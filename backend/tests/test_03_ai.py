"""AI pipeline (09 §3–5, 15 §4 items 3–4). LLM and object storage are faked."""

import base64

import pytest
from botocore.exceptions import ClientError

import analyzer
import llm_provider
from llm_provider import THINKING_HEADROOM, AnthropicProvider, LLMProvider, ProviderError

pytestmark = pytest.mark.s3_bedrock


class FakeBody:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data


class FakeS3:
    def __init__(self, objects=None, error_code=None):
        self.objects = objects or {}
        self.error_code = error_code
        self.calls = []

    def get_object(self, Bucket, Key):
        self.calls.append((Bucket, Key))
        if self.error_code or Key not in self.objects:
            code = self.error_code or "NoSuchKey"
            raise ClientError({"Error": {"Code": code, "Message": "The specified key does not exist."}}, "GetObject")
        return {"Body": FakeBody(self.objects[Key])}


class RecordingProvider(LLMProvider):
    vision_model_id = "claude-sonnet-5-5"
    fast_model_id = "claude-haiku-5-5"

    def __init__(self, formatted='{"miniaturization_index": 0.42, "density_percentage": 58.0, "clinical_summary": "Better."}', raise_on=None):
        self.formatted, self.raise_on, self.calls = formatted, raise_on, []

    def _maybe_raise(self, stage):
        if self.raise_on and self.raise_on[0] == stage:
            raise self.raise_on[1]

    def vision_compare(self, *args, **kwargs):
        self.calls.append(("vision", args, kwargs))
        self._maybe_raise("vision")
        return "Raw clinical text."

    def format_json(self, *args, **kwargs):
        self.calls.append(("format", args, kwargs))
        self._maybe_raise("format")
        return "Sure! " + self.formatted + " done"

    def extract_lab(self, *args, **kwargs):
        self.calls.append(("lab", args, kwargs))
        self._maybe_raise("lab")
        return '```json\n{"dht": 42.5, "free_t": null, "ferritin": 15.0}\n```'

    def chat(self, *args, **kwargs):
        self.calls.append(("chat", args, kwargs))
        self._maybe_raise("chat")
        return "Hello from the agent."


@pytest.fixture()
def fake_s3(monkeypatch):
    s3 = FakeS3({"vault/u/2026-01/Front/a.png": b"PNG1", "vault/u/2026-02/Front/b.jpeg": b"JPG2"})
    monkeypatch.setattr(analyzer, "_s3_client", lambda: s3)
    return s3


@pytest.fixture()
def provider():
    p = RecordingProvider()
    llm_provider.set_provider(p)
    yield p
    llm_provider.set_provider(None)


BODY = {"user_id": "u", "baseline_s3_key": "vault/u/2026-01/Front/a.png", "current_s3_key": "vault/u/2026-02/Front/b.jpeg"}


def test_analyze_success_schema(client, fake_s3, provider):
    res = client.post("/analyze", json=BODY)
    assert res.status_code == 200
    assert res.json() == {
        "miniaturization_index": 0.42, "density_percentage": 58.0, "clinical_summary": "Better.",
        "raw_vision_output": "Raw clinical text.",
        "model_chain": ["claude-sonnet-5-5", "claude-haiku-5-5"],
    }
    vision = provider.calls[0]
    assert vision[1][0] == analyzer.CLAUDE_SYSTEM_PROMPT
    assert vision[1][1:5] == (b"PNG1", "png", b"JPG2", "jpeg")  # format from extension
    assert vision[2] == {"max_tokens": 1024, "temperature": 0.1}
    fmt = provider.calls[1]
    assert fmt[1] == (analyzer.NOVA_SYSTEM_PROMPT, analyzer.FORMATTER_PREFIX + "Raw clinical text.")
    assert fmt[2] == {"max_tokens": 512, "temperature": 0.0}
    assert fake_s3.calls == [("densify-vault-storage", BODY["baseline_s3_key"]), ("densify-vault-storage", BODY["current_s3_key"])]


def test_analyze_defaults_when_keys_missing(client, fake_s3):
    llm_provider.set_provider(RecordingProvider(formatted="{}"))
    try:
        body = client.post("/analyze", json=BODY).json()
        assert (body["miniaturization_index"], body["density_percentage"], body["clinical_summary"]) == (0.5, 50.0, "Analysis unavailable.")
    finally:
        llm_provider.set_provider(None)


def test_analyze_missing_object_422(client, provider, monkeypatch):
    monkeypatch.setattr(analyzer, "_s3_client", lambda: FakeS3({}))
    res = client.post("/analyze", json={**BODY, "current_s3_key": "../../etc/passwd"})
    assert res.status_code == 422
    assert res.json() == {
        "error": True, "error_code": "NoSuchKey",
        "error_message": "Image not found or access denied for one of the keys. Verify the S3 keys and IAM permissions.",
        "recoverable": False,
    }


def test_analyze_throttling_503(client, fake_s3):
    llm_provider.set_provider(RecordingProvider(raise_on=("vision", ProviderError("ThrottlingException", "Rate exceeded"))))
    try:
        res = client.post("/analyze", json=BODY)
        assert res.status_code == 503
        assert res.json() == {"error": True, "error_code": "ThrottlingException", "error_message": "Rate exceeded", "recoverable": True}
    finally:
        llm_provider.set_provider(None)


def test_analyze_validation_error_422(client, fake_s3):
    llm_provider.set_provider(RecordingProvider(raise_on=("vision", ProviderError("ValidationException", "bad image"))))
    try:
        res = client.post("/analyze", json=BODY)
        assert res.status_code == 422 and res.json()["recoverable"] is False
    finally:
        llm_provider.set_provider(None)


def test_analyze_malformed_json_parse_error(client, fake_s3):
    llm_provider.set_provider(RecordingProvider(formatted="not json at all"))
    try:
        res = client.post("/analyze", json=BODY)
        assert res.status_code == 422
        assert res.json()["error_code"] == "PARSE_ERROR" and res.json()["recoverable"] is False
    finally:
        llm_provider.set_provider(None)


def test_analyze_unexpected_error(client, fake_s3):
    llm_provider.set_provider(RecordingProvider(raise_on=("vision", RuntimeError("boom"))))
    try:
        res = client.post("/analyze", json=BODY)
        assert res.status_code == 422
        assert res.json()["error_code"] == "INTERNAL_ERROR"
        assert res.json()["error_message"] == "Unexpected error: RuntimeError: boom"
    finally:
        llm_provider.set_provider(None)


def test_image_format_sniffs_bytes_before_extension():
    assert analyzer.image_format("a.png", b"\xff\xd8\xff\xe0rest") == "jpeg"  # re-encoded JPEG under a .png key
    assert analyzer.image_format("a.jpg", b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "webp"
    assert analyzer.image_format("a.jpg", b"\x89PNG\r\n\x1a\n") == "png"
    assert analyzer.image_format("a.webp", b"??") == "webp"
    assert analyzer.image_format("a.bin") == "jpeg"


def test_analyze_obsolete_s3_key_body_422(client):
    """The unused server-action proxy sends {user_id, s3_key} → Pydantic 422 (U27)."""
    assert client.post("/analyze", json={"user_id": "u", "s3_key": "x"}).status_code == 422


def test_analyze_lab_success_and_params(client, provider):
    data_url = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 test").decode()
    res = client.post("/analyze-lab", json={"user_id": "u", "data_url": data_url})
    assert res.status_code == 200
    assert res.json() == {"dht": 42.5, "free_t": None, "ferritin": 15.0}
    lab = provider.calls[0]
    assert lab[1] == (analyzer.LAB_PROMPT, b"%PDF-1.4 test", analyzer.LAB_INSTRUCTION)
    assert lab[2] == {"temperature": 0.0, "max_tokens": None, "doc_format": "pdf"}


@pytest.mark.parametrize(
    "data, fmt",
    [(b"\x89PNG\r\n", "png"), (b"\xff\xd8\xff\xe0", "jpeg"), (b"GIF89a", "gif"), (b"RIFF\0\0\0\0WEBPVP8 ", "webp")],
)
def test_analyze_lab_accepts_report_images(client, provider, data, fmt):
    data_url = f"data:image/{fmt};base64," + base64.b64encode(data).decode()
    res = client.post("/analyze-lab", json={"user_id": "u", "data_url": data_url})
    assert res.status_code == 200
    assert provider.calls[0][2]["doc_format"] == fmt


def test_analyze_lab_rejects_unsupported_files(client, provider):
    data_url = "data:text/plain;base64," + base64.b64encode(b"DHT 42").decode()
    res = client.post("/analyze-lab", json={"user_id": "u", "data_url": data_url})
    assert res.status_code == 422
    assert res.json()["error_code"] == "UNSUPPORTED_FILE"
    assert provider.calls == []


def test_analyze_lab_raw_base64_and_bad_base64(client, provider):
    raw = base64.b64encode(b"%PDF-raw").decode()
    assert client.post("/analyze-lab", json={"user_id": "u", "data_url": raw}).status_code == 200
    bad = client.post("/analyze-lab", json={"user_id": "u", "data_url": "data:application/pdf;base64,abcde"})
    assert bad.status_code == 500 and "detail" in bad.json()


def test_chat_reply_and_params(client, provider):
    res = client.post("/agent-chat", json={"user_id": "u", "message": "How is my crown?", "history": []})
    assert res.json() == {"reply": "Hello from the agent."}
    chat = provider.calls[0]
    assert chat[1][0] == analyzer.CHAT_PROMPT
    assert chat[1][1] == [{"role": "user", "text": "How is my crown?"}]
    assert chat[2] == {"max_tokens": 256, "temperature": 0.5}


def test_chat_failure_returns_error_reply(client):
    """Known behaviour: model failure → 200 {"reply": "Error: …"}."""
    llm_provider.set_provider(RecordingProvider(raise_on=("chat", RuntimeError("model down"))))
    try:
        res = client.post("/agent-chat", json={"user_id": "u", "message": "hi"})
        assert res.status_code == 200 and res.json() == {"reply": "Error: model down"}
    finally:
        llm_provider.set_provider(None)


# ── Chat history merge rules (09 §5) ─────────────────────────────────────────


def test_merge_consecutive_roles():
    merged = analyzer.merge_chat_history("q2", [
        {"role": "user", "content": "q1"}, {"role": "user", "content": "more"},
        {"role": "assistant", "content": "a1"}, {"role": "assistant", "content": "a1b"},
        {"role": "user", "content": "q2"},
    ])
    assert merged == [
        {"role": "user", "text": "q1\n\nmore"},
        {"role": "assistant", "text": "a1\n\na1b"},
        {"role": "user", "text": "q2"},
    ]


def test_merge_drops_leading_assistant_and_maps_unknown_roles():
    merged = analyzer.merge_chat_history("q", [
        {"role": "assistant", "content": '{"miniaturization_index": 0.4}'},
        {"role": "system", "content": "s"},
    ])
    assert merged == [{"role": "user", "text": "s\n\nq"}]


def test_merge_does_not_duplicate_user_message():
    merged = analyzer.merge_chat_history("hello", [{"role": "user", "content": "hello"}])
    assert merged == [{"role": "user", "text": "hello"}]


def test_merge_appends_when_last_is_assistant():
    merged = analyzer.merge_chat_history("next", [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}])
    assert merged[-1] == {"role": "user", "text": "next"}


def test_merge_empty_history():
    assert analyzer.merge_chat_history("hi", []) == [{"role": "user", "text": "hi"}]


# ── Anthropic adapter request shape ──────────────────────────────────────────


class Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class FakeMessages:
    def __init__(self):
        self.kwargs = []

    def create(self, **kwargs):
        self.kwargs.append(kwargs)
        return type("Resp", (), {"content": [Block("part one"), Block("part two")]})()


@pytest.fixture()
def anthropic_provider(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("LLM_VISION_MODEL", raising=False)
    monkeypatch.delenv("LLM_FAST_MODEL", raising=False)
    p = AnthropicProvider()
    fake = FakeMessages()
    p._client = type("C", (), {"messages": fake})()
    return p, fake


def test_anthropic_vision_request(anthropic_provider):
    p, fake = anthropic_provider
    out = p.vision_compare("SYS", b"\x89PNG", "png", b"\xff\xd8", "jpeg", "INSTR", max_tokens=1024, temperature=0.1)
    assert out == "part one part two"
    kw = fake.kwargs[0]
    assert kw["model"] == "claude-sonnet-5-5"
    assert (kw["system"], kw["max_tokens"], kw["output_config"]) == ("SYS", 1024 + THINKING_HEADROOM, {"effort": "low"})
    assert "temperature" not in kw  # Claude 5.5 rejects non-default sampling params
    content = kw["messages"][0]["content"]
    assert [c["type"] for c in content] == ["text", "image", "text", "image", "text"]
    assert content[0]["text"] == "Image 1: Baseline (Day 1)" and content[2]["text"] == "Image 2: Current (Latest Progress)"
    assert content[1]["source"] == {"type": "base64", "media_type": "image/png", "data": base64.b64encode(b"\x89PNG").decode()}
    assert content[3]["source"]["media_type"] == "image/jpeg"


def test_anthropic_formatter_chat_and_lab_requests(anthropic_provider):
    p, fake = anthropic_provider
    p.format_json("NOVA", "text", max_tokens=512, temperature=0.0)
    p.chat("CHAT", [{"role": "user", "text": "a"}, {"role": "assistant", "text": "b"}, {"role": "user", "text": "c"}], 256, 0.5)
    p.extract_lab("LAB", b"%PDF", "INSTR", temperature=0.0, max_tokens=None)
    fmt, chat, lab = fake.kwargs
    assert (fmt["model"], fmt["max_tokens"]) == ("claude-haiku-5-5", 512 + THINKING_HEADROOM)
    assert chat["model"] == "claude-haiku-5-5" and chat["max_tokens"] == 256 + THINKING_HEADROOM
    assert chat["messages"] == [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}, {"role": "user", "content": "c"}]
    assert lab["model"] == "claude-sonnet-5-5" and lab["max_tokens"] == 4096 + THINKING_HEADROOM
    assert all("temperature" not in kw for kw in fake.kwargs)
    doc = lab["messages"][0]["content"][0]
    assert doc == {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.b64encode(b"%PDF").decode()}}

    p.extract_lab("LAB", b"\x89PNG", "INSTR", 0.0, None, doc_format="png")
    img = fake.kwargs[-1]["messages"][0]["content"][0]
    assert img == {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(b"\x89PNG").decode()}}


def test_provider_selection(monkeypatch):
    llm_provider.set_provider(None)
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    assert isinstance(llm_provider.get_provider(), llm_provider.MockProvider)
    llm_provider.set_provider(None)
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    assert isinstance(llm_provider.get_provider(), AnthropicProvider)
    llm_provider.set_provider(None)


# ── Bedrock adapter (team deploys with LLM_PROVIDER=bedrock): Converse request shape ──


class FakeBedrock:
    def __init__(self):
        self.kwargs = []

    def converse(self, **kwargs):
        self.kwargs.append(kwargs)
        return {"output": {"message": {"content": [{"text": "a"}, {"text": "b"}]}}}


@pytest.fixture()
def bedrock_provider(monkeypatch):
    monkeypatch.delenv("LLM_VISION_MODEL", raising=False)
    monkeypatch.delenv("LLM_FAST_MODEL", raising=False)
    p = llm_provider.BedrockProvider()
    p._client = FakeBedrock()
    return p, p._client


def test_bedrock_request_shape(bedrock_provider):
    p, fake = bedrock_provider
    assert p.vision_compare("SYS", b"1", "png", b"2", "jpeg", "INSTR", 1024, 0.1) == "a b"
    p.format_json("NOVA", "txt", 512, 0.0)
    p.extract_lab("LAB", b"%PDF", "INSTR", 0.0, None)
    p.chat("CHAT", [{"role": "user", "text": "hi"}], 256, 0.5)
    vision, fmt, lab, chat = fake.kwargs
    assert vision["modelId"] == "us.anthropic.claude-sonnet-5-5"
    assert vision["system"] == [{"text": "SYS"}]
    assert vision["messages"][0]["content"] == [
        {"text": "Image 1: Baseline (Day 1)"}, {"image": {"format": "png", "source": {"bytes": b"1"}}},
        {"text": "Image 2: Current (Latest Progress)"}, {"image": {"format": "jpeg", "source": {"bytes": b"2"}}},
        {"text": "INSTR"},
    ]
    assert vision["inferenceConfig"] == {"maxTokens": 1024 + THINKING_HEADROOM}
    assert vision["additionalModelRequestFields"] == {"output_config": {"effort": "low"}}
    assert fmt["modelId"] == "us.amazon.nova-lite-v1:0" and fmt["inferenceConfig"] == {"maxTokens": 512, "temperature": 0.0}
    assert lab["messages"][0]["content"][0] == {"document": {"name": "report", "format": "pdf", "source": {"bytes": b"%PDF"}}}
    assert lab["inferenceConfig"] == {}  # Bedrock default max tokens
    assert chat["modelId"] == "us.amazon.nova-lite-v1:0" and chat["inferenceConfig"] == {"maxTokens": 256, "temperature": 0.5}

    p.extract_lab("LAB", b"\xff\xd8\xff", "INSTR", 0.0, None, doc_format="jpeg")
    assert fake.kwargs[-1]["messages"][0]["content"][0] == {"image": {"format": "jpeg", "source": {"bytes": b"\xff\xd8\xff"}}}


def test_bedrock_sonnet_4_5_omits_effort(monkeypatch):
    monkeypatch.setenv("LLM_VISION_MODEL", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
    p = llm_provider.BedrockProvider()
    p._client = fake = FakeBedrock()
    p.vision_compare("SYS", b"1", "png", b"2", "jpeg", "INSTR", 1024, 0.1)
    p.extract_lab("LAB", b"%PDF", "INSTR", 0.0, None)
    assert all("additionalModelRequestFields" not in kw for kw in fake.kwargs)


def test_bedrock_client_error_maps_to_structured_error(client, fake_s3, bedrock_provider):
    p, fake = bedrock_provider

    def boom(**kwargs):
        raise ClientError({"Error": {"Code": "ThrottlingException", "Message": "Too many tokens"}}, "Converse")

    fake.converse = boom
    llm_provider.set_provider(p)
    try:
        res = client.post("/analyze", json=BODY)
        assert res.status_code == 503
        assert res.json() == {"error": True, "error_code": "ThrottlingException", "error_message": "Too many tokens", "recoverable": True}
    finally:
        llm_provider.set_provider(None)
