import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import live_smoke_test as smoke


class Response:
    def __init__(self, body):
        self.body = body
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        return False
    def read(self):
        return self.body


class SmokeTestHelpers(unittest.TestCase):
    def test_status_vocabulary_is_enforced(self):
        for status in ("PASS", "FAIL", "SKIP", "DEGRADED"):
            self.assertEqual(smoke.Check("x", status, "detail").status, status)
        with self.assertRaises(ValueError):
            smoke.Check("x", "UNKNOWN", "detail")

    def test_inspection_payload_is_tamil_and_base64_encoded(self):
        payload = smoke.build_inspection_payload(b"test-image", "image/jpeg", "farm-demo", 9.5, 77.5)
        self.assertEqual(payload["farm_id"], "farm-demo")
        self.assertEqual(payload["language"], "ta-IN")
        self.assertEqual(payload["latitude"], 9.5)
        encoded = payload["image_data_url"].split(",", 1)[1]
        self.assertEqual(base64.b64decode(encoded), b"test-image")

    @patch("scripts.live_smoke_test.urllib.request.urlopen")
    def test_request_json_passes_timeout_and_decodes(self, mocked):
        mocked.return_value = Response(b'{"status":"healthy"}')
        self.assertEqual(smoke.request_json("http://example.test/health", timeout=2), {"status": "healthy"})
        self.assertEqual(mocked.call_args.kwargs["timeout"], 2)

    @patch("scripts.live_smoke_test.request_json", side_effect=TimeoutError())
    def test_timeout_is_fail_without_exception_details(self, _mocked):
        result = smoke.check_http_json("api", "http://example.test")
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.detail, "request timed out")

    @patch("scripts.live_smoke_test.request_json", return_value={"status": "setup_required", "configured": False})
    def test_unconfigured_service_is_degraded_not_pass(self, _mocked):
        result = smoke.check_service_health("satellite", "http://example.test/health")
        self.assertEqual(result.status, "DEGRADED")

    @patch("scripts.live_smoke_test.request_json", return_value={"status": "healthy"})
    def test_health_contract_passes(self, _mocked):
        self.assertEqual(smoke.check_service_health("api", "http://example.test/health").status, "PASS")

    @patch("scripts.live_smoke_test.request_json", return_value={"models": [{"name": "qwen2.5vl:3b"}]})
    def test_ollama_model_tag_check(self, _mocked):
        self.assertEqual(smoke.ollama_model_check("http://ollama", "qwen2.5vl:3b").status, "PASS")

    @patch("scripts.live_smoke_test.request_json", return_value={"message": {"content": "A plant with green leaves."}})
    def test_local_vision_inference_contract(self, mocked):
        with tempfile.TemporaryDirectory() as temp:
            image = Path(temp) / "crop.jpg"
            image.write_bytes(b"test-image")
            result = smoke.ollama_vision_inference("http://ollama", "qwen2.5vl:3b", image)
        self.assertEqual(result.status, "PASS")
        self.assertNotIn("green leaves", result.detail)
        self.assertEqual(mocked.call_args.kwargs["timeout"], 180.0)
        self.assertEqual(mocked.call_args.kwargs["method"], "POST")

    def test_boundary_requires_closed_polygon_ring(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "boundary.json"
            path.write_text(json.dumps({"type": "Polygon", "coordinates": [[[1, 2], [2, 2], [2, 3], [1, 2]]]}), encoding="utf-8")
            self.assertEqual(smoke.validate_boundary(path)["type"], "Polygon")
            path.write_text(json.dumps({"type": "Polygon", "coordinates": [[[1, 2], [2, 2], [2, 3], [1, 3]]]}), encoding="utf-8")
            with self.assertRaises(ValueError):
                smoke.validate_boundary(path)

    def test_boundary_rejects_out_of_range_coordinates(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "boundary.json"
            path.write_text(json.dumps({"type": "Polygon", "coordinates": [[[181, 2], [2, 2], [2, 3], [181, 2]]]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "outside longitude/latitude ranges"):
                smoke.validate_boundary(path)

    def test_boundary_rejects_non_finite_and_boolean_coordinates(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "boundary.json"
            path.write_text('{"type":"Polygon","coordinates":[[[NaN,2],[2,2],[2,3],[NaN,2]]]}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "finite numbers"):
                smoke.validate_boundary(path)
            path.write_text(json.dumps({"type": "Polygon", "coordinates": [[[True, 2], [2, 2], [2, 3], [True, 2]]]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "finite numbers"):
                smoke.validate_boundary(path)

    def test_boundary_validates_all_polygon_rings(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "boundary.json"
            path.write_text(json.dumps({"type": "Polygon", "coordinates": [
                [[1, 1], [4, 1], [4, 4], [1, 1]],
                [[2, 2], [3, 2], [3, 3], [2, 3]],
            ]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "interior ring 1 must be closed"):
                smoke.validate_boundary(path)

    @patch("scripts.live_smoke_test.request_json", return_value={
        "inspection_id": "insp_123", "parent_inspection_id": None,
        "vision": {"provider": "ollama"}, "risk": {"level": "low"},
        "decision": {"farmer_message": "தமிழில் செய்தி"},
        "evaluation": {}, "incident": {},
    })
    def test_live_inspection_contract_without_leaking_message(self, mocked):
        with tempfile.TemporaryDirectory() as temp:
            image = Path(temp) / "crop.jpg"
            image.write_bytes(b"test-image")
            result = smoke.run_inspection("http://api", image, "farm", 9.5, 77.5)
        self.assertEqual(result.status, "PASS")
        self.assertNotIn("தமிழில்", result.detail)
        self.assertIn("/ai/multimodal/inspect-and-decide", mocked.call_args.args[0])

    @patch("scripts.live_smoke_test.request_json", return_value={
        "inspection_id": "insp_456", "parent_inspection_id": "insp_123",
        "comparison": {}, "risk": {}, "decision": {"farmer_message": "private"},
    })
    def test_reinspection_contract(self, mocked):
        with tempfile.TemporaryDirectory() as temp:
            image = Path(temp) / "crop.jpg"
            image.write_bytes(b"test-image")
            result = smoke.run_inspection("http://api", image, "farm", 9.5, 77.5, reinspection=True)
        self.assertEqual(result.status, "PASS")
        self.assertIn("/ai/inspections/reinspect", mocked.call_args.args[0])

    def test_inspection_args_require_boundary_confirmation(self):
        with patch("sys.argv", ["live_smoke_test.py", "--run-inspection", "--image", "crop.jpg",
                                "--farm-id", "farm", "--latitude", "9.5", "--longitude", "77.5"]):
            with self.assertRaises(SystemExit) as error:
                smoke.parse_args()
        self.assertEqual(error.exception.code, 2)

    def test_read_only_history_args_are_allowed(self):
        with patch("sys.argv", ["live_smoke_test.py", "--check-history", "--farm-id", "farm"]):
            args = smoke.parse_args()
        self.assertTrue(args.check_history)

    def test_evidence_coordinates_must_be_in_geographic_ranges(self):
        with patch("sys.argv", ["live_smoke_test.py", "--check-evidence", "--boundary-json", "boundary.json",
                                "--latitude", "91", "--longitude", "77", "--confirmed-boundary-checked"]):
            with self.assertRaises(SystemExit) as error:
                smoke.parse_args()
        self.assertEqual(error.exception.code, 2)

    def test_weather_longitude_must_be_in_geographic_range(self):
        with patch("sys.argv", ["live_smoke_test.py", "--weather-lat", "9.5", "--weather-lon", "181"]):
            with self.assertRaises(SystemExit) as error:
                smoke.parse_args()
        self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
