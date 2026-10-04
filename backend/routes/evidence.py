from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.evidence_state import build_evidence_state


router = APIRouter(prefix="/ai/evidence", tags=["evidence-monitor"])


class EvidenceStateRequest(BaseModel):
    vision: dict[str, Any] | None = None
    weather: dict[str, Any] | None = None
    satellite: dict[str, Any] | None = None
    farm_context: dict[str, Any] | None = None
    zone_id: str | None = Field(default=None, max_length=80)


@router.get("/health")
def evidence_health() -> dict[str, Any]:
    return {
        "service": "VazhaiGuard evidence state monitor",
        "satellite_mode": "periodic_latest-available",
        "ground_truth_policy": "recent farmer evidence overrides stale satellite evidence",
        "status": "ok",
    }


@router.post("/state")
def evidence_state(request: EvidenceStateRequest) -> dict[str, Any]:
    state = build_evidence_state(
        vision=request.vision,
        weather=request.weather,
        satellite=request.satellite,
        farm_context=request.farm_context,
    )

    return {
        "zone_id": request.zone_id,
        "evidence": state,
    }
