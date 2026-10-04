from __future__ import annotations

import base64
import json
import os
from typing import Any

from .bedrock_service import get_bedrock_client, extract_json


PRIMARY_VISION_MODEL = os.getenv(
    "VAZHAIGUARD_VISION_MODEL",
    "amazon.nova-lite-v1:0",
)
SECONDARY_VISION_MODEL = os.getenv(
    "VAZHAIGUARD_VISION_FALLBACK_MODEL",
    "amazon.nova-pro-v1:0",
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
    prompt = _inspection_prompt(language, farm_context, weather_context)
    client = get_bedrock_client()

    last_error: Exception | None = None
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

            result = extract_json(text)
            result["model"] = model_id
            result["fallback_used"] = model_id != PRIMARY_VISION_MODEL
            return result
        except Exception as exc:
            last_error = exc

    raise RuntimeError("All configured multimodal vision models failed.") from last_error


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if not data_url or "," not in data_url:
        raise ValueError("Invalid image data URL.")
    header, encoded = data_url.split(",", 1)
    content_type = header.removeprefix("data:").split(";", 1)[0]
    image_bytes = base64.b64decode(encoded, validate=True)
    return image_bytes, content_type
