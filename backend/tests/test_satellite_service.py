import unittest
from unittest.mock import patch

from services.satellite_service import _geometry, _satellite_stress, analyze_satellite_evidence, satellite_configuration_status


class SatelliteServiceTests(unittest.TestCase):
    def test_invalid_coordinates_fail_before_network(self):
        with self.assertRaises(ValueError):
            analyze_satellite_evidence(latitude=100, longitude=78)

    def test_invalid_window_fails_before_network(self):
        with self.assertRaises(ValueError):
            analyze_satellite_evidence(latitude=10, longitude=78, lookback_days=3)

    def test_stress_score_is_bounded(self):
        score, confidence = _satellite_stress(0.2, 0.1, -0.2)
        self.assertIsNotNone(score)
        self.assertIsNotNone(confidence)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 1)

    def test_missing_ndvi_returns_no_satellite_risk(self):
        score, confidence = _satellite_stress(None, 0.2, 0.1)
        self.assertIsNone(score)
        self.assertIsNone(confidence)

    def test_boundary_is_preserved_as_farmer_confirmed(self):
        boundary = {"type": "Polygon", "coordinates": [[[78.0, 10.0], [78.001, 10.0], [78.001, 10.001], [78.0, 10.0]]]}
        geometry, scope, confirmed = _geometry(boundary, 10.0, 78.0)
        self.assertEqual(geometry["type"], "Polygon")
        self.assertTrue(confirmed)
        self.assertIn("farmer-confirmed", scope)

    @patch("services.satellite_service._token", return_value="test-token")
    @patch("services.satellite_service._stats", side_effect=[[0.62, 0.35, -0.05], [0.55, 0.31, -0.02]])
    @patch("services.satellite_service._search")
    def test_real_response_shape_is_deterministic(self, search, _stats, _token):
        scene = {"id": "S2_TEST", "properties": {"datetime": "2026-10-01T05:00:00Z", "eo:cloud_cover": 4.2}}
        search.side_effect = [[scene], [scene]]
        result = analyze_satellite_evidence(latitude=10.0, longitude=78.0)
        self.assertTrue(result["available"])
        self.assertEqual(result["provider"], "Copernicus Data Space Ecosystem")
        self.assertEqual(result["resolution_m"], 10)
        self.assertAlmostEqual(result["ndvi"], 0.62)
        self.assertIn(result["trend"], {"improving", "stable", "declining"})

    def test_configuration_status_has_no_secret_value(self):
        status = satellite_configuration_status()
        self.assertIn("configured", status)
        self.assertEqual(status["provider"], "Copernicus Data Space Ecosystem")
        self.assertNotIn("client_secret", status)


if __name__ == "__main__":
    unittest.main()
