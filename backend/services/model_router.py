from __future__ import annotations

import os
from dataclasses import dataclass


SMALL_MODEL = os.getenv(
    "VAZHAIGUARD_SMALL_MODEL",
    "mistral.ministral-3-3b-instruct",
)


TEXT_MODEL = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)


ROUTER_MODEL = os.getenv(
    "VAZHAIGUARD_ROUTER_MODEL",
    "amazon.nova-micro-v1:0",
)


MULTIMODAL_MODEL = os.getenv(
    "VAZHAIGUARD_MULTIMODAL_MODEL",
    "amazon.nova-lite-v1:0",
)


@dataclass
class RouteResult:

    task_type: str

    selected_model: str

    model_id: str

    reason: str

    fallback_model: str | None = None


def route_request(
    user_query: str,
    has_image: bool = False,
) -> RouteResult:

    query = (
        user_query
        .strip()
        .lower()
    )

    # -----------------------------------------------------
    # IMAGE REQUEST
    # -----------------------------------------------------

    if has_image:

        return RouteResult(

            task_type="multimodal",

            selected_model="Nova Lite",

            model_id=MULTIMODAL_MODEL,

            reason=(
                "Image input is present, "
                "so a multimodal model is required."
            ),

            fallback_model=TEXT_MODEL,
        )

    # -----------------------------------------------------
    # STORM / WEATHER / PROTECTION
    # -----------------------------------------------------

    storm_keywords = [
        "storm",
        "wind",
        "cyclone",
        "rain",
        "heavy rain",
        "strong wind",
        "protect",
        "stormguard",
        "storm guard",
        "புயல்",
        "காற்று",
        "மழை",
    ]

    if any(
        keyword in query
        for keyword in storm_keywords
    ):

        return RouteResult(

            task_type="stormguard",

            selected_model="Nova Micro",

            model_id=ROUTER_MODEL,

            reason=(
                "The request concerns "
                "weather or storm protection."
            ),

            fallback_model=TEXT_MODEL,
        )

    # -----------------------------------------------------
    # FARM PROFILE / PLANNING / AGRICULTURE REASONING
    # -----------------------------------------------------

    profile_keywords = [
        "farm profile",
        "farm plan",
        "planting",
        "banana",
        "soil",
        "water",
        "crop",
        "field",
        "land",
        "variety",
        "fertilizer",
        "drainage",
        "தோட்டம்",
        "வாழை",
        "மண்",
        "தண்ணீர்",
        "பயிர்",
    ]

    if any(
        keyword in query
        for keyword in profile_keywords
    ):

        return RouteResult(

            task_type="agriculture_reasoning",

            selected_model="Ministral 8B",

            model_id=TEXT_MODEL,

            reason=(
                "The request requires "
                "agricultural reasoning and "
                "structured farm context."
            ),

            fallback_model=SMALL_MODEL,
        )

    # -----------------------------------------------------
    # SIMPLE REQUEST
    # -----------------------------------------------------

    return RouteResult(

        task_type="simple_text",

        selected_model="Ministral 3B",

        model_id=SMALL_MODEL,

        reason=(
            "The request is a simple "
            "text task, so the smaller "
            "model is selected."
        ),

        fallback_model=ROUTER_MODEL,
    )