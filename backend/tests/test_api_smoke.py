import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
class ApiSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
    def test_root_endpoint_returns_service_information(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "online")
        self.assertEqual(payload["service"], "VazhaiGuardAI")
        self.assertIn("version", payload)
    def test_health_endpoint_reports_healthy(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
    @patch("routes.inspections.s3_health", return_value={"status": "mocked"})
    def test_inspection_health_endpoint(self, mocked_s3_health):
        response = self.client.get("/ai/inspections/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "inspection evidence")
        self.assertEqual(payload["s3"], {"status": "mocked"})
        mocked_s3_health.assert_called_once()
    @patch("routes.inspections.get_farm", return_value=None)
    def test_unknown_farm_history_returns_404(self, mocked_get_farm):
        response = self.client.get("/ai/inspections/unknown-smoke-test-farm/history")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Farm was not found.")
        mocked_get_farm.assert_called_once_with("unknown-smoke-test-farm")
if __name__ == "__main__":
    unittest.main()
