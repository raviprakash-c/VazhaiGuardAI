import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# Keep route import independent of live AWS credentials/resources.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from routes.multimodal import RiskFusionRequest, risk_fusion


class RiskFusionEvidenceContractTests(unittest.TestCase):
    def setUp(self):
        self.vision = {
            "observation": "A recent farmer photo shows visible banana plants.",
            "stress_signals": ["leaf yellowing"],
            "possible_causes": ["water stress"],
            "urgency": "medium",
            "visual_confidence": 0.85,
            "needs_field_verification": False,
            "recommended_checks": ["Check soil moisture"],
            "crop_visible": True,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }
        self.weather = {
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "max_rain_probability": 10,
            "total_precipitation": 0,
            "max_wind_gust": 5,
        }
        self.decision = {
            "summary": "Possible leaf stress; check the field.",
            "priority_actions": [
                {
                    "priority": 1,
                    "action": "Check soil moisture",
                    "reason": "Confirm the possible cause in the field.",
                }
            ],
            "follow_up_check": "",
            "recheck_after": "Tomorrow",
            "needs_field_verification": False,
            "farmer_message": "Please check the crop in the field.",
        }

    def call_risk_fusion(self, satellite):
        request = RiskFusionRequest(
            vision=self.vision,
            weather=self.weather,
            satellite=satellite,
            language="en",
        )
        with patch("routes.multimodal._generate_farmer_decision", return_value=dict(self.decision)):
            return risk_fusion(request)

    def assert_response_contract(self, response):
        self.assertIn("decision", response)
        self.assertIn("evaluation", response)
        self.assertIn("weights_used", response["risk"])
        self.assertIn("signals_used", response["risk"])
        self.assertEqual(
            set(response["risk"]["weights_used"]),
            set(response["risk"]["signals_used"]),
        )
        self.assertEqual(
            response["risk"]["evidence_state"]["effective_weights"],
            response["risk"]["weights_used"],
        )

    def test_missing_satellite_is_absent_from_final_api_weights_and_trace(self):
        response = self.call_risk_fusion(None)
        self.assert_response_contract(response)
        self.assertNotIn("satellite", response["risk"]["weights_used"])
        self.assertNotIn("satellite", response["risk"]["signals_used"])
        self.assertFalse(response["evaluation"]["evidence_trace"]["satellite_freshness"] == "fresh")

    def test_stale_satellite_is_excluded_from_final_api_weights_and_trace(self):
        satellite = {
            "available": True,
            "observation_age_hours": 240,
            "risk_score": 99,
            "crop_state": "vegetation_present",
        }
        response = self.call_risk_fusion(satellite)
        self.assert_response_contract(response)
        self.assertEqual(response["evaluation"]["evidence_trace"]["satellite_freshness"], "stale")
        self.assertNotIn("satellite", response["risk"]["weights_used"])
        self.assertNotIn("satellite", response["risk"]["signals_used"])
        self.assertNotIn("STALE_SATELLITE_USED", [item["code"] for item in response["evaluation"]["issues"]])

    def test_conflicting_satellite_forces_verification_in_final_api_response(self):
        satellite = {
            "available": True,
            "observation_age_hours": 24,
            "risk_score": 99,
            "crop_state": "bare",
        }
        response = self.call_risk_fusion(satellite)
        self.assert_response_contract(response)
        self.assertTrue(response["decision"]["needs_field_verification"])
        self.assertTrue(response["decision"]["follow_up_check"])
        self.assertNotIn("satellite", response["risk"]["weights_used"])
        self.assertNotIn("satellite", response["risk"]["signals_used"])
        self.assertTrue(response["evaluation"]["requires_field_verification"])
        self.assertNotIn(
            "CONFLICT_WITHOUT_VERIFICATION",
            [item["code"] for item in response["evaluation"]["issues"]],
        )


if __name__ == "__main__":
    unittest.main()
