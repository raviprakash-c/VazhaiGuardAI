from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ParcelSearchRequest(BaseModel):
    district: Optional[str] = None
    taluk: Optional[str] = None
    village: Optional[str] = None

    survey_number: Optional[str] = None
    subdivision: Optional[str] = None

    road_name: Optional[str] = None
    landmark_name: Optional[str] = None
    landmark_type: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    limit: int = Field(
        default=10,
        ge=1,
        le=50,
    )


class ParcelCandidate(BaseModel):
    parcel_id: str

    district: Optional[str] = None
    taluk: Optional[str] = None
    village: Optional[str] = None

    survey_number: Optional[str] = None
    subdivision: Optional[str] = None

    land_id: Optional[str] = None
    unit_id: Optional[str] = None
    block_id: Optional[str] = None
    kide: Optional[str] = None

    area_acres: Optional[float] = None

    confidence: float

    match_reasons: List[str] = Field(
        default_factory=list
    )

    source_file: Optional[str] = None

    geometry: Dict[str, Any]


class ParcelSearchResponse(BaseModel):
    success: bool
    candidates: List[ParcelCandidate]

    search_summary: Dict[str, Any]


class ParcelConfirmRequest(BaseModel):
    farm_id: str

    parcel_id: str

    farmer_confirmed: bool

    district: Optional[str] = None
    taluk: Optional[str] = None
    village: Optional[str] = None

    survey_number: Optional[str] = None
    subdivision: Optional[str] = None

    geometry: Dict[str, Any]


class ParcelConfirmResponse(BaseModel):
    success: bool

    farm_id: str

    parcel_id: str

    status: str

    farmer_confirmed: bool

    message: str