import unittest
from unittest.mock import MagicMock, patch

# Import the route without requiring a local AWS SSO profile in CI.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from routes.multimodal import _fuse_signals, _generate_farmer_decision


class MultimodalPipelineTests(unittest.TestCase):
    @patch("routes.multimodal.generate_text", return_value='{"summary":"Check the plant","priority_actions":[],"follow_up_check":"Check soil moisture","recheck_after":"Tomorrow","needs_field_verification":true,"farmer_message":"இலையை மீண்டும் சரிபார்க்கவும்"}')
    def test_decision_prompt_accepts_and_includes_soil(self, generate_text):
        soil = {"available": True, "provider": "SoilGrids", "ph": 6.2}
        result = _generate_farmer_decision(
            vision={"observation": "leaf yellowing"},
            weather=None,
            satellite=None,
            soil=soil,
            farm_context={"crop": "banana"},
            score=28,
            label="low",
            language="ta-IN",
        )
        prompt = generate_text.call_args.kwargs["prompt"]
        self.assertIn("SOIL EVIDENCE:", prompt)
        self.assertIn("SoilGrids", prompt)
        self.assertEqual(result["farmer_message"], "இலையை மீண்டும் சரிபார்க்கவும்")

    @patch("routes.multimodal.calculate_unified_risk", return_value={
        "score": 31, "level": "low", "signal_scores": {"vision": 30, "weather": 20, "satellite": 0, "soil": 40},
        "signals_used": ["vision", "soil"], "weights_used": {"vision": 0.7, "soil": 0.3}, "evidence_state": {}
    })
    def test_fusion_passes_soil_and_farm_context_separately(self, calculate):
        soil = {"available": True, "ph": 6.2}
        farm = {"crop": "banana", "farm_name": "Demo"}
        _fuse_signals({"visual_confidence": 0.7}, None, None, soil, farm)
        self.assertEqual(calculate.call_args.kwargs["soil"], soil)
        self.assertEqual(calculate.call_args.kwargs["farm_context"], farm)


if __name__ == "__main__":
    unittest.main()
