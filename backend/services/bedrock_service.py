from __future__ import annotations

import json
import os
import re
from typing import Any, Dict

import boto3


AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)


# IMPORTANT:
# Put the exact model ID that already works
# in your voice_registration.py into the
# environment variable below.
#
# Example:
# $env:VAZHAIGUARD_TEXT_MODEL="..."
#
TEXT_MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL"
)


def get_bedrock_client():

    return boto3.client(
        "bedrock-runtime",
        region_name=AWS_REGION,
    )


def extract_json(
    text: str,
) -> Dict[str, Any]:

    cleaned = (
        text
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    try:
        return json.loads(
            cleaned
        )

    except json.JSONDecodeError:

        match = re.search(
            r"\{.*\}",
            cleaned,
            re.DOTALL,
        )

        if not match:
            raise ValueError(
                "Bedrock did not return valid JSON."
            )

        return json.loads(
            match.group(0)
        )


def create_farm_profile(
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
) -> Dict[str, Any]:

    if not TEXT_MODEL_ID:

        raise RuntimeError(
            "VAZHAIGUARD_TEXT_MODEL "
            "environment variable is not configured."
        )

    prompt = f"""
You are the Farm Profile Intelligence
for VazhaiGuard AI.

This is a Tamil Nadu banana farm.

Create a structured farm intelligence profile
from ONLY the information provided.

Do not invent missing information.

FARMER REGISTRATION:
{json.dumps(
    farm_profile,
    ensure_ascii=False,
    indent=2
)}

FARM LOCATION:
{json.dumps(
    location,
    ensure_ascii=False,
    indent=2
)}

FARM BOUNDARY:
{json.dumps(
    boundary,
    ensure_ascii=False,
    indent=2
)}

MAPPED AREA:
{mapped_area_acres} acres

Return STRICT JSON.

Required structure:

{{
  "farm_summary": {{
    "farm_name": "",
    "crop": "banana",
    "variety": "",
    "crop_status": "existing|new_planting|unknown",
    "planting_age": "",
    "approximate_plants": null
  }},

  "land": {{
    "registered_area_acres": null,
    "mapped_area_acres": {mapped_area_acres},
    "area_difference_note": ""
  }},

  "field_conditions": {{
    "drainage": "",
    "support": "",
    "accessibility": ""
  }},

  "known_information": [],

  "missing_information": [],

  "risk_context": [],

  "recommended_next_step": "",

  "confidence": 0.0
}}

Rules:

1. Never invent soil information.
2. Never invent water availability.
3. Never claim legal ownership.
4. The boundary is farmer-confirmed only.
5. Mapped area is a geographic measurement.
6. Missing information must remain missing.
7. Keep confidence between 0 and 1.
8. This profile will later be used by
   planting, growth and StormGuard modules.
"""

    client = get_bedrock_client()

    response = client.converse(
        modelId=TEXT_MODEL_ID,

        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],

        inferenceConfig={
            "maxTokens": 1000,
            "temperature": 0.0,
            "topP": 0.9,
        },
    )

    output_text = (
        response[
            "output"
        ][
            "message"
        ][
            "content"
        ][0][
            "text"
        ]
    )

    return extract_json(
        output_text
    )