from __future__ import annotations

from typing import Any

from services.evidence_state import build_evidence_state


BASE_WEIGHTS = {
    "vision": 0.50,
    "weather": 0.30,
    "satellite": 0.20,
}


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def _number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def vision_risk(vision: dict[str, Any] | None) -> float:
    if not vision:
        return 0.0

    urgency = {
        "low": 20.0,
        "medium": 55.0,
        "high": 85.0,
    }.get(str(vision.get("urgency", "low")).lower(), 20.0)
    confidence = _clamp(_number(vision.get("visual_confidence")))
    return _clamp((urgency * 0.75) + (confidence * 25.0))


def weather_risk(weather: dict[str, Any] | None) -> float:
    if not weather:
        return 0.0

    next_24 = weather.get("next_24_hours") or {}
    rain = _number(weather.get("max_rain_probability", next_24.get("max_rain_probability")))
    precipitation = _number(weather.get("total_precipitation", next_24.get("total_precipitation")))
    gust = _number(weather.get("max_wind_gust", next_24.get("max_wind_gust")))
    wind = _number(weather.get("max_wind_speed", next_24.get("max_wind_speed")))

    return _clamp(
        (rain * 0.50)
        + (min(precipitation, 30.0) / 30.0 * 30.0)
        + (min(max(gust, wind * 1.5), 60.0) / 60.0 * 20.0)
    )


def satellite_risk(satellite: dict[str, Any] | None) -> float:
    if not satellite:
        return 0.0

    if satellite.get("risk_score") is not None:
        return _clamp(_number(satellite.get("risk_score")))

    if satellite.get("ndvi") is not None:
        return _clamp((1.0 - _number(satellite.get("ndvi"))) * 100.0)

    if satellite.get("health_index") is not None:
        return _clamp((1.0 - _number(satellite.get("health_index"))) * 100.0)

    return 0.0


def _label(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "moderate"
    return "low"


def calculate_unified_risk(
    *,
    vision: dict[str, Any] | None,
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    farm_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fuse current evidence while deterministically discounting stale satellite data."""
    evidence_state = build_evidence_state(
        vision=vision,
        weather=weather,
        satellite=satellite,
        farm_context=farm_context,
    )

    scores = {
        "vision": round(vision_risk(vision), 1),
        "weather": round(weather_risk(weather), 1),
        "satellite": round(satellite_risk(satellite), 1),
    }

    configured = dict(BASE_WEIGHTS)
    adjusted = dict(configured)
    satellite_factor = float(evidence_state["satellite_reliability"])
    adjusted["satellite"] *= satellite_factor

    sources = {
        "vision": bool(vision),
        "weather": bool(weather),
        "satellite": bool(satellite),
    }

    # Stale satellite imagery is retained for transparency/context, but it must
    # not contribute to a current plant-level decision. Sentinel-2 is periodic,
    # not a live field sensor.
    satellite_status = evidence_state["freshness"].get("satellite", {}).get("status")
    if satellite_status == "stale":
        adjusted["satellite"] = 0.0

    # A known temporal crop conflict also makes the satellite observation
    # historical until the farmer confirms the field.
    if any(c.get("type") == "temporal_crop_conflict" for c in evidence_state["conflicts"]):
        adjusted["satellite"] = 0.0

    active_weight = sum(adjusted[name] for name, available in sources.items() if available)
    if active_weight <= 0:
        return {
            "score": 0.0,
            "level": "low",
            "signal_scores": scores,
            "weights_used": {},
            "signals_used": [],
            "evidence_state": evidence_state,
            "evidence_confidence": 0.0,
        }

    weights_used = {
        name: round(adjusted[name] / active_weight, 3)
        for name, available in sources.items()
        if available and adjusted[name] > 0
    }

    score = round(
        _clamp(sum(scores[name] * weight for name, weight in weights_used.items())),
        1,
    )

    # Confidence reflects evidence coverage, not risk severity.
    coverage = sum(weights_used.values())
    freshness_bonus = 0.0
    if evidence_state["freshness"].get("vision", {}).get("status") == "fresh":
        freshness_bonus += 0.10
    if evidence_state["freshness"].get("weather", {}).get("status") == "fresh":
        freshness_bonus += 0.10
    confidence = round(min(1.0, 0.55 * coverage + freshness_bonus), 3)

    return {
        "score": score,
        "level": _label(score),
        "signal_scores": scores,
        "weights_used": weights_used,
        "signals_used": list(weights_used),
        "evidence_state": evidence_state,
        "evidence_confidence": confidence,
    }
