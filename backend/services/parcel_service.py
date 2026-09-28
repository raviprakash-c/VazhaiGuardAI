from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from shapely.geometry import shape


# -------------------------------------------------------------------
# DATA LOCATION
# -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
GEOSPATIAL_DIR = BASE_DIR / "data" / "geospatial"


# -------------------------------------------------------------------
# ACTUAL FARMWISEAI PROPERTY NAMES
# -------------------------------------------------------------------

PROPERTY_ALIASES = {
    "district": [
        "dist_name",
    ],
    "taluk": [
        "taluk_name",
    ],
    "village": [
        "vil_name",
    ],
    "survey_number": [
        "survey_no",
    ],
    "subdivision": [
        "sub_div",
    ],
    "land_id": [
        "Land_id",
    ],
    "unit_id": [
        "unit_id",
    ],
    "block_id": [
        "block_id",
    ],
    "kide": [
        "KIDE",
    ],
}


# -------------------------------------------------------------------
# TEXT NORMALIZATION
# -------------------------------------------------------------------

def normalize_text(value: Any) -> str:
    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("-", " ")
        .replace("_", " ")
        .replace("/", " ")
        .replace("\\", " ")
        .replace(".", " ")
        .split()
        .__str__()
        .replace("[", "")
        .replace("]", "")
        .replace("'", "")
        .replace(",", " ")
    )


def clean_text(value: Any) -> str:
    if value is None:
        return ""

    return " ".join(str(value).strip().lower().split())


# -------------------------------------------------------------------
# PROPERTY ACCESS
# -------------------------------------------------------------------

def get_property(
    properties: Dict[str, Any],
    logical_name: str,
) -> Optional[Any]:

    aliases = PROPERTY_ALIASES.get(logical_name, [])

    for key in aliases:
        if key in properties:
            return properties[key]

    return None


# -------------------------------------------------------------------
# GEOJSON LOADING
# -------------------------------------------------------------------

def load_geojson_files() -> List[Dict[str, Any]]:
    features: List[Dict[str, Any]] = []

    if not GEOSPATIAL_DIR.exists():
        return features

    for file_path in GEOSPATIAL_DIR.glob("*.geojson"):

        try:
            with file_path.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

            if data.get("type") != "FeatureCollection":
                continue

            source_name = file_path.name

            for feature in data.get("features", []):

                if not feature.get("geometry"):
                    continue

                feature_copy = dict(feature)

                properties = dict(
                    feature_copy.get("properties") or {}
                )

                properties["_source_file"] = source_name

                feature_copy["properties"] = properties

                features.append(feature_copy)

        except Exception as error:
            print(
                f"Unable to load GeoJSON "
                f"{file_path.name}: {error}"
            )

    return features


# -------------------------------------------------------------------
# TEXT MATCHING
# -------------------------------------------------------------------

def text_matches(
    actual_value: Any,
    requested_value: Optional[str],
) -> bool:

    if not requested_value:
        return True

    actual = clean_text(actual_value)
    requested = clean_text(requested_value)

    if not requested:
        return True

    if actual == requested:
        return True

    if requested in actual:
        return True

    if actual in requested:
        return True

    return False


# -------------------------------------------------------------------
# GEOMETRY NORMALIZATION
# -------------------------------------------------------------------

def geometry_to_polygon_or_multipolygon(
    geometry: Dict[str, Any],
) -> Optional[Dict[str, Any]]:

    geometry_type = geometry.get("type")

    if geometry_type == "Polygon":
        return geometry

    if geometry_type == "MultiPolygon":
        return geometry

    return None


# -------------------------------------------------------------------
# AREA CALCULATION
# -------------------------------------------------------------------

def calculate_area_acres(
    geometry: Dict[str, Any],
) -> Optional[float]:

    try:

        geom = shape(geometry)

        if geom.is_empty:
            return None

        # GeoJSON coordinates are normally longitude/latitude.
        # We do NOT pretend this raw geographic area is accurate.
        #
        # Therefore area is intentionally not calculated here
        # unless a projected CRS is available.
        #
        # Return None rather than presenting a false acreage.

        return None

    except Exception:
        return None


# -------------------------------------------------------------------
# CANDIDATE CREATION
# -------------------------------------------------------------------

def build_candidate(
    feature: Dict[str, Any],
    match_reasons: List[str],
) -> Dict[str, Any]:

    properties = feature.get("properties") or {}

    geometry = geometry_to_polygon_or_multipolygon(
        feature.get("geometry") or {}
    )

    if geometry is None:
        return {}

    district = get_property(
        properties,
        "district",
    )

    taluk = get_property(
        properties,
        "taluk",
    )

    village = get_property(
        properties,
        "village",
    )

    survey_number = get_property(
        properties,
        "survey_number",
    )

    subdivision = get_property(
        properties,
        "subdivision",
    )

    land_id = get_property(
        properties,
        "land_id",
    )

    unit_id = get_property(
        properties,
        "unit_id",
    )

    block_id = get_property(
        properties,
        "block_id",
    )

    kide = get_property(
        properties,
        "kide",
    )

    source_file = properties.get(
        "_source_file"
    )

    # Prefer stable FarmwiseAI identifiers.
    parcel_id = (
        str(land_id)
        if land_id is not None
        else (
            f"{source_file}:"
            f"{unit_id}:"
            f"{block_id}:"
            f"{survey_number}:"
            f"{subdivision}"
        )
    )

    # Basic confidence based on matched fields.
    confidence = min(
        0.55 + (0.10 * len(match_reasons)),
        0.95,
    )

    area_acres = calculate_area_acres(
        geometry
    )

    return {
        "parcel_id": parcel_id,
        "district": district,
        "taluk": taluk,
        "village": village,
        "survey_number": survey_number,
        "subdivision": subdivision,
        "land_id": land_id,
        "unit_id": unit_id,
        "block_id": block_id,
        "kide": kide,
        "area_acres": area_acres,
        "confidence": round(confidence, 2),
        "match_reasons": match_reasons,
        "source_file": source_file,
        "geometry": geometry,
    }


# -------------------------------------------------------------------
# PARCEL SEARCH
# -------------------------------------------------------------------

def search_parcels(request) -> List[Dict[str, Any]]:

    all_features = load_geojson_files()

    if not all_features:
        return []

    results: List[Dict[str, Any]] = []

    for feature in all_features:

        properties = feature.get(
            "properties",
            {},
        )

        reasons: List[str] = []

        # -----------------------------------------------------------
        # DISTRICT
        # -----------------------------------------------------------

        district = get_property(
            properties,
            "district",
        )

        if request.district:

            if not text_matches(
                district,
                request.district,
            ):
                continue

            reasons.append("district matched")

        # -----------------------------------------------------------
        # TALUK
        # -----------------------------------------------------------

        taluk = get_property(
            properties,
            "taluk",
        )

        if request.taluk:

            if not text_matches(
                taluk,
                request.taluk,
            ):
                continue

            reasons.append("taluk matched")

        # -----------------------------------------------------------
        # VILLAGE
        # -----------------------------------------------------------

        village = get_property(
            properties,
            "village",
        )

        if request.village:

            if not text_matches(
                village,
                request.village,
            ):
                continue

            reasons.append("village matched")

        # -----------------------------------------------------------
        # SURVEY NUMBER
        # -----------------------------------------------------------

        survey_number = get_property(
            properties,
            "survey_number",
        )

        if request.survey_number:

            if not text_matches(
                survey_number,
                request.survey_number,
            ):
                continue

            reasons.append(
                "survey number matched"
            )

        # -----------------------------------------------------------
        # SUBDIVISION
        # -----------------------------------------------------------

        subdivision = get_property(
            properties,
            "subdivision",
        )

        if request.subdivision:

            if not text_matches(
                subdivision,
                request.subdivision,
            ):
                continue

            reasons.append(
                "subdivision matched"
            )

        # -----------------------------------------------------------
        # BUILD RESULT
        # -----------------------------------------------------------

        candidate = build_candidate(
            feature,
            reasons,
        )

        if not candidate:
            continue

        results.append(candidate)

        if len(results) >= request.limit:
            break

    return results