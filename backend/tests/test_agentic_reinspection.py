from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from services.agentic_reinspection import plan_next_inspection


class AgenticReinspectionTests(unittest.TestCase):
    def test_empty_history_requests_baseline(self):
        result = plan_next_inspection(history=[])
        self.assertEqual(result["decision"], "BASELINE_REQUIRED")
        self.assertTrue(result["reinspect"])
        self.assertEqual(result["trigger"], "baseline")

    def test_worsening_comparison_has_priority_over_weather(self):
        result = plan_next_inspection(
            history=[{"comparison": {"status": "worsened"}, "incident": {"severity": "low"}}],
            current_weather={"next_24_hours": {"max_rain_probability": 95}},
        )
        self.assertEqual(result["decision"], "REINSPECT_SOON")
        self.assertEqual(result["trigger"], "worsening")

    def test_malformed_weather_values_do_not_crash_or_trigger(self):
        result = plan_next_inspection(
            history=[{"created_at": "not-a-date", "incident": {"severity": "low"}}],
            current_weather={
                "next_24_hours": {
                    "max_rain_probability": "unknown",
                    "max_wind_gust": float("nan"),
                }
            },
        )
        self.assertEqual(result["decision"], "WAIT_AND_MONITOR")
        self.assertFalse(result["reinspect"])

    def test_high_weather_risk_triggers_reinspection(self):
        result = plan_next_inspection(
            history=[{"incident": {"severity": "low"}}],
            current_weather={"next_24_hours": {"max_rain_probability": "80"}},
        )
        self.assertEqual(result["decision"], "WEATHER_TRIGGERED_REINSPECTION")
        self.assertEqual(result["trigger"], "weather_event")

    def test_naive_utc_timestamp_older_than_seven_days_is_due(self):
        old_timestamp = (datetime.now(timezone.utc) - timedelta(days=8)).replace(tzinfo=None).isoformat()
        result = plan_next_inspection(
            history=[{"created_at": old_timestamp, "incident": {"severity": "low"}}]
        )
        self.assertEqual(result["decision"], "ROUTINE_REINSPECTION_DUE")
        self.assertEqual(result["trigger"], "time_based")

    def test_future_timestamp_is_not_marked_overdue(self):
        future_timestamp = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        result = plan_next_inspection(
            history=[{"created_at": future_timestamp, "incident": {"severity": "low"}}]
        )
        self.assertEqual(result["decision"], "WAIT_AND_MONITOR")
        self.assertFalse(result["reinspect"])

    def test_field_verification_triggers_reinspection(self):
        result = plan_next_inspection(
            history=[{"vision_summary": {"needs_field_verification": True}}]
        )
        self.assertEqual(result["decision"], "REINSPECT_SOON")
        self.assertEqual(result["trigger"], "verification_required")


if __name__ == "__main__":
    unittest.main()
