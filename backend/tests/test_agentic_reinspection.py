from __future__ import annotations

import unittest

from services.agentic_reinspection import plan_next_inspection


class AgenticReinspectionPlannerTests(unittest.TestCase):
    def test_newest_timestamped_record_wins_when_history_is_newest_first(self):
        older = {
            "created_at": "2026-10-01T10:00:00+00:00",
            "incident": {"severity": "low"},
        }
        newer = {
            "created_at": "2026-10-12T10:00:00+00:00",
            "incident": {"severity": "moderate", "field_verification_required": True},
        }

        plan = plan_next_inspection(history=[newer, older])

        self.assertEqual(plan["trigger"], "verification_required")
        self.assertTrue(plan["reinspect"])

    def test_newest_timestamped_record_wins_when_history_is_oldest_first(self):
        older = {
            "created_at": "2026-10-01T10:00:00+00:00",
            "incident": {"severity": "low"},
        }
        newer = {
            "created_at": "2026-10-12T10:00:00+00:00",
            "incident": {"severity": "high"},
        }

        plan = plan_next_inspection(history=[older, newer])

        self.assertEqual(plan["trigger"], "verification_required")
        self.assertTrue(plan["reinspect"])

    def test_invalid_weather_values_do_not_crash_or_trigger_weather_plan(self):
        history = [{
            "created_at": "2026-10-12T10:00:00+00:00",
            "incident": {"severity": "low"},
        }]

        plan = plan_next_inspection(
            history=history,
            current_weather={
                "next_24_hours": {
                    "max_rain_probability": "unknown",
                    "max_wind_gust": None,
                }
            },
        )

        self.assertEqual(plan["trigger"], "no_trigger")
        self.assertFalse(plan["reinspect"])

    def test_high_weather_values_still_trigger_reinspection(self):
        history = [{
            "created_at": "2026-10-12T10:00:00+00:00",
            "incident": {"severity": "low"},
        }]

        plan = plan_next_inspection(
            history=history,
            current_weather={
                "next_24_hours": {
                    "max_rain_probability": 90,
                    "max_wind_gust": 20,
                }
            },
        )

        self.assertEqual(plan["trigger"], "weather_event")
        self.assertTrue(plan["reinspect"])

    def test_empty_history_requires_baseline(self):
        plan = plan_next_inspection(history=[])

        self.assertEqual(plan["decision"], "BASELINE_REQUIRED")
        self.assertEqual(plan["trigger"], "baseline")


if __name__ == "__main__":
    unittest.main()
