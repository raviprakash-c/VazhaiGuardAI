import unittest

from services.satellite_service import _satellite_stress, analyze_satellite_evidence


class SatelliteServiceTests(unittest.TestCase):
    def test_invalid_coordinates_fail_before_earth_engine(self):
        with self.assertRaises(ValueError):
            analyze_satellite_evidence(latitude=100, longitude=78)

    def test_invalid_window_fails_before_earth_engine(self):
        with self.assertRaises(ValueError):
            analyze_satellite_evidence(latitude=10, longitude=78, lookback_days=3)

    def test_stress_score_is_bounded(self):
        score, confidence = _satellite_stress(0.2, 0.1, -0.2, 0.9)
        self.assertIsNotNone(score)
        self.assertIsNotNone(confidence)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 1)

    def test_missing_ndvi_returns_no_satellite_risk(self):
        score, confidence = _satellite_stress(None, 0.2, 0.1, 0.8)
        self.assertIsNone(score)
        self.assertIsNone(confidence)


if __name__ == "__main__":
    unittest.main()
