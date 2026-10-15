"""Durable persistence for farmer action outcomes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.dynamodb_service import get_table, to_dynamodb_value


def build_feedback_event(
    *,
    action_id: str,
    outcome: str,
    farmer_id: str,
    language: str,
    note: str | None = None,
    recorded_at: str | None = None,
) -> dict[str, Any]:
    """Create a compact, timestamped feedback event safe for DynamoDB."""
    return {
        "action_id": action_id.strip(),
        "outcome": outcome,
        "language": "ta-IN" if language.lower().startswith("ta") else "en-IN",
        "note": (note or "").strip()[:500],
        "recorded_at": recorded_at or datetime.now(timezone.utc).isoformat(),
    }


def persist_feedback(*, farm_id: str, event: dict[str, Any]) -> None:
    """Append feedback to the existing farm item; never overwrite farm data."""
    if not farm_id or not farm_id.strip():
        raise ValueError("farm_id is required for durable feedback.")
    safe_event = to_dynamodb_value(event)
    get_table().update_item(
        Key={"farm_id": farm_id.strip()},
        UpdateExpression="SET farmer_feedback = list_append(if_not_exists(farmer_feedback, :empty), :events)",
        ExpressionAttributeValues={":empty": [], ":events": [safe_event]},
        ConditionExpression="attribute_exists(farm_id)",
    )


def get_feedback_history(*, farm_id: str) -> list[dict[str, Any]]:
    """Return the most recent feedback entries for a known farm."""
    if not farm_id or not farm_id.strip():
        raise ValueError("farm_id is required.")
    response = get_table().get_item(
        Key={"farm_id": farm_id.strip()},
        ProjectionExpression="farm_id, farmer_feedback",
        ConsistentRead=True,
    )
    item = response.get("Item")
    if not item:
        raise LookupError("Farm was not found.")
    entries = item.get("farmer_feedback") or []
    return list(reversed(entries[-50:]))
