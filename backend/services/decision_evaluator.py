from __future__ import annotations

"""Deterministic quality and safety evaluation for multimodal farmer decisions.

This module deliberately does not use an LLM to judge another LLM. It checks
the final structured result against evidence availability, confidence bounds,
decision completeness, freshness/conflict state, and unsafe recommendation
patterns.
"""

import re
from typing import Any

UNSAFE_TREATMENT_PATTERNS = (
    r"\b\d+(?:\.\d+)?\s*(?:ml|g|kg|l|litre|liter)\s*(?:per|/|in)\s*",
    r"\b(?:spray|apply|mix|dose|dosage)\b.{0,80}\b(?:ml|g|kg|litre|liter)\b",
)

REQUIRED_ACTION_FIELDS = ("summary", "priority_actions", "farmer_message")
REQUIRED_VISION_FIELDS = (
    "observation",
    "stress_signals",
    "possible_causes",
    "urgency",
    "visual_confidence",
    "needs_field_verification",
    "recommended_checks",
)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _text(value: Any) -> str:
    return str(value or "").strip()


def evaluate_multimodal_decision(
    *,
    vision: dict[str, Any] | None,
    weather: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
    risk: dict[str, Any],
    decision: dict[str, Any],
) -> dict[str, Any]:
    """Evaluate a decision without changing the deterministic risk result."""
    issues: list[dict[str, str]] = []
    checks: dict[str, bool] = {}
    vision = vision or {}
    decision = decision or {}
    evidence_state = risk.get("evidence_state") or {}
    conflicts = evidence_state.get("conflicts") or []

    checks["vision_schema"] = all(field in vision for field in REQUIRED_VISION_FIELDS)
    if not checks["vision_schema"]:
        issues.append({
            "code": "VISION_SCHEMA_INCOMPLETE",
            "severity": "high",
            "message": "Vision output is missing required evidence fields.",
        })

    checks["decision_schema"] = all(field in decision for field in REQUIRED_ACTION_FIELDS)
    if not checks["decision_schema"]:
        issues.append({
            "code": "DECISION_SCHEMA_INCOMPLETE",
            "severity": "high",
            "message": "Decision output is missing required farmer-action fields.",
        })

    actions = decision.get("priority_actions")
    checks["action_count"] = isinstance(actions, list) and 1 <= len(actions) <= 3
    if not checks["action_count"]:
        issues.append({
            "code": "ACTION_COUNT_INVALID",
            "severity": "medium",
            "message": "Decision should contain one to three prioritized actions.",
        })

    visual_confidence = _number(vision.get("visual_confidence"), -1)
    checks["confidence_valid"] = 0.0 <= visual_confidence <= 1.0
    if not checks["confidence_valid"]:
        issues.append({
            "code": "VISION_CONFIDENCE_INVALID",
            "severity": "high",
            "message": "Vision confidence is outside the allowed 0..1 range.",
        })

    needs_verification = bool(
        vision.get("needs_field_verification", True)
        or decision.get("needs_field_verification", False)
    )

    if visual_confidence < 0.60 and not needs_verification:
        issues.append({
            "code": "LOW_CONFIDENCE_WITHOUT_VERIFICATION",
            "severity": "high",
            "message": "Low visual confidence must trigger field verification.",
        })

    if conflicts and not needs_verification:
        issues.append({
            "code": "CONFLICT_WITHOUT_VERIFICATION",
            "severity": "high",
            "message": "Conflicting evidence must trigger field verification.",
        })

    signals_used = set(risk.get("signals_used") or [])
    checks["signal_trace_present"] = bool(signals_used)

    if satellite and "satellite" in signals_used and satellite.get("available") is False:
        issues.append({
            "code": "SATELLITE_SIGNAL_MISMATCH",
            "severity": "high",
            "message": "Risk trace says satellite was used although satellite evidence is unavailable.",
        })

    if weather is None and "weather" in signals_used:
        issues.append({
            "code": "WEATHER_SIGNAL_MISMATCH",
            "severity": "medium",
            "message": "Risk trace says weather was used without weather evidence.",
        })

    actions = actions if isinstance(actions, list) else []
    combined_text = " ".join([
        _text(decision.get("summary")),
        _text(decision.get("farmer_message")),
        " ".join(_text(item.get("action")) for item in actions if isinstance(item, dict)),
        " ".join(_text(item.get("reason")) for item in actions if isinstance(item, dict)),
    ])

    unsafe_match = any(
        re.search(pattern, combined_text, flags=re.IGNORECASE)
        for pattern in UNSAFE_TREATMENT_PATTERNS
    )
    checks["treatment_safety"] = not unsafe_match
    if unsafe_match:
        issues.append({
            "code": "UNSAFE_TREATMENT_INSTRUCTION",
            "severity": "critical",
            "message": "Generated guidance appears to contain treatment dosage details.",
        })

    uncertainty_terms = (
        "verify", "field", "check", "possible", "may", "confirm",
        "சரிபார", "சோத", "உறுதி",
    )
    if needs_verification:
        lower_text = combined_text.lower()
        checks["uncertainty_present"] = any(term.lower() in lower_text for term in uncertainty_terms)
        if not checks["uncertainty_present"]:
            issues.append({
                "code": "UNCERTAINTY_NOT_EXPRESSED",
                "severity": "medium",
                "message": "The decision requests verification but does not express uncertainty.",
            })
    else:
        checks["uncertainty_present"] = True

    satellite_freshness = (
        evidence_state.get("freshness", {}).get("satellite", {})
        if isinstance(evidence_state, dict)
        else {}
    )
    satellite_status = satellite_freshness.get("status")
    if satellite_status == "stale" and "satellite" in signals_used:
        issues.append({
            "code": "STALE_SATELLITE_USED",
            "severity": "high",
            "message": "Stale satellite evidence should not materially drive a current plant-level decision.",
        })

    severity_penalty = {"critical": 0.35, "high": 0.20, "medium": 0.08, "low": 0.03}
    penalty = sum(severity_penalty.get(issue["severity"], 0.0) for issue in issues)

    base = 1.0
    if not checks.get("vision_schema"):
        base -= 0.20
    if not checks.get("decision_schema"):
        base -= 0.20
    if not checks.get("confidence_valid"):
        base -= 0.20
    if not checks.get("action_count"):
        base -= 0.10

    quality_score = round(_clamp(base - penalty), 3)
    critical_or_high = any(issue["severity"] in {"critical", "high"} for issue in issues)

    return {
        "quality_score": quality_score,
        "grade": (
            "fail" if critical_or_high or quality_score < 0.60
            else "review" if quality_score < 0.80
            else "pass"
        ),
        "decision_safe_to_show": not any(
            issue["severity"] == "critical" for issue in issues
        ),
        "requires_field_verification": needs_verification or bool(conflicts),
        "checks": checks,
        "issues": issues,
        "evidence_trace": {
            "signals_used": sorted(signals_used),
            "conflict_count": len(conflicts),
            "satellite_freshness": satellite_status,
        },
        "evaluator": "deterministic-v1",
    }
