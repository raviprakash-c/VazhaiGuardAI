import json
import tempfile
import unittest
from pathlib import Path

from scripts.farm_registry_preflight import inspect_registry, load_registry, main


def record(farm_id="farm-a", *, parcel_id=None, mapped=2, total=5, boundary=None):
    item = {
        "farm_id": farm_id,
        "farm_profile": {"total_farm_acres": total},
        "location": {"latitude": 10.0, "longitude": 78.0},
        "boundary": boundary or {
            "type": "Polygon",
            "coordinates": [[[78.0, 10.0], [78.01, 10.0], [78.01, 10.01], [78.0, 10.0]]],
        },
        "mapped_area_acres": mapped,
        "farmer_confirmed": True,
    }
    if parcel_id is not None:
        item["parcel_id"] = parcel_id
    return item


class FarmRegistryPreflightTests(unittest.TestCase):
    def test_clean_record_has_no_findings(self):
        self.assertEqual(inspect_registry([record()]), [])

    def test_valid_multipolygon_is_accepted(self):
        boundary = {
            "type": "MultiPolygon",
            "coordinates": [[[
                [78.0, 10.0], [78.01, 10.0], [78.01, 10.01],
                [78.0, 10.0],
            ]]],
        }
        findings = inspect_registry([record(boundary=boundary)])
        self.assertNotIn("confirmed_boundary_invalid", {finding.code for finding in findings})

    def test_invalid_ring_inside_multipolygon_is_rejected(self):
        boundary = {
            "type": "MultiPolygon",
            "coordinates": [[[
                [78.0, 10.0], [78.01, 10.0], [78.01, 10.01],
                [78.02, 10.02],
            ]]],
        }
        findings = inspect_registry([record(boundary=boundary)])
        self.assertIn("confirmed_boundary_invalid", {finding.code for finding in findings})

    def test_duplicate_farm_ids_are_errors(self):
        findings = inspect_registry([record("same"), record("same")])
        self.assertIn("duplicate_farm_id", {finding.code for finding in findings})
        self.assertTrue(any(f.severity == "ERROR" for f in findings))

    def test_duplicate_parcel_reference_is_warning(self):
        findings = inspect_registry([record("a", parcel_id="parcel-x"), record("b", parcel_id="parcel-x")])
        self.assertIn("duplicate_parcel_reference", {finding.code for finding in findings})
        self.assertFalse(any(f.severity == "ERROR" for f in findings))

    def test_duplicate_geometry_is_warning_not_proof_of_duplicate_parcel(self):
        findings = inspect_registry([record("a"), record("b")])
        self.assertIn("duplicate_boundary_geometry", {finding.code for finding in findings})

    def test_mapped_area_larger_than_total_is_warning(self):
        findings = inspect_registry([record(mapped=8, total=5)])
        self.assertIn("mapped_area_exceeds_total", {finding.code for finding in findings})
        self.assertFalse(any(f.severity == "ERROR" for f in findings))

    def test_rejects_boolean_and_out_of_range_coordinates(self):
        bad = record()
        bad["location"] = {"latitude": True, "longitude": 181}
        findings = inspect_registry([bad])
        self.assertIn("location_invalid", {finding.code for finding in findings})

    def test_confirmed_boundary_must_be_closed_and_in_range(self):
        bad = record(boundary={
            "type": "Polygon",
            "coordinates": [[[78.0, 10.0], [78.01, 10.0], [181.0, 10.01], [78.0, 10.0]]],
        })
        findings = inspect_registry([bad])
        self.assertIn("confirmed_boundary_invalid", {finding.code for finding in findings})

    def test_extremely_large_integer_is_rejected_without_crashing(self):
        bad = record()
        bad["location"] = {"latitude": 10**1000, "longitude": 78}
        findings = inspect_registry([bad])
        self.assertIn("location_invalid", {finding.code for finding in findings})

    def test_non_list_root_is_reported(self):
        self.assertEqual(inspect_registry({"farm_id": "x"})[0].code, "registry_not_list")

    def test_load_registry_rejects_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "farms.json"
            path.write_text("{not-json", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_registry(path)

    def test_cli_is_read_only_and_strict_mode_fails_on_warning(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "farms.json"
            path.write_text(json.dumps([record(mapped=8, total=5)]), encoding="utf-8")
            self.assertEqual(main(["--registry", str(path)]), 0)
            self.assertEqual(main(["--registry", str(path), "--strict"]), 1)
            # The CLI only reads; it must not rewrite the input file.
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))[0]["mapped_area_acres"], 8)


if __name__ == "__main__":
    unittest.main()
