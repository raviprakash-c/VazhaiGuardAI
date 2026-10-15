from unittest import TestCase
from unittest.mock import patch

from services.farmer_feedback import build_feedback_event, get_feedback_history, persist_feedback


class FarmerFeedbackTests(TestCase):
    def test_event_normalizes_language_and_trims_note(self):
        event = build_feedback_event(
            action_id="  action-1  ",
            outcome="needs_help",
            farmer_id="farm-1",
            language="ta",
            note="  need a pump  ",
            recorded_at="2026-10-15T12:00:00+00:00",
        )
        self.assertEqual(event["action_id"], "action-1")
        self.assertEqual(event["language"], "ta-IN")
        self.assertEqual(event["note"], "need a pump")
        self.assertEqual(event["recorded_at"], "2026-10-15T12:00:00+00:00")

    @patch("services.farmer_feedback.get_table")
    def test_persist_appends_without_replacing_farm_fields(self, get_table):
        persist_feedback(farm_id=" farm-1 ", event={"action_id": "a1", "outcome": "completed"})
        get_table.return_value.update_item.assert_called_once()
        kwargs = get_table.return_value.update_item.call_args.kwargs
        self.assertEqual(kwargs["Key"], {"farm_id": "farm-1"})
        self.assertIn("list_append", kwargs["UpdateExpression"])
        self.assertEqual(kwargs["ExpressionAttributeValues"][":events"], [{"action_id": "a1", "outcome": "completed"}])
        self.assertEqual(kwargs["ConditionExpression"], "attribute_exists(farm_id)")

    @patch("services.farmer_feedback.get_table")
    def test_history_returns_latest_first_and_limits_to_50(self, get_table):
        get_table.return_value.get_item.return_value = {
            "Item": {"farm_id": "farm-1", "farmer_feedback": [{"n": n} for n in range(60)]}
        }
        history = get_feedback_history(farm_id="farm-1")
        self.assertEqual(len(history), 50)
        self.assertEqual(history[0], {"n": 59})
        self.assertEqual(history[-1], {"n": 10})

    @patch("services.farmer_feedback.get_table")
    def test_missing_farm_raises_lookup_error(self, get_table):
        get_table.return_value.get_item.return_value = {}
        with self.assertRaises(LookupError):
            get_feedback_history(farm_id="missing")
