import unittest
from unittest.mock import MagicMock, patch

# Avoid requiring a developer's local AWS SSO profile during unit tests.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from routes.followup import ReinspectionRequest, reinspect_after_feedback


class ReinspectionEvidenceTests(unittest.TestCase):
    @patch("routes.followup._generate_farmer_decision")
    @patch("routes.followup._fuse_signals", return_value=(24.0, "low", {}, ["vision", "soil"], {}))
    @patch("routes.followup._resolve_soil_context", return_value={"available": True, "provider": "ISRIC SoilGrids"})
    @patch("routes.followup._resolve_satellite_context", return_value={"available": True, "provider": "Copernicus"})
    @patch("routes.followup.analyze_crop_image", return_value={"observation": "leaf yellowing", "visual_confidence": 0.8})
    @patch("routes.followup.decode_data_url", return_value=(b"image-bytes", "image/jpeg"))
    def test_reinspection_uses_confirmed_farm_evidence_contexts(
        self,
        _decode,
        _vision,
        resolve_satellite,
        resolve_soil,
        fuse,
        decide,
    ):
        decide.return_value = {
            "farmer_message": "புதிய இலைகளை மீண்டும் சரிபார்க்கவும்.",
            "priority_actions": [{"action": "Check soil moisture", "reason": "Confirm field conditions"}],
            "follow_up_check": "Check the same plant",
            "recheck_after": "Tomorrow",
            "needs_field_verification": False,
        }
        request = ReinspectionRequest(
            action_id="action-123",
            language="ta-IN",
            image_data_url="data:image/jpeg;base64,aW1hZ2U=",
            farm_id="farm-123",
            latitude=10.1,
            longitude=78.2,
            previous_risk_score=32,
            farm_context={"crop": "banana"},
        )

        result = reinspect_after_feedback(request)

        resolve_satellite.assert_called_once_with(
            farm_id="farm-123",
            latitude=10.1,
            longitude=78.2,
            supplied_context=None,
        )
        resolve_soil.assert_called_once_with(
            farm_id="farm-123",
            latitude=10.1,
            longitude=78.2,
            supplied_context=None,
        )
        self.assertEqual(fuse.call_args.args[1:], (None, {"available": True, "provider": "Copernicus"}, {"available": True, "provider": "ISRIC SoilGrids"}, {"crop": "banana"}))
        self.assertEqual(decide.call_args.kwargs["soil"], {"available": True, "provider": "ISRIC SoilGrids"})
        self.assertEqual(result.satellite_evidence["provider"], "Copernicus")
        self.assertEqual(result.soil_evidence["provider"], "ISRIC SoilGrids")
        self.assertIn("soil", result.signals_used)

    def test_reinspection_request_accepts_optional_registered_farm_coordinates(self):
        request = ReinspectionRequest(
            action_id="action-123",
            image_data_url="data:image/jpeg;base64,aW1hZ2U=",
            farm_id="farm-123",
            latitude=10.1,
            longitude=78.2,
        )
        self.assertEqual(request.farm_id, "farm-123")
        self.assertEqual(request.latitude, 10.1)
        self.assertEqual(request.longitude, 78.2)


if __name__ == "__main__":
    unittest.main()
