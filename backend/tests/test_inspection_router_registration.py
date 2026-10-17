import importlib
import unittest
from unittest.mock import MagicMock, patch


class InspectionRouterRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Refresh the router module as well as the app. Reloading only app.main
        # can retain a stale router object if another test imported it earlier.
        with patch("boto3.Session", return_value=MagicMock()):
            import routes.inspections as inspections_module
            import app.main as app_module
            inspections_module = importlib.reload(inspections_module)
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
