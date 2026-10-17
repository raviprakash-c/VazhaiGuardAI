import unittest
from unittest.mock import MagicMock, patch


class InspectionRouterRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Router imports initialize AWS clients in this application. Keep this
        # regression test isolated from developer profiles and live AWS calls.
        with patch("boto3.Session", return_value=MagicMock()):
            from app.main import app
        cls.app = app

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
