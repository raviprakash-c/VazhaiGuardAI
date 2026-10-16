import unittest
from scripts.live_smoke_test import build_inspection_payload

class LiveSmokeTestHelpers(unittest.TestCase):
    def test_inspection_payload_is_tamil_and_base64_encoded(self):
        payload = build_inspection_payload(b"test-image", "image/jpeg", "farm-demo", 9.5, 77.5)
        self.assertEqual(payload["farm_id"], "farm-demo")
        self.assertEqual(payload["language"], "ta-IN")
        self.assertEqual(payload["latitude"], 9.5)
        self.assertTrue(payload["image_data_url"].startswith("data:image/jpeg;base64,"))
        self.assertNotIn("test-image", payload["image_data_url"])

if __name__ == "__main__":
    unittest.main()
