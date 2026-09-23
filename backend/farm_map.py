from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.farm_profile_agent import (
    create_profile,
)

from schemas.farm_profile import (
    FarmProfileRequest,
    FarmProfileResponse,
)

from services.dynamodb_service import (
    save_farm,
)

router = APIRouter(
    prefix="/farm",
    tags=["farm-map"],
)


# =========================================================
# DATA MODELS
# =========================================================

class FarmMapLocation(BaseModel):
    latitude: float
    longitude: float
    label: str | None = None


class FarmPolygonGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class FarmLocationSaveRequest(BaseModel):
    farm_profile: Dict[str, Any] = Field(
        default_factory=dict
    )

    location: FarmMapLocation

    boundary: FarmPolygonGeometry

    mapped_area_acres: float

    perimeter_m: float

    farmer_confirmed: bool = True

    boundary_source: str = (
        "farmer_drawn_satellite"
    )


class FarmLocationSaveResponse(BaseModel):
    farm_id: str

    saved: bool

    location: FarmMapLocation

    boundary: FarmPolygonGeometry

    mapped_area_acres: float

    perimeter_m: float

    farmer_confirmed: bool

    boundary_source: str


# =========================================================
# SIMPLE PROTOTYPE STORAGE
# =========================================================

DATA_DIR = Path(__file__).resolve().parent / "data"

DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

FARM_FILE = DATA_DIR / "farms.json"


def read_farms() -> list:
    if not FARM_FILE.exists():
        return []

    try:
        with FARM_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:
            content = json.load(file)

        if isinstance(content, list):
            return content

        return []

    except (
        json.JSONDecodeError,
        OSError,
    ):
        return []


def write_farms(
    farms: list,
) -> None:
    with FARM_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            farms,
            file,
            ensure_ascii=False,
            indent=2,
        )


# =========================================================
# SAVE FARM LOCATION
# =========================================================

@router.post(
    "/location",
    response_model=FarmLocationSaveResponse,
)
def save_farm_location(
    request: FarmLocationSaveRequest,
):
    if (
        request.boundary.type
        != "Polygon"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Farm boundary must "
                "be a Polygon."
            ),
        )

    if not request.boundary.coordinates:
        raise HTTPException(
            status_code=400,
            detail=(
                "Farm boundary "
                "coordinates are required."
            ),
        )

    if request.mapped_area_acres <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Mapped farm area "
                "must be greater than zero."
            ),
        )

    farm_id = (
        "farm_"
        + uuid.uuid4().hex[:10]
    )

    farm_record = {
        "farm_id":
            farm_id,

        "farm_profile":
            request.farm_profile,

        "location":
            request.location.model_dump(),

        "boundary":
            request.boundary.model_dump(),

        "mapped_area_acres":
            request.mapped_area_acres,

        "perimeter_m":
            request.perimeter_m,

        "farmer_confirmed":
            request.farmer_confirmed,

        "boundary_source":
            request.boundary_source,
    }

    farms = read_farms()

    farms.append(
        farm_record
    )

    try:
        write_farms(
            farms
        )

        save_farm(
            farm_id=farm_id,
            farm_profile=request.farm_profile,
            location=request.location.model_dump(),
            boundary=request.boundary.model_dump(),
            mapped_area_acres=request.mapped_area_acres,
            perimeter_m=request.perimeter_m,
            farmer_confirmed=request.farmer_confirmed,
            boundary_source=request.boundary_source,
        )

        print(
            "[FARM] Saved to DynamoDB:",
            farm_id,
        )

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save "
                "farm location."
            ),
        ) from error

    except Exception as error:
        print(
            "[FARM] DynamoDB save error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save farm "
                "to DynamoDB: "
                + str(error)
            ),
        ) from error
    return FarmLocationSaveResponse(
        farm_id=farm_id,

        saved=True,

        location=request.location,

        boundary=request.boundary,

        mapped_area_acres=(
            request.mapped_area_acres
        ),

        perimeter_m=(
            request.perimeter_m
        ),

        farmer_confirmed=(
            request.farmer_confirmed
        ),

        boundary_source=(
            request.boundary_source
        ),
    )
# =========================================================
# CREATE AI FARM PROFILE
# =========================================================

@router.post(
    "/profile",
    response_model=FarmProfileResponse,
)
def create_ai_farm_profile(
    request: FarmProfileRequest,
):

    if not request.farmer_confirmed:

        raise HTTPException(
            status_code=400,
            detail=(
                "Farmer must confirm "
                "the farm boundary first."
            ),
        )

    if (
        request.mapped_area_acres
        <= 0
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Mapped farm area "
                "must be greater than zero."
            ),
        )

    try:

        result = create_profile(
            farm_id=
                request.farm_id,

            farm_profile=
                request.farm_profile,

            location=
                request.location,

            boundary=
                request.boundary,

            mapped_area_acres=
                request.mapped_area_acres,

            perimeter_m=
                request.perimeter_m,

            farmer_confirmed=
                request.farmer_confirmed,

            boundary_source=
                request.boundary_source,
        )

        return result

    except Exception as error:

        print(
            "FARM PROFILE ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to create "
                "AI farm profile: "
                + str(error)
            ),
        ) from error

# =========================================================
# GET SAVED FARMS
# =========================================================

@router.get("")
def get_farms():
    return {
        "farms": read_farms()
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@router.get("/health")
def farm_map_health():
    return {
        "status": "ok",
        "service": "farm-map",
    }
