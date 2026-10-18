import json
import subprocess
import sys
import unittest
from pathlib import Path


class InspectionRouterRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use a fresh interpreter so imports made by unrelated tests cannot
        # contaminate the application/router module identities.
        backend_dir = Path(__file__).resolve().parents[1]
        script = r"""
import importlib
import json
from unittest.mock import MagicMock, patch

with patch("boto3.Session", return_value=MagicMock()):
    app_module = importlib.import_module("app.main")
    inspections_module = importlib.import_module("routes.inspections")

print(json.dumps({
    "app_file": app_module.__file__,
    "inspection_file": inspections_module.__file__,
    "inspection_router_paths": [route.path for route in inspections_module.router.routes],
    "routes": [
        (route.path, method)
        for route in app_module.app.routes
        for method in getattr(route, "methods", set())
    ],
}))
"""
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=backend_dir,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        payload = json.loads(result.stdout)
        cls.routes = {tuple(route) for route in payload["routes"]}
        cls.import_diagnostics = payload

    def test_inspection_readiness_route_is_registered(self):
        self.assertIn(
            ("/ai/inspections/health", "GET"),
            self.routes,
            msg=f"App/router import diagnostics: {self.import_diagnostics}",
        )

    def test_inspection_history_route_is_registered(self):
        self.assertIn(
            ("/ai/inspections/{farm_id}/history", "GET"),
            self.routes,
            msg=f"App/router import diagnostics: {self.import_diagnostics}",
        )

    def test_reinspection_route_is_registered(self):
        self.assertIn(
            ("/ai/inspections/reinspect", "POST"),
            self.routes,
            msg=f"App/router import diagnostics: {self.import_diagnostics}",
        )

    def test_timeline_and_next_action_routes_are_registered(self):
        self.assertIn(
            ("/ai/inspections/{farm_id}/timeline", "GET"),
            self.routes,
            msg=f"App/router import diagnostics: {self.import_diagnostics}",
        )
        self.assertIn(
            ("/ai/inspections/{farm_id}/next-action", "GET"),
            self.routes,
            msg=f"App/router import diagnostics: {self.import_diagnostics}",
        )


if __name__ == "__main__":
    unittest.main()
