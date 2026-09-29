from __future__ import annotations

from fastapi import APIRouter, HTTPException

from schemas.parcel import (
    ParcelConfirmRequest,
    ParcelConfirmResponse,
    ParcelSearchRequest,
    ParcelSearchResponse,
)

from services.parcel_service import search_parcels


router = APIRouter(
    prefix="/farm/parcels",
    tags=["farm-parcels"],
)


@router.post(
    "/search",
    response_model=ParcelSearchResponse,
)
def search_farm_parcels(
    request: ParcelSearchRequest,
):

    try:

        candidates = search_parcels(request)

        return {
            "success": True,
            "candidates": candidates,
            "search_summary": {
                "district": request.district,
                "taluk": request.taluk,
                "village": request.village,
                "road_name": request.road_name,
                "landmark_name": request.landmark_name,
                "candidate_count": len(candidates),
            },
        }

    except Exception as error:

        print(
            "========== PARCEL SEARCH ERROR =========="
        )
        print(
            repr(error)
        )
        print(
            "========================================="
        )

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.post(
    "/confirm",
    response_model=ParcelConfirmResponse,
)
def confirm_farm_parcel(
    request: ParcelConfirmRequest,
):

    print(
        "\n========== PARCEL CONFIRM =========="
    )

    print(
        "FARM ID:",
        request.farm_id,
    )

    print(
        "PARCEL ID:",
        request.parcel_id,
    )

    print(
        "FARMER CONFIRMED:",
        request.farmer_confirmed,
    )

    print(
        "DISTRICT:",
        request.district,
    )

    print(
        "TALUK:",
        request.taluk,
    )

    print(
        "VILLAGE:",
        request.village,
    )

    print(
        "SURVEY NUMBER:",
        request.survey_number,
    )

    print(
        "SUBDIVISION:",
        request.subdivision,
    )

    print(
        "GEOMETRY TYPE:",
        request.geometry.get("type"),
    )

    print(
        "=====================================\n"
    )

    if not request.farmer_confirmed:

        return {
            "success": True,
            "farm_id": request.farm_id,
            "parcel_id": request.parcel_id,
            "status": "MISMATCH",
            "farmer_confirmed": False,
            "message": (
                "Farmer did not confirm the cadastral parcel."
            ),
        }

    return {
        "success": True,
        "farm_id": request.farm_id,
        "parcel_id": request.parcel_id,
        "status": "FARMER_CONFIRMED",
        "farmer_confirmed": True,
        "message": (
            "Cadastral parcel confirmed successfully."
        ),
    }