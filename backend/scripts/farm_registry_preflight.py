"""Read-only preflight checks for the local farm registry.

Run from backend:
    python -m scripts.farm_registry_preflight
    python -m scripts.farm_registry_preflight --strict

The default mode reports warnings without changing farm data. Strict mode returns
non-zero for any warning or error, suitable for a deliberate operator gate.
Output intentionally uses record indexes and issue codes, not farm IDs,
coordinates, farmer names, or parcel metadata.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    record_index: int | None
    detail: str


def _number(value: Any) -> bool:
    # Python integers are finite by definition; math.isfinite() may overflow
    # when handed an extremely large integer parsed from JSON.
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and math.isfinite(value)


def _valid_position(position: Any) -> bool:
    return (
        isinstance(position, list)
        and len(position) >= 2
        and _number(position[0])
        and _number(position[1])
        and -180 <= position[0] <= 180
        and -90 <= position[1] <= 90
    )


def _valid_ring(ring: Any) -> bool:
    return (
        isinstance(ring, list)
        and len(ring) >= 4
        and all(_valid_position(position) for position in ring)
        and ring[0][:2] == ring[-1][:2]
    )


def _valid_polygon_coordinates(coordinates: Any) -> bool:
    return (
        isinstance(coordinates, list)
        and bool(coordinates)
        and all(_valid_ring(ring) for ring in coordinates)
    )


def _valid_boundary(boundary: Any) -> bool:
    """Validate the supported GeoJSON Polygon and MultiPolygon geometries."""
    if not isinstance(boundary, dict):
        return False

    geometry_type = boundary.get("type")
    coordinates = boundary.get("coordinates")

    if geometry_type == "Polygon":
        return _valid_polygon_coordinates(coordinates)

    if geometry_type == "MultiPolygon":
        return (
            isinstance(coordinates, list)
            and bool(coordinates)
            and all(_valid_polygon_coordinates(polygon) for polygon in coordinates)
        )

    return False


def inspect_registry(records: Any) -> list[Finding]:
    """Return deterministic findings without modifying or exposing record values."""
    findings: list[Finding] = []
    if not isinstance(records, list):
        return [Finding("ERROR", "registry_not_list", None, "Registry root must be a JSON array.")]

    ids: dict[str, int] = {}
    parcel_refs: dict[str, int] = {}
    geometry_refs: dict[str, int] = {}

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            findings.append(Finding("ERROR", "record_not_object", index, "Record must be an object."))
            continue

        farm_id = record.get("farm_id")
        if not isinstance(farm_id, str) or not farm_id.strip():
            findings.append(Finding("ERROR", "farm_id_missing", index, "Farm ID must be a non-empty string."))
        elif farm_id in ids:
            findings.append(Finding("ERROR", "duplicate_farm_id", index, f"Duplicates record {ids[farm_id]}."))
        else:
            ids[farm_id] = index

        location = record.get("location")
        if not isinstance(location, dict):
            findings.append(Finding("ERROR", "location_missing", index, "Location object is required."))
        else:
            lat, lon = location.get("latitude"), location.get("longitude")
            if not (_number(lat) and _number(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                findings.append(Finding("ERROR", "location_invalid", index, "Latitude/longitude must be finite numeric values in range."))

        boundary = record.get("boundary")
        if record.get("farmer_confirmed") is True and not _valid_boundary(boundary):
            findings.append(Finding("ERROR", "confirmed_boundary_invalid", index, "Farmer-confirmed records require a valid closed GeoJSON Polygon or MultiPolygon."))

        if isinstance(boundary, dict) and _valid_boundary(boundary):
            # Canonical JSON makes exact duplicate geometry detectable without
            # depending on dict insertion order. This is a warning, not proof
            # that two records refer to the same legal parcel.
            geometry_key = json.dumps(boundary, sort_keys=True, separators=(",", ":"), allow_nan=False)
            if geometry_key in geometry_refs:
                findings.append(Finding("WARNING", "duplicate_boundary_geometry", index, f"Matches geometry in record {geometry_refs[geometry_key]}; verify whether this is intentional."))
            else:
                geometry_refs[geometry_key] = index

        parcel_id = record.get("parcel_id")
        if isinstance(parcel_id, str) and parcel_id.strip():
            if parcel_id in parcel_refs:
                findings.append(Finding("WARNING", "duplicate_parcel_reference", index, f"Matches parcel reference in record {parcel_refs[parcel_id]}; verify registration semantics."))
            else:
                parcel_refs[parcel_id] = index

        profile = record.get("farm_profile")
        if isinstance(profile, dict):
            total = profile.get("total_farm_acres")
            mapped = record.get("mapped_area_acres")
            if total is not None and not (_number(total) and total > 0):
                findings.append(Finding("ERROR", "total_acreage_invalid", index, "Total farm acreage must be a positive finite number when supplied."))
            if mapped is not None and not (_number(mapped) and mapped > 0):
                findings.append(Finding("ERROR", "mapped_acreage_invalid", index, "Mapped acreage must be a positive finite number when supplied."))
            if _number(total) and total > 0 and _number(mapped) and mapped > total:
                findings.append(Finding("WARNING", "mapped_area_exceeds_total", index, "Mapped boundary area exceeds declared total farm acreage; confirm units and registration."))

    return findings


def load_registry(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("registry file could not be read as UTF-8 JSON") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only farm registry integrity preflight.")
    parser.add_argument("--registry", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "farms.json")
    parser.add_argument("--strict", action="store_true", help="return non-zero when warnings are present")
    args = parser.parse_args(argv)

    try:
        records = load_registry(args.registry)
    except ValueError as exc:
        print(f"ERROR registry_unreadable: {exc}")
        return 2

    findings = inspect_registry(records)
    for finding in findings:
        location = f" record={finding.record_index}" if finding.record_index is not None else ""
        print(f"{finding.severity} {finding.code}{location}: {finding.detail}")

    counts = Counter(finding.severity for finding in findings)
    print(f"Farm registry preflight: records={len(records) if isinstance(records, list) else 0}, errors={counts['ERROR']}, warnings={counts['WARNING']}")
    if counts["ERROR"]:
        return 1
    if args.strict and counts["WARNING"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
