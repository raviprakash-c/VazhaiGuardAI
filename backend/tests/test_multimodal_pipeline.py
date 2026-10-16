import unittest
from unittest.mock import MagicMock, patch

# Import the route without requiring a local AWS SSO profile in CI.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from routes.multimodal import (
        CropInspectionRequest,
        _fuse_signals,
        _generate_farmer_decision,
        _resolve_satellite_context,
        _resolve_soil_context,
        inspect_and_decide,
    )


class MultimodalPipelineTests(unittest.TestCase):
    def test_inspection_request_accepts_valid_coordinates(self):
        request = CropInspectionRequest(
            image_data_url="data:image/png;base64," + ("a" * 40),
            latitude=13.0827,
            longitude=80.2707,
        )
        self.assertAlmostEqual(request.latitude, 13.0827)
        self.assertAlmostEqual(request.longitude, 80.2707)

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


    def test_satellite_resolver_preserves_explicit_context(self):
        supplied = {"available": True, "provider": "caller", "ndvi": 0.7}
        with patch("routes.multimodal.get_farm") as mock_farm, patch(
            "routes.multimodal.analyze_satellite_evidence"
        ) as mock_analyze:
            result = _resolve_satellite_context(
                farm_id="farm-test",
                latitude=9.0,
                longitude=78.0,
                supplied_context=supplied,
            )
        self.assertIs(result, supplied)
        mock_farm.assert_not_called()
        mock_analyze.assert_not_called()

    def test_satellite_resolver_skips_unconfirmed_boundary(self):
        with patch(
            "routes.multimodal.get_farm",
            return_value={
                "farm_id": "farm-test",
                "farmer_confirmed": False,
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [[[78.0, 9.0], [78.1, 9.0], [78.1, 9.1], [78.0, 9.0]]],
                },
            },
        ), patch("routes.multimodal.analyze_satellite_evidence") as mock_analyze:
            result = _resolve_satellite_context(
                farm_id="farm-test",
                latitude=9.05,
                longitude=78.05,
                supplied_context=None,
            )
        self.assertIsNone(result)
        mock_analyze.assert_not_called()

    def test_satellite_resolver_fetches_confirmed_farm_evidence(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [[[78.0, 9.0], [78.1, 9.0], [78.1, 9.1], [78.0, 9.0]]],
        }
        expected = {"available": True, "provider": "Copernicus"}
        with patch(
            "routes.multimodal.get_farm",
            return_value={
                "farm_id": "farm-test",
                "farmer_confirmed": True,
                "boundary": boundary,
            },
        ), patch(
            "routes.multimodal.analyze_satellite_evidence",
            return_value=expected,
        ) as mock_analyze:
            result = _resolve_satellite_context(
                farm_id="farm-test",
                latitude=9.05,
                longitude=78.05,
                supplied_context=None,
            )
        self.assertIs(result, expected)
        mock_analyze.assert_called_once_with(
            latitude=9.05,
            longitude=78.05,
            boundary=boundary,
        )

    def test_satellite_resolver_fails_open_when_provider_errors(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [[[78.0, 9.0], [78.1, 9.0], [78.1, 9.1], [78.0, 9.0]]],
        }
        with patch(
            "routes.multimodal.get_farm",
            return_value={
                "farm_id": "farm-test",
                "farmer_confirmed": True,
                "boundary": boundary,
            },
        ), patch(
            "routes.multimodal.analyze_satellite_evidence",
            side_effect=RuntimeError("provider unavailable"),
        ):
            result = _resolve_satellite_context(
                farm_id="farm-test",
                latitude=9.05,
                longitude=78.05,
                supplied_context=None,
            )
        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "unavailable")


    def test_soil_resolver_preserves_explicit_context(self):
        supplied = {"available": True, "provider": "caller", "properties": {"phh2o": 6.4}}
        with patch("routes.multimodal.get_farm") as mock_farm, patch(
            "routes.multimodal.get_soil_evidence"
        ) as mock_soil:
            result = _resolve_soil_context(
                farm_id="farm-test",
                latitude=9.0,
                longitude=78.0,
                supplied_context=supplied,
            )
        self.assertIs(result, supplied)
        mock_farm.assert_not_called()
        mock_soil.assert_not_called()

    def test_soil_resolver_skips_unconfirmed_farm(self):
        with patch(
            "routes.multimodal.get_farm",
            return_value={"farm_id": "farm-test", "farmer_confirmed": False},
        ), patch("routes.multimodal.get_soil_evidence") as mock_soil:
            result = _resolve_soil_context(
                farm_id="farm-test",
                latitude=9.0,
                longitude=78.0,
                supplied_context=None,
            )
        self.assertIsNone(result)
        mock_soil.assert_not_called()

    def test_soil_resolver_fetches_context_for_confirmed_farm(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [[[78.0, 9.0], [78.1, 9.0], [78.1, 9.1], [78.0, 9.0]]],
        }
        expected = {"available": True, "provider": "ISRIC SoilGrids"}
        with patch(
            "routes.multimodal.get_farm",
            return_value={
                "farm_id": "farm-test",
                "farmer_confirmed": True,
                "boundary": boundary,
            },
        ), patch(
            "routes.multimodal.get_soil_evidence",
            return_value=expected,
        ) as mock_soil:
            result = _resolve_soil_context(
                farm_id="farm-test",
                latitude=9.05,
                longitude=78.05,
                supplied_context=None,
            )
        self.assertIs(result, expected)
        mock_soil.assert_called_once_with(latitude=9.05, longitude=78.05)

    def test_soil_resolver_provider_failure_is_nonfatal(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [[[78.0, 9.0], [78.1, 9.0], [78.1, 9.1], [78.0, 9.0]]],
        }
        with patch(
            "routes.multimodal.get_farm",
            return_value={
                "farm_id": "farm-test",
                "farmer_confirmed": True,
                "boundary": boundary,
            },
        ), patch(
            "routes.multimodal.get_soil_evidence",
            side_effect=RuntimeError("provider unavailable"),
        ):
            result = _resolve_soil_context(
                farm_id="farm-test",
                latitude=9.05,
                longitude=78.05,
                supplied_context=None,
            )
        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "unavailable")


    def test_inspection_history_is_saved_when_photo_upload_fails(self):
        request = CropInspectionRequest(
            farm_id="farm-test",
            image_data_url="data:image/jpeg;base64," + ("a" * 40),
        )
        risk_result = {
            "score": 20,
            "level": "low",
            "signal_scores": {"vision": 20},
            "signals_used": ["vision"],
            "weights_used": {"vision": 1.0},
            "evidence_state": {},
        }
        with patch("routes.multimodal.decode_data_url", return_value=(b"image", "image/jpeg")), patch(
            "routes.multimodal.analyze_crop_image",
            return_value={"observation": "leaf visible", "visual_confidence": 0.8},
        ), patch(
            "routes.multimodal._fuse_signals",
            return_value=(20.0, "low", {"vision": 20}, ["vision"], {"vision": 1.0}),
        ), patch(
            "routes.multimodal._generate_farmer_decision",
            return_value={"farmer_message": "Check the plant", "priority_actions": []},
        ), patch(
            "routes.multimodal.calculate_unified_risk",
            return_value=risk_result,
        ), patch(
            "routes.multimodal.evaluate_multimodal_decision",
            return_value={"needs_field_verification": True},
        ), patch(
            "routes.multimodal.build_incident_and_action_plan",
            return_value={"actions": []},
        ), patch(
            "routes.multimodal.store_photo",
            side_effect=PermissionError("S3 write denied"),
        ), patch(
            "routes.multimodal.create_inspection_record",
            return_value={"inspection_id": "insp-test"},
        ), patch("routes.multimodal.save_inspection_record") as save_record:
            result = inspect_and_decide(request)

        save_record.assert_called_once()
        self.assertEqual(result["inspection_storage"]["status"], "storage_error")
        self.assertTrue(result["inspection_history"]["stored"])
        self.assertEqual(result["inspection_history"]["status"], "saved")


    def test_inspect_and_decide_returns_complete_evidence_decision_contract(self):
        """Exercise the full one-call route while isolating external providers."""
        request = CropInspectionRequest(
            farm_id="farm-test",
            image_data_url="data:image/jpeg;base64," + ("a" * 40),
            language="ta-IN",
            latitude=9.5,
            longitude=77.5,
            farm_context={"crop": "banana", "farmer_confirmed": True},
            weather_context={"available": True, "risk": "moderate", "source": "Open-Meteo"},
            satellite_context={"available": True, "provider": "Copernicus", "ndvi": 0.61},
            soil_context={"available": True, "provider": "ISRIC SoilGrids"},
        )
        vision = {
            "observation": "possible leaf yellowing",
            "visual_confidence": 0.76,
            "provider": "ollama-local",
            "model": "qwen2.5vl:3b",
            "needs_field_verification": True,
        }
        decision = {
            "summary": "Verify the affected leaves in the field",
            "priority_actions": [{"priority": 1, "action": "Inspect several plants"}],
            "follow_up_check": "Check the underside of affected leaves",
            "recheck_after": "Tomorrow",
            "needs_field_verification": True,
            "farmer_message": "பாதிக்கப்பட்ட இலைகளை நேரில் சரிபார்க்கவும்",
        }
        risk_result = {
            "score": 42,
            "level": "moderate",
            "signal_scores": {"vision": 42, "weather": 50, "satellite": 39, "soil": 0},
            "signals_used": ["vision", "weather", "satellite"],
            "weights_used": {"vision": 0.6, "weather": 0.25, "satellite": 0.15},
            "evidence_state": {"freshness": {"satellite": "periodic"}},
        }
        evaluation = {"needs_field_verification": True, "checks": ["field verification"]}
        incident = {"actions": [{"priority": 1, "action": "Inspect several plants"}]}

        with patch("routes.multimodal.decode_data_url", return_value=(b"image-bytes", "image/jpeg")), patch(
            "routes.multimodal.analyze_crop_image", return_value=vision
        ) as analyze_vision, patch(
            "routes.multimodal._fuse_signals",
            return_value=(42.0, "moderate", risk_result["signal_scores"], risk_result["signals_used"], risk_result["weights_used"]),
        ), patch(
            "routes.multimodal._generate_farmer_decision", return_value=decision
        ) as generate_decision, patch(
            "routes.multimodal.calculate_unified_risk", return_value=risk_result
        ), patch(
            "routes.multimodal.evaluate_multimodal_decision", return_value=evaluation
        ), patch(
            "routes.multimodal.build_incident_and_action_plan", return_value=incident
        ), patch(
            "routes.multimodal.store_photo", return_value={"stored": True, "status": "saved", "key": "demo/photo.jpg"}
        ), patch(
            "routes.multimodal.create_inspection_record", return_value={"inspection_id": "record-test"}
        ), patch("routes.multimodal.save_inspection_record") as save_record:
            result = inspect_and_decide(request)

        analyze_vision.assert_called_once()
        self.assertEqual(analyze_vision.call_args.kwargs["language"], "ta-IN")
        generate_decision.assert_called_once()
        self.assertEqual(generate_decision.call_args.kwargs["satellite"], request.satellite_context)
        self.assertEqual(generate_decision.call_args.kwargs["soil"], request.soil_context)
        self.assertEqual(result["farm_id"], "farm-test")
        self.assertTrue(result["inspection_id"].startswith("insp_"))
        self.assertEqual(result["vision"]["model"], "qwen2.5vl:3b")
        self.assertEqual(result["satellite"]["provider"], "Copernicus")
        self.assertEqual(result["soil"]["provider"], "ISRIC SoilGrids")
        self.assertEqual(result["risk"]["score"], 42.0)
        self.assertEqual(result["risk"]["level"], "moderate")
        self.assertEqual(result["decision"]["farmer_message"], "பாதிக்கப்பட்ட இலைகளை நேரில் சரிபார்க்கவும்")
        self.assertEqual(result["evaluation"], evaluation)
        self.assertEqual(result["incident"], incident)
        self.assertTrue(result["inspection_storage"]["stored"])
        self.assertEqual(result["inspection_history"]["status"], "saved")
        save_record.assert_called_once()


if __name__ == "__main__":
    unittest.main()
