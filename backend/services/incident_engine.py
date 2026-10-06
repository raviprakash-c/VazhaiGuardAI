from __future__ import annotations

from datetime import datetime
from typing import Any


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fmt_time(value: str | None) -> str:
    if not value:
        return "the next 24 hours"
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%d %b, %I:%M %p").lstrip("0")
    except Exception:
        return value


def _rain_window(hourly: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    significant = [
        item for item in hourly
        if _num(item.get("rain_probability")) >= 50
        or _num(item.get("precipitation")) >= 0.5
    ]
    if not significant:
        return None, None
    return significant[0].get("time"), significant[-1].get("time")


def build_incident_and_action_plan(
    *,
    vision: dict[str, Any],
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    evaluation: dict[str, Any] | None,
    farm_context: dict[str, Any] | None,
) -> dict[str, Any]:
    weather = weather or {}
    next24 = weather.get("next_24_hours") or {}
    hourly = next24.get("hourly_forecast") or []
    if not isinstance(hourly, list):
        hourly = []

    rain_probability = _num(next24.get("max_rain_probability"))
    precipitation = _num(next24.get("total_precipitation"))
    gust = _num(next24.get("max_wind_gust"))
    rain_start, rain_end = _rain_window(hourly)

    verification = bool(
        vision.get("needs_field_verification")
        or (evaluation or {}).get("requires_field_verification")
    )

    if rain_probability >= 80 or precipitation >= 15 or gust >= 45:
        severity = "high"
    elif rain_probability >= 50 or precipitation >= 5 or gust >= 30:
        severity = "moderate"
    else:
        severity = "low"

    incidents: list[str] = []
    if rain_probability >= 50 or precipitation >= 5:
        incidents.append("HEAVY_RAIN" if severity == "high" else "RAIN_PREPAREDNESS")
    if gust >= 30:
        incidents.append("STRONG_WIND")
    if verification:
        incidents.append("FIELD_VERIFICATION_REQUIRED")
    if not incidents and vision.get("stress_signals"):
        incidents.append("PLANT_STRESS")
    if not incidents:
        incidents.append("NORMAL_FIELD_MONITORING")

    farm_name = (
        (farm_context or {}).get("farm_name")
        or (farm_context or {}).get("name")
        or "your farm"
    )

    actions: list[dict[str, Any]] = []
    if rain_probability >= 50 or precipitation >= 5:
        actions.append({
            "priority": 1,
            "action": "Clear drainage paths and check water outlets before rain starts.",
            "when": _fmt_time(rain_start),
            "where": "Low-lying areas and drainage outlets across the farm",
            "reason": "Rain conditions can increase standing-water risk.",
        })
    if gust >= 30:
        actions.append({
            "priority": len(actions) + 1,
            "action": "Check and strengthen banana plant supports before strong gusts.",
            "when": _fmt_time(next24.get("peak_gust_time")),
            "where": "Exposed rows and plants with weak support",
            "reason": "Strong gusts can increase lodging risk.",
        })
    if verification:
        actions.append({
            "priority": len(actions) + 1,
            "action": "Take a closer field photo and check the soil around affected plants.",
            "when": "During the next safe field visit",
            "where": "Plants showing the visible symptoms",
            "reason": "Current evidence is not strong enough for a confident plant-level conclusion.",
        })
    if not actions:
        actions.append({
            "priority": 1,
            "action": "Continue routine field monitoring and inspect any new symptoms.",
            "when": "During the next normal field visit",
            "where": "The inspected farm area",
            "reason": "No strong incident signal was detected from the available evidence.",
        })

    return {
        "incident": incidents[0],
        "incidents": incidents,
        "severity": severity,
        "when": {
            "start": rain_start or next24.get("peak_rain_time"),
            "end": rain_end,
            "peak_rain": next24.get("peak_rain_time"),
            "peak_wind": next24.get("peak_gust_time"),
        },
        "where": str(farm_name),
        "actions": actions[:3],
        "field_verification_required": verification,
        "evidence_basis": {
            "rain_probability": rain_probability,
            "precipitation_mm": precipitation,
            "max_wind_gust_kmh": gust,
            "satellite_available": bool(satellite and satellite.get("available")),
            "visual_confidence": _num(vision.get("visual_confidence")),
        },
        "engine": "deterministic-incident-v1",
    }
