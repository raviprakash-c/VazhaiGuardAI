from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


BASE_WEIGHTS = {
    "vision": 0.45,
    "weather": 0.25,
    "satellite": 0.20,
    "soil": 0.10,
}



def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None

    if isinstance(value, datetime):
        result = value
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            result = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)

    return result.astimezone(timezone.utc)



def _age_hours(evidence: dict[str, Any] | None, now: datetime) -> float | None:
    if not evidence:
        return None

    timestamp = (
        evidence.get("captured_at")
        or evidence.get("observed_at")
        or evidence.get("timestamp")
        or evidence.get("updated_at")
    )
    parsed = _parse_timestamp(timestamp)
    if parsed is None:
        return None

    return max(0.0, (now - parsed).total_seconds() / 3600.0)



def _freshness(age_hours: float | None, source: str) -> str:
    if age_hours is None:
        return "unknown" if source else "unavailable"

    if source == "satellite":
        if age_hours <= 72:
            return "fresh"
        if age_hours <= 168:
            return "aging"
        return "stale"

    if age_hours <= 6:
        return "fresh"
    if age_hours <= 24:
        return "aging"
    return "stale"



def soil_reliability(soil: dict[str, Any] | None) -> float:
    if not soil or not soil.get("available"):
        return 0.0
    return min(0.40, max(0.10, float(soil.get("confidence", 0.35) or 0.35)))


def satellite_reliability(satellite: dict[str, Any] | None) -> float:
    """Return a conservative reliability factor for satellite evidence.

    Satellite imagery is periodic rather than a live sensor. The factor
    prevents an old image from overpowering current farmer observations.
    """
    if not satellite:
        return 0.0

    age = _age_hours(satellite, datetime.now(timezone.utc))
    if age is None:
        # A supplied image without a timestamp is usable, but not trusted as
        # strongly as a time-stamped observation.
        return 0.50

    if age <= 72:
        return 1.0
    if age <= 168:
        return 0.65
    if age <= 720:
        return 0.30
    return 0.10



def build_evidence_state(
    *,
    vision: dict[str, Any] | None,
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    soil: dict[str, Any] | None = None,
    farm_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Describe evidence availability, freshness and conflicts.

    This is deliberately deterministic. The LLM is not allowed to decide
    whether an evidence source is fresh or stale.
    """
    now = datetime.now(timezone.utc)

    sources = {"vision": vision, "weather": weather, "satellite": satellite, "soil": soil}

    freshness: dict[str, dict[str, Any]] = {}
    for name, evidence in sources.items():
        age = _age_hours(evidence, now)
        freshness[name] = {
            "available": bool(evidence),
            "age_hours": round(age, 1) if age is not None else None,
            "status": _freshness(age, name) if evidence else "unavailable",
        }

    conflicts: list[dict[str, Any]] = []

    crop_age_days = None
    if farm_context:
        for key in ("crop_age_days", "planting_age_days"):
            if farm_context.get(key) is not None:
                try:
                    crop_age_days = float(farm_context[key])
                    break
                except (TypeError, ValueError):
                    pass

    satellite_state = str((satellite or {}).get("crop_state", "")).lower()
    if satellite_state in {"bare", "empty", "no_crop"} and crop_age_days is not None and crop_age_days >= 30:
        conflicts.append({
            "type": "temporal_crop_conflict",
            "source": "satellite",
            "message": "Satellite indicates bare/low vegetation but the farmer crop record is older than 30 days.",
            "resolution": "Treat satellite as historical evidence and prefer current farmer/photo evidence.",
        })

    satellite_factor = satellite_reliability(satellite)
    soil_factor = soil_reliability(soil)
    effective_weights = dict(BASE_WEIGHTS)
    effective_weights["satellite"] *= satellite_factor
    effective_weights["soil"] *= soil_factor

    available_weight = sum(
        weight
        for name, weight in effective_weights.items()
        if sources[name]
    )

    normalized_weights: dict[str, float] = {}
    if available_weight > 0:
        for name, weight in effective_weights.items():
            if sources[name] and weight > 0:
                normalized_weights[name] = round(weight / available_weight, 3)

    return {
        "generated_at": now.isoformat(),
        "freshness": freshness,
        "base_weights": BASE_WEIGHTS,
        "satellite_reliability": round(satellite_factor, 3),
        "soil_reliability": round(soil_factor, 3),
        "effective_weights": normalized_weights,
        "conflicts": conflicts,
        "satellite_is_live": False,
        "soil_is_live_sensor": False,
        "ground_truth_policy": "Current farmer-confirmed records and recent photos take precedence over coarse or stale environmental context.",
    }
