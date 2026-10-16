import unittest
from unittest.mock import Mock, patch

from services.soil_service import get_soil_evidence, soil_configuration_status


class SoilServiceTests(unittest.TestCase):
    def test_invalid_coordinates_are_rejected_before_network(self):
        with patch("services.soil_service.requests.get") as get:
            with self.assertRaises(ValueError):
                get_soil_evidence(latitude=91, longitude=78)
        get.assert_not_called()

    @patch("services.soil_service.requests.get")
    def test_valid_soilgrids_response_is_normalized_and_labeled_contextual(self, get):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            "properties": {
                "phh2o": {"0-5cm": {"mean": 65, "uncertainty": 5}},
                "clay": {"0-5cm": {"mean": 300, "uncertainty": 30}},
                "sand": {"0-5cm": {"mean": 400, "uncertainty": 40}},
                "soc": {"0-5cm": {"mean": 100, "uncertainty": 10}},
                "cec": {"0-5cm": {"mean": 200, "uncertainty": 20}},
            }
        }
        get.return_value = response

        result = get_soil_evidence(latitude=10.0, longitude=78.0)

        self.assertTrue(result["available"])
        self.assertEqual(result["provider"], "ISRIC SoilGrids")
        self.assertEqual(result["scope"], "coarse_soil_context")
        self.assertEqual(result["properties"]["phh2o"], 6.5)
        self.assertEqual(result["properties"]["clay"], 30.0)
        self.assertEqual(result["properties"]["sand"], 40.0)
        self.assertEqual(result["properties"]["soc"], 10.0)
        self.assertEqual(result["risk_score"], 5.0)
        self.assertEqual(result["confidence"], 0.35)
        self.assertIn("not a crop disease classifier", result["risk_method"])
        get.assert_called_once()

    @patch("services.soil_service.requests.get")
    def test_provider_http_error_returns_unavailable_evidence(self, get):
        response = Mock()
        response.status_code = 503
        get.return_value = response

        result = get_soil_evidence(latitude=10.0, longitude=78.0)

        self.assertFalse(result["available"])
        self.assertEqual(result["provider"], "ISRIC SoilGrids")
        self.assertIn("HTTP 503", result["reason"])

    @patch("services.soil_service.requests.get", side_effect=TimeoutError("timed out"))
    def test_provider_timeout_returns_unavailable_evidence(self, _get):
        result = get_soil_evidence(latitude=10.0, longitude=78.0)
        self.assertFalse(result["available"])
        self.assertEqual(result["scope"], "coarse_soil_context")
        self.assertIn("temporarily unavailable", result["warnings"][0])

    def test_configuration_status_discloses_provider_scope(self):
        status = soil_configuration_status()
        self.assertTrue(status["configured"])
        self.assertEqual(status["provider"], "ISRIC SoilGrids")
        self.assertEqual(status["resolution_m"], 250)
        self.assertEqual(status["scope"], "coarse_soil_context")


if __name__ == "__main__":
    unittest.main()
