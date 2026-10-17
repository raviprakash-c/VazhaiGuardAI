import importlib
import unittest
from unittest.mock import MagicMock, patch


class InspectionRouterRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Import/reload the actual backend app while isolating AWS client setup.
        # Other tests may have imported app.main earlier with mocked modules.
        with patch("boto3.Session", return_value=MagicMock()):
            import app.main as app_module
            app_module = importlib.reload(app_module)
        cls.app = app_module.app

    def test_inspection_readiness_route_is_registered(self):
        routes = {(route.path, method) for route in self.app.routes
                  for method in getattr(route, "methods", set())}
        self.assertIn(("/ai/inspections/health", "GET"), routes)

    def test_inspection_history_route_is_registered(self):
        routes = {(route.path, method) for route in self.app.routes
                  for method in getattr(route, "methods", set())}
        self.assertIn(("/ai/inspections/{farm_id}/history", "GET"), routes)

    def test_reinspection_route_is_registered(self):
        routes = {(route.path, method) for route in self.app.routes
                  for method in getattr(route, "methods", set())}
        self.assertIn(("/ai/inspections/reinspect", "POST"), routes)

    def test_timeline_and_next_action_routes_are_registered(self):
        routes = {(route.path, method) for route in self.app.routes
                  for method in getattr(route, "methods", set())}
        self.assertIn(("/ai/inspections/{farm_id}/timeline", "GET"), routes)
        self.assertIn(("/ai/inspections/{farm_id}/next-action", "GET"), routes)


if __name__ == "__main__":
    unittest.main()
