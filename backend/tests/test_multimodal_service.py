import json
import unittest
from unittest.mock import MagicMock, patch

# The module constructs its AWS session at import time. Keep unit tests isolated
# from developer-specific AWS profiles and credentials.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from services.multimodal_service import _analyze_with_local_ollama


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


if __name__ == "__main__":
    unittest.main()
