from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from services.evidence_state import build_evidence_state, soil_reliability
from services.unified_risk_engine import calculate_unified_risk


def timestamp_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


class EvidenceFusionHardeningTests(unittest.TestCase):
    def setUp(self):
        self.vision = {
            "urgency": "high",
            "visual_confidence": 0.9,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }
        self.weather = {
            "max_rain_probability": 10,
            "observed_at": datetime.now(timezone.utc).isoformat(),
        }

    def test_stale_satellite_is_visible_but_has_zero_decision_weight(self):
        satellite = {
            "risk_score": 95,
            "observed_at": timestamp_ago(20),
            "crop_state": "healthy",
        }

        result = calculate_unified_risk(
            vision=self.vision, weather=self.weather, satellite=satellite
        )

        self.assertEqual(result["evidence_state"]["freshness"]["satellite"]["status"], "stale")
        self.assertEqual(result["evidence_state"]["satellite_reliability"], 0.0)
        self.assertNotIn("satellite", result["weights_used"])
        self.assertEqual(result["signal_scores"]["satellite"], 95.0)

    def test_fresh_satellite_can_contribute_when_no_conflict_exists(self):
        satellite = {
            "risk_score": 60,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "crop_state": "vegetated",
        }

        result = calculate_unified_risk(
            vision=self.vision, weather=self.weather, satellite=satellite
        )

        self.assertEqual(result["evidence_state"]["freshness"]["satellite"]["status"], "fresh")
        self.assertIn("satellite", result["weights_used"])
        self.assertGreater(result["weights_used"]["satellite"], 0)

    def test_temporal_crop_conflict_excludes_satellite_weight(self):
        satellite = {
            "risk_score": 90,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "crop_state": "bare",
        }

        result = calculate_unified_risk(
            vision=self.vision,
            weather=self.weather,
            satellite=satellite,
            farm_context={"crop_age_days": 60},
        )

        self.assertTrue(result["evidence_state"]["conflicts"])
        self.assertEqual(result["evidence_state"]["satellite_reliability"], 0.0)
        self.assertNotIn("satellite", result["weights_used"])

    def test_missing_satellite_timestamp_is_not_misreported_as_fresh(self):
        state = build_evidence_state(
            vision=self.vision,
            weather=self.weather,
            satellite={"risk_score": 50},
        )

        self.assertEqual(state["freshness"]["satellite"]["status"], "unknown")
        self.assertEqual(state["satellite_reliability"], 0.5)

    def test_unavailable_soil_is_not_used_in_decision_weights(self):
        result = calculate_unified_risk(
            vision=self.vision,
            weather=self.weather,
            satellite=None,
            soil={"available": False, "risk_score": 100, "confidence": 1.0},
        )

        self.assertNotIn("soil", result["weights_used"])
        self.assertEqual(result["evidence_state"]["soil_reliability"], 0.0)

    def test_malformed_soil_confidence_falls_back_safely(self):
        for value in ("unknown", None, float("nan"), 2.0):
            with self.subTest(value=value):
                self.assertEqual(
                    soil_reliability({"available": True, "confidence": value}),
                    0.35,
                )

    def test_effective_weights_match_exclusion_of_stale_satellite(self):
        state = build_evidence_state(
            vision=self.vision,
            weather=self.weather,
            satellite={"risk_score": 99, "observed_at": timestamp_ago(15)},
        )

        self.assertNotIn("satellite", state["effective_weights"])
        self.assertAlmostEqual(sum(state["effective_weights"].values()), 1.0, places=3)


if __name__ == "__main__":
    unittest.main()
