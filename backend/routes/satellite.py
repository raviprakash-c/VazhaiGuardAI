from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.satellite_service import analyze_satellite_evidence

router = APIRouter(prefix="/ai/satellite", tags=["satellite-evidence"])


class SatelliteEvidenceRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    boundary: dict[str, Any] | None = None
    lookback_days: int = Field(default=45, ge=7, le=180)
    baseline_days: int = Field(default=45, ge=7, le=180)
    max_cloud_percent: float = Field(default=35, ge=0, le=100)


@router.get("/health")
def satellite_health() -> dict[str, Any]:
    return {
        "service": "satellite-evidence",
        "provider": "Google Earth Engine",
        "datasets": [
            "COPERNICUS/S2_SR_HARMONIZED",
            "GOOGLE/DYNAMICWORLD/V1",
        ],
        "indices": ["NDVI", "NDRE", "NDWI"],
        "status": "configured" if os.getenv("GEE_PROJECT") else "setup_required",
        "satellite_is_live": False,
        "scope": "farm_or_zone_level",
    }


@router.post("/evidence")
def satellite_evidence(request: SatelliteEvidenceRequest) -> dict[str, Any]:
    try:
        return analyze_satellite_evidence(
            latitude=request.latitude,
            longitude=request.longitude,
            boundary=request.boundary,
            lookback_days=request.lookback_days,
            baseline_days=request.baseline_days,
            max_cloud_percent=request.max_cloud_percent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Satellite evidence is temporarily unavailable.",
        ) from exc
