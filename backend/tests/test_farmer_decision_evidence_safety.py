import unittest

from routes.multimodal import _enforce_evidence_safety
from services.decision_evaluator import evaluate_multimodal_decision


VISION = {
    "observation": "Leaf yellowing is visible.",
    "stress_signals": ["leaf yellowing"],
    "possible_causes": ["water stress"],
    "urgency": "medium",
    "visual_confidence": 0.85,
    "needs_field_verification": False,
    "recommended_checks": ["Check soil moisture"],
    "crop_visible": True,
}

DECISION = {
    "summary": "The photo shows possible leaf stress.",
    "priority_actions": [
        {"priority": 1, "action": "Check soil moisture", "reason": "Confirm the likely cause."}
    ],
    "farmer_message": "Please check the plant in the field.",
    "needs_field_verification": False,
    "follow_up_check": "",
}


class FarmerDecisionEvidenceSafetyTests(unittest.TestCase):
    def risk(self, status="fresh", conflicts=None, signals=None):
        return {
            "score": 62.0,
            "level": "moderate",
            "signals_used": signals if signals is not None else ["vision", "weather"],
            "weights_used": {"vision": 0.64, "weather": 0.36},
            "evidence_state": {
                "freshness": {"satellite": {"status": status}},
                "conflicts": conflicts or [],
            },
        }

    def test_conflict_forces_verification_in_final_decision(self):
        conflict = {
            "type": "satellite_photo_conflict",
            "source": "satellite",
            "message": "Recent photo shows crop while satellite indicates bare ground.",
        }
        risk = self.risk(status="stale", conflicts=[conflict])
        decision = _enforce_evidence_safety(DECISION, risk)
        self.assertTrue(decision["needs_field_verification"])
        self.assertTrue(decision["follow_up_check"])
        evaluation = evaluate_multimodal_decision(
            vision=VISION,
            weather={"max_rain_probability": 10},
            satellite={"available": True},
            risk=risk,
            decision=decision,
        )
        self.assertTrue(evaluation["requires_field_verification"])
        self.assertNotIn("CONFLICT_WITHOUT_VERIFICATION", [i["code"] for i in evaluation["issues"]])

    def test_stale_satellite_cannot_drive_current_risk_or_final_guidance(self):
        risk = self.risk(status="stale", signals=["vision", "weather", "satellite"])
        decision = _enforce_evidence_safety(DECISION, risk)
        evaluation = evaluate_multimodal_decision(
            vision=VISION,
            weather={"max_rain_probability": 10},
            satellite={"available": True},
            risk=risk,
            decision=decision,
        )
        self.assertTrue(decision["needs_field_verification"])
        self.assertIn("STALE_SATELLITE_USED", [i["code"] for i in evaluation["issues"]])
        self.assertFalse(evaluation["decision_safe_to_show"])

    def test_stale_satellite_already_excluded_does_not_force_verification_by_itself(self):
        risk = self.risk(status="stale", signals=["vision", "weather"])
        decision = _enforce_evidence_safety(DECISION, risk)
        self.assertFalse(decision["needs_field_verification"])
        self.assertEqual(decision["follow_up_check"], "")

    def test_conflicting_evidence_cannot_be_marked_safe_without_verification(self):
        conflict = {"type": "satellite_photo_conflict", "source": "satellite"}
        risk = self.risk(conflicts=[conflict])
        evaluation = evaluate_multimodal_decision(
            vision=VISION,
            weather={"max_rain_probability": 10},
            satellite={"available": True},
            risk=risk,
            decision=DECISION,
        )
        self.assertIn("CONFLICT_WITHOUT_VERIFICATION", [i["code"] for i in evaluation["issues"]])
        self.assertFalse(evaluation["decision_safe_to_show"])
        self.assertTrue(evaluation["requires_field_verification"])


if __name__ == "__main__":
    unittest.main()
