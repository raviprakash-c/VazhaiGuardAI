from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Any

from services.agentic_reinspection import plan_next_inspection


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _format_date(value: Any) -> str:
    parsed = _parse_iso(value)
    if not parsed:
        return "Date unavailable"
    return parsed.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y, %I:%M %p")


def _risk_score(record: dict[str, Any]) -> float | None:
    try:
        return round(float((record.get("risk") or {}).get("score")), 1)
    except (TypeError, ValueError):
        return None


def _signals(record: dict[str, Any]) -> list[str]:
    summary = record.get("vision_summary") or record.get("vision") or {}
    values = summary.get("stress_signals") or []
    return [str(value).strip() for value in values if str(value).strip()][:5]


def _status(record: dict[str, Any]) -> str:
    comparison = record.get("comparison") or {}
    status = str(comparison.get("status") or "").lower()
    if status in {"baseline", "improved", "stable", "worsened"}:
        return status
    return "baseline"


def _entry(record: dict[str, Any], index: int, total: int) -> dict[str, Any]:
    incident = record.get("incident") or {}
    decision = record.get("decision") or {}
    action_plan = record.get("action_plan") or incident
    actions = action_plan.get("actions") or incident.get("actions") or []
    first_action = actions[0] if actions else {}
    return {
        "inspection_id": record.get("inspection_id"),
        "parent_inspection_id": record.get("parent_inspection_id"),
        "sequence": total - index,
        "date": _format_date(record.get("created_at")),
        "created_at": record.get("created_at"),
        "status": _status(record),
        "incident": str(incident.get("incident") or "FIELD_CHECK").replace("_", " "),
        "severity": str(incident.get("severity") or "low").lower(),
        "risk_score": _risk_score(record),
        "signals": _signals(record),
        "photo_stored": bool((record.get("inspection_storage") or {}).get("stored", False)),
        "action": str(first_action.get("action") or decision.get("farmer_message") or record.get("action") or "Continue field monitoring."),
        "next_step": str((record.get("comparison") or {}).get("next_step") or decision.get("follow_up_check") or "Continue field monitoring."),
        "field_verification_required": bool(
            incident.get("field_verification_required")
            or (record.get("evaluation") or {}).get("requires_field_verification")
        ),
    }


def _trend(entries: list[dict[str, Any]]) -> str:
    statuses = [entry.get("status") for entry in entries]
    if "worsened" in statuses[:2]:
        return "worsening"
    if "improved" in statuses[:2]:
        return "improving"
    if statuses:
        return "stable"
    return "unknown"


def build_farm_timeline(
    *,
    farm_id: str,
    history: list[dict[str, Any]],
    current_weather: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ordered = sorted(
        [record for record in history if isinstance(record, dict)],
        key=lambda record: _parse_iso(record.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    recent = ordered[:10]
    entries = [_entry(record, index, len(ordered)) for index, record in enumerate(recent)]

    latest = entries[0] if entries else None
    active_issues: list[str] = []
    for entry in entries[:3]:
        for signal in entry.get("signals") or []:
            if signal not in active_issues:
                active_issues.append(signal)
    if latest and latest.get("incident") and latest["incident"] not in {"FIELD CHECK", "NORMAL FIELD MONITORING"}:
        if latest["incident"] not in active_issues:
            active_issues.append(latest["incident"])

    trend = _trend(entries)
    if trend == "improving":
        status = "improving"
        status_message = "சமீபத்திய நிலை முந்தைய சரிபார்ப்பை விட மேம்பட்டுள்ளது."
    elif trend == "worsening":
        status = "attention"
        status_message = "சமீபத்திய சரிபார்ப்பில் கூடுதல் கவனம் தேவை."
    elif entries:
        status = "stable"
        status_message = "சமீபத்திய சரிபார்ப்புகளில் நிலை பெரும்பாலும் மாறாமல் உள்ளது."
    else:
        status = "unknown"
        status_message = "முதல் களச் சரிபார்ப்பு இன்னும் பதிவு செய்யப்படவில்லை."

    plan = plan_next_inspection(history=ordered, current_weather=current_weather)

    return {
        "farm_id": farm_id,
        "summary": {
            "inspection_count": len(ordered),
            "latest_inspection_id": latest.get("inspection_id") if latest else None,
            "latest_date": latest.get("date") if latest else None,
            "latest_status": status,
            "latest_status_message": status_message,
            "trend": trend,
            "active_issues": active_issues[:6],
            "latest_risk_score": latest.get("risk_score") if latest else None,
        },
        "timeline": entries,
        "next_plan": plan,
        "engine": "farm-timeline-v1",
    }
