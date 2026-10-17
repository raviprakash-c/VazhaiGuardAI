from __future__ import annotations

import os
from typing import Any

import requests

SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
TIMEOUT = float(os.getenv("VAZHAIGUARD_SOIL_TIMEOUT_SECONDS", "15"))
PROPERTIES = ("phh2o", "clay", "sand", "soc", "cec")
DEPTH = "0-5cm"


def _number(value: Any) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _extract_mean_uncertainty(payload: dict[str, Any], prop: str) -> tuple[float | None, float | None]:
    properties = payload.get("properties", {})
    # Current SoilGrids API response: properties.layers[].depths[].values
    layers = properties.get("layers") if isinstance(properties, dict) else None
    if isinstance(layers, list):
        layer = next(
            (
                item for item in layers
                if isinstance(item, dict) and item.get("name") == prop
            ),
            None,
        )
        if not isinstance(layer, dict):
            return None, None
        depths = layer.get("depths", [])
        depth_data = next(
            (
                item for item in depths
                if isinstance(item, dict)
                and item.get("label") == DEPTH
            ),
            None,
        )
        if not isinstance(depth_data, dict):
            return None, None
        values = depth_data.get("values", {})
        if not isinstance(values, dict):
            return None, None
        unit_measure = layer.get("unit_measure", {})
        factor = _number(
            unit_measure.get("d_factor")
            if isinstance(unit_measure, dict)
            else None
        ) or 1.0
        mean = _number(values.get("mean"))
        uncertainty = _number(values.get("uncertainty"))
        return (
            mean / factor if mean is not None else None,
            uncertainty / factor if uncertainty is not None else None,
        )
    # Backward compatibility with the older nested response shape.
    values = properties.get(prop) if isinstance(properties, dict) else None
    if isinstance(values, dict):
        values = values.get(DEPTH) or values.get("0-30cm") or values
    if isinstance(values, dict):
        mean = _number(values.get("mean"))
        uncertainty = _number(values.get("uncertainty"))
        return (
            mean / 10.0 if mean is not None else None,
            uncertainty / 10.0 if uncertainty is not None else None,
        )
    return None, None


def _normalize(raw: float | None, prop: str) -> float | None:
    if raw is None:
        return None
    if prop in {"phh2o", "clay", "sand", "soc", "cec"}:
        return raw / 10.0
    return raw


def _soil_context_risk(ph: float | None, clay: float | None, sand: float | None, soc: float | None) -> float | None:
    signals: list[tuple[float, float]] = []
    if ph is not None:
        signals.append((min(abs(ph - 6.5) / 2.0, 1.0), 0.45))
    if soc is not None:
        signals.append((max(0.0, min(1.0, (12.0 - soc) / 12.0)), 0.30))
    if clay is not None and sand is not None:
        texture = max((clay - 60.0) / 40.0, (sand - 75.0) / 25.0, 0.0)
        signals.append((min(texture, 1.0), 0.25))
    if not signals:
        return None
    total = sum(weight for _, weight in signals)
    return round(100.0 * sum(score * weight for score, weight in signals) / total, 1)


def get_soil_evidence(*, latitude: float, longitude: float) -> dict[str, Any]:
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("Invalid farm latitude/longitude.")

    params: list[tuple[str, str]] = [
        ("lon", str(longitude)), ("lat", str(latitude)),
        ("depth", DEPTH), ("value", "mean"), ("value", "uncertainty"),
    ]
    params.extend(("property", prop) for prop in PROPERTIES)

    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.get(
                SOILGRIDS_URL,
                params=params,
                timeout=(10, max(TIMEOUT, 30)),
                headers={"User-Agent": "VazhaiGuardAI/1.0"},
            )
        if response.status_code >= 400:
            return {
                "available": False, "provider": "ISRIC SoilGrids", "source": "SoilGrids 2.0",
                "scope": "coarse_soil_context",
                "reason": f"SoilGrids returned HTTP {response.status_code}.",
                "warnings": ["Soil evidence is temporarily unavailable; current photo, weather and satellite evidence remain usable."],
            }
        payload = response.json()
    except Exception as exc:
        return {
            "available": False, "provider": "ISRIC SoilGrids", "source": "SoilGrids 2.0",
            "scope": "coarse_soil_context", "reason": f"SoilGrids request failed: {exc}",
            "warnings": ["Soil evidence is temporarily unavailable; current photo, weather and satellite evidence remain usable."],
        }

    values: dict[str, float | None] = {}
    uncertainties: dict[str, float | None] = {}
    for prop in PROPERTIES:
        raw, uncertainty = _extract_mean_uncertainty(payload, prop)
        # Values returned by the extractor are already converted using
        # the SoilGrids layer's d_factor.
        values[prop] = raw
        uncertainties[prop] = uncertainty

    if not any(value is not None for value in values.values()):
        return {
            "available": False, "provider": "ISRIC SoilGrids", "source": "SoilGrids 2.0",
            "scope": "coarse_soil_context", "reason": "SoilGrids returned no usable values.",
            "warnings": ["No soil property values were available for this location."],
        }

    return {
        "available": True, "provider": "ISRIC SoilGrids", "source": "SoilGrids 2.0",
        "scope": "coarse_soil_context", "resolution_m": 250, "depth": DEPTH,
        "properties": values, "uncertainty": uncertainties,
        "risk_score": _soil_context_risk(values.get("phh2o"), values.get("clay"), values.get("sand"), values.get("soc")),
        "confidence": 0.35,
        "risk_method": "contextual soil-condition heuristic; not a crop disease classifier",
        "warnings": [
            "SoilGrids is a coarse global soil model and should be treated as contextual evidence, not a farm-lab measurement.",
            "Do not use this soil layer alone to prescribe fertilizer or treatment.",
        ],
    }


def soil_configuration_status() -> dict[str, Any]:
    return {
        "configured": True, "provider": "ISRIC SoilGrids", "source": "SoilGrids 2.0",
        "resolution_m": 250, "scope": "coarse_soil_context", "depth": DEPTH,
        "properties": list(PROPERTIES),
    }
