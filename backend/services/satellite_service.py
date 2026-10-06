from __future__ import annotations

import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

STAC = "https://stac.dataspace.copernicus.eu/v1/search"
TOKEN = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS = "https://sh.dataspace.copernicus.eu/process/v1"
STATS = "https://sh.dataspace.copernicus.eu/statistics/v1"
COLLECTION = "sentinel-2-l2a"
TIMEOUT = float(os.getenv("VAZHAIGUARD_CDSE_TIMEOUT_SECONDS", "45"))
DEFAULT_CLOUD = float(os.getenv("VAZHAIGUARD_SATELLITE_MAX_CLOUD_PERCENT", "35"))


class CDSEConfigurationError(RuntimeError):
    pass


def _num(value: Any) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _geometry(
    boundary: dict[str, Any] | None,
    latitude: float,
    longitude: float,
) -> tuple[dict[str, Any], str, bool]:
    value: Any = boundary or {}

    if value.get("type") == "Feature":
        value = value.get("geometry") or {}

    if value.get("type") == "FeatureCollection":
        geometries = [
            feature.get("geometry")
            for feature in value.get("features", [])
            if isinstance(feature, dict) and isinstance(feature.get("geometry"), dict)
        ]
        if len(geometries) == 1:
            value = geometries[0]
        elif geometries:
            value = {"type": "GeometryCollection", "geometries": geometries}

    if (
        isinstance(value, dict)
        and value.get("type") in {"Polygon", "MultiPolygon"}
        and value.get("coordinates")
    ):
        return value, f"farmer-confirmed {value['type']} boundary", True

    # Only a fallback when no usable farm boundary was supplied.
    dlat = 60 / 111320
    dlon = 60 / max(1, 111320 * abs(math.cos(math.radians(latitude))))
    fallback = {
        "type": "Polygon",
        "coordinates": [
            [
                [longitude - dlon, latitude - dlat],
                [longitude + dlon, latitude - dlat],
                [longitude + dlon, latitude + dlat],
                [longitude - dlon, latitude + dlat],
                [longitude - dlon, latitude - dlat],
            ]
        ],
    }
    return fallback, "60 m farm-location buffer", False


def _canonical_polygon(geometry: dict[str, Any]) -> dict[str, Any]:
    """Return a strict GeoJSON Polygon with [[lng, lat], ...] coordinate nesting."""
    if geometry.get("type") != "Polygon":
        raise ValueError("Satellite statistics currently require a Polygon farm boundary.")

    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) != 1:
        raise ValueError("Farm Polygon must contain exactly one exterior ring.")

    ring = coordinates[0]
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValueError("Farm Polygon exterior ring is invalid.")

    normalized: list[list[float]] = []
    for point in ring:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            raise ValueError("Farm Polygon contains an invalid coordinate pair.")
        normalized.append([float(point[0]), float(point[1])])

    if normalized[0] != normalized[-1]:
        normalized.append(normalized[0])

    return {
        "type": "Polygon",
        "coordinates": [normalized],
    }


def _bbox(geometry: dict[str, Any]) -> list[float]:
    points: list[tuple[float, float]] = []

    def walk(value: Any) -> None:
        if isinstance(value, (list, tuple)):
            if (
                len(value) >= 2
                and isinstance(value[0], (int, float))
                and isinstance(value[1], (int, float))
            ):
                points.append((float(value[0]), float(value[1])))
            else:
                for child in value:
                    walk(child)
        elif isinstance(value, dict):
            walk(value.get("coordinates"))
            for child in value.get("geometries", []):
                walk(child)

    walk(geometry)
    if not points:
        raise ValueError("Farm boundary contains no valid coordinates.")

    lngs, lats = zip(*points)
    return [min(lngs), min(lats), max(lngs), max(lats)]


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _token() -> str:
    client_id = os.getenv("CDSE_CLIENT_ID")
    client_secret = os.getenv("CDSE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise CDSEConfigurationError(
            "Copernicus Data Space credentials are not configured. "
            "Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET."
        )

    response = requests.post(
        TOKEN,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=TIMEOUT,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Copernicus authentication failed ({response.status_code})."
        )

    access_token = response.json().get("access_token")
    if not access_token:
        raise RuntimeError(
            "Copernicus authentication response did not contain an access token."
        )

    return access_token


def _search(
    geometry: dict[str, Any],
    start: datetime,
    end: datetime,
    cloud: float,
    limit: int = 20,
) -> list[dict[str, Any]]:
    # Use the AOI bounding box for STAC scene discovery. The exact farm
    # polygon is still used later by the Statistics/Process APIs, so this
    # does not expand the area used for NDVI/NDRE/NDWI calculations.
    payload = {
        "collections": [COLLECTION],
        "datetime": f"{_iso(start)}/{_iso(end)}",
        "bbox": _bbox(geometry),
        "query": {"eo:cloud_cover": {"lte": cloud}},
        "sortby": [{"field": "datetime", "direction": "desc"}],
        "limit": limit,
    }

    response = requests.post(STAC, json=payload, timeout=TIMEOUT)

    if response.status_code >= 400:
        detail = response.text[:1000].replace("\n", " ")
        raise RuntimeError(
            f"Copernicus Catalog search failed ({response.status_code}): {detail}"
        )

    return response.json().get("features", [])


def _scene_time(scene: dict[str, Any]) -> datetime:
    properties = scene.get("properties", {})
    raw = properties.get("datetime") or properties.get("start_datetime")

    if not raw:
        raise RuntimeError("Copernicus scene has no acquisition timestamp.")

    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)


def _scene_window(scene_time: datetime) -> tuple[str, str]:
    # Statistics API works reliably when the aggregation window covers the
    # complete UTC acquisition day rather than only a few minutes around the
    # STAC timestamp.
    day_start = scene_time.astimezone(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return _iso(day_start), _iso(day_start + timedelta(days=1))


STATS_EVALSCRIPT = r"""
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B03", "B04", "B05", "B08", "B8A", "SCL", "dataMask"]
    }],
    output: [
      {
        id: "ndvi",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "ndre",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "ndwi",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1
      }
    ]
  };
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var ndviDenominator = s.B08 + s.B04;
  var ndreDenominator = s.B8A + s.B05;
  var ndwiDenominator = s.B03 + s.B08;

  var ndvi = ndviDenominator === 0 ? 0 : (s.B08 - s.B04) / ndviDenominator;
  var ndre = ndreDenominator === 0 ? 0 : (s.B8A - s.B05) / ndreDenominator;
  var ndwi = ndwiDenominator === 0 ? 0 : (s.B03 - s.B08) / ndwiDenominator;

  var mask = s.dataMask * (cloudy ? 0 : 1);

  return {
    ndvi: [ndvi],
    ndre: [ndre],
    ndwi: [ndwi],
    dataMask: [mask]
  };
}
"""


RGB_EVALSCRIPT = r"""
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B02", "B03", "B04", "SCL", "dataMask"]
    }],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var alpha = s.dataMask * (cloudy ? 0 : 1);

  return [
    2.5 * s.B04,
    2.5 * s.B03,
    2.5 * s.B02,
    alpha
  ];
}
"""


def _stats(
    token: str,
    geometry: dict[str, Any],
    scene_time: datetime,
) -> list[float | None]:
    start, end = _scene_window(scene_time)
    stats_geometry = _canonical_polygon(geometry)

    payload = {
        "input": {
            "bounds": {
                "geometry": stats_geometry,
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
            },
            "data": [
                {
                    "type": COLLECTION,
                    "dataFilter": {"mosaickingOrder": "mostRecent"},
                }
            ],
        },
        "aggregation": {
            "timeRange": {"from": start, "to": end},
            "aggregationInterval": {"of": "P1D"},
            "evalscript": STATS_EVALSCRIPT,
            "resx": 10,
            "resy": 10,
        },
    }

    response = requests.post(
        STATS,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=TIMEOUT,
    )

    if response.status_code >= 400:
        detail = response.text[:1000].replace("\n", " ")
        raise RuntimeError(
            f"Copernicus statistics request failed ({response.status_code}): {detail}"
        )

    data = response.json().get("data") or []
    if not data:
        return [None, None, None]

    # The Statistics API returns one entry per aggregation interval. Find the
    # interval containing valid pixels instead of assuming data[0] has them.
    values: list[float | None] = []
    for name in ("ndvi", "ndre", "ndwi"):
        value = None
        for interval in data:
            outputs = interval.get("outputs") or {}
            stats = (
                ((outputs.get(name) or {}).get("bands", {}).get("B0") or {})
                .get("stats")
                or {}
            )
            candidate = _num(stats.get("mean"))
            if candidate is not None:
                value = candidate
                break
        values.append(value)

    return values


def _satellite_stress(
    ndvi: float | None,
    ndre: float | None,
    ndwi: float | None,
) -> tuple[float | None, float | None]:
    if ndvi is None:
        return None, None

    ndvi_stress = _clamp((0.70 - ndvi) / 0.45)
    ndre_stress = _clamp((0.42 - (ndre if ndre is not None else 0.42)) / 0.30)
    ndwi_stress = _clamp((0.10 - (ndwi if ndwi is not None else 0.10)) / 0.35)

    score = (0.55 * ndvi_stress) + (0.25 * ndre_stress) + (0.20 * ndwi_stress)
    risk_score = round(score * 100, 1)
    confidence = round(_clamp(0.75 - 0.25 * ndvi_stress), 3)

    return risk_score, confidence


def _layer_evalscript(layer: str) -> tuple[str, int]:
    if layer == "ndvi":
        return (
            r"""
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04", "B08", "SCL", "dataMask"]}],
    output: {bands: 4, sampleType: "AUTO"}
  };
}

function color(v) {
  if (v <= 0.0) return [0.55, 0.20, 0.08];
  if (v <= 0.2) return [0.95, 0.78, 0.18];
  if (v <= 0.45) return [0.68, 0.86, 0.18];
  if (v <= 0.7) return [0.20, 0.62, 0.20];
  return [0.05, 0.38, 0.12];
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var d = s.B08 + s.B04;
  var ndvi = d === 0 ? 0 : (s.B08 - s.B04) / d;
  var c = color(ndvi);
  return [c[0], c[1], c[2], s.dataMask * (cloudy ? 0 : 0.72)];
}
""",
            10,
        )

    if layer == "ndre":
        return (
            r"""
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B05", "B8A", "SCL", "dataMask"]}],
    output: {bands: 4, sampleType: "AUTO"}
  };
}

function color(v) {
  if (v <= 0.05) return [0.55, 0.18, 0.10];
  if (v <= 0.15) return [0.95, 0.70, 0.15];
  if (v <= 0.30) return [0.65, 0.85, 0.20];
  if (v <= 0.45) return [0.18, 0.62, 0.18];
  return [0.04, 0.35, 0.12];
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var d = s.B8A + s.B05;
  var ndre = d === 0 ? 0 : (s.B8A - s.B05) / d;
  var c = color(ndre);
  return [c[0], c[1], c[2], s.dataMask * (cloudy ? 0 : 0.72)];
}
""",
            20,
        )

    if layer == "ndwi":
        return (
            r"""
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B03", "B08", "SCL", "dataMask"]}],
    output: {bands: 4, sampleType: "AUTO"}
  };
}

function color(v) {
  if (v <= -0.20) return [0.55, 0.20, 0.10];
  if (v <= -0.05) return [0.95, 0.72, 0.18];
  if (v <= 0.10) return [0.78, 0.86, 0.30];
  if (v <= 0.30) return [0.20, 0.65, 0.90];
  return [0.04, 0.30, 0.78];
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var d = s.B03 + s.B08;
  var ndwi = d === 0 ? 0 : (s.B03 - s.B08) / d;
  var c = color(ndwi);
  return [c[0], c[1], c[2], s.dataMask * (cloudy ? 0 : 0.68)];
}
""",
            10,
        )

    if layer == "stress":
        return (
            r"""
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B03", "B04", "B05", "B08", "B8A", "SCL", "dataMask"]}],
    output: {bands: 4, sampleType: "AUTO"}
  };
}

function color(score) {
  if (score < 0.25) return [0.08, 0.55, 0.20];
  if (score < 0.50) return [0.80, 0.82, 0.12];
  if (score < 0.75) return [0.96, 0.55, 0.08];
  return [0.82, 0.10, 0.10];
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function evaluatePixel(s) {
  var cloudy = [3, 7, 8, 9, 10, 11].includes(s.SCL);
  var ndviD = s.B08 + s.B04;
  var ndreD = s.B8A + s.B05;
  var ndwiD = s.B03 + s.B08;

  var ndvi = ndviD === 0 ? 0 : (s.B08 - s.B04) / ndviD;
  var ndre = ndreD === 0 ? 0 : (s.B8A - s.B05) / ndreD;
  var ndwi = ndwiD === 0 ? 0 : (s.B03 - s.B08) / ndwiD;

  var score =
    0.55 * clamp((0.70 - ndvi) / 0.45) +
    0.25 * clamp((0.42 - ndre) / 0.30) +
    0.20 * clamp((0.10 - ndwi) / 0.35);

  var c = color(score);
  return [c[0], c[1], c[2], s.dataMask * (cloudy ? 0 : 0.68)];
}
""",
            10,
        )

    raise ValueError("layer must be one of: ndvi, ndre, ndwi, stress")


def analyze_satellite_evidence(
    *,
    latitude: float,
    longitude: float,
    boundary: dict[str, Any] | None = None,
    lookback_days: int = 45,
    baseline_days: int = 45,
    max_cloud_percent: float = DEFAULT_CLOUD,
) -> dict[str, Any]:
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("Invalid farm latitude/longitude.")
    if not 7 <= lookback_days <= 180:
        raise ValueError("lookback_days must be between 7 and 180.")
    if not 7 <= baseline_days <= 180:
        raise ValueError("baseline_days must be between 7 and 180.")
    if not 0 <= max_cloud_percent <= 100:
        raise ValueError("max_cloud_percent must be between 0 and 100.")

    geometry, scope, confirmed = _geometry(boundary, latitude, longitude)
    now = datetime.now(timezone.utc)
    recent_start = now - timedelta(days=lookback_days)
    baseline_start = recent_start - timedelta(days=baseline_days)

    recent = _search(geometry, recent_start, now, max_cloud_percent)
    baseline = _search(
        geometry,
        baseline_start,
        recent_start,
        max_cloud_percent,
    )

    if not recent:
        return {
            "available": False,
            "provider": "Copernicus Data Space Ecosystem",
            "source": "Copernicus Sentinel-2 Level-2A",
            "datasets": {"sentinel2": COLLECTION},
            "analysis_scope": scope,
            "farm_geometry": {
                "is_farmer_confirmed": confirmed,
                "geometry_type": geometry.get("type"),
            },
            "reason": (
                "No Sentinel-2 L2A observation passed the date, geometry, "
                "and cloud filters."
            ),
            "warnings": [
                "Try a longer lookback window or allow a higher cloud threshold."
            ],
        }

    token = _token()
    scene = recent[0]
    scene_time = _scene_time(scene)
    values = _stats(token, geometry, scene_time)

    baseline_values = (
        _stats(token, geometry, _scene_time(baseline[0]))
        if baseline
        else [None, None, None]
    )

    ndvi, ndre, ndwi = values
    baseline_ndvi = baseline_values[0]

    trend_value = (
        round(ndvi - baseline_ndvi, 4)
        if ndvi is not None and baseline_ndvi is not None
        else None
    )

    if trend_value is None:
        trend = "insufficient_history"
    elif trend_value >= 0.05:
        trend = "improving"
    elif trend_value <= -0.05:
        trend = "declining"
    else:
        trend = "stable"

    risk_score, confidence = _satellite_stress(ndvi, ndre, ndwi)
    age_hours = round(
        max(0, (now - scene_time).total_seconds() / 3600),
        1,
    )
    cloud = _num(scene.get("properties", {}).get("eo:cloud_cover"))

    warnings = [
        "Satellite evidence is farm/zone-level context, not individual-tree disease diagnosis.",
        "NDVI/NDRE/NDWI risk is a vegetation-stress heuristic and requires field verification.",
        "NDRE uses 20 m red-edge bands; the map resamples that layer for display.",
    ]

    if age_hours > 240:
        warnings.append(
            "The latest usable satellite observation is older than 10 days."
        )

    if cloud is not None and cloud > 25:
        warnings.append(
            "The selected scene has substantial scene cloud cover; interpret results cautiously."
        )

    return {
        "available": True,
        "provider": "Copernicus Data Space Ecosystem",
        "source": "Copernicus Sentinel-2 Level-2A",
        "datasets": {"sentinel2": COLLECTION},
        "analysis_scope": scope,
        "farm_geometry": {
            "source": scope,
            "is_farmer_confirmed": confirmed,
            "geometry_type": geometry.get("type"),
        },
        "resolution_m": 10,
        "latest_observation": scene_time.isoformat(),
        "observed_at": scene_time.isoformat(),
        "observation_age_hours": age_hours,
        "image_count": len(recent),
        "cloud_percent_mean": cloud,
        "ndvi": ndvi,
        "ndre": ndre,
        "ndwi": ndwi,
        "baseline_ndvi": baseline_ndvi,
        "ndvi_trend": trend_value,
        "trend": trend,
        "crop_state": (
            "vegetation_present"
            if ndvi is not None and ndvi >= 0.25
            else "low_or_uncertain_vegetation"
        ),
        "health_index": (
            round(1 - risk_score / 100, 3)
            if risk_score is not None
            else None
        ),
        "risk_score": risk_score,
        "confidence": confidence,
        "risk_method": (
            "prototype vegetation-stress heuristic; not a disease classifier"
        ),
        "scene_id": scene.get("id"),
        "warnings": warnings,
    }


def render_index_layer(
    *,
    latitude: float,
    longitude: float,
    boundary: dict[str, Any] | None,
    layer: str,
    lookback_days: int = 45,
    max_cloud_percent: float = DEFAULT_CLOUD,
) -> tuple[bytes, str]:
    if layer not in {"ndvi", "ndre", "ndwi", "stress"}:
        raise ValueError("layer must be one of: ndvi, ndre, ndwi, stress")

    geometry, _, _ = _geometry(boundary, latitude, longitude)
    now = datetime.now(timezone.utc)
    scenes = _search(
        geometry,
        now - timedelta(days=lookback_days),
        now,
        max_cloud_percent,
    )

    if not scenes:
        raise RuntimeError("No suitable Sentinel-2 scene is available for the farm.")

    scene_time = _scene_time(scenes[0])
    token = _token()
    evalscript, source_resolution = _layer_evalscript(layer)
    start, end = _scene_window(scene_time)

    bbox = _bbox(geometry)
    width = 900
    height = max(450, min(900, int(900 * (bbox[3] - bbox[1]) / max(0.0001, bbox[2] - bbox[0]))))

    payload = {
        "input": {
            "bounds": {
                "geometry": geometry,
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
            },
            "data": [
                {
                    "type": COLLECTION,
                    "dataFilter": {
                        "timeRange": {"from": start, "to": end},
                    },
                    "processing": {
                        "upsampling": "BILINEAR",
                        "downsampling": "BILINEAR",
                    },
                }
            ],
        },
        "output": {
            "width": width,
            "height": height,
            "responses": [
                {
                    "identifier": "default",
                    "format": {"type": "image/png"},
                }
            ],
        },
        "evalscript": evalscript,
    }

    response = requests.post(
        PROCESS,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "image/png",
        },
        json=payload,
        timeout=TIMEOUT,
    )

    if response.status_code >= 400:
        detail = response.text[:500].replace("\n", " ")
        raise RuntimeError(
            f"Copernicus {layer} layer processing failed "
            f"({response.status_code}): {detail}"
        )

    return response.content, "image/png"


def render_true_color_preview(
    *,
    latitude: float,
    longitude: float,
    boundary: dict[str, Any] | None = None,
    lookback_days: int = 45,
    max_cloud_percent: float = DEFAULT_CLOUD,
) -> tuple[bytes, str, list[list[float]]]:
    geometry, _, _ = _geometry(boundary, latitude, longitude)
    bbox = _bbox(geometry)
    now = datetime.now(timezone.utc)
    scenes = _search(
        geometry,
        now - timedelta(days=lookback_days),
        now,
        max_cloud_percent,
    )

    if not scenes:
        raise RuntimeError("No suitable Sentinel-2 scene is available for the farm.")

    token = _token()
    scene_time = _scene_time(scenes[0])
    start, end = _scene_window(scene_time)

    payload = {
        "input": {
            "bounds": {
                "geometry": geometry,
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
            },
            "data": [
                {
                    "type": COLLECTION,
                    "dataFilter": {"timeRange": {"from": start, "to": end}},
                    "processing": {
                        "upsampling": "BILINEAR",
                        "downsampling": "BILINEAR",
                    },
                }
            ],
        },
        "output": {
            "width": 900,
            "height": 700,
            "responses": [
                {
                    "identifier": "default",
                    "format": {"type": "image/png"},
                }
            ],
        },
        "evalscript": RGB_EVALSCRIPT,
    }

    response = requests.post(
        PROCESS,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "image/png",
        },
        json=payload,
        timeout=TIMEOUT,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Copernicus true-color processing failed ({response.status_code})."
        )

    return (
        response.content,
        "image/png",
        [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],
    )


def satellite_configuration_status() -> dict[str, Any]:
    return {
        "configured": bool(
            os.getenv("CDSE_CLIENT_ID") and os.getenv("CDSE_CLIENT_SECRET")
        ),
        "provider": "Copernicus Data Space Ecosystem",
        "collection": COLLECTION,
        "image_resolution_m": 10,
        "satellite_is_live": False,
        "scope": "farm_or_zone_level",
        "layers": ["ndvi", "ndre", "ndwi", "stress"],
    }
