import unittest
from datetime import datetime, timedelta, timezone

from services.unified_risk_engine import calculate_unified_risk


def recent_timestamp():
    return datetime.now(timezone.utc).isoformat()


class SatelliteEvidenceFusionTests(unittest.TestCase):
    def setUp(self):
        self.vision = {
            "urgency": "high",
            "visual_confidence": 0.9,
            "captured_at": recent_timestamp(),
            "crop_visible": True,
            "observation": "Green banana canopy visible in the recent farmer photo.",
            "stress_signals": ["leaf yellowing"],
        }
        self.weather = {
            "observed_at": recent_timestamp(),
            "max_rain_probability": 10,
            "total_precipitation": 0,
            "max_wind_gust": 5,
        }

    def satellite(self, age_hours, **extra):
        return {
            "available": True,
            "observation_age_hours": age_hours,
            "risk_score": 90,
            "crop_state": "vegetation_present",
            **extra,
        }

    def risk(self, satellite, vision=None, farm_context=None):
        return calculate_unified_risk(
            vision=vision if vision is not None else self.vision,
            weather=self.weather,
            satellite=satellite,
            soil=None,
            farm_context=farm_context,
        )

    def test_missing_or_unavailable_satellite_does_not_enter_weights_or_signals(self):
        for satellite in (None, {"available": False, "risk_score": 90}):
            with self.subTest(satellite=satellite):
                result = self.risk(satellite)
                self.assertNotIn("satellite", result["weights_used"])
                self.assertNotIn("satellite", result["signals_used"])

    def test_aging_satellite_has_lower_weight_than_fresh_satellite(self):
        fresh = self.risk(self.satellite(24))
        aging = self.risk(self.satellite(120))
        self.assertIn("satellite", fresh["weights_used"])
        self.assertIn("satellite", aging["weights_used"])
        self.assertLess(
            aging["weights_used"]["satellite"],
            fresh["weights_used"]["satellite"],
        )
        self.assertEqual(aging["evidence_state"]["freshness"]["satellite"]["status"], "aging")

    def test_stale_satellite_is_excluded_from_current_risk(self):
        result = self.risk(self.satellite(240))
        self.assertEqual(result["evidence_state"]["freshness"]["satellite"]["status"], "stale")
        self.assertNotIn("satellite", result["weights_used"])
        self.assertNotIn("satellite", result["signals_used"])

    def test_recent_photo_conflicting_with_bare_satellite_requests_verification(self):
        satellite = self.satellite(240, crop_state="bare")
        result = self.risk(
            satellite,
            farm_context={"crop_age_days": 10},
        )
        conflicts = result["evidence_state"]["conflicts"]
        self.assertTrue(any(item["type"] == "satellite_photo_conflict" for item in conflicts))
        self.assertNotIn("satellite", result["weights_used"])
        self.assertEqual(result["evidence_state"]["freshness"]["vision"]["status"], "fresh")


if __name__ == "__main__":
    unittest.main()
