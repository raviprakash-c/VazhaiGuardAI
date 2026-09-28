from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable

BASE_DIR = Path(__file__).resolve().parent.parent / "challenge_data"
TASK2_DIR = BASE_DIR / "task2_geojson"

CANDIDATE_FILES = {
    "cadastral": TASK2_DIR / "Park_Cadastral_Map.geojson",
    "fmb": TASK2_DIR / "Park_fmb_Map.geojson",
}

PARKS_FILE = TASK2_DIR / "Thoothukudi_Parks.geojson"


def _load(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _norm(value: Any) -> str:
    if value is None:
        return ""

    text = unicodedata.normalize(
        "NFKC",
        str(value)
    ).strip().lower()

    text = re.sub(r"[\s\-_/.,]+", " ", text)

    return text


def _tokens(value: str) -> set[str]:
    return {
        t
        for t in _norm(value).split()
        if len(t) > 1
    }


ALIASES = {
    "தூத்துக்குடி": "thoothukudi",
    "தூத்துக்குடி மாவட்டம்": "thoothukudi",
    "thoothukkudi": "thoothukudi",

    "திருநெல்வேலி": "tirunelveli",
    "தென்காசி": "tenkasi",

    "அல்லிக்குளம்": "allikulam",

    "கீழத்தட்டப்பாறை": "keelathattaparai",

    "மேலத்தட்டப்பாறை": "melathattaparai",

    "பெரூரணி": "peroorani",

    "ராமசாமிபுரம்": "ramasamypuram",

    "தெற்கு சிலுக்கன்பட்டி": "south silukanpatti",

    "சிலுக்கன்பட்டி": "south silukanpatti",

    "உமரிக்கோட்டை": "umarikottai",
    "உமரிகோட்டை": "umarikottai",

    "தூத்துக்குடி வட்டம்": "thoothukudi",
}


def _canonical(value: Any) -> str:
    n = _norm(value)
    return ALIASES.get(n, n)


def _text_match(query: str, value: Any) -> bool:
    q = _canonical(query)
    v = _canonical(value)

    if not q or not v:
        return False

    return (
        q == v
        or q in v
        or v in q
        or bool(_tokens(q) & _tokens(v))
    )


def _geometry_points(
    geometry: dict[str, Any]
) -> Iterable[tuple[float, float]]:

    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])

    if gtype == "Polygon":

        for ring in coords[:1]:

            for point in ring:

                if len(point) >= 2:
                    yield (
                        float(point[0]),
                        float(point[1])
                    )

    elif gtype == "MultiPolygon":

        for polygon in coords:

            for ring in polygon[:1]:

                for point in ring:

                    if len(point) >= 2:
                        yield (
                            float(point[0]),
                            float(point[1])
                        )


def _centroid(
    geometry: dict[str, Any]
) -> tuple[float, float] | None:

    points = list(
        _geometry_points(geometry)
    )

    if not points:
        return None

    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def _distance_km(
    a: tuple[float, float],
    b: tuple[float, float]
) -> float:

    lon1, lat1 = map(
        math.radians,
        a
    )

    lon2, lat2 = map(
        math.radians,
        b
    )

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    h = (
        math.sin(dlat / 2) ** 2
        +
        math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    return (
        6371.0088
        * 2
        * math.asin(math.sqrt(h))
    )


def _extract_location_clues(
    transcript: str
) -> dict[str, Any]:

    text = transcript.strip()
    n = _norm(text)

    clues: dict[str, Any] = {
        "district": None,
        "taluk": None,
        "village": None,
        "survey_no": None,
        "road": None,
        "landmarks": [],
        "relations": [],
        "gps_requested": False,
    }

    survey_match = re.search(
        r"(?:survey|s\.?\s*no|சர்வே|சர்வே\s*நம்பர்|நில\s*எண்)"
        r"\s*(?:number|no|எண்)?"
        r"\s*[:\-]?\s*"
        r"([0-9]+(?:[/\-][0-9A-Za-z]+)*)",
        text,
        re.IGNORECASE,
    )

    if survey_match:
        clues["survey_no"] = survey_match.group(1)

    relation_map = [
        ("பக்கத்துல", "near"),
        ("பக்கத்தில்", "near"),
        ("அருகில்", "near"),
        ("அருகே", "near"),
        ("பின்னாடி", "behind"),
        ("பின்னால்", "behind"),
        ("எதிர்ல", "opposite"),
        ("எதிரில்", "opposite"),
        ("அடுத்தது", "next_to"),
        ("அடிவாரத்தில்", "foothill"),
        ("அடிவாரத்துல", "foothill"),
        ("அந்தப்பக்கம்", "across"),
    ]

    for phrase, relation in relation_map:

        if phrase in text:
            clues["relations"].append(
                relation
            )

    landmark_map = {
        "கோவில்": "temple",
        "அம்மன் கோவில்": "temple",
        "temple": "temple",

        "மில்": "mill",
        "mill": "mill",

        "கோழிப்பண்ணை": "poultry_farm",
        "poultry farm": "poultry_farm",

        "மலை": "hill",
        "hill": "hill",

        "குளம்": "pond",
        "pond": "pond",

        "ஏரி": "lake",
        "lake": "lake",

        "கால்வாய்": "canal",
        "canal": "canal",

        "பாலம்": "bridge",
        "bridge": "bridge",

        "பள்ளி": "school",
        "school": "school",

        "highway": "highway",
        "ஹைவே": "highway",

        "main road": "major_road",
        "மெயின் ரோடு": "major_road",
    }

    for phrase, kind in landmark_map.items():

        if _norm(phrase) in n:

            clues["landmarks"].append(
                {
                    "type": kind,
                    "query": phrase,
                }
            )

    known_districts = [
        "thoothukudi",
        "thoothukkudi",
        "தூத்துக்குடி",
        "tirunelveli",
        "திருநெல்வேலி",
        "tenkasi",
        "தென்காசி",
        "dindigul",
        "திண்டுக்கல்",
    ]

    known_taluks = [
        "thoothukudi",
        "sivagiri",
        "tenkasi",
        "ஒட்டப்பிடாரம்",
        "திருச்செந்தூர்",
        "கோவில்பட்டி",
    ]

    for name in known_districts:

        if _text_match(name, text):
            clues["district"] = name
            break

    for name in known_taluks:

        if _text_match(name, text):
            clues["taluk"] = name
            break

    return clues


def _feature_record(
    feature: dict[str, Any],
    layer: str
) -> dict[str, Any]:

    props = feature.get("properties") or {}
    geometry = feature.get("geometry") or {}

    centroid = _centroid(
        geometry
    )

    return {
        "layer": layer,
        "geometry": geometry,
        "properties": props,
        "centroid": (
            {
                "longitude": centroid[0],
                "latitude": centroid[1],
            }
            if centroid
            else None
        ),
    }


class LocationIntelligenceService:

    def __init__(self) -> None:

        self.layers: dict[
            str,
            list[dict[str, Any]]
        ] = {}

        for layer, path in CANDIDATE_FILES.items():

            if path.exists():

                data = _load(path)

                self.layers[layer] = [
                    _feature_record(
                        feature,
                        layer
                    )
                    for feature
                    in data.get(
                        "features",
                        []
                    )
                ]

        self.parks: list[
            dict[str, Any]
        ] = []

        if PARKS_FILE.exists():

            data = _load(
                PARKS_FILE
            )

            self.parks = [
                _feature_record(
                    feature,
                    "parks"
                )
                for feature
                in data.get(
                    "features",
                    []
                )
            ]

    def search(
        self,
        *,
        transcript: str = "",
        district: str | None = None,
        taluk: str | None = None,
        village: str | None = None,
        survey_no: str | None = None,
        road: str | None = None,
        landmarks: list[str] | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        limit: int = 5,
    ) -> dict[str, Any]:

        clues = _extract_location_clues(
            transcript
        )

        district = (
            district
            or clues["district"]
        )

        taluk = (
            taluk
            or clues["taluk"]
        )

        village = (
            village
            or None
        )

        survey_no = (
            survey_no
            or clues["survey_no"]
        )

        road = (
            road
            or None
        )

        requested_landmarks = list(
            landmarks or []
        )

        requested_landmarks.extend(
            x["query"]
            for x in clues["landmarks"]
        )

        requested_landmarks = list(
            dict.fromkeys(
                requested_landmarks
            )
        )

        records = []

        for layer, features in self.layers.items():

            for item in features:

                props = item[
                    "properties"
                ]

                score = 0.0
                evidence: list[str] = []

                p_district = props.get(
                    "dist_name"
                )

                p_taluk = props.get(
                    "taluk_name"
                )

                p_village = props.get(
                    "vil_name"
                )

                p_survey = props.get(
                    "survey_no"
                )

                if district:

                    district = _canonical(
                        district
                    )

                    if _text_match(
                        district,
                        p_district
                    ):
                        score += 30
                        evidence.append(
                            "district_match"
                        )
                    else:
                        continue

                if taluk:

                    taluk = _canonical(
                        taluk
                    )

                    if _text_match(
                        taluk,
                        p_taluk
                    ):
                        score += 20
                        evidence.append(
                            "taluk_match"
                        )
                    else:
                        continue

                if village:

                    if _text_match(
                        village,
                        p_village
                    ):
                        score += 30
                        evidence.append(
                            "village_match"
                        )
                    else:
                        continue

                if survey_no:

                    if _text_match(
                        survey_no,
                        p_survey
                    ):
                        score += 35
                        evidence.append(
                            "survey_match"
                        )

                if road:

                    evidence.append(
                        "road_layer_unavailable"
                    )

                for landmark in requested_landmarks:

                    matched_park = None

                    for park in self.parks:

                        park_name = park[
                            "properties"
                        ].get(
                            "park_name"
                        )

                        if _text_match(
                            landmark,
                            park_name
                        ):
                            matched_park = park
                            break

                    if (
                        matched_park
                        and item["centroid"]
                        and matched_park["centroid"]
                    ):

                        c = (
                            item[
                                "centroid"
                            ]["longitude"],
                            item[
                                "centroid"
                            ]["latitude"],
                        )

                        p = (
                            matched_park[
                                "centroid"
                            ]["longitude"],
                            matched_park[
                                "centroid"
                            ]["latitude"],
                        )

                        distance = _distance_km(
                            c,
                            p
                        )

                        if distance <= 5:

                            score += max(
                                5,
                                20
                                - distance * 3
                            )

                            evidence.append(
                                f"near_named_park:{park_name}"
                            )

                    elif landmark:

                        evidence.append(
                            "landmark_layer_unavailable"
                        )

                if (
                    latitude is not None
                    and longitude is not None
                    and item["centroid"]
                ):

                    distance = _distance_km(
                        (
                            longitude,
                            latitude,
                        ),
                        (
                            item[
                                "centroid"
                            ]["longitude"],
                            item[
                                "centroid"
                            ]["latitude"],
                        ),
                    )

                    if distance <= 10:

                        score += max(
                            0,
                            30
                            - distance * 3
                        )

                        evidence.append(
                            f"location_distance_km:{distance:.2f}"
                        )

                if (
                    score > 0
                    or not any(
                        [
                            district,
                            taluk,
                            village,
                            survey_no,
                            road,
                            requested_landmarks,
                            latitude,
                            longitude,
                        ]
                    )
                ):

                    records.append(
                        {
                            **item,
                            "score": round(
                                score,
                                2
                            ),
                            "evidence": evidence,
                        }
                    )

        records.sort(
            key=lambda x: x["score"],
            reverse=True
        )

        candidates = records[
            : max(1, limit)
        ]

        missing_layers = []

        if road:
            missing_layers.append(
                "road_network"
            )

        if requested_landmarks:

            missing_layers.append(
                "temple_school_mill_hill_waterway_landmark_layers"
            )

        return {
            "parsed_clues": {
                "district": (
                    _canonical(district)
                    if district
                    else None
                ),
                "taluk": (
                    _canonical(taluk)
                    if taluk
                    else None
                ),
                "village": village,
                "survey_no": survey_no,
                "road": road,
                "landmarks": clues[
                    "landmarks"
                ],
                "relations": clues[
                    "relations"
                ],
            },

            "candidate_count": len(
                candidates
            ),

            "candidates": candidates,

            "data_sources": [
                "Park_Cadastral_Map.geojson",
                "Park_fmb_Map.geojson",
            ],

            "missing_layers": sorted(
                set(missing_layers)
            ),

            "status": (
                "candidates_found"
                if candidates
                else "need_more_location_clues"
            ),

            "message": (
                "Candidate parcels found from the FarmwiseAI-provided reference layers."
                if candidates
                else
                "More location clues are required. Current repository data does not contain enough matching attributes."
            ),
        }


location_intelligence = LocationIntelligenceService()