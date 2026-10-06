from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from services.dynamodb_service import AWS_REGION, _to_dynamodb_value, get_table, session

S3_BUCKET = os.getenv("VAZHAIGUARD_S3_BUCKET", "").strip()
S3_PREFIX = os.getenv("VAZHAIGUARD_S3_PREFIX", "inspections").strip("/") or "inspections"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in value)
    return cleaned[:100] or "unknown"


def get_s3_client():
    return session.client("s3", region_name=AWS_REGION)


def s3_health() -> dict[str, Any]:
    if not S3_BUCKET:
        return {"configured": False, "bucket": None, "status": "not_configured"}
    try:
        get_s3_client().head_bucket(Bucket=S3_BUCKET)
        return {"configured": True, "bucket": S3_BUCKET, "status": "ready"}
    except Exception as exc:
        return {
            "configured": True,
            "bucket": S3_BUCKET,
            "status": "unavailable",
            "error": str(exc),
        }


def store_photo(
    *,
    farm_id: str,
    inspection_id: str,
    image_bytes: bytes,
    content_type: str,
) -> dict[str, Any]:
    if not S3_BUCKET:
        return {
            "stored": False,
            "status": "not_configured",
            "bucket": None,
            "key": None,
        }

    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }.get(content_type, "jpg")

    key = f"{S3_PREFIX}/{_safe(farm_id)}/{_safe(inspection_id)}/photo.{extension}"

    get_s3_client().put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=image_bytes,
        ContentType=content_type,
        ServerSideEncryption="AES256",
        Metadata={
            "farm-id": _safe(farm_id),
            "inspection-id": _safe(inspection_id),
        },
    )

    return {
        "stored": True,
        "status": "stored",
        "bucket": S3_BUCKET,
        "key": key,
        "s3_uri": f"s3://{S3_BUCKET}/{key}",
    }


def save_inspection_record(*, farm_id: str, record: dict[str, Any]) -> dict[str, Any]:
    get_table().update_item(
        Key={"farm_id": str(farm_id)},
        UpdateExpression=(
            "SET inspection_history = list_append("
            "if_not_exists(inspection_history, :empty), :entry"
            "), updated_at = :updated_at"
        ),
        ExpressionAttributeValues={
            ":empty": [],
            ":entry": [_to_dynamodb_value(record)],
            ":updated_at": _now(),
        },
        ReturnValues="NONE",
    )
    return record


def create_inspection_record(
    *,
    farm_id: str,
    inspection_id: str,
    parent_inspection_id: str | None,
    result: dict[str, Any],
    storage: dict[str, Any],
) -> dict[str, Any]:
    return {
        "inspection_id": inspection_id,
        "parent_inspection_id": parent_inspection_id,
        "created_at": _now(),
        "status": "REINSPECTION" if parent_inspection_id else "COMPLETED",
        "photo": {
            "s3_key": storage.get("key"),
            "s3_uri": storage.get("s3_uri"),
            "stored": bool(storage.get("stored")),
        },
        "incident": result.get("incident", {}),
        "action_plan": result.get("action_plan", {}),
        "risk": result.get("risk", {}),
        "evaluation": result.get("evaluation", {}),
        "decision": result.get("decision", {}),
        "vision_summary": {
            "observation": result.get("vision", {}).get("observation"),
            "visual_confidence": result.get("vision", {}).get("visual_confidence"),
            "needs_field_verification": result.get("vision", {}).get("needs_field_verification"),
        },
    }
