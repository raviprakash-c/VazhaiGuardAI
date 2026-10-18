import json
import subprocess
import sys
import unittest
from pathlib import Path


class InspectionRouterRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Import the application in a clean interpreter. Reloading app/router
        # modules in the unittest process can leave previously imported routers
        # attached to other module instances, making the test depend on order.
        backend_dir = Path(__file__).resolve().parents[1]
        script = r"""
import json
from unittest.mock import MagicMock, patch

with patch("boto3.Session", return_value=MagicMock()):
    from app.main import app

print(json.dumps([
    (route.path, method)
    for route in app.routes
    for method in getattr(route, "methods", set())
]))
"""
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=backend_dir,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        cls.routes = {tuple(route) for route in json.loads(result.stdout)}

    def test_inspection_readiness_route_is_registered(self):
        self.assertIn(("/ai/inspections/health", "GET"), self.routes)

    def test_inspection_history_route_is_registered(self):
        self.assertIn(("/ai/inspections/{farm_id}/history", "GET"), self.routes)

    def test_reinspection_route_is_registered(self):
        self.assertIn(("/ai/inspections/reinspect", "POST"), self.routes)

    def test_timeline_and_next_action_routes_are_registered(self):
        self.assertIn(("/ai/inspections/{farm_id}/timeline", "GET"), self.routes)
        self.assertIn(("/ai/inspections/{farm_id}/next-action", "GET"), self.routes)


if __name__ == "__main__":
    unittest.main()
