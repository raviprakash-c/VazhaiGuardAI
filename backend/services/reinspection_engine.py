from __future__ import annotations

from typing import Any


def _score(record: dict[str, Any] | None) -> float | None:
    if not record:
        return None
    risk = record.get("risk") or {}
    value = risk.get("score")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _confidence(record: dict[str, Any] | None) -> float | None:
    if not record:
        return None
    value = (record.get("vision_summary") or {}).get("visual_confidence")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _signals(record: dict[str, Any] | None) -> set[str]:
    if not record:
        return set()
    summary = record.get("vision_summary") or {}
    values = summary.get("stress_signals") or []
    return {str(v).strip().lower() for v in values if str(v).strip()}


def _severity(record: dict[str, Any] | None) -> str:
    return str((record or {}).get("incident", {}).get("severity") or "low").lower()


def _direction(previous: float | None, current: float | None) -> str:
    if previous is None or current is None:
        return "unknown"
    delta = current - previous
    if delta <= -8:
        return "improved"
    if delta >= 8:
        return "worsened"
    return "stable"


def compare_inspection_records(
    previous: dict[str, Any] | None,
    current_result: dict[str, Any],
) -> dict[str, Any]:
    if not previous:
        return {
            "available": False,
            "status": "baseline",
            "headline": "Baseline inspection recorded.",
            "summary": "There is no earlier inspection to compare with.",
            "risk": {"previous": None, "current": _score(current_result), "change": None, "direction": "baseline"},
            "visual_confidence": {"previous": None, "current": _confidence(current_result), "change": None},
            "signals": {"new": sorted(_signals(current_result)), "cleared": []},
            "incident": {"previous": None, "current": _severity(current_result)},
            "next_step": "Use this inspection as the baseline for the next field check.",
            "engine": "deterministic-reinspection-v1",
        }

    previous_score = _score(previous)
    current_score = _score(current_result)
    delta = None if previous_score is None or current_score is None else round(current_score - previous_score, 1)
    direction = _direction(previous_score, current_score)

    previous_signals = _signals(previous)
    current_signals = _signals(current_result)
    new_signals = sorted(current_signals - previous_signals)
    cleared_signals = sorted(previous_signals - current_signals)

    previous_conf = _confidence(previous)
    current_conf = _confidence(current_result)
    conf_delta = None if previous_conf is None or current_conf is None else round(current_conf - previous_conf, 3)

    if direction == "worsened":
        headline = "Field condition needs closer attention."
        summary = "The current inspection has a higher combined risk signal than the previous inspection."
        next_step = "Inspect the affected plants and complete the recommended field checks."
    elif direction == "improved":
        headline = "Conditions look better than the previous inspection."
        summary = "The current inspection has a lower combined risk signal than the previous inspection."
        next_step = "Continue monitoring and keep the earlier preventive action in place if relevant."
    else:
        headline = "Condition is broadly stable."
        summary = "The current inspection is not materially different from the previous inspection."
        next_step = "Continue monitoring and recheck if symptoms spread or weather risk increases."

    if new_signals:
        summary += f" New visible signals: {', '.join(new_signals[:3])}."
    if cleared_signals:
        summary += f" No longer observed: {', '.join(cleared_signals[:3])}."

    return {
        "available": True,
        "status": direction,
        "headline": headline,
        "summary": summary,
        "risk": {
            "previous": previous_score,
            "current": current_score,
            "change": delta,
            "direction": direction,
        },
        "visual_confidence": {
            "previous": previous_conf,
            "current": current_conf,
            "change": conf_delta,
        },
        "signals": {
            "new": new_signals,
            "cleared": cleared_signals,
        },
        "incident": {
            "previous": _severity(previous),
            "current": _severity(current_result),
        },
        "next_step": next_step,
        "engine": "deterministic-reinspection-v1",
    }
