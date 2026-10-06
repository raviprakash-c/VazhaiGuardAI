from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.satellite_service import (
    analyze_satellite_evidence,
    render_index_layer,
    render_true_color_preview,
    satellite_configuration_status,
)

router = APIRouter(prefix="/ai/satellite", tags=["satellite-evidence"])


class SatelliteEvidenceRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    boundary: dict[str, Any] | None = None
    lookback_days: int = Field(default=45, ge=7, le=180)
    baseline_days: int = Field(default=45, ge=7, le=180)
    max_cloud_percent: float = Field(default=35, ge=0, le=100)


class SatelliteLayerRequest(SatelliteEvidenceRequest):
    layer: str = Field(pattern="^(ndvi|ndre|ndwi|stress)$")


@router.get("/health")
def satellite_health() -> dict[str, Any]:
    status = satellite_configuration_status()
    return {
        "service": "satellite-evidence",
        "provider": status["provider"],
        "datasets": [status["collection"]],
        "indices": ["NDVI", "NDRE", "NDWI"],
        "layers": status.get("layers", []),
        "status": "configured" if status["configured"] else "setup_required",
        "satellite_is_live": False,
        "scope": status["scope"],
        "resolution_m": status["image_resolution_m"],
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


@router.post("/layer")
def satellite_layer(request: SatelliteLayerRequest) -> Response:
    try:
        image, media_type = render_index_layer(
            latitude=request.latitude,
            longitude=request.longitude,
            boundary=request.boundary,
            layer=request.layer,
            lookback_days=request.lookback_days,
            max_cloud_percent=request.max_cloud_percent,
        )
        return Response(
            content=image,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Satellite layer is temporarily unavailable.",
        ) from exc


@router.post("/preview")
def satellite_preview(request: SatelliteEvidenceRequest) -> Response:
    try:
        image, media_type, _ = render_true_color_preview(
            latitude=request.latitude,
            longitude=request.longitude,
            boundary=request.boundary,
            lookback_days=request.lookback_days,
            max_cloud_percent=request.max_cloud_percent,
        )
        return Response(
            content=image,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Satellite image is temporarily unavailable.",
        ) from exc
