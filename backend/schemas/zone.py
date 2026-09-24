from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ZoneRequest(BaseModel):
    farm_id: str

    boundary: dict

    mapped_area_acres: Optional[float] = Field(
        default=None,
        ge=0,
    )

    target_zone_area_acres: float = Field(
        default=0.5,
        gt=0,
        le=10,
    )


class ZoneGeometry(BaseModel):
    type: str = "Polygon"

    coordinates: List[List[List[float]]]


class FarmZone(BaseModel):
    zone_id: str

    row: int
    column: int

    area_acres: float
    area_m2: float

    center_latitude: float
    center_longitude: float

    geometry: ZoneGeometry


class ZoneResponse(BaseModel):
    success: bool

    farm_id: str

    total_area_acres: float

    zone_count: int

    zones: List[FarmZone]