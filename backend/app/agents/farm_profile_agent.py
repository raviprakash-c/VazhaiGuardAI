from __future__ import annotations

from typing import Any, Dict

from services.bedrock_service import (
    create_farm_profile,
)

from services.dynamodb_service import (
    save_farm,
    update_ai_profile,
)


def verify_profile(
    farm_profile: Dict[str, Any],
    ai_profile: Dict[str, Any],
) -> Dict[str, Any]:

    issues = []

    summary = ai_profile.get(
        "farm_summary",
        {}
    )

    land = ai_profile.get(
        "land",
        {}
    )

    mapped_area = land.get(
        "mapped_area_acres"
    )

    if mapped_area is None:
        issues.append(
            "Mapped farm area is missing."
        )

    if not summary.get(
        "crop"
    ):
        issues.append(
            "Crop type is missing."
        )

    if not farm_profile.get(
        "banana_variety"
    ):
        if (
            "variety"
            not in ai_profile.get(
                "missing_information",
                []
            )
        ):
            pass

    if issues:

        return {
            "status":
                "NEEDS_REVIEW",

            "issues":
                issues,

            "checked_fields":
                [
                    "farm_summary",
                    "land",
                    "field_conditions",
                ],
        }

    return {
        "status":
            "VERIFIED",

        "issues":
            [],

        "checked_fields":
            [
                "farm_summary",
                "land",
                "field_conditions",
                "missing_information",
            ],
    }


def build_next_questions(
    ai_profile: Dict[str, Any],
) -> list[str]:
    missing = ai_profile.get("missing_information", [])
    questions = []

    question_map = {
        "soil_type": "Do you know your soil type or soil test result?",
        "water_source": "What is your main water source for the banana crop?",
        "water_source_and_availability": "What is your main water source for the banana crop?",
        "irrigation_method": "What irrigation method do you use?",
        "fertilizer_or_pest_control_history": (
            "Can you tell me about your fertilizer or pest control practices?"
        ),
        "yield_history": "Do you know your previous banana yield?",
        "legal_ownership_status": "What is the ownership status of this farm?",
        "farm_ownership_status": "What is the ownership status of this farm?",
        "land_use_permissions": "Do you have the required permission to use this land for farming?",
        "pest_disease_history": "Have you noticed any pest or disease problems before?",
        "agronomic_practices": "Can you tell me about your usual farming practices?",
    }

    for item in missing:
        if isinstance(item, dict):
            key = str(item.get("key", "")).strip().lower()
        else:
            key = str(item).strip().lower()

        if not key:
            continue

        question = question_map.get(key)

        if question:
            questions.append(question)
        else:
            readable = key.replace("_", " ").strip()
            questions.append(
                f"Can you provide information about {readable}?"
            )

    return questions[:5]

    missing = ai_profile.get(
        "missing_information",
        []
    )

    questions = []

    for item in missing:

        value = str(
            item
        ).lower()

        if (
            "soil"
            in value
        ):
            questions.append(
                "Do you know your soil type or soil test result?"
            )

        elif (
            "water"
            in value
        ):
            questions.append(
                "What is your main water source for the banana crop?"
            )

        elif (
            "planting"
            in value
        ):
            questions.append(
                "Are you planning a new banana planting or is the crop already growing?"
            )

        elif (
            "labour"
            in value
            or "worker"
            in value
        ):
            questions.append(
                "How many workers can normally work on your farm?"
            )

        else:
            questions.append(
                f"Please provide: {item}."
            )

    # Avoid a giant farmer questionnaire.
    return questions[:5]


def create_profile(
    farm_id: str,
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
    perimeter_m: float,
    farmer_confirmed: bool,
    boundary_source: str,
) -> Dict[str, Any]:

    # -----------------------------------------------------
    # 1. Save raw farmer-confirmed farm state
    # -----------------------------------------------------

    save_farm(
        farm_id=farm_id,

        farm_profile=farm_profile,

        location=location,

        boundary=boundary,

        mapped_area_acres=
            mapped_area_acres,

        perimeter_m=
            perimeter_m,

        farmer_confirmed=
            farmer_confirmed,

        boundary_source=
            boundary_source,
    )

    # -----------------------------------------------------
    # 2. AI structured profile
    # -----------------------------------------------------

    ai_profile = create_farm_profile(
        farm_profile=
            farm_profile,

        location=
            location,

        boundary=
            boundary,

        mapped_area_acres=
            mapped_area_acres,
    )

    # -----------------------------------------------------
    # 3. Verification
    # -----------------------------------------------------

    verification = verify_profile(
        farm_profile=
            farm_profile,

        ai_profile=
            ai_profile,
    )

    # -----------------------------------------------------
    # 4. Next useful farmer questions
    # -----------------------------------------------------

    next_questions = (
        build_next_questions(
            ai_profile
        )
    )

    # -----------------------------------------------------
    # 5. Store AI result
    # -----------------------------------------------------

    update_ai_profile(
        farm_id=
            farm_id,

        ai_profile=
            ai_profile,

        verification=
            verification,
    )

    return {
    "farm_id": farm_id,
    "saved": True,
    "profile_status": "PROFILE_READY",
    "profile": ai_profile,
    "next_questions": next_questions,
    "verification": verification,
}