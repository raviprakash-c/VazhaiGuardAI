from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        # Persisted timestamps without an offset are treated as UTC, never as
        # the host machine's local timezone.
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def _safe_number(value: Any) -> float:
    """Parse optional weather values without breaking the inspection planner."""
    if value is None or isinstance(value, bool):
        return 0.0
    try:
        from math import isfinite
        number = float(value)
        return number if isfinite(number) else 0.0
    except (TypeError, ValueError, OverflowError):
        return 0.0


def plan_next_inspection(
    *,
    history: list[dict[str, Any]],
    current_weather: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not history:
        return {
            "decision": "BASELINE_REQUIRED",
            "priority": "normal",
            "reinspect": True,
            "reason": "No previous inspection is available.",
            "when": "After the first field inspection",
            "where": "The farmer's selected farm area",
            "checks": ["Take a clear photo of the affected plant or leaf."],
            "trigger": "baseline",
            "engine": "agentic-reinspection-v1",
        }

    latest = history[-1]
    incident = latest.get("incident") or {}
    evaluation = latest.get("evaluation") or {}
    comparison = latest.get("comparison") or {}
    vision = latest.get("vision_summary") or {}

    severity = str(incident.get("severity") or "low").lower()
    needs_verification = bool(
        incident.get("field_verification_required")
        or evaluation.get("requires_field_verification")
        or vision.get("needs_field_verification")
    )

    comparison_status = str(comparison.get("status") or "").lower()
    if comparison_status == "worsened":
        return {
            "decision": "REINSPECT_SOON",
            "priority": "high",
            "reinspect": True,
            "reason": "The latest inspection is worse than the previous inspection.",
            "when": "At the next safe field visit",
            "where": str(incident.get("where") or "The affected farm area"),
            "checks": [
                "Photograph the same affected plant or area again.",
                "Check whether symptoms have spread to nearby plants.",
                "Check soil moisture and drainage around the affected plants.",
            ],
            "trigger": "worsening",
            "engine": "agentic-reinspection-v1",
        }

    if severity == "high" or needs_verification:
        return {
            "decision": "REINSPECT_SOON",
            "priority": "high" if severity == "high" else "moderate",
            "reinspect": True,
            "reason": "The available evidence still needs field confirmation.",
            "when": "During the next safe field visit",
            "where": str(incident.get("where") or "The affected farm area"),
            "checks": [
                "Retake a clear close-up photo in good light.",
                "Check the underside of affected leaves.",
                "Check soil moisture and standing water near affected plants.",
            ],
            "trigger": "verification_required",
            "engine": "agentic-reinspection-v1",
        }

    weather = current_weather if isinstance(current_weather, dict) else {}
    next24_value = weather.get("next_24_hours")
    next24 = next24_value if isinstance(next24_value, dict) else {}
    rain = _safe_number(next24.get("max_rain_probability"))
    gust = _safe_number(next24.get("max_wind_gust"))
    if rain >= 80 or gust >= 45:
        peak = next24.get("peak_rain_time") or next24.get("peak_gust_time")
        when = "After the heavy rain / strong wind passes"
        if isinstance(peak, str):
            dt = _parse_iso(peak)
            if dt:
                when = f"After the weather event around {dt.astimezone(timezone.utc).strftime('%d %b, %I:%M %p')} UTC"
        return {
            "decision": "WEATHER_TRIGGERED_REINSPECTION",
            "priority": "moderate",
            "reinspect": True,
            "reason": "A strong weather event may change field conditions.",
            "when": when,
            "where": str(incident.get("where") or "Low-lying and exposed farm areas"),
            "checks": [
                "Check drainage and standing water.",
                "Check banana supports after strong wind.",
                "Take a follow-up photo if visible damage or new symptoms appear.",
            ],
            "trigger": "weather_event",
            "engine": "agentic-reinspection-v1",
        }

    created = _parse_iso(latest.get("created_at"))
    if created:
        age = datetime.now(timezone.utc) - created
        # A future timestamp can result from clock skew; it must not make an
        # inspection immediately overdue.
        if timedelta(0) <= age and age >= timedelta(days=7):
            return {
                "decision": "ROUTINE_REINSPECTION_DUE",
                "priority": "normal",
                "reinspect": True,
                "reason": "The latest inspection is more than 7 days old.",
                "when": "During the next normal field visit",
                "where": str(incident.get("where") or "The inspected farm area"),
                "checks": ["Take a comparable photo from the same area.", "Check for new or spreading symptoms."],
                "trigger": "time_based",
                "engine": "agentic-reinspection-v1",
            }

    return {
        "decision": "WAIT_AND_MONITOR",
        "priority": "low",
        "reinspect": False,
        "reason": "No strong trigger for another inspection is present.",
        "when": "During the next normal field visit, or sooner if symptoms spread.",
        "where": str(incident.get("where") or "The inspected farm area"),
        "checks": ["Continue normal field monitoring."],
        "trigger": "no_trigger",
        "engine": "agentic-reinspection-v1",
    }
