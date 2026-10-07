from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


from agents.farm_profile_agent import create_profile

from schemas.farm_profile import (
    FarmProfileRequest,
    FarmProfileResponse,
)

from services.dynamodb_service import save_farm


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/farm",
    tags=["farm-map"],
)


# ============================================================
# DATA MODELS
# ============================================================


class FarmMapLocation(BaseModel):
    latitude: float
    longitude: float
    label: str | None = None


class FarmPolygonGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"] = "Polygon"
    coordinates: Any


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

    parcel_id: str | None = None

    parcel_metadata: Dict[str, Any] | None = None


class FarmLocationSaveResponse(BaseModel):
    farm_id: str

    saved: bool

    location: FarmMapLocation

    boundary: FarmPolygonGeometry

    mapped_area_acres: float

    perimeter_m: float

    farmer_confirmed: bool

    boundary_source: str

    parcel_id: str | None = None

    parcel_metadata: Dict[str, Any] | None = None


# ============================================================
# SIMPLE PROTOTYPE STORAGE
# ============================================================

DATA_DIR = (
    Path(__file__).resolve().parent / "data"
)

DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

FARM_FILE = DATA_DIR / "farms.json"


# ============================================================
# READ FARMS
# ============================================================

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


# ============================================================
# WRITE FARMS
# ============================================================

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


# ============================================================
# SAVE FARM LOCATION
# ============================================================

@router.post(
    "/location",
    response_model=FarmLocationSaveResponse,
)
def save_farm_location(
    request: FarmLocationSaveRequest,
):

    # --------------------------------------------------------
    # Validate boundary
    # --------------------------------------------------------

    if request.boundary.type not in (
        "Polygon",
        "MultiPolygon",
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Farm boundary must be "
                "Polygon or MultiPolygon."
            ),
        )

    if not request.boundary.coordinates:

        raise HTTPException(
            status_code=400,
            detail=(
                "Farm boundary coordinates "
                "are required."
            ),
        )

    # --------------------------------------------------------
    # Validate area
    # --------------------------------------------------------

    if request.mapped_area_acres <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Mapped farm area must "
                "be greater than zero."
            ),
        )

    # --------------------------------------------------------
    # Validate perimeter
    # --------------------------------------------------------

    if request.perimeter_m < 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Perimeter cannot be negative."
            ),
        )

    # --------------------------------------------------------
    # Generate canonical farm ID
    # --------------------------------------------------------

    farm_id = (
        "farm_"
        + uuid.uuid4().hex[:10]
    )

    # --------------------------------------------------------
    # Build farm record
    # --------------------------------------------------------

    farm_record = {
        "farm_id": farm_id,

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

        "parcel_id":
            request.parcel_id,

        "parcel_metadata":
            request.parcel_metadata,
    }

    # --------------------------------------------------------
    # Save local JSON copy
    # --------------------------------------------------------

    farms = read_farms()

    farms.append(
        farm_record
    )

    try:

        write_farms(farms)

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save "
                "farm location."
            ),
        ) from error

    # --------------------------------------------------------
    # Save to DynamoDB
    # --------------------------------------------------------

    try:

        save_farm(
            farm_id=farm_id,

            farm_profile=
                request.farm_profile,

            location=
                request.location.model_dump(),

            boundary=
                request.boundary.model_dump(),

            mapped_area_acres=
                request.mapped_area_acres,

            perimeter_m=
                request.perimeter_m,

            farmer_confirmed=
                request.farmer_confirmed,

            boundary_source=
                request.boundary_source,

            parcel_id=
                request.parcel_id,

            parcel_metadata=
                request.parcel_metadata,
        )

        print(
            "[FARM] Saved to DynamoDB:",
            farm_id,
        )

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

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

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

        parcel_id=
            request.parcel_id,

        parcel_metadata=
            request.parcel_metadata,
    )


# ============================================================
# CREATE AI FARM PROFILE
# ============================================================

@router.post(
    "/profile",
    response_model=FarmProfileResponse,
)
def create_ai_farm_profile(
    request: FarmProfileRequest,
):

    # --------------------------------------------------------
    # Validate farmer confirmation
    # --------------------------------------------------------

    if not request.farmer_confirmed:

        raise HTTPException(
            status_code=400,
            detail=(
                "Farmer must confirm "
                "the farm boundary first."
            ),
        )

    # --------------------------------------------------------
    # Validate area
    # --------------------------------------------------------

    if request.mapped_area_acres <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Mapped farm area "
                "must be greater than zero."
            ),
        )

    # --------------------------------------------------------
    # Generate AI profile
    # --------------------------------------------------------

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


# ============================================================
# GET ALL SAVED FARMS
# ============================================================

@router.get("")
def get_farms():
    return {"farms": read_farms()}


# ============================================================
# HEALTH CHECK
# ============================================================

@router.get("/health")
def farm_map_health():
    return {"status": "ok", "service": "farm-map"}


# ============================================================
# GET ONE SAVED FARM
# ============================================================

@router.get("/{farm_id}")
def get_farm_by_id(farm_id: str):
    farms = read_farms()

    for farm in farms:
        if farm.get("farm_id") == farm_id:
            return farm

    raise HTTPException(
        status_code=404,
        detail="Farm not found: " + farm_id,
    )
