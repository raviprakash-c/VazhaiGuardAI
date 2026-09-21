from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class FarmProfileRequest(BaseModel):
    farm_id: str

    farm_profile: Dict[str, Any] = Field(
        default_factory=dict
    )

    location: Dict[str, Any]

    boundary: Dict[str, Any]

    mapped_area_acres: float

    perimeter_m: float

    farmer_confirmed: bool = True

    boundary_source: str = (
        "farmer_drawn_satellite"
    )


class FarmProfileResponse(BaseModel):
    farm_id: str

    saved: bool

    profile_status: str

    profile: Dict[str, Any]

    next_questions: list[str]

    verification: Dict[str, Any]