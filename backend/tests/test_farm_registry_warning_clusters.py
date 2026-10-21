import json
import tempfile
import unittest
from pathlib import Path

from scripts.farm_registry_warning_clusters import build_report, main


def record(index, *, parcel_id="shared-ref", total=5, mapped=6, boundary=None):
    return {
        "farm_id": f"private-farm-{index}",
        "parcel_id": parcel_id,
        "farm_profile": {"total_farm_acres": total},
        "mapped_area_acres": mapped,
        "boundary": boundary or {
            "type": "Polygon",
            "coordinates": [[[78, 10], [78.01, 10], [78.01, 10.01], [78, 10]]],
        },
        "boundary_source": "test",
        "farmer_confirmed": True,
    }


class FarmRegistryWarningClusterTests(unittest.TestCase):
    def test_groups_repeated_parcel_refs_and_geometry(self):
        report = build_report([record(1), record(2)])
        self.assertEqual(len(report["duplicate_parcel_reference_groups"]), 1)
        self.assertEqual(report["duplicate_parcel_reference_groups"][0]["records"], [1, 2])
        self.assertEqual(len(report["duplicate_boundary_geometry_groups"]), 1)
        self.assertEqual(report["duplicate_boundary_geometry_groups"][0]["records"], [1, 2])

    def test_warning_reconciliation_counts_each_duplicate_after_first(self):
        report = build_report([record(1), record(2)])
        counts = report["warning_reconciliation"]
        self.assertEqual(counts["duplicate_parcel_reference_warnings"], 1)
        self.assertEqual(counts["duplicate_boundary_geometry_warnings"], 1)
        self.assertEqual(counts["mapped_area_exceeds_total_warnings"], 2)
        self.assertEqual(counts["total_accounted_warnings"], 4)

    def test_report_does_not_expose_ids_or_parcel_values(self):
        report = build_report([record(1), record(2)])
        rendered = json.dumps(report)
        self.assertNotIn("private-farm", rendered)
        self.assertNotIn("shared-ref", rendered)
        self.assertNotIn("78.01", rendered)

    def test_acreage_mismatch_is_reported_without_mutating_input(self):
        rows = [record(1, total=5, mapped=9)]
        before = json.dumps(rows, sort_keys=True)
        report = build_report(rows)
        self.assertEqual(report["acreage_mismatches"][0]["excess_acres"], 4)
        self.assertEqual(json.dumps(rows, sort_keys=True), before)

    def test_distinct_geometries_do_not_form_duplicate_group(self):
        first = record(1, boundary={"type": "Polygon", "coordinates": [[[1, 1], [2, 1], [2, 2], [1, 1]]]})
        second = record(2, boundary={"type": "Polygon", "coordinates": [[[3, 3], [4, 3], [4, 4], [3, 3]]]})
        report = build_report([first, second])
        self.assertEqual(report["duplicate_boundary_geometry_groups"], [])

    def test_extremely_large_integer_does_not_overflow(self):
        row = record(1, total=10**1000, mapped=9)
        report = build_report([row])
        self.assertEqual(report["acreage_mismatches"], [])

    def test_non_list_root_rejected(self):
        with self.assertRaises(ValueError):
            build_report({"not": "a list"})

    def test_cli_is_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "farms.json"
            rows = [record(1, total=5, mapped=9)]
            original = json.dumps(rows)
            path.write_text(original, encoding="utf-8")
            self.assertEqual(main(["--registry", str(path)],), 0)
            self.assertEqual(path.read_text(encoding="utf-8"), original)


if __name__ == "__main__":
    unittest.main()
