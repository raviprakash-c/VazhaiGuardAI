from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

import boto3


AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)


TABLE_NAME = os.getenv(
    "VAZHAIGUARD_DYNAMODB_TABLE",
    "vazhaiguard-farms",
)


def _to_dynamodb_value(
    value: Any,
) -> Any:
    """
    Convert Python float values to Decimal
    because DynamoDB does not support Python float
    directly.
    """

    if isinstance(value, float):

        return Decimal(
            str(value)
        )

    if isinstance(value, dict):

        return {
            key: _to_dynamodb_value(
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


def get_table():
    """
    Return the VazhaiGuard DynamoDB table.
    """

    dynamodb = boto3.resource(
        "dynamodb",
        region_name=AWS_REGION,
    )

    return dynamodb.Table(
        TABLE_NAME
    )


def save_farm(
    farm_id: str,
    farm_profile: Dict[str, Any],
    location: Dict[str, Any],
    boundary: Dict[str, Any],
    mapped_area_acres: float,
    perimeter_m: float,
    farmer_confirmed: bool,
    boundary_source: str,
    ai_profile: Dict[str, Any] | None = None,
    verification: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Save the farmer registration and farm
    mapping information into DynamoDB.
    """

    now = datetime.now(
        timezone.utc
    ).isoformat()

    item = {
        "farm_id": farm_id,

        "created_at": now,

        "updated_at": now,

        "farm_profile": farm_profile,

        "location": location,

        "boundary": boundary,

        "mapped_area_acres":
            mapped_area_acres,

        "perimeter_m":
            perimeter_m,

        "farmer_confirmed":
            bool(
                farmer_confirmed
            ),

        "boundary_source":
            boundary_source,

        "profile_status":
            "FARMER_CONFIRMED",

        "ai_profile":
            ai_profile or {},

        "verification":
            verification or {
                "status":
                    "PENDING"
            },
    }

    # Convert floats recursively before
    # sending the item to DynamoDB.
    item = _to_dynamodb_value(
        item
    )

    table = get_table()

    table.put_item(
        Item=item
    )

    return item


def get_farm(
    farm_id: str,
) -> Dict[str, Any] | None:
    """
    Retrieve one farm from DynamoDB.
    """

    table = get_table()

    response = table.get_item(
        Key={
            "farm_id": farm_id
        }
    )

    return response.get(
        "Item"
    )


def update_ai_profile(
    farm_id: str,
    ai_profile: Dict[str, Any],
    verification: Dict[str, Any],
) -> None:
    """
    Update the AI-generated farm profile
    after Bedrock processing and verification.
    """

    table = get_table()

    ai_profile = _to_dynamodb_value(
        ai_profile
    )

    verification = _to_dynamodb_value(
        verification
    )

    table.update_item(
        Key={
            "farm_id": farm_id
        },

        UpdateExpression="""
            SET
                ai_profile = :profile,
                verification = :verification,
                profile_status = :status,
                updated_at = :updated
        """,

        ExpressionAttributeValues={
            ":profile":
                ai_profile,

            ":verification":
                verification,

            ":status":
                "PROFILE_READY",

            ":updated":
                datetime.now(
                    timezone.utc
                ).isoformat(),
        },
    )