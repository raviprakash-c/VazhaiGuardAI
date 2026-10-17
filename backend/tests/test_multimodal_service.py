import json
import unittest
import urllib.error
from unittest.mock import MagicMock, patch

# Keep unit tests isolated from developer AWS SSO profile / credentials.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from services.multimodal_service import (
        _analyze_with_local_ollama,
        analyze_crop_image,
        check_ollama_reachable,
        decode_data_url,
    )


class LocalVisionTests(unittest.TestCase):
    @patch("services.multimodal_service.urllib.request.urlopen")
    def test_local_ollama_response_is_parsed_and_tagged(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "message": {
                "content": json.dumps({
                    "observation": "Visible banana leaf with mild spotting",
                    "crop_visible": True,
                    "stress_signals": ["leaf spotting"],
                    "possible_causes": ["fungal spot"],
                    "urgency": "medium",
                    "visual_confidence": 0.85,
                    "needs_field_verification": True,
                    "recommended_checks": ["inspect underside of leaf"],
                    "farmer_message": "இலைகளில் சிறிய புள்ளிகள் தென்படுகின்றன.",
                })
            }
        }).encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = _analyze_with_local_ollama(
            image_bytes=b"dummy-image-bytes",
            prompt="Analyze crop",
        )
        self.assertEqual(result["provider"], "ollama-local")
        self.assertEqual(result["model"], "qwen2.5vl:3b")
        self.assertFalse(result["fallback_used"])
        self.assertEqual(result["observation"], "Visible banana leaf with mild spotting")
        self.assertTrue(result["crop_visible"])

    @patch("services.multimodal_service.validate_image_quality", return_value={"accepted": True, "issues": []})
    @patch("services.multimodal_service.get_bedrock_client")
    @patch("services.multimodal_service.urllib.request.urlopen")
    def test_local_ollama_failure_falls_back_to_bedrock(self, mock_urlopen, mock_bedrock, _mock_quality):
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        mock_client = MagicMock()
        mock_client.converse.return_value = {
            "output": {
                "message": {
                    "content": [{
                        "text": json.dumps({
                            "observation": "Cloud vision observation",
                            "crop_visible": True,
                            "stress_signals": [],
                            "possible_causes": [],
                            "urgency": "low",
                            "visual_confidence": 0.9,
                            "needs_field_verification": False,
                            "recommended_checks": [],
                            "farmer_message": "பயிர் ஆரோக்கியமாக உள்ளது.",
                        })
                    }]
                }
            }
        }
        mock_bedrock.return_value = mock_client

        result = analyze_crop_image(
            image_bytes=b"fake-image-bytes-jpeg",
            content_type="image/jpeg",
        )
        self.assertEqual(result["provider"], "aws-bedrock")
        self.assertTrue(result["fallback_used"])
        self.assertEqual(result["observation"], "Cloud vision observation")

    @patch("services.multimodal_service.validate_image_quality", return_value={"accepted": True, "issues": []})
    @patch("services.multimodal_service.get_bedrock_client")
    @patch("services.multimodal_service.urllib.request.urlopen")
    def test_both_local_and_bedrock_failing_raises_runtime_error(self, mock_urlopen, mock_bedrock, _mock_quality):
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")
        mock_client = MagicMock()
        mock_client.converse.side_effect = RuntimeError("ExpiredToken")
        mock_bedrock.return_value = mock_client

        with self.assertRaises(RuntimeError) as ctx:
            analyze_crop_image(
                image_bytes=b"fake-image-bytes",
                content_type="image/jpeg",
            )
        self.assertIn("failed", str(ctx.exception).lower())

    def test_empty_image_raises_value_error(self):
        with self.assertRaises(ValueError):
            analyze_crop_image(b"", "image/jpeg")

    def test_invalid_data_url_raises_value_error(self):
        with self.assertRaises(ValueError):
            decode_data_url("not-a-valid-data-url")

    @patch("services.multimodal_service.urllib.request.urlopen")
    def test_check_ollama_reachable_success_and_failure(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp
        self.assertTrue(check_ollama_reachable(timeout_seconds=0.1))

        mock_urlopen.side_effect = urllib.error.URLError("Down")
        self.assertFalse(check_ollama_reachable(timeout_seconds=0.1))


if __name__ == "__main__":
    unittest.main()
