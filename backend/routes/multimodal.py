from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bedrock_service import extract_json, generate_text
from services.multimodal_service import (
    PRIMARY_VISION_MODEL,
    SECONDARY_VISION_MODEL,
    analyze_crop_image,
    decode_data_url,
)
from services.unified_risk_engine import calculate_unified_risk
from services.decision_evaluator import evaluate_multimodal_decision

router = APIRouter(prefix="/ai/multimodal", tags=["multimodal-ai"])
TEXT_MODEL_ID = os.getenv("VAZHAIGUARD_TEXT_MODEL", "mistral.ministral-3-8b-instruct")


class CropInspectionRequest(BaseModel):
    image_data_url: str = Field(min_length=32, max_length=12_000_000)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    farm_context: dict[str, Any] | None = None
    weather_context: dict[str, Any] | None = None
    satellite_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)


class RiskFusionRequest(BaseModel):
    vision: dict[str, Any]
    weather: dict[str, Any] | None = None
    satellite: dict[str, Any] | None = None
    farm_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)


class InspectAndDecideRequest(CropInspectionRequest):
    """One-call end-to-end multimodal farmer decision request."""


def _fuse_signals(
    vision: dict[str, Any],
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    farm_context: dict[str, Any] | None = None,
) -> tuple[float, str, dict[str, float], list[str], dict[str, float]]:
    """Compatibility wrapper around the deterministic unified risk engine.

    Follow-up/reinspection code imports this function, so the public helper is
    retained while all inspection paths now share freshness and conflict rules.
    """
    result = calculate_unified_risk(
        vision=vision,
        weather=weather,
        satellite=satellite,
        farm_context=farm_context,
    )
    return (
        float(result["score"]),
        str(result["level"]),
        result["signal_scores"],
        result["signals_used"],
        result["weights_used"],
    )


def _build_action_prompt(
    *,
    vision: dict[str, Any],
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    farm_context: dict[str, Any] | None,
    score: float,
    label: str,
    language: str,
) -> str:
    tamil = language.lower().startswith("ta") or language in {"tamil", "தமிழ்"}
    response_language = "simple spoken Tamil" if tamil else "simple English"
    return f"""
You are the final farmer decision agent of VazhaiGuard AI for a banana farm in Tamil Nadu.
Combine the supplied visual, weather, satellite (if available), and farm-context evidence.
The deterministic unified risk engine calculated {score:.0f}/100 ({label}).

Respond in {response_language}.

VISUAL EVIDENCE:
{vision}

WEATHER EVIDENCE:
{weather or {}}

SATELLITE EVIDENCE:
{satellite or {}}

EVIDENCE FRESHNESS/POLICY:
- Sentinel-2 is periodic farm/zone evidence, not a live plant sensor.
- If satellite evidence is stale, use it only as historical context and never let it drive a current plant-level conclusion.
- Current farmer photo and current field checks take precedence over stale satellite evidence.
- If evidence conflicts or visual confidence is weak, explicitly request field verification.

FARM CONTEXT:
{farm_context or {}}

Return STRICT JSON only:
{{
  "summary": "one short explanation of what the combined evidence means",
  "priority_actions": [
    {{"priority": 1, "action": "...", "reason": "..."}},
    {{"priority": 2, "action": "...", "reason": "..."}}
  ],
  "follow_up_check": "one useful field check or empty string",
  "recheck_after": "short practical time guidance or empty string",
  "needs_field_verification": true,
  "farmer_message": "short natural spoken response for the farmer"
}}

Rules:
1. Treat the photo as visual evidence, not a definitive disease diagnosis.
2. Never invent weather, satellite, farm measurements, or treatment results.
3. Missing evidence must remain missing; do not pretend satellite data exists.
4. Give 2 or 3 practical actions, ordered by priority.
5. Do not prescribe pesticide/fungicide dosage.
6. If evidence is weak or conflicting, request a useful field verification.
7. Keep farmer_message short enough for voice playback.
8. Return valid JSON without Markdown fences.
"""


def _generate_farmer_decision(
    *,
    vision: dict[str, Any],
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    farm_context: dict[str, Any] | None,
    score: float,
    label: str,
    language: str,
) -> dict[str, Any]:
    raw = generate_text(
        prompt=_build_action_prompt(
            vision=vision,
            weather=weather,
            satellite=satellite,
            farm_context=farm_context,
            score=score,
            label=label,
            language=language,
        ),
        model_id=TEXT_MODEL_ID,
        max_tokens=650,
        temperature=0.2,
    ).strip()
    try:
        result = extract_json(raw)
        if isinstance(result, dict) and result.get("farmer_message"):
            return result
    except Exception:
        pass
    return {
        "summary": raw,
        "priority_actions": [],
        "follow_up_check": "",
        "recheck_after": "",
        "needs_field_verification": bool(vision.get("needs_field_verification", True)),
        "farmer_message": raw,
    }


@router.get("/health")
def multimodal_health() -> dict[str, Any]:
    return {
        "service": "VazhaiGuard multimodal inspection",
        "primary_vision_model": PRIMARY_VISION_MODEL,
        "fallback_vision_model": SECONDARY_VISION_MODEL,
        "decision_model": TEXT_MODEL_ID,
        "fusion": "vision + weather + optional satellite + farm context + freshness/conflict rules",
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
    score, label, signal_scores, signals_used, weights_used = _fuse_signals(
        request.vision, request.weather, request.satellite, request.farm_context
    )
    try:
        decision = _generate_farmer_decision(
            vision=request.vision,
            weather=request.weather,
            satellite=request.satellite,
            farm_context=request.farm_context,
            score=score,
            label=label,
            language=request.language,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Decision model is temporarily unavailable.") from exc

    risk_result = calculate_unified_risk(
        vision=request.vision,
        weather=request.weather,
        satellite=request.satellite,
        farm_context=request.farm_context,
    )
    risk = {
        "score": score,
        "level": label,
        "signals_used": signals_used,
        "weights_used": weights_used,
        "evidence_state": risk_result.get("evidence_state", {}),
    }
    evaluation = evaluate_multimodal_decision(
        vision=request.vision,
        weather=request.weather,
        satellite=request.satellite,
        risk=risk,
        decision=decision,
    )

    return {
        "zone_id": request.zone_id,
        "risk": risk,
        "signal_scores": signal_scores,
        "decision": decision,
        "evaluation": evaluation,
        "action": decision.get("farmer_message", ""),
        "decision_model": TEXT_MODEL_ID,
    }


@router.post("/inspect-and-decide")
def inspect_and_decide(request: InspectAndDecideRequest) -> dict[str, Any]:
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

    score, label, signal_scores, signals_used, weights_used = _fuse_signals(
        vision,
        request.weather_context,
        request.satellite_context,
        request.farm_context,
    )
    try:
        decision = _generate_farmer_decision(
            vision=vision,
            weather=request.weather_context,
            satellite=request.satellite_context,
            farm_context=request.farm_context,
            score=score,
            label=label,
            language=request.language,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Decision model is temporarily unavailable.") from exc

    risk = {
        "score": score,
        "level": label,
        "signals_used": signals_used,
        "weights_used": weights_used,
        "evidence_state": calculate_unified_risk(
            vision=vision,
            weather=request.weather_context,
            satellite=request.satellite_context,
            farm_context=request.farm_context,
        ).get("evidence_state", {}),
    }
    evaluation = evaluate_multimodal_decision(
        vision=vision,
        weather=request.weather_context,
        satellite=request.satellite_context,
        risk=risk,
        decision=decision,
    )

    return {
        "zone_id": request.zone_id,
        "vision": vision,
        "risk": risk,
        "signal_scores": signal_scores,
        "decision": decision,
        "evaluation": evaluation,
        "action": decision.get("farmer_message", ""),
        "decision_model": TEXT_MODEL_ID,
        "latency_ms": round((time.perf_counter() - started) * 1000),
        "source": "AWS Bedrock multimodal + deterministic evidence fusion + decision evaluator",
    }
