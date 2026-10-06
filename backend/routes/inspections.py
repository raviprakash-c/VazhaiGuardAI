from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from routes.multimodal import _fuse_signals, _generate_farmer_decision
from services.decision_evaluator import evaluate_multimodal_decision
from services.dynamodb_service import get_farm
from services.incident_engine import build_incident_and_action_plan
from services.inspection_storage import create_inspection_record, s3_health, save_inspection_record, store_photo
from services.multimodal_service import analyze_crop_image, decode_data_url
from services.reinspection_engine import compare_inspection_records
from services.agentic_reinspection import plan_next_inspection
from services.unified_risk_engine import calculate_unified_risk

router = APIRouter(prefix="/ai/inspections", tags=["inspection-evidence"])


class ReinspectionRequest(BaseModel):
    farm_id: str = Field(min_length=1, max_length=100)
    image_data_url: str = Field(min_length=32, max_length=12_000_000)
    language: str = Field(default="ta-IN", min_length=2, max_length=16)
    weather_context: dict[str, Any] | None = None
    satellite_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)


def _history(farm_id: str) -> list[dict[str, Any]]:
    farm = get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm was not found.")
    return list(reversed((farm.get("inspection_history") or [])[-30:]))


@router.get("/health")
def inspection_health() -> dict[str, Any]:
    return {"service": "inspection evidence", "s3": s3_health(), "storage": "S3 photo + DynamoDB inspection history"}


@router.get("/{farm_id}/history")
def inspection_history(farm_id: str) -> dict[str, Any]:
    return {"farm_id": farm_id, "inspections": _history(farm_id)}


@router.post("/reinspect")
def reinspect(request: ReinspectionRequest) -> dict[str, Any]:
    farm = get_farm(request.farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm was not found.")

    history = farm.get("inspection_history") or []
    parent = history[-1] if history else None
    parent_id = parent.get("inspection_id") if parent else None
    farm_context = farm.get("farm_profile") or {}

    try:
        image_bytes, content_type = decode_data_url(request.image_data_url)
        vision = analyze_crop_image(
            image_bytes=image_bytes,
            content_type=content_type,
            language=request.language,
            farm_context=farm_context,
            weather_context=request.weather_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Reinspection vision analysis is temporarily unavailable.") from exc

    score, label, signal_scores, signals_used, weights_used = _fuse_signals(
        vision, request.weather_context, request.satellite_context, farm_context
    )
    risk_result = calculate_unified_risk(
        vision=vision, weather=request.weather_context, satellite=request.satellite_context, farm_context=farm_context
    )
    risk = {
        "score": score,
        "level": label,
        "signals_used": signals_used,
        "weights_used": weights_used,
        "evidence_state": risk_result.get("evidence_state", {}),
    }
    decision = _generate_farmer_decision(
        vision=vision, weather=request.weather_context, satellite=request.satellite_context,
        farm_context=farm_context, score=score, label=label, language=request.language,
    )
    evaluation = evaluate_multimodal_decision(
        vision=vision, weather=request.weather_context, satellite=request.satellite_context,
        risk=risk, decision=decision,
    )
    incident = build_incident_and_action_plan(
        vision=vision, weather=request.weather_context, satellite=request.satellite_context,
        evaluation=evaluation, farm_context=farm_context,
    )

    inspection_id = f"insp_{uuid.uuid4().hex[:12]}"
    result = {
        "inspection_id": inspection_id,
        "parent_inspection_id": parent_id,
        "farm_id": request.farm_id,
        "zone_id": request.zone_id,
        "vision": vision,
        "risk": risk,
        "signal_scores": signal_scores,
        "decision": decision,
        "evaluation": evaluation,
        "action": decision.get("farmer_message", ""),
        "decision_model": "mistral.ministral-3-8b-instruct",
        "incident": incident,
        "action_plan": incident,
        "reinspection": {"is_reinspection": True, "parent_inspection_id": parent_id},
    }

    comparison = compare_inspection_records(parent, result)
    result["comparison"] = comparison

    try:
        storage = store_photo(
            farm_id=request.farm_id, inspection_id=inspection_id,
            image_bytes=image_bytes, content_type=content_type,
        )
        record = create_inspection_record(
            farm_id=request.farm_id, inspection_id=inspection_id,
            parent_inspection_id=parent_id, result=result, storage=storage,
        )
        save_inspection_record(farm_id=request.farm_id, record=record)
        result["inspection_storage"] = storage
    except Exception as exc:
        result["inspection_storage"] = {"stored": False, "status": "storage_error", "error": str(exc)}

    return result


@router.get("/{farm_id}/next-action")
def inspection_next_action(farm_id: str) -> dict[str, Any]:
    farm = get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm was not found.")
    history = list(farm.get("inspection_history") or [])
    weather = None
    try:
        from weather import get_weather
        location = farm.get("location") or {}
        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if latitude is not None and longitude is not None:
            weather = asyncio.run(get_weather(float(latitude), float(longitude)))
    except Exception:
        weather = None
    return {
        "farm_id": farm_id,
        "plan": plan_next_inspection(history=history, current_weather=weather),
    }
