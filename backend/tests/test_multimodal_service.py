import json
import unittest
from unittest.mock import MagicMock, patch

# The module constructs its AWS session at import time. Keep unit tests isolated
# from developer-specific AWS profiles and credentials.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from services.multimodal_service import _analyze_with_local_ollama, _validate_vision_result


class LocalVisionTests(unittest.TestCase):
    @patch("services.multimodal_service.urllib.request.urlopen")
    def test_local_ollama_response_is_parsed_and_tagged(self, urlopen):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = json.dumps({
            "message": {
                "content": json.dumps({
                    "observation": "Visible banana leaf",
                    "crop_visible": True,
                    "stress_signals": [],
                    "possible_causes": [],
                    "urgency": "low",
                    "visual_confidence": 0.7,
                    "needs_field_verification": True,
                    "recommended_checks": ["Check the underside of the leaf"],
                    "farmer_message": "இலையை மீண்டும் சரிபார்க்கவும்"
                })
            }
        }).encode("utf-8")

        result = _analyze_with_local_ollama(image_bytes=b"test-image", prompt="Return JSON")
        request = urlopen.call_args.args[0]
        body = json.loads(request.data.decode("utf-8"))

        self.assertEqual(body["model"], "qwen2.5vl:3b")
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        self.assertEqual(result["provider"], "ollama-local")
        self.assertEqual(result["model"], "qwen2.5vl:3b")
        self.assertFalse(result["fallback_used"])
        self.assertTrue(result["crop_visible"])


    def _valid_result(self):
        return {
            "observation": "Visible banana leaf",
            "crop_visible": True,
            "stress_signals": ["leaf yellowing"],
            "possible_causes": ["water stress"],
            "urgency": "MEDIUM",
            "visual_confidence": 0.7,
            "needs_field_verification": True,
            "recommended_checks": ["Check soil moisture"],
            "farmer_message": "Check the soil near the plant.",
        }

    def test_vision_result_normalizes_urgency_and_confidence(self):
        result = _validate_vision_result(self._valid_result())
        self.assertEqual(result["urgency"], "medium")
        self.assertEqual(result["visual_confidence"], 0.7)

    def test_vision_result_rejects_missing_required_fields(self):
        result = self._valid_result()
        del result["farmer_message"]
        with self.assertRaisesRegex(RuntimeError, "missing required fields"):
            _validate_vision_result(result)

    def test_vision_result_rejects_out_of_range_confidence(self):
        result = self._valid_result()
        result["visual_confidence"] = 1.4
        with self.assertRaisesRegex(RuntimeError, "between 0 and 1"):
            _validate_vision_result(result)

    def test_vision_result_rejects_invalid_urgency(self):
        result = self._valid_result()
        result["urgency"] = "critical"
        with self.assertRaisesRegex(RuntimeError, "low, medium, or high"):
            _validate_vision_result(result)

    def test_vision_result_rejects_non_boolean_crop_flag(self):
        result = self._valid_result()
        result["crop_visible"] = "yes"
        with self.assertRaisesRegex(RuntimeError, "must be a boolean"):
            _validate_vision_result(result)


if __name__ == "__main__":
    unittest.main()
