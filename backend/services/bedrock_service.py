from __future__ import annotations

import json
import os
import uuid
from decimal import Decimal
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError


# ============================================================
# AWS CONFIGURATION
# ============================================================

AWS_PROFILE = os.getenv(
    "AWS_PROFILE",
    "vazhaiguard",
)

AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)

# Approved Bedrock model
TEXT_MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)

# EXISTING Team 53 DynamoDB table
DYNAMODB_FARMS_TABLE = os.getenv(
    "VAZHAIGUARD_DYNAMODB_TABLE",
    "fai-tce-team53-vazhaiguard-farms",
)


# ============================================================
# AWS SESSION
# ============================================================

def create_aws_session():
    """
    Create the AWS session using the VazhaiGuard
    IAM Identity Center profile.

    IMPORTANT:
    Do not use the default profile here.
    """

    return boto3.Session(
        profile_name=AWS_PROFILE,
        region_name=AWS_REGION,
    )


session = create_aws_session()


# ============================================================
# AWS RESOURCES
# ============================================================

dynamodb = session.resource(
    "dynamodb",
    region_name=AWS_REGION,
)

farms_table = dynamodb.Table(
    DYNAMODB_FARMS_TABLE,
)


# ============================================================
# BEDROCK CLIENT
# ============================================================

def get_bedrock_client():
    """
    Return Bedrock Runtime client using
    the VazhaiGuard SSO session.
    """

    return session.client(
        "bedrock-runtime",
        region_name=AWS_REGION,
    )


# ============================================================
# AWS IDENTITY
# ============================================================

def get_aws_identity():
    """
    Return the AWS identity currently used
    by this backend.
    """

    sts = session.client(
        "sts",
        region_name=AWS_REGION,
    )

    return sts.get_caller_identity()


# ============================================================
# DYNAMODB HEALTH CHECK
# ============================================================

def check_dynamodb_table():
    """
    Confirm that the configured DynamoDB table exists
    and is ACTIVE.
    """

    try:

        response = farms_table.meta.client.describe_table(
            TableName=DYNAMODB_FARMS_TABLE,
        )

        table_info = response.get(
            "Table",
            {},
        )

        return {
            "table_name": table_info.get(
                "TableName"
            ),
            "status": table_info.get(
                "TableStatus"
            ),
            "key_schema": table_info.get(
                "KeySchema"
            ),
        }

    except ClientError as error:

        print(
            "\n========== DYNAMODB ERROR =========="
        )

        print(
            repr(error)
        )

        print(
            "TABLE:",
            DYNAMODB_FARMS_TABLE,
        )

        print(
            "REGION:",
            AWS_REGION,
        )

        print(
            "PROFILE:",
            AWS_PROFILE,
        )

        print(
            "========== END DYNAMODB ERROR =========="
        )

        raise


# ============================================================
# JSON SERIALIZATION
# ============================================================

def dynamodb_safe(value: Any) -> Any:
    """
    Convert values into DynamoDB-compatible values.

    This is useful for:
    - float
    - dict
    - list
    - nested farm data
    """

    if isinstance(value, float):

        return Decimal(
            str(value)
        )

    if isinstance(value, dict):

        return {
            str(key): dynamodb_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, list):

        return [
            dynamodb_safe(item)
            for item in value
        ]

    if isinstance(value, tuple):

        return [
            dynamodb_safe(item)
            for item in value
        ]

    return value


# ============================================================
# JSON EXTRACTION
# ============================================================

def extract_json(
    text: str,
) -> Dict[str, Any]:
    """
    Extract a JSON object from a Bedrock response.

    Supports:
    - pure JSON
    - Markdown code fences
    - additional text around JSON
    """

    cleaned = (
        text
        .replace("```json", "")
        .replace("```JSON", "")
        .replace("```", "")
        .strip()
    )

    # --------------------------------------------------------
    # 1. Complete response
    # --------------------------------------------------------

    try:

        result = json.loads(
            cleaned
        )

        if not isinstance(
            result,
            dict,
        ):

            raise ValueError(
                "Bedrock JSON response "
                "is not an object."
            )

        return result

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # 2. Locate JSON object
    # --------------------------------------------------------

    start = cleaned.find(
        "{"
    )

    end = cleaned.rfind(
        "}"
    )

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
    # 3. Parse
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

    if not isinstance(
        result,
        dict,
    ):

        raise ValueError(
            "Bedrock JSON response "
            "is not an object."
        )

    return result


# ============================================================
# CREATE FARM PROFILE WITH BEDROCK
# ============================================================

def create_farm_profile(
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
) -> Dict[str, Any]:
    """
    Generate the AI farm profile using Bedrock.

    IMPORTANT:
    Bedrock only interprets supplied information.
    It does not create geographic measurements.
    """

    if not TEXT_MODEL_ID:

        raise RuntimeError(
            "VAZHAIGUARD_TEXT_MODEL "
            "is not configured."
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
"""

    client = get_bedrock_client()

    try:

        response = client.converse(
            modelId=TEXT_MODEL_ID,

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
                "maxTokens": 1200,
                "temperature": 0.0,
                "topP": 0.9,
            },
        )

    except Exception as error:

        print(
            "\n========== BEDROCK ERROR =========="
        )

        print(
            repr(error)
        )

        print(
            "PROFILE:",
            AWS_PROFILE,
        )

        print(
            "REGION:",
            AWS_REGION,
        )

        print(
            "MODEL:",
            TEXT_MODEL_ID,
        )

        print(
            "========== END BEDROCK ERROR =========="
        )

        raise

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


# ============================================================
# SAVE FARM LOCATION
# ============================================================

def save_farm_location(
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
    perimeter_m: float,
    farmer_confirmed: bool,
    boundary_source: str,
    parcel_id: str | None = None,
    parcel_metadata: Dict[str, Any] | None = None,
    farm_id: str | None = None,
) -> Dict[str, Any]:
    """
    Save the farmer's confirmed farm location and boundary
    into the existing Team 53 DynamoDB table.

    DynamoDB partition key:
        farm_id
    """

    # --------------------------------------------------------
    # Validate mapped area
    # --------------------------------------------------------

    if mapped_area_acres <= 0:

        raise ValueError(
            "Mapped farm area must be greater than zero."
        )

    # --------------------------------------------------------
    # Validate boundary confirmation
    # --------------------------------------------------------

    if farmer_confirmed is not True:

        raise ValueError(
            "Farm boundary must be confirmed by the farmer."
        )

    # --------------------------------------------------------
    # Generate farm ID
    # --------------------------------------------------------

    if not farm_id:

        farm_id = (
            "farm-"
            + uuid.uuid4().hex
        )

    # --------------------------------------------------------
    # Build DynamoDB item
    # --------------------------------------------------------

    item = {

        "farm_id": farm_id,

        "farm_profile": dynamodb_safe(
            farm_profile
        ),

        "location": dynamodb_safe(
            location
        ),

        "boundary": dynamodb_safe(
            boundary
        ),

        "mapped_area_acres": Decimal(
            str(mapped_area_acres)
        ),

        "perimeter_m": Decimal(
            str(perimeter_m)
        ),

        "farmer_confirmed": True,

        "boundary_source": boundary_source,

        "created_by_profile": AWS_PROFILE,

        "aws_region": AWS_REGION,

    }

    if parcel_id:

        item["parcel_id"] = parcel_id

    if parcel_metadata:

        item["parcel_metadata"] = dynamodb_safe(
            parcel_metadata
        )

    # --------------------------------------------------------
    # Save to DynamoDB
    # --------------------------------------------------------

    try:

        farms_table.put_item(
            Item=item
        )

    except ClientError as error:

        print(
            "\n========== DYNAMODB PUT ERROR =========="
        )

        print(
            repr(error)
        )

        print(
            "TABLE:",
            DYNAMODB_FARMS_TABLE,
        )

        print(
            "PROFILE:",
            AWS_PROFILE,
        )

        print(
            "REGION:",
            AWS_REGION,
        )

        print(
            "FARM ID:",
            farm_id,
        )

        print(
            "========== END DYNAMODB PUT ERROR =========="
        )

        raise

    # --------------------------------------------------------
    # Return API-friendly response
    # --------------------------------------------------------

    return {

        "farm_id": farm_id,

        "saved": True,

        "location": location,

        "boundary": boundary,

        "mapped_area_acres": mapped_area_acres,

        "perimeter_m": perimeter_m,

        "farmer_confirmed": True,

        "boundary_source": boundary_source,

        "parcel_id": parcel_id,

        "parcel_metadata": parcel_metadata,
    }


# ============================================================
# GET FARM
# ============================================================

def get_farm(
    farm_id: str,
) -> Dict[str, Any] | None:
    """
    Retrieve one farm using the DynamoDB partition key.
    """

    try:

        response = farms_table.get_item(
            Key={
                "farm_id": farm_id
            }
        )

    except ClientError as error:

        print(
            "\n========== DYNAMODB GET ERROR =========="
        )

        print(
            repr(error)
        )

        raise

    item = response.get(
        "Item"
    )

    if not item:

        return None

    return item


# ============================================================
# GENERAL BEDROCK TEXT GENERATION
# ============================================================

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
        model_id
        or TEXT_MODEL_ID
    )

    if not selected_model:

        raise RuntimeError(
            "No Bedrock model ID configured."
        )

    client = get_bedrock_client()

    try:

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

    except Exception as error:

        print(
            "\n========== BEDROCK ERROR =========="
        )

        print(
            repr(error)
        )

        print(
            "PROFILE:",
            AWS_PROFILE,
        )

        print(
            "REGION:",
            AWS_REGION,
        )

        print(
            "MODEL:",
            selected_model,
        )

        print(
            "========== END BEDROCK ERROR =========="
        )

        raise

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