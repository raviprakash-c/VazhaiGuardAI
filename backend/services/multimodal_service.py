from __future__ import annotations

import base64
import json
import os
import logging
import urllib.error
import urllib.request
from typing import Any

from .bedrock_service import get_bedrock_client, extract_json
from .image_quality import validate_image_quality


logger = logging.getLogger(__name__)
LOCAL_VISION_ENABLED = os.getenv("VAZHAIGUARD_LOCAL_VISION_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
LOCAL_VISION_MODEL = os.getenv("VAZHAIGUARD_LOCAL_VISION_MODEL", "qwen2.5vl:3b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_TIMEOUT_SECONDS = max(5, int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "90")))


PRIMARY_VISION_MODEL = os.getenv(
    "VAZHAIGUARD_VISION_MODEL",
    "apac.amazon.nova-lite-v1:0",
)
SECONDARY_VISION_MODEL = os.getenv(
    "VAZHAIGUARD_VISION_FALLBACK_MODEL",
    "apac.amazon.nova-pro-v1:0",
)


ALLOWED_IMAGE_FORMATS = {"jpeg", "png", "gif", "webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


def _image_format(content_type: str | None) -> str:
    value = (content_type or "image/jpeg").lower().split(";")[0].strip()
    mapping = {
        "image/jpg": "jpeg",
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
    }
    result = mapping.get(value, "")
    if result not in ALLOWED_IMAGE_FORMATS:
        raise ValueError("Unsupported image format. Use JPEG, PNG, GIF, or WEBP.")
    return result


def _inspection_prompt(language: str, farm_context: dict[str, Any] | None, weather_context: dict[str, Any] | None) -> str:
    tamil = language.lower().startswith("ta") or language in {"tamil", "தமிழ்"}
    response_language = "simple Tamil" if tamil else "simple English"
    return f"""
You are the visual crop-inspection component of VazhaiGuard AI for banana farmers in Tamil Nadu.
Analyze the supplied farm/plant photograph. Do not identify a disease with certainty from appearance alone.
Use cautious language such as possible, visible, or needs field verification when evidence is incomplete.

Answer in {response_language}. The machine-readable fields must remain in English.

Farm context:
{json.dumps(farm_context or {}, ensure_ascii=False, default=str)}

Weather context:
{json.dumps(weather_context or {}, ensure_ascii=False, default=str)}

Return STRICT JSON only with this structure:
{{
  "observation": "short description of what is visibly present",
  "crop_visible": true,
  "stress_signals": ["leaf yellowing", "spots"],
  "possible_causes": ["water stress"],
  "urgency": "low|medium|high",
  "visual_confidence": 0.0,
  "needs_field_verification": true,
  "recommended_checks": ["check soil moisture near affected plants"],
  "farmer_message": "short practical response for the farmer"
}}

Rules:
1. Only report visual evidence actually visible in the image.
2. Do not invent measurements, weather values, farm history, or treatment results.
3. If no crop is visible, set crop_visible to false and explain what the farmer should photograph.
4. Do not recommend pesticide or fungicide dosage.
5. Keep farmer_message short enough to be spoken aloud.
6. Confidence must be between 0 and 1.
7. If uncertain, request one useful field check instead of guessing.
"""



_REQUIRED_VISION_FIELDS = (
    "observation",
    "crop_visible",
    "stress_signals",
    "possible_causes",
    "urgency",
    "visual_confidence",
    "needs_field_verification",
    "recommended_checks",
    "farmer_message",
)


def _validate_vision_result(value: Any) -> dict[str, Any]:
    """Reject incomplete or unsafe-to-consume model output before fusion."""
    if not isinstance(value, dict):
        raise RuntimeError("Vision model output must be a JSON object.")

    missing = [field for field in _REQUIRED_VISION_FIELDS if field not in value]
    if missing:
        raise RuntimeError("Vision model output is missing required fields: " + ", ".join(missing))

    for field in ("observation", "farmer_message"):
        if not isinstance(value[field], str) or not value[field].strip():
            raise RuntimeError(f"Vision model field '{field}' must be a non-empty string.")

    if not isinstance(value["crop_visible"], bool):
        raise RuntimeError("Vision model field 'crop_visible' must be a boolean.")
    if not isinstance(value["needs_field_verification"], bool):
        raise RuntimeError("Vision model field 'needs_field_verification' must be a boolean.")

    for field in ("stress_signals", "possible_causes", "recommended_checks"):
        items = value[field]
        if not isinstance(items, list) or any(not isinstance(item, str) or not item.strip() for item in items):
            raise RuntimeError(f"Vision model field '{field}' must be a list of non-empty strings.")

    urgency = value["urgency"]
    if not isinstance(urgency, str) or urgency.strip().lower() not in {"low", "medium", "high"}:
        raise RuntimeError("Vision model field 'urgency' must be low, medium, or high.")
    value["urgency"] = urgency.strip().lower()

    confidence = value["visual_confidence"]
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        raise RuntimeError("Vision model field 'visual_confidence' must be a number between 0 and 1.")
    if not 0.0 <= float(confidence) <= 1.0:
        raise RuntimeError("Vision model field 'visual_confidence' must be a number between 0 and 1.")
    value["visual_confidence"] = float(confidence)

    return value


def _analyze_with_local_ollama(
    *,
    image_bytes: bytes,
    prompt: str,
) -> dict[str, Any]:
    """Run local Qwen2.5-VL through Ollama without sending the photo to a cloud vision API."""
    payload = {
        "model": LOCAL_VISION_MODEL,
        "stream": False,
        "format": "json",
        "messages": [{
            "role": "user",
            "content": prompt,
            "images": [base64.b64encode(image_bytes).decode("ascii")],
        }],
        "options": {"temperature": 0.1},
    }
    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Local Ollama vision endpoint is unavailable at {OLLAMA_BASE_URL}.") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RuntimeError("Local Ollama returned an invalid response.") from exc

    content = body.get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Local vision model returned no text output.")
    result = _validate_vision_result(extract_json(content))
    result["model"] = LOCAL_VISION_MODEL
    result["provider"] = "ollama-local"
    result["fallback_used"] = False
    return result


def analyze_crop_image(
    image_bytes: bytes,
    content_type: str | None,
    language: str = "ta-IN",
    farm_context: dict[str, Any] | None = None,
    weather_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image is too large. Maximum supported size is 8 MB.")

    image_format = _image_format(content_type)
    quality = validate_image_quality(image_bytes, (content_type or "image/jpeg").split(";", 1)[0].lower())
    if not quality["accepted"]:
        raise ValueError(
            "Photo quality check failed: " + " ".join(quality["issues"])
        )

    prompt = _inspection_prompt(language, farm_context, weather_context)

    last_error: Exception | None = None
    local_attempted = LOCAL_VISION_ENABLED
    if LOCAL_VISION_ENABLED:
        try:
            return _analyze_with_local_ollama(image_bytes=image_bytes, prompt=prompt)
        except Exception as exc:
            last_error = exc
            logger.warning("Local vision model %s failed; trying configured Bedrock vision fallback.", LOCAL_VISION_MODEL, exc_info=True)

    client = get_bedrock_client()
    models = [PRIMARY_VISION_MODEL]
    if SECONDARY_VISION_MODEL and SECONDARY_VISION_MODEL != PRIMARY_VISION_MODEL:
        models.append(SECONDARY_VISION_MODEL)

    for model_id in models:
        try:
            response = client.converse(
                modelId=model_id,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"text": prompt},
                            {
                                "image": {
                                    "format": image_format,
                                    "source": {"bytes": image_bytes},
                                }
                            },
                        ],
                    }
                ],
                inferenceConfig={
                    "maxTokens": 700,
                    "temperature": 0.1,
                    "topP": 0.9,
                },
            )

            content = response.get("output", {}).get("message", {}).get("content", [])
            text = next((item.get("text") for item in content if item.get("text")), None)
            if not text:
                raise RuntimeError("Vision model returned no text output.")

            result = _validate_vision_result(extract_json(text))
            result["model"] = model_id
            result["provider"] = "aws-bedrock"
            result["fallback_used"] = local_attempted
            return result
        except Exception as exc:
            last_error = exc

    raise RuntimeError("Local Qwen vision and all configured Bedrock vision models failed.") from last_error


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if not data_url or "," not in data_url:
        raise ValueError("Invalid image data URL.")
    header, encoded = data_url.split(",", 1)
    content_type = header.removeprefix("data:").split(";", 1)[0]
    image_bytes = base64.b64decode(encoded, validate=True)
    return image_bytes, content_type
