from __future__ import annotations

import json
import os
from typing import Any, Dict

import boto3


AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)


# Exact Bedrock model ID allowed
# for your AWS account.
TEXT_MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL"
)


def get_bedrock_client():
    """
    Create the Amazon Bedrock Runtime client.
    """

    return boto3.client(
        "bedrock-runtime",
        region_name=AWS_REGION,
    )


def extract_json(
    text: str,
) -> Dict[str, Any]:
    """
    Extract a JSON object from a Bedrock response.

    Handles:
    - pure JSON
    - JSON inside Markdown code fences
    - JSON surrounded by additional text
    """

    cleaned = (
        text
        .replace("```json", "")
        .replace("```JSON", "")
        .replace("```", "")
        .strip()
    )

    # --------------------------------------------------------
    # 1. Try complete response
    # --------------------------------------------------------

    try:

        result = json.loads(
            cleaned
        )

        if not isinstance(result, dict):
            raise ValueError(
                "Bedrock JSON response "
                "is not an object."
            )

        return result

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # 2. Find JSON object inside additional text
    # --------------------------------------------------------

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if (
        start == -1
        or end == -1
        or end <= start
    ):

        raise ValueError(
            "Bedrock did not return "
            "a JSON object."
        )

    json_text = cleaned[
        start:end + 1
    ]

    # --------------------------------------------------------
    # 3. Parse extracted JSON
    # --------------------------------------------------------

    try:

        result = json.loads(
            json_text
        )

    except json.JSONDecodeError as error:

        print(
            "\n========== BEDROCK RAW RESPONSE =========="
        )

        print(
            cleaned
        )

        print(
            "========== END BEDROCK RESPONSE =========="
        )

        print(
            "JSON ERROR:",
            error,
        )

        raise

    if not isinstance(result, dict):

        raise ValueError(
            "Bedrock JSON response "
            "is not an object."
        )

    return result


def create_farm_profile(
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
) -> Dict[str, Any]:
    """
    Create an AI farm profile using Amazon Bedrock.

    The model must only use information supplied
    by the farmer/application and must not invent
    missing agricultural information.
    """

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
using ONLY the information provided below.

Do not invent missing information.

FARMER REGISTRATION:
{json.dumps(
    farm_profile,
    ensure_ascii=False,
    indent=2,
    default=str,
)}

FARM LOCATION:
{json.dumps(
    location,
    ensure_ascii=False,
    indent=2,
    default=str,
)}

FARM BOUNDARY:
{json.dumps(
    boundary,
    ensure_ascii=False,
    indent=2,
    default=str,
)}

MAPPED AREA:
{mapped_area_acres} acres

Return STRICT JSON only.

Required JSON structure:

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
    "mapped_area_acres": {mapped_area_acres}
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
8. Use "banana" as the crop.
9. Preserve farmer-provided values accurately.
10. Do not add information that was not provided.
11. Return valid JSON.
12. Do not use Markdown code fences.
13. The profile will later be used by
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
            "maxTokens": 1200,
            "temperature": 0.0,
            "topP": 0.9,
        },
    )

    output = (
        response
        .get("output", {})
        .get("message", {})
        .get("content", [])
    )

    if not output:

        raise RuntimeError(
            "Bedrock returned an empty response."
        )

    output_text = output[0].get(
        "text"
    )

    if not output_text:

        raise RuntimeError(
            "Bedrock response did not contain text."
        )

    return extract_json(
        output_text
    )


def generate_text(
    prompt: str,
    model_id: str | None = None,
    max_tokens: int = 400,
    temperature: float = 0.0,
) -> str:
    """
    General-purpose Bedrock text generation.
    """

    selected_model = (
        model_id or TEXT_MODEL_ID
    )

    if not selected_model:

        raise RuntimeError(
            "No Bedrock model ID configured."
        )

    client = get_bedrock_client()

    response = client.converse(
        modelId=selected_model,

        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": prompt
                    }
                ],
            }
        ],

        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    )

    content = (
        response
        .get("output", {})
        .get("message", {})
        .get("content", [])
    )

    if not content:

        raise RuntimeError(
            "Bedrock returned an empty response."
        )

    text = content[0].get(
        "text"
    )

    if not text:

        raise RuntimeError(
            "Bedrock response did not contain text."
        )

    return text