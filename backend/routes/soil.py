from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.soil_service import get_soil_evidence, soil_configuration_status

router = APIRouter(prefix="/ai/soil", tags=["soil-evidence"])


class SoilEvidenceRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@router.get("/health")
def soil_health() -> dict[str, Any]:
    return {"service": "soil-evidence", **soil_configuration_status(), "status": "configured"}


@router.post("/evidence")
def soil_evidence(request: SoilEvidenceRequest) -> dict[str, Any]:
    try:
        return get_soil_evidence(latitude=request.latitude, longitude=request.longitude)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Soil evidence is temporarily unavailable.") from exc
