from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

SENTINEL2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"
DYNAMIC_WORLD_COLLECTION = "GOOGLE/DYNAMICWORLD/V1"
DEFAULT_CLOUD_LIMIT = float(os.getenv("VAZHAIGUARD_SATELLITE_MAX_CLOUD_PERCENT", "35"))


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _safe_number(value: Any) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _initialize_earth_engine() -> Any:
    try:
        import ee
    except ImportError as exc:
        raise RuntimeError(
            "Google Earth Engine is not installed. Run: pip install -r requirements-satellite.txt"
        ) from exc

    project = os.getenv("GEE_PROJECT")
    if not project:
        raise RuntimeError(
            "GEE_PROJECT is not configured. Set the Earth Engine Cloud Project used by this backend."
        )

    try:
        ee.Initialize(project=project)
    except Exception as exc:
        raise RuntimeError(
            "Earth Engine is not authenticated for this backend. Run 'earthengine authenticate' once in this environment."
        ) from exc
    return ee


def _geometry_from_request(
    ee: Any,
    latitude: float,
    longitude: float,
    boundary: dict[str, Any] | None,
) -> Any:
    if boundary:
        geometry = boundary
        if boundary.get("type") == "Feature":
            geometry = boundary.get("geometry")
        elif boundary.get("type") == "FeatureCollection":
            features = boundary.get("features") or []
            if len(features) == 1:
                geometry = features[0].get("geometry")

        if isinstance(geometry, dict) and geometry.get("type") in {"Polygon", "MultiPolygon"}:
            coordinates = geometry.get("coordinates")
            if coordinates:
                return ee.Geometry(geometry)

    # Location-only fallback is deliberately a small buffer, not a fabricated legal parcel.
    return ee.Geometry.Point([longitude, latitude]).buffer(60)


def _ndvi(image: Any) -> Any:
    return image.normalizedDifference(["B8", "B4"]).rename("ndvi")


def _ndre(image: Any) -> Any:
    return image.normalizedDifference(["B8A", "B5"]).rename("ndre")


def _ndwi(image: Any) -> Any:
    return image.normalizedDifference(["B3", "B8"]).rename("ndwi")


def _sentinel_collection(
    ee: Any,
    geometry: Any,
    start: datetime,
    end: datetime,
    cloud_limit: float,
) -> Any:
    return (
        ee.ImageCollection(SENTINEL2_COLLECTION)
        .filterBounds(geometry)
        .filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", cloud_limit))
    )


def _analyze_window(
    ee: Any,
    geometry: Any,
    start: datetime,
    end: datetime,
    cloud_limit: float,
) -> dict[str, Any] | None:
    collection = _sentinel_collection(ee, geometry, start, end, cloud_limit)
    count = int(collection.size().getInfo())
    if count == 0:
        return None

    composite = collection.median()
    indices = _ndvi(composite).addBands(_ndre(composite)).addBands(_ndwi(composite))
    values = indices.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=10,
        bestEffort=True,
        maxPixels=1_000_000,
    ).getInfo() or {}

    latest = collection.sort("system:time_start", False).first()
    timestamp_ms = latest.get("system:time_start").getInfo()
    latest_observation = datetime.fromtimestamp(
        timestamp_ms / 1000,
        tz=timezone.utc,
    ).isoformat()

    return {
        "image_count": count,
        "ndvi": _safe_number(values.get("ndvi")),
        "ndre": _safe_number(values.get("ndre")),
        "ndwi": _safe_number(values.get("ndwi")),
        "cloud_percent_mean": _safe_number(
            collection.aggregate_mean("CLOUDY_PIXEL_PERCENTAGE").getInfo()
        ),
        "latest_observation": latest_observation,
    }


def _dynamic_world(ee: Any, geometry: Any, start: datetime, end: datetime) -> dict[str, Any]:
    collection = (
        ee.ImageCollection(DYNAMIC_WORLD_COLLECTION)
        .filterBounds(geometry)
        .filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    )
    count = int(collection.size().getInfo())
    if count == 0:
        return {"image_count": 0, "crop_probability": None, "tree_probability": None}

    values = collection.mean().select(["crops", "trees"]).reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=10,
        bestEffort=True,
        maxPixels=1_000_000,
    ).getInfo() or {}

    return {
        "image_count": count,
        "crop_probability": _safe_number(values.get("crops")),
        "tree_probability": _safe_number(values.get("trees")),
    }


def _satellite_stress(
    ndvi: float | None,
    ndre: float | None,
    ndwi: float | None,
    crop_probability: float | None,
) -> tuple[float | None, float | None]:
    if ndvi is None:
        return None, None

    # This is a vegetation-stress heuristic, not a disease classifier.
    vegetation_stress = _clamp((0.70 - ndvi) / 0.45)
    red_edge_stress = _clamp((0.42 - (ndre if ndre is not None else 0.42)) / 0.30)
    water_stress = _clamp((0.10 - (ndwi if ndwi is not None else 0.10)) / 0.35)
    raw = vegetation_stress * 0.55 + red_edge_stress * 0.25 + water_stress * 0.20

    crop_factor = _clamp(crop_probability if crop_probability is not None else 0.5, 0.35, 1.0)
    confidence = _clamp((0.45 + 0.55 * crop_factor) * (1.0 - 0.35 * vegetation_stress))
    return round(raw * 100, 1), round(confidence, 3)


def analyze_satellite_evidence(
    *,
    latitude: float,
    longitude: float,
    boundary: dict[str, Any] | None = None,
    lookback_days: int = 45,
    baseline_days: int = 45,
    max_cloud_percent: float = DEFAULT_CLOUD_LIMIT,
) -> dict[str, Any]:
    """Fetch real Sentinel-2 + Dynamic World farm/zone evidence from GEE."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid farm latitude/longitude.")
    if not 7 <= lookback_days <= 180:
        raise ValueError("lookback_days must be between 7 and 180.")
    if not 7 <= baseline_days <= 180:
        raise ValueError("baseline_days must be between 7 and 180.")
    if not 0 <= max_cloud_percent <= 100:
        raise ValueError("max_cloud_percent must be between 0 and 100.")

    ee = _initialize_earth_engine()
    geometry = _geometry_from_request(ee, latitude, longitude, boundary)
    now = datetime.now(timezone.utc)
    recent_start = now - timedelta(days=lookback_days)
    baseline_start = recent_start - timedelta(days=baseline_days)

    recent = _analyze_window(ee, geometry, recent_start, now, max_cloud_percent)
    baseline = _analyze_window(ee, geometry, baseline_start, recent_start, max_cloud_percent)

    if recent is None:
        return {
            "available": False,
            "provider": "Google Earth Engine",
            "source": "Sentinel-2 SR Harmonized + Dynamic World",
            "analysis_scope": "farmer-confirmed farm boundary" if boundary else "60 m farm-location buffer",
            "reason": "No Sentinel-2 observations passed the date and cloud filters.",
            "warnings": ["Try a longer lookback window or a higher cloud threshold."],
        }

    dynamic_world = _dynamic_world(ee, geometry, recent_start, now)
    ndvi = recent.get("ndvi")
    baseline_ndvi = baseline.get("ndvi") if baseline else None
    ndvi_trend = (
        round(ndvi - baseline_ndvi, 4)
        if ndvi is not None and baseline_ndvi is not None
        else None
    )

    if ndvi_trend is None:
        trend = "insufficient_history"
    elif ndvi_trend >= 0.05:
        trend = "improving"
    elif ndvi_trend <= -0.05:
        trend = "declining"
    else:
        trend = "stable"

    risk_score, confidence = _satellite_stress(
        ndvi,
        recent.get("ndre"),
        recent.get("ndwi"),
        dynamic_world.get("crop_probability"),
    )

    latest_observation = recent["latest_observation"]
    observed_at = datetime.fromisoformat(latest_observation)
    observation_age_hours = round(
        max(0.0, (now - observed_at).total_seconds() / 3600),
        1,
    )

    crop_probability = dynamic_world.get("crop_probability")
    warnings = [
        "Satellite evidence is farm/zone-level context, not individual-tree disease diagnosis.",
        "NDVI/NDRE/NDWI risk is a prototype vegetation-stress heuristic and requires field verification.",
    ]
    if observation_age_hours > 10 * 24:
        warnings.append("The latest usable satellite observation is older than 10 days.")
    if (recent.get("cloud_percent_mean") or 0) > 25:
        warnings.append("Recent imagery has substantial scene-level cloud cover; interpret trends cautiously.")
    if crop_probability is not None and crop_probability < 0.5:
        warnings.append("Dynamic World crop probability is below 0.50; cropland classification is uncertain.")

    # Coarse crop-state context is intentionally descriptive; it is not a plant count.
    if crop_probability is not None and crop_probability < 0.20 and (ndvi or 0) < 0.25:
        crop_state = "bare_or_low_vegetation"
    elif crop_probability is not None and crop_probability >= 0.50:
        crop_state = "cropland_likely"
    else:
        crop_state = "uncertain"

    return {
        "available": True,
        "provider": "Google Earth Engine",
        "source": "Sentinel-2 SR Harmonized + Dynamic World",
        "datasets": {
            "sentinel2": SENTINEL2_COLLECTION,
            "dynamic_world": DYNAMIC_WORLD_COLLECTION,
        },
        "analysis_scope": "farmer-confirmed farm boundary" if boundary else "60 m farm-location buffer",
        "resolution_m": 10,
        "latest_observation": latest_observation,
        "observed_at": latest_observation,
        "observation_age_hours": observation_age_hours,
        "image_count": recent["image_count"],
        "cloud_percent_mean": recent["cloud_percent_mean"],
        "ndvi": ndvi,
        "ndre": recent.get("ndre"),
        "ndwi": recent.get("ndwi"),
        "baseline_ndvi": baseline_ndvi,
        "ndvi_trend": ndvi_trend,
        "trend": trend,
        "crop_state": crop_state,
        "dynamic_world": dynamic_world,
        "health_index": round(1.0 - risk_score / 100.0, 3) if risk_score is not None else None,
        "risk_score": risk_score,
        "confidence": confidence,
        "risk_method": "prototype vegetation-stress heuristic; not a disease classifier",
        "warnings": warnings,
    }
