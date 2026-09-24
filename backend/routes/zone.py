from fastapi import APIRouter, HTTPException

from schemas.zone import ZoneRequest, ZoneResponse
from services.zone_engine import build_zone_result

router = APIRouter(prefix="/farm/zones", tags=["Farm Zones"])


@router.post("/generate", response_model=ZoneResponse)
def generate_zones(payload: ZoneRequest):
    try:
        return build_zone_result(
            farm_id=payload.farm_id,
            boundary=payload.boundary,
            target_zone_area_acres=payload.target_zone_area_acres,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error