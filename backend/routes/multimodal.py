from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bedrock_service import generate_text
from services.multimodal_service import (
    PRIMARY_VISION_MODEL,
    SECONDARY_VISION_MODEL,
    decode_data_url,
    analyze_crop_image,
)


router = APIRouter(prefix="/ai/multimodal", tags=["multimodal-ai"])

TEXT_MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)


class CropInspectionRequest(BaseModel):
    image_data_url: str = Field(min_length=32, max_length=12_000_000)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    farm_context: dict[str, Any] | None = None
    weather_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)


class RiskFusionRequest(BaseModel):
    vision: dict[str, Any]
    weather: dict[str, Any] | None = None
    satellite: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _weather_score(weather: dict[str, Any] | None) -> float:
    if not weather:
        return 0.0
    rain = float(weather.get("max_rain_probability", 0) or 0)
    precipitation = float(weather.get("total_precipitation", 0) or 0)
    gust = float(weather.get("max_wind_gust", 0) or 0)
    return _clamp((rain * 0.55) + (min(precipitation, 30) / 30 * 25) + (min(gust, 60) / 60 * 20))


def _satellite_score(satellite: dict[str, Any] | None) -> float:
    if not satellite:
        return 0.0
    if "risk_score" in satellite:
        return _clamp(float(satellite.get("risk_score", 0)))
    ndvi = satellite.get("ndvi")
    if ndvi is None:
        return 0.0
    return _clamp((1.0 - float(ndvi)) * 100)


def _vision_score(vision: dict[str, Any]) -> float:
    urgency = {"low": 20.0, "medium": 55.0, "high": 85.0}.get(str(vision.get("urgency", "low")), 20.0)
    confidence = _clamp(float(vision.get("visual_confidence", 0))) * 0.25
    return _clamp(urgency + confidence)


def _risk_label(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "moderate"
    return "low"


def _build_action_prompt(request: RiskFusionRequest, score: float, label: str) -> str:
    tamil = request.language.lower().startswith("ta") or request.language in {"tamil", "தமிழ்"}
    language = "simple spoken Tamil" if tamil else "simple English"
    return f"""
You are VazhaiGuard AI's farmer decision agent. Produce a short, practical field response in {language}.

Zone: {request.zone_id or 'unspecified'}
Combined risk score: {score:.0f}/100 ({label})
Visual evidence: {request.vision}
Weather evidence: {request.weather or {}}
Satellite evidence: {request.satellite or {}}

Rules:
- Explain what the evidence suggests without claiming a certain disease.
- Give 2 or 3 practical actions, ordered by priority.
- If evidence is weak, ask for one useful follow-up check or photo.
- Never invent measurements or pesticide doses.
- Keep it concise enough for voice playback.
"""


@router.get("/health")
def multimodal_health() -> dict[str, Any]:
    return {
        "service": "VazhaiGuard multimodal inspection",
        "primary_vision_model": PRIMARY_VISION_MODEL,
        "fallback_vision_model": SECONDARY_VISION_MODEL,
        "decision_model": TEXT_MODEL_ID,
        "status": "configured",
    }


@router.post("/inspect")
def inspect_crop(request: CropInspectionRequest) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        image_bytes, content_type = decode_data_url(request.image_data_url)
        vision = analyze_crop_image(
            image_bytes=image_bytes,
            content_type=content_type,
            language=request.language,
            farm_context=request.farm_context,
            weather_context=request.weather_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Multimodal inspection is temporarily unavailable.") from exc

    return {
        "zone_id": request.zone_id,
        "vision": vision,
        "latency_ms": round((time.perf_counter() - started) * 1000),
        "source": "AWS Bedrock multimodal",
    }


@router.post("/risk-fusion")
def risk_fusion(request: RiskFusionRequest) -> dict[str, Any]:
    vision = _vision_score(request.vision)
    weather = _weather_score(request.weather)
    satellite = _satellite_score(request.satellite)

    available = []
    weighted = []
    if request.vision:
        available.append("vision")
        weighted.append((vision, 0.50))
    if request.weather:
        available.append("weather")
        weighted.append((weather, 0.30))
    if request.satellite:
        available.append("satellite")
        weighted.append((satellite, 0.20))

    if not weighted:
        score = 0.0
    else:
        total_weight = sum(weight for _, weight in weighted)
        score = sum(value * weight for value, weight in weighted) / total_weight

    score = round(_clamp(score), 1)
    label = _risk_label(score)

    try:
        response = generate_text(
            prompt=_build_action_prompt(request, score, label),
            model_id=TEXT_MODEL_ID,
            max_tokens=450,
            temperature=0.2,
        ).strip()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Decision model is temporarily unavailable.") from exc

    return {
        "zone_id": request.zone_id,
        "risk": {
            "score": score,
            "level": label,
            "signals_used": available,
        },
        "signal_scores": {
            "vision": round(vision, 1),
            "weather": round(weather, 1),
            "satellite": round(satellite, 1),
        },
        "action": response,
        "decision_model": TEXT_MODEL_ID,
    }
