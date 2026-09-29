from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import boto3


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

# IMPORTANT:
# Team 53 DynamoDB resource.
#
# Do NOT use:
#   vazhaiguard-farms
#
# Do NOT use:
#   fai-tce-team53-farms
#
# The currently verified ACTIVE table is:
#   fai-tce-team53-vazhaiguard-farms
#
DYNAMODB_TABLE_NAME = os.getenv(
    "VAZHAIGUARD_DYNAMODB_TABLE",
    "fai-tce-team53-vazhaiguard-farms",
)


# ============================================================
# AWS SESSION
# ============================================================

def create_aws_session():
    """
    Create the AWS session using the VazhaiGuard
    AWS IAM Identity Center profile.

    This makes sure the backend uses the same
    authenticated AWS identity that you verified
    from PowerShell.
    """

    return boto3.Session(
        profile_name=AWS_PROFILE,
        region_name=AWS_REGION,
    )


# One shared session for the backend.
session = create_aws_session()


# ============================================================
# DYNAMODB RESOURCE
# ============================================================

dynamodb = session.resource(
    "dynamodb",
    region_name=AWS_REGION,
)


def get_table():
    """
    Return the Team 53 VazhaiGuard farms table.
    """

    return dynamodb.Table(
        DYNAMODB_TABLE_NAME
    )


# ============================================================
# DYNAMODB VALUE CONVERSION
# ============================================================

def _to_dynamodb_value(
    value: Any,
) -> Any:
    """
    Recursively convert Python values into
    DynamoDB-compatible values.

    DynamoDB does not accept Python float values
    through boto3's high-level resource interface,
    so floats are converted to Decimal.
    """

    if isinstance(value, float):
        return Decimal(
            str(value)
        )

    if isinstance(value, Decimal):
        return value

    if isinstance(value, dict):
        return {
            str(key): _to_dynamodb_value(
                val
            )
            for key, val in value.items()
        }

    if isinstance(value, list):
        return [
            _to_dynamodb_value(
                item
            )
            for item in value
        ]

    if isinstance(value, tuple):
        return [
            _to_dynamodb_value(
                item
            )
            for item in value
        ]

    return value


# Backward-compatible public alias.
#
# Some existing code may use:
#     to_dynamodb_value(...)
#
# Keep it available so those modules do not break.
def to_dynamodb_value(
    value: Any,
) -> Any:
    return _to_dynamodb_value(
        value
    )


# ============================================================
# TIMESTAMP
# ============================================================

def _utc_now() -> str:
    """
    Return current UTC timestamp in ISO format.
    """

    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================================
# DYNAMODB HEALTH CHECK
# ============================================================

def check_dynamodb_table() -> Dict[str, Any]:
    """
    Verify that the configured Team 53 DynamoDB
    table exists and is accessible.
    """

    try:

        response = dynamodb.meta.client.describe_table(
            TableName=DYNAMODB_TABLE_NAME
        )

        table_info = response.get(
            "Table",
            {},
        )

        return {
            "ok": True,
            "table_name": DYNAMODB_TABLE_NAME,
            "status": table_info.get(
                "TableStatus"
            ),
            "key_schema": table_info.get(
                "KeySchema"
            ),
        }

    except Exception as error:

        print(
            "\n========== DYNAMODB HEALTH CHECK ERROR =========="
        )

        print(
            "TABLE:",
            DYNAMODB_TABLE_NAME,
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
            "ERROR:",
            repr(error),
        )

        print(
            "========== END DYNAMODB HEALTH CHECK ERROR ==========\n"
        )

        raise


# ============================================================
# AWS IDENTITY
# ============================================================

def get_aws_identity() -> Dict[str, Any]:
    """
    Return the AWS identity currently being used
    by this backend.
    """

    sts = session.client(
        "sts",
        region_name=AWS_REGION,
    )

    return sts.get_caller_identity()


# ============================================================
# SAVE FARM
# ============================================================

def save_farm(
    farm_id: str,
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
    perimeter_m: float,
    farmer_confirmed: bool,
    boundary_source: str,
    ai_profile: Optional[
        Dict[str, Any]
    ] = None,
    verification: Optional[
        Dict[str, Any]
    ] = None,
    parcel_id: Optional[str] = None,
    parcel_metadata: Optional[
        Dict[str, Any]
    ] = None,
) -> Dict[str, Any]:
    """
    Save complete farm registration data
    into the Team 53 DynamoDB table.

    DynamoDB partition key:

        farm_id

    Table:

        fai-tce-team53-vazhaiguard-farms
    """

    if not farm_id:
        raise ValueError(
            "farm_id is required."
        )

    if not isinstance(
        farm_profile,
        dict,
    ):
        raise ValueError(
            "farm_profile must be a dictionary."
        )

    if not isinstance(
        location,
        dict,
    ):
        raise ValueError(
            "location must be a dictionary."
        )

    if not isinstance(
        boundary,
        dict,
    ):
        raise ValueError(
            "boundary must be a dictionary."
        )

    now = _utc_now()

    # --------------------------------------------------------
    # Build DynamoDB item
    # --------------------------------------------------------

    item: Dict[str, Any] = {

        # Required partition key.
        "farm_id": str(
            farm_id
        ),

        # Registration timestamps.
        "created_at": now,

        "updated_at": now,

        # Farmer registration data.
        "farm_profile": farm_profile,

        # Selected geographic location.
        "location": location,

        # Farmer-confirmed polygon/multipolygon.
        "boundary": boundary,

        # Geographic measurements.
        "mapped_area_acres":
            mapped_area_acres,

        "perimeter_m":
            perimeter_m,

        # Confirmation.
        "farmer_confirmed":
            bool(
                farmer_confirmed
            ),

        # Boundary origin.
        "boundary_source":
            boundary_source,

        # Current registration state.
        "profile_status":
            "FARMER_CONFIRMED",

        # AI profile is initially empty.
        "ai_profile":
            ai_profile or {},

        # Verification is initially pending.
        "verification":
            verification
            or {
                "status": "PENDING"
            },
    }

    # --------------------------------------------------------
    # Optional parcel information
    # --------------------------------------------------------

    if parcel_id:
        item[
            "parcel_id"
        ] = str(
            parcel_id
        )

    if parcel_metadata is not None:
        item[
            "parcel_metadata"
        ] = parcel_metadata

    # --------------------------------------------------------
    # Convert floats to Decimal
    # --------------------------------------------------------

    item = _to_dynamodb_value(
        item
    )

    # --------------------------------------------------------
    # Get configured table
    # --------------------------------------------------------

    table = get_table()

    print(
        "\n========== DYNAMODB FARM SAVE =========="
    )

    print(
        "TABLE:",
        DYNAMODB_TABLE_NAME,
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
        "FARM ID:",
        farm_id,
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    try:

        table.put_item(
            Item=item
        )

    except Exception as error:

        print(
            "\n========== DYNAMODB PUT ERROR =========="
        )

        print(
            "TABLE:",
            DYNAMODB_TABLE_NAME,
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
            "ERROR:",
            repr(error),
        )

        print(
            "========== END DYNAMODB PUT ERROR ==========\n"
        )

        raise

    print(
        "FARM SAVED SUCCESSFULLY"
    )

    print(
        "========== END DYNAMODB FARM SAVE ==========\n"
    )

    return item


# ============================================================
# GET FARM
# ============================================================

def get_farm(
    farm_id: str,
) -> Optional[
    Dict[str, Any]
]:
    """
    Retrieve one farm using the DynamoDB
    partition key farm_id.
    """

    if not farm_id:
        raise ValueError(
            "farm_id is required."
        )

    table = get_table()

    try:

        response = table.get_item(
            Key={
                "farm_id": str(
                    farm_id
                )
            }
        )

    except Exception as error:

        print(
            "\n========== DYNAMODB GET ERROR =========="
        )

        print(
            "TABLE:",
            DYNAMODB_TABLE_NAME,
        )

        print(
            "FARM ID:",
            farm_id,
        )

        print(
            "ERROR:",
            repr(error),
        )

        print(
            "========== END DYNAMODB GET ERROR ==========\n"
        )

        raise

    return response.get(
        "Item"
    )


# ============================================================
# UPDATE AI PROFILE
# ============================================================

def update_ai_profile(
    farm_id: str,
    ai_profile: Dict[str, Any],
    verification: Optional[
        Dict[str, Any]
    ] = None,
) -> Dict[str, Any]:
    """
    Update the AI-generated farm profile
    inside the SAME farm item.

    This function is used by:
        agents/farm_profile_agent.py
    """

    if not farm_id:
        raise ValueError(
            "farm_id is required."
        )

    if not isinstance(
        ai_profile,
        dict,
    ):
        raise ValueError(
            "ai_profile must be a dictionary."
        )

    table = get_table()

    update_expression = (
        "SET "
        "ai_profile = :ai_profile, "
        "profile_status = :profile_status, "
        "updated_at = :updated_at"
    )

    expression_values: Dict[
        str,
        Any
    ] = {

        ":ai_profile":
            _to_dynamodb_value(
                ai_profile
            ),

        ":profile_status":
            "PROFILE_READY",

        ":updated_at":
            _utc_now(),
    }

    if verification is not None:

        update_expression += (
            ", verification = :verification"
        )

        expression_values[
            ":verification"
        ] = _to_dynamodb_value(
            verification
        )

    try:

        response = table.update_item(

            Key={
                "farm_id": str(
                    farm_id
                )
            },

            UpdateExpression=(
                update_expression
            ),

            ExpressionAttributeValues=(
                expression_values
            ),

            ReturnValues="ALL_NEW",
        )

    except Exception as error:

        print(
            "\n========== DYNAMODB AI PROFILE ERROR =========="
        )

        print(
            "TABLE:",
            DYNAMODB_TABLE_NAME,
        )

        print(
            "FARM ID:",
            farm_id,
        )

        print(
            "ERROR:",
            repr(error),
        )

        print(
            "========== END DYNAMODB AI PROFILE ERROR ==========\n"
        )

        raise

    return response.get(
        "Attributes",
        {},
    )


# ============================================================
# SAVE FARM ZONES
# ============================================================

def save_farm_zones(
    farm_id: str,
    zones: list,
    total_area_acres: float,
) -> Dict[str, Any]:
    """
    Save farm zones.

    IMPORTANT:
    This writes to the SAME DynamoDB table.

    Because farm_id is the partition key, the zone
    record below would replace an existing item if
    it uses the same farm_id.

    Therefore, for now this function stores zones
    inside the main farm item using update_item.
    """

    if not farm_id:
        raise ValueError(
            "farm_id is required."
        )

    table = get_table()

    converted_zones = _to_dynamodb_value(
        zones
    )

    converted_area = _to_dynamodb_value(
        total_area_acres
    )

    try:

        response = table.update_item(

            Key={
                "farm_id": str(
                    farm_id
                )
            },

            UpdateExpression="""
                SET
                    zones = :zones,
                    zone_count = :zone_count,
                    total_area_acres = :total_area_acres,
                    updated_at = :updated_at
            """,

            ExpressionAttributeValues={

                ":zones":
                    converted_zones,

                ":zone_count":
                    len(zones),

                ":total_area_acres":
                    converted_area,

                ":updated_at":
                    _utc_now(),
            },

            ReturnValues="ALL_NEW",
        )

    except Exception as error:

        print(
            "\n========== DYNAMODB ZONE ERROR =========="
        )

        print(
            "TABLE:",
            DYNAMODB_TABLE_NAME,
        )

        print(
            "FARM ID:",
            farm_id,
        )

        print(
            "ERROR:",
            repr(error),
        )

        print(
            "========== END DYNAMODB ZONE ERROR ==========\n"
        )

        raise

    return response.get(
        "Attributes",
        {},
    )