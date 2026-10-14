from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from services.soil_service import get_soil_evidence, soil_configuration_status


def soilgrids_payload() -> dict:
    return {
        "properties": {
            "phh2o": {"0-5cm": {"mean": 65, "uncertainty": 8}},
            "clay": {"0-5cm": {"mean": 280, "uncertainty": 40}},
            "sand": {"0-5cm": {"mean": 410, "uncertainty": 35}},
            "soc": {"0-5cm": {"mean": 120, "uncertainty": 20}},
            "cec": {"0-5cm": {"mean": 180, "uncertainty": 25}},
        }
    }


class SoilServiceTests(unittest.TestCase):
    @patch("services.soil_service.requests.get")
    def test_normalizes_soilgrids_values_and_returns_caveats(self, get):
        response = Mock(status_code=200)
        response.json.return_value = soilgrids_payload()
        get.return_value = response

        result = get_soil_evidence(latitude=10.7905, longitude=78.7047)

        self.assertTrue(result["available"])
        self.assertEqual(result["provider"], "ISRIC SoilGrids")
        self.assertEqual(result["resolution_m"], 250)
        self.assertEqual(result["depth"], "0-5cm")
        self.assertEqual(result["properties"]["phh2o"], 6.5)
        self.assertEqual(result["properties"]["clay"], 28.0)
        self.assertEqual(result["properties"]["sand"], 41.0)
        self.assertEqual(result["properties"]["soc"], 12.0)
        self.assertEqual(result["properties"]["cec"], 18.0)
        self.assertIsNotNone(result["risk_score"])
        self.assertEqual(result["confidence"], 0.35)
        self.assertTrue(any("not a farm-lab measurement" in note for note in result["warnings"]))
        get.assert_called_once()
        self.assertEqual(get.call_args.kwargs["timeout"] > 0, True)

    @patch("services.soil_service.requests.get")
    def test_http_error_returns_unavailable_evidence_without_raising(self, get):
        get.return_value = Mock(status_code=503)

        result = get_soil_evidence(latitude=10.79, longitude=78.70)

        self.assertFalse(result["available"])
        self.assertIn("HTTP 503", result["reason"])
        self.assertTrue(result["warnings"])

    @patch("services.soil_service.requests.get")
    def test_network_error_returns_unavailable_evidence_without_raising(self, get):
        get.side_effect = TimeoutError("provider timeout")

        result = get_soil_evidence(latitude=10.79, longitude=78.70)

        self.assertFalse(result["available"])
        self.assertIn("request failed", result["reason"])
        self.assertTrue(result["warnings"])

    @patch("services.soil_service.requests.get")
    def test_empty_provider_payload_is_not_treated_as_evidence(self, get):
        response = Mock(status_code=200)
        response.json.return_value = {"properties": {}}
        get.return_value = response

        result = get_soil_evidence(latitude=10.79, longitude=78.70)

        self.assertFalse(result["available"])
        self.assertEqual(result["reason"], "SoilGrids returned no usable values.")

    def test_invalid_coordinates_are_rejected_before_network_request(self):
        with patch("services.soil_service.requests.get") as get:
            with self.assertRaises(ValueError):
                get_soil_evidence(latitude=91, longitude=78.70)
            with self.assertRaises(ValueError):
                get_soil_evidence(latitude=10.79, longitude=181)
            get.assert_not_called()

    def test_health_describes_coarse_context_not_live_measurements(self):
        status = soil_configuration_status()
        self.assertTrue(status["configured"])
        self.assertEqual(status["provider"], "ISRIC SoilGrids")
        self.assertEqual(status["resolution_m"], 250)
        self.assertEqual(status["scope"], "coarse_soil_context")


if __name__ == "__main__":
    unittest.main()
