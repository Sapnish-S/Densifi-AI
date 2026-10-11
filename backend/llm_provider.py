"""
LLM provider abstraction for the Densify Core Engine.

Two transports: the Anthropic API (default) and AWS Bedrock's Converse API (Claude
Sonnet 5.5 for vision/OCR, Amazon Nova Lite for JSON formatting and chat), selectable
with LLM_PROVIDER=bedrock.

Prompts, temperatures and max_tokens are passed in by analyzer.py so this module only
owns transport. Claude 5.5 models reject non-default sampling parameters, so Claude
requests drop `temperature` (Nova still gets it) and run at low effort with extra
max_tokens headroom, because adaptive thinking counts toward max_tokens.

Error contract: providers raise ProviderError(code, message). Codes use the AWS
error-code vocabulary, so the structured error body
({error, error_code, error_message, recoverable}) and its 422/503 status mapping stay
identical regardless of provider.
"""

from __future__ import annotations

import base64
import logging
import os
import re
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger("densify.llm")

# Codes the analyzer treats as recoverable (→ HTTP 503).
RECOVERABLE_CODES = {"ThrottlingException", "ServiceUnavailableException", "TooManyRequestsException"}

# Claude 5.5 thinks by default and thinking tokens count toward max_tokens; analyzer.py's
# caps are sized for the visible reply, so Claude requests get this much on top.
CLAUDE_EFFORT = "low"
THINKING_HEADROOM = 2048


class ProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class LLMProvider(ABC):
    """Interface used by analyzer.py."""

    vision_model_id: str
    fast_model_id: str

    @abstractmethod
    def vision_compare(
        self,
        system_prompt: str,
        baseline_bytes: bytes,
        baseline_format: str,
        current_bytes: bytes,
        current_format: str,
        instruction: str,
        max_tokens: int,
        temperature: float,
    ) -> str: ...

    @abstractmethod
    def format_json(self, system_prompt: str, text: str, max_tokens: int, temperature: float) -> str: ...

    @abstractmethod
    def extract_lab(
        self, system_prompt: str, pdf_bytes: bytes, instruction: str, temperature: float, max_tokens: Optional[int]
    ) -> str: ...

    @abstractmethod
    def chat(self, system_prompt: str, messages: list[dict], max_tokens: int, temperature: float) -> str:
        """messages: [{"role": "user"|"assistant", "text": str}] — already merged/alternating."""


# ── Anthropic API (default) ───────────────────────────────────────────────────


class AnthropicProvider(LLMProvider):
    # The Bedrock Converse API applied the model's default max output when no
    # maxTokens was given (lab OCR). The Messages API requires max_tokens, so the
    # lab call uses this ceiling; the JSON it produces is tiny.
    LAB_DEFAULT_MAX_TOKENS = 4096

    def __init__(self) -> None:
        import anthropic

        self._anthropic = anthropic
        self.vision_model_id = os.getenv("LLM_VISION_MODEL", "claude-sonnet-5-5")
        self.fast_model_id = os.getenv("LLM_FAST_MODEL", "claude-haiku-5-5")
        # boto3's default read timeout was 60 s; keep the same ceiling per attempt.
        self._client = anthropic.Anthropic(timeout=60.0)

    @staticmethod
    def _text(response) -> str:
        return " ".join(block.text for block in response.content if block.type == "text").strip()

    def _create(self, max_tokens: int, **kwargs) -> str:
        a = self._anthropic
        try:
            response = self._client.messages.create(
                max_tokens=max_tokens + THINKING_HEADROOM,
                output_config={"effort": CLAUDE_EFFORT},
                **kwargs,
            )
        except a.RateLimitError as exc:
            raise ProviderError("ThrottlingException", exc.message) from exc
        except a.AuthenticationError as exc:
            raise ProviderError("AccessDeniedException", exc.message) from exc
        except a.PermissionDeniedError as exc:
            raise ProviderError("AccessDeniedException", exc.message) from exc
        except a.NotFoundError as exc:
            raise ProviderError("ResourceNotFoundException", exc.message) from exc
        except a.BadRequestError as exc:
            raise ProviderError("ValidationException", exc.message) from exc
        except a.InternalServerError as exc:  # 5xx incl. 529 overloaded
            raise ProviderError("ServiceUnavailableException", exc.message) from exc
        except a.APIStatusError as exc:
            raise ProviderError("ModelErrorException", exc.message) from exc
        except a.APIConnectionError as exc:
            raise ProviderError("ServiceUnavailableException", str(exc)) from exc
        if getattr(response, "stop_reason", None) == "refusal":
            raise ProviderError("ValidationException", "The model declined this request.")
        return self._text(response)

    def vision_compare(self, system_prompt, baseline_bytes, baseline_format, current_bytes, current_format,
                       instruction, max_tokens, temperature) -> str:
        def image_block(data: bytes, fmt: str) -> dict:
            return {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": f"image/{fmt}",
                    "data": base64.b64encode(data).decode("ascii"),
                },
            }

        return self._create(
            model=self.vision_model_id,
            system=system_prompt,
            max_tokens=max_tokens,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Image 1: Baseline (Day 1)"},
                    image_block(baseline_bytes, baseline_format),
                    {"type": "text", "text": "Image 2: Current (Latest Progress)"},
                    image_block(current_bytes, current_format),
                    {"type": "text", "text": instruction},
                ],
            }],
        )

    def format_json(self, system_prompt, text, max_tokens, temperature) -> str:
        return self._create(
            model=self.fast_model_id,
            system=system_prompt,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": text}],
        )

    def extract_lab(self, system_prompt, pdf_bytes, instruction, temperature, max_tokens) -> str:
        return self._create(
            model=self.vision_model_id,
            system=system_prompt,
            max_tokens=max_tokens or self.LAB_DEFAULT_MAX_TOKENS,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": base64.b64encode(pdf_bytes).decode("ascii"),
                        },
                    },
                    {"type": "text", "text": instruction},
                ],
            }],
        )

    def chat(self, system_prompt, messages, max_tokens, temperature) -> str:
        return self._create(
            model=self.fast_model_id,
            system=system_prompt,
            max_tokens=max_tokens,
            messages=[{"role": m["role"], "content": m["text"]} for m in messages],
        )


# ── AWS Bedrock ───────────────────────────────────────────────────────────────────────────────────────


class BedrockProvider(LLMProvider):
    def __init__(self) -> None:
        import boto3

        self.vision_model_id = os.getenv("LLM_VISION_MODEL", "us.anthropic.claude-sonnet-5-5")
        self.fast_model_id = os.getenv("LLM_FAST_MODEL", "us.amazon.nova-lite-v1:0")
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-2"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )

    def _claude_fields(self) -> dict:
        # `effort` is Claude 5.x only; Sonnet 4.5 (the fallback while 5.5 access is pending) rejects it.
        if re.search(r"claude-[a-z]+-5", self.vision_model_id):
            return {"additionalModelRequestFields": {"output_config": {"effort": CLAUDE_EFFORT}}}
        return {}

    def _converse(self, **kwargs) -> str:
        from botocore.exceptions import ClientError

        try:
            response = self._client.converse(**kwargs)
        except ClientError as exc:
            err = exc.response.get("Error", {})
            raise ProviderError(err.get("Code", "ClientError"), err.get("Message", str(exc))) from exc
        blocks = response["output"]["message"]["content"]
        return " ".join(b["text"] for b in blocks if "text" in b).strip()

    def vision_compare(self, system_prompt, baseline_bytes, baseline_format, current_bytes, current_format,
                       instruction, max_tokens, temperature) -> str:
        return self._converse(
            modelId=self.vision_model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [
                {"text": "Image 1: Baseline (Day 1)"},
                {"image": {"format": baseline_format, "source": {"bytes": baseline_bytes}}},
                {"text": "Image 2: Current (Latest Progress)"},
                {"image": {"format": current_format, "source": {"bytes": current_bytes}}},
                {"text": instruction},
            ]}],
            inferenceConfig={"maxTokens": max_tokens + THINKING_HEADROOM},
            **self._claude_fields(),
        )

    def format_json(self, system_prompt, text, max_tokens, temperature) -> str:
        return self._converse(
            modelId=self.fast_model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": text}]}],
            inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
        )

    def extract_lab(self, system_prompt, pdf_bytes, instruction, temperature, max_tokens) -> str:
        # No maxTokens → Bedrock applies the model's default max output.
        config: dict = {"maxTokens": max_tokens + THINKING_HEADROOM} if max_tokens else {}
        return self._converse(
            modelId=self.vision_model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [
                {"document": {"name": "report", "format": "pdf", "source": {"bytes": pdf_bytes}}},
                {"text": instruction},
            ]}],
            inferenceConfig=config,
            **self._claude_fields(),
        )

    def chat(self, system_prompt, messages, max_tokens, temperature) -> str:
        return self._converse(
            modelId=self.fast_model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": m["role"], "content": [{"text": m["text"]}]} for m in messages],
            inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
        )


# ── Deterministic mock (local E2E / CI without an API key; never the default) ──


class MockProvider(LLMProvider):
    vision_model_id = "mock-vision"
    fast_model_id = "mock-fast"

    def vision_compare(self, system_prompt, baseline_bytes, baseline_format, current_bytes, current_format,
                       instruction, max_tokens, temperature) -> str:
        return ("Mock clinical assessment: density_percentage 62.5, miniaturization_index 0.31. "
                "Follicular density appears improved at the crown with reduced miniaturization.")

    def format_json(self, system_prompt, text, max_tokens, temperature) -> str:
        return ('{"miniaturization_index": 0.31, "density_percentage": 62.5, '
                '"clinical_summary": "Your scalp shows improved coverage with thicker follicles since baseline."}')

    def extract_lab(self, system_prompt, pdf_bytes, instruction, temperature, max_tokens) -> str:
        if not pdf_bytes.startswith(b"%PDF"):
            raise ProviderError("ValidationException", "The document is not a valid PDF.")
        return '{"dht": 42.5, "free_t": 12.75, "ferritin": 88.0}'

    def chat(self, system_prompt, messages, max_tokens, temperature) -> str:
        return f"Mock trichologist reply to: {messages[-1]['text'][-80:]}"


_provider: Optional[LLMProvider] = None


def get_provider() -> LLMProvider:
    """Module singleton."""
    global _provider
    if _provider is None:
        name = os.getenv("LLM_PROVIDER", "anthropic").strip().lower()
        if name == "bedrock":
            _provider = BedrockProvider()
        elif name == "mock":
            _provider = MockProvider()
        else:
            _provider = AnthropicProvider()
        logger.info("LLM provider initialised: %s (%s, %s)", name, _provider.vision_model_id, _provider.fast_model_id)
    return _provider


def set_provider(provider: Optional[LLMProvider]) -> None:
    """Test hook: inject a fake provider."""
    global _provider
    _provider = provider
