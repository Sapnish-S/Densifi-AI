"""
Densify AI pipeline: two-stage vision analysis, lab-report OCR and chat companion.

Prompts, temperatures and max_tokens are fixed per stage. Transport goes through
llm_provider (Anthropic by default, Bedrock selectable). Vault images are read from
S3-compatible object storage (Akamai Object Storage in production, SeaweedFS locally).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from llm_provider import RECOVERABLE_CODES, ProviderError, get_provider

logger = logging.getLogger("densify.analyzer")

S3_BUCKET = os.getenv("S3_BUCKET") or "densify-vault-storage"

CLAUDE_SYSTEM_PROMPT = """You are an elite board-certified trichologist and computational hair-follicle specialist with 20+ years of clinical experience in diagnosing and tracking androgenetic alopecia and other hair-loss pathologies.

Your task is to perform a rigorous, quantitative spatial analysis comparing two provided scalp photographs (Baseline and Current). You must extract three precise numerical metrics reflecting the current state and provide a concise clinical narrative of the progress.

ANALYSIS PROTOCOL:
1. HAIR DENSITY ASSESSMENT: Examine the visible scalp area in the Current photo and estimate the percentage of scalp surface covered by terminal hair follicles. Express this as a density_percentage from 0 (completely bald) to 100 (full terminal coverage).

2. MINIATURIZATION INDEX: Assess the proportion of follicles in the Current photo that appear miniaturized (thin, fine, or vellus-like) compared to healthy terminal follicles. Express this as a miniaturization_index from 0.0 (no miniaturization, fully healthy) to 1.0 (complete miniaturization, all follicles affected).

3. CLINICAL SUMMARY: Write a single, precise clinical paragraph (3–5 sentences) describing the observed changes between the Baseline and Current photos, including follicular state, distribution pattern, visible scalp landmarks, and any notable improvements or regressions consistent with hair-loss staging.

CRITICAL INSTRUCTION: Output ONLY your raw clinical analysis text. Do NOT format as JSON. Do NOT include any preamble like "Here is my analysis". Begin directly with your clinical findings."""

NOVA_SYSTEM_PROMPT = """You are a precise clinical data extraction and formatting utility. Your sole function is to parse unstructured trichological clinical assessment text and output a single, valid JSON object.

You MUST extract exactly these three keys from the clinical text provided:

- "miniaturization_index": A float between 0.0 and 1.0 representing follicular miniaturization severity.
- "density_percentage": A float between 0.0 and 100.0 representing scalp hair coverage.
- "clinical_summary": A concise string (1–3 sentences) summarising the clinical findings for patient-facing display.

STRICT RULES:
1. Output ONLY a raw JSON object. No markdown fences. No explanation. No preamble.
2. All numeric values must be valid floats (not strings).
3. If a value cannot be reliably extracted from the text, use these safe defaults: miniaturization_index=0.5, density_percentage=50.0.
4. The clinical_summary must be written in clear, patient-friendly language.

Your entire response must be parseable by Python's json.loads() without any preprocessing."""

LAB_PROMPT = """You are an advanced clinical data extraction and formatting utility. Your sole function is to parse unstructured, tabular, or messy lab report text (including paragraphs and dense text) and output a single, valid JSON object.

EXTRACTION PROTOCOL:
1. MARKER IDENTIFICATION: You must scan the document for the following markers, including their common synonyms, abbreviations, and ALL CAPS variations. Be completely case-insensitive:
   - "Dihydrotestosterone (DHT)", "DHT"
   - "Testosterone, Free", "Free Testosterone", "FREE TESTOSTERONE"
   - "Ferritin", "FERRITIN"
2. IGNORE DECOYS: Do not extract values for "Total Testosterone" or "Iron, Serum". Only extract the markers listed in step 1.
3. CONTEXT-AWARE EXTRACTION: The values may be located in clean tabular "Result" columns OR embedded within narrative paragraphs or clinical summaries. Look closely for text like "FERRITIN LEVELS ARE LOW AT 15 ng/mL". Extract the numerical value associated with the marker regardless of layout format.
4. STRICT JSON OUTPUT: Return ONLY a valid JSON object matching the exact schema below, with no markdown formatting (no ```json fences), no conversational text, and no explanation.

SCHEMA:
{
  "dht": float,
  "free_t": float,
  "ferritin": float
}

CRITICAL RULES:
- If a value is truly missing from the report, you MUST return `null` for that specific key.
- All extracted numeric values must be valid floats (not strings).
- Your entire response must be strictly parseable by Python's `json.loads()` without any preprocessing."""

CHAT_PROMPT = """You are an elite, empathetic board-certified trichologist and hair-loss specialist.
A patient is asking you a question about their hair progress, protocol, or a photo they just uploaded.
Respond helpfully, concisely (2-4 sentences max), and maintain a professional yet warm clinical tone.
If they ask about an uploaded photo, assume they uploaded one to the Vault. Keep it brief.
Do not output JSON, just your conversational text response."""

VISION_INSTRUCTION = (
    "Perform your full trichological spatial analysis comparing these two scalp images. "
    "Extract density_percentage, miniaturization_index, and clinical_summary as described in your protocol."
)
FORMATTER_PREFIX = "Parse the following clinical assessment and output the structured JSON object as instructed:\n\n"
LAB_INSTRUCTION = "Extract the DHT, Free Testosterone, and Ferritin values from this lab report as instructed."

MISSING_OBJECT_CODES = {"NoSuchKey", "AccessDenied", "NoSuchBucket"}
MISSING_OBJECT_MESSAGE = "Image not found or access denied for one of the keys. Verify the S3 keys and IAM permissions."

# PHI hygiene: raw lab OCR text is only logged when LOG_LAB_OCR_TEXT=true.
LOG_LAB_OCR_TEXT = os.getenv("LOG_LAB_OCR_TEXT", "false").lower() == "true"


@dataclass
class AnalysisResult:
    miniaturization_index: float
    density_percentage: float
    clinical_summary: str
    raw_vision_output: str
    model_chain: list[str]


@dataclass
class AnalysisError:
    error: bool
    error_code: str
    error_message: str
    recoverable: bool


@dataclass
class LabResult:
    dht: Optional[float]
    free_t: Optional[float]
    ferritin: Optional[float]


def _s3_client():
    """New client per call. Endpoint + path-style for S3-compatible stores."""
    endpoint = os.getenv("S3_ENDPOINT") or None
    path_style = os.getenv("S3_FORCE_PATH_STYLE", "true" if endpoint else "false").lower() == "true"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=os.getenv("S3_REGION") or "us-ord",
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        config=Config(
            s3={"addressing_style": "path" if path_style else "virtual"},
            signature_version="s3v4",
            # S3-compatible stores: send/validate checksums only when required.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def image_format(key: str, data: bytes = b"") -> str:
    """png | jpeg | webp | gif — sniffed from the bytes, falling back to the key's extension."""
    if data.startswith(b"\x89PNG"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"GIF8"):
        return "gif"
    ext = key.lower().rsplit(".", 1)[-1]
    return {"png": "png", "webp": "webp", "gif": "gif"}.get(ext, "jpeg")


def extract_json_object(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No JSON object found in model output: {text[:200]}")
    return json.loads(text[start : end + 1])


def _client_error(code: str, message: str) -> AnalysisError:
    if code in MISSING_OBJECT_CODES:
        return AnalysisError(True, code, MISSING_OBJECT_MESSAGE, False)
    return AnalysisError(True, code, message, code in RECOVERABLE_CODES)


def _map_exception(exc: Exception) -> AnalysisError:
    if isinstance(exc, ClientError):
        err = exc.response.get("Error", {})
        return _client_error(err.get("Code", "ClientError"), err.get("Message", str(exc)))
    if isinstance(exc, ProviderError):
        return _client_error(exc.code, exc.message)
    if isinstance(exc, ValueError):
        return AnalysisError(True, "PARSE_ERROR", str(exc), False)
    return AnalysisError(True, "INTERNAL_ERROR", f"Unexpected error: {type(exc).__name__}: {exc}", False)


def analyze_vault_image(baseline_s3_key: str, current_s3_key: str) -> dict:
    """Returns AnalysisResult or AnalysisError as a dict."""
    try:
        s3 = _s3_client()
        baseline = s3.get_object(Bucket=S3_BUCKET, Key=baseline_s3_key)["Body"].read()
        current = s3.get_object(Bucket=S3_BUCKET, Key=current_s3_key)["Body"].read()

        provider = get_provider()
        raw = provider.vision_compare(
            CLAUDE_SYSTEM_PROMPT,
            baseline, image_format(baseline_s3_key, baseline),
            current, image_format(current_s3_key, current),
            VISION_INSTRUCTION,
            max_tokens=1024,
            temperature=0.1,
        )
        logger.info("Vision stage complete (%s chars)", len(raw))

        formatted = provider.format_json(NOVA_SYSTEM_PROMPT, FORMATTER_PREFIX + raw, max_tokens=512, temperature=0.0)
        parsed = extract_json_object(formatted)

        return asdict(AnalysisResult(
            miniaturization_index=float(parsed.get("miniaturization_index", 0.5)),
            density_percentage=float(parsed.get("density_percentage", 50.0)),
            clinical_summary=str(parsed.get("clinical_summary", "Analysis unavailable.")),
            raw_vision_output=raw,
            model_chain=[provider.vision_model_id, provider.fast_model_id],
        ))
    except Exception as exc:  # mapped to the structured error contract
        logger.error("analyze_vault_image failed: %s", exc)
        return asdict(_map_exception(exc))


def analyze_lab_report(pdf_bytes: bytes) -> dict:
    try:
        provider = get_provider()
        raw_text = provider.extract_lab(LAB_PROMPT, pdf_bytes, LAB_INSTRUCTION, temperature=0.0, max_tokens=None)
        if LOG_LAB_OCR_TEXT:
            logger.info("Lab OCR raw text: %s", raw_text)
        data = extract_json_object(raw_text)
        return asdict(LabResult(dht=data.get("dht"), free_t=data.get("free_t"), ferritin=data.get("ferritin")))
    except Exception as exc:
        logger.error("analyze_lab_report failed: %s", exc)
        return asdict(_map_exception(exc))


def merge_chat_history(user_message: str, history: list[dict]) -> list[dict]:
    """Merge rules from 09 §5: collapse consecutive roles, ensure the user message is
    last, and drop leading assistant turns (conversations must start with user)."""
    merged: list[dict] = []
    for msg in history or []:
        role = msg.get("role") if msg.get("role") in ("user", "assistant") else "user"
        content = msg.get("content", "")
        if merged and merged[-1]["role"] == role:
            merged[-1]["text"] += "\n\n" + content
        else:
            merged.append({"role": role, "text": content})

    if not merged or merged[-1]["role"] != "user" or not merged[-1]["text"].endswith(user_message):
        if merged and merged[-1]["role"] == "user":
            merged[-1]["text"] += "\n\n" + user_message
        else:
            merged.append({"role": "user", "text": user_message})

    while merged and merged[0]["role"] != "user":
        merged.pop(0)
    return merged


def chat_with_agent(user_message: str, history: list[dict]) -> str:
    try:
        messages = merge_chat_history(user_message, history)
        return get_provider().chat(CHAT_PROMPT, messages, max_tokens=256, temperature=0.5)
    except Exception as exc:
        logger.error("chat_with_agent failed: %s", exc)
        return f"Error: {exc}"
