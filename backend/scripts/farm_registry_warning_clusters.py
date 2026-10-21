"""Read-only grouped diagnostics for farm-registry preflight warnings.

Run from backend:
    python -m scripts.farm_registry_warning_clusters
    python -m scripts.farm_registry_warning_clusters --registry path/to/farms.json

The report groups repeated references/geometries and acreage mismatches so operators
can investigate shared causes. It prints record indexes and short fingerprints only;
it never prints parcel references, farm IDs, farmer names, or coordinates.
It does not modify the registry.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any


SOURCE_TERMS = (
    "source", "origin", "import", "created", "updated", "demo", "sample",
    "seed", "synthetic", "verified", "confirmed", "unit", "area", "acre",
)


def _finite_number(value: Any) -> bool:
    """Check finite JSON numbers without overflowing on arbitrarily large ints."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and math.isfinite(value)


def _fingerprint(value: Any) -> str:
    raw = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:12]


def _groups(values: dict[str, list[int]]) -> list[dict[str, Any]]:
    return [
        {"fingerprint": key, "records": indexes, "occurrences": len(indexes)}
        for key, indexes in sorted(
            ((key, indexes) for key, indexes in values.items() if len(indexes) > 1),
            key=lambda item: item[1][0],
        )
    ]


def build_report(records: Any) -> dict[str, Any]:
    """Build a deterministic summary without exposing underlying identifiers."""
    if not isinstance(records, list):
        raise ValueError("registry root must be a JSON array")

    parcel_refs: dict[str, list[int]] = defaultdict(list)
    geometries: dict[str, list[int]] = defaultdict(list)
    acreage_mismatches: list[dict[str, Any]] = []
    total_acres_distribution: dict[str, int] = defaultdict(int)
    provenance_presence: dict[str, int] = defaultdict(int)

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            continue

        parcel_id = record.get("parcel_id")
        if isinstance(parcel_id, str) and parcel_id.strip():
            parcel_refs[_fingerprint(parcel_id)].append(index)

        boundary = record.get("boundary")
        if isinstance(boundary, dict):
            try:
                geometries[_fingerprint(boundary)].append(index)
            except (TypeError, ValueError):
                # Invalid/non-JSON numeric geometry is left for the preflight
                # validator to report; this summary must remain read-only.
                pass

        profile = record.get("farm_profile")
        if isinstance(profile, dict):
            total = profile.get("total_farm_acres")
            if _finite_number(total):
                total_acres_distribution[str(total)] += 1
            mapped = record.get("mapped_area_acres")
            if (
                _finite_number(total) and _finite_number(mapped)
                and total > 0 and mapped > total
            ):
                acreage_mismatches.append({
                    "record": index,
                    "declared_acres": total,
                    "mapped_acres": mapped,
                    "excess_acres": round(mapped - total, 6),
                })

        for key in record:
            if any(term in key.lower() for term in SOURCE_TERMS):
                provenance_presence[key] += 1

    parcel_groups = _groups(parcel_refs)
    geometry_groups = _groups(geometries)
    parcel_warning_count = sum(group["occurrences"] - 1 for group in parcel_groups)
    geometry_warning_count = sum(group["occurrences"] - 1 for group in geometry_groups)
    acreage_warning_count = len(acreage_mismatches)

    return {
        "records_inspected": len(records),
        "duplicate_parcel_reference_groups": parcel_groups,
        "duplicate_boundary_geometry_groups": geometry_groups,
        "acreage_mismatches": acreage_mismatches,
        "warning_reconciliation": {
            "duplicate_parcel_reference_warnings": parcel_warning_count,
            "duplicate_boundary_geometry_warnings": geometry_warning_count,
            "mapped_area_exceeds_total_warnings": acreage_warning_count,
            "total_accounted_warnings": parcel_warning_count + geometry_warning_count + acreage_warning_count,
        },
        "declared_acreage_distribution": dict(
            sorted(total_acres_distribution.items())
        ),
        "provenance_field_presence": dict(sorted(provenance_presence.items())),
        "safety": {
            "read_only": True,
            "identifiers_redacted": True,
            "no_records_changed": True,
        },
    }


def load_registry(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("registry file could not be read as UTF-8 JSON") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Group farm-registry warnings for read-only investigation."
    )
    parser.add_argument(
        "--registry", type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "farms.json",
    )
    args = parser.parse_args(argv)

    try:
        report = build_report(load_registry(args.registry))
    except ValueError as exc:
        print(f"ERROR registry_unreadable: {exc}")
        return 2

    print(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
