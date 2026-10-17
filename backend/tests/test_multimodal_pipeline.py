import unittest
from unittest.mock import MagicMock, patch

# Import the route without requiring local AWS SSO credentials or active tables.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from routes.multimodal import (
        RiskFusionRequest,
        _fuse_signals,
        _generate_farmer_decision,
        multimodal_health,
        risk_fusion,
    )


class MultimodalPipelineTests(unittest.TestCase):
    @patch("routes.multimodal.generate_text", return_value='{"summary":"Check the plant","priority_actions":[],"follow_up_check":"Check soil moisture","recheck_after":"Tomorrow","needs_field_verification":true,"farmer_message":"இலையை மீண்டும் சரிபார்க்கவும்"}')
    def test_decision_prompt_accepts_and_includes_soil(self, mock_generate_text):
        soil = {"available": True, "provider": "SoilGrids", "ph": 6.2}
        result = _generate_farmer_decision(
            vision={"observation": "leaf yellowing", "needs_field_verification": True},
            weather=None,
            satellite=None,
            soil=soil,
            farm_context={"crop_stage": "vegetative"},
            score=45.0,
            label="Watch",
            language="ta-IN",
        )
        self.assertIn("summary", result)
        self.assertEqual(result["summary"], "Check the plant")
        self.assertEqual(result["farmer_message"], "இலையை மீண்டும் சரிபார்க்கவும்")

        # Verify prompt passed to generate_text contained soil evidence
        prompt_arg = mock_generate_text.call_args[1]["prompt"]
        self.assertIn("SOIL EVIDENCE", prompt_arg)
        self.assertIn("SoilGrids", prompt_arg)

    def test_fuse_signals_accepts_soil_keyword(self):
        vision = {"visual_confidence": 0.8, "crop_visible": True, "stress_signals": ["leaf spotting"]}
        weather = {"rainfall_risk": 20}
        satellite = {"available": False}
        soil = {"available": True, "ph": 6.5}
        farm_context = {"acreage": 2.5}

        score, level, signal_scores, signals_used, weights_used = _fuse_signals(
            vision=vision,
            weather=weather,
            satellite=satellite,
            soil=soil,
            farm_context=farm_context,
        )
        self.assertIsInstance(score, float)
        self.assertIsInstance(level, str)
        self.assertIsInstance(signals_used, list)
        self.assertIn("vision", signals_used)

    @patch("routes.multimodal.check_ollama_reachable", return_value=False)
    def test_multimodal_health_shape_and_reachability(self, _mock_reach):
        health = multimodal_health()
        self.assertEqual(health["status"], "configured")
        self.assertIn("reachability", health)
        self.assertFalse(health["reachability"]["local_ollama"])
        self.assertEqual(health["reachability"]["cloud_bedrock"], "configured")
        self.assertIn("local_vision_model", health)
        # Ensure no secrets or API keys are exposed
        for key in health:
            self.assertNotIn("secret", key.lower())
            self.assertNotIn("key", key.lower())

    @patch("routes.multimodal.generate_text", return_value='{"summary":"Action plan","priority_actions":[],"follow_up_check":"","recheck_after":"","needs_field_verification":false,"farmer_message":"அனைத்தும் சீராக உள்ளது"}')
    def test_risk_fusion_handler_executes_with_soil(self, _mock_gen):
        request = RiskFusionRequest(
            vision={"observation": "normal", "visual_confidence": 0.9, "crop_visible": True, "stress_signals": []},
            weather={"temperature_c": 30},
            satellite=None,
            soil={"available": True, "ph": 6.8},
            farm_context={"variety": "Grand Naine"},
            language="ta-IN",
        )
        response = risk_fusion(request)
        self.assertIn("risk", response)
        self.assertIn("decision", response)
        self.assertIn("evaluation", response)
        self.assertEqual(response["decision"]["farmer_message"], "அனைத்தும் சீராக உள்ளது")


if __name__ == "__main__":
    unittest.main()
