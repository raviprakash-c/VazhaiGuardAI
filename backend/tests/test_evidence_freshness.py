import unittest
from services.evidence_state import build_evidence_state
class EvidenceFreshnessTests(unittest.TestCase):
    def test_satellite_age_hours_is_used_without_timestamp(self):
        state = build_evidence_state(
            vision=None,
            weather=None,
            satellite={
                "available": True,
                "observation_age_hours": 105.0,
                "confidence": 0.5,
                "ndvi": 0.1876,
            },
            soil=None,
        )
        satellite = state["freshness"]["satellite"]
        self.assertEqual(satellite["age_hours"], 105.0)
        self.assertEqual(satellite["status"], "aging")
if __name__ == "__main__":
    unittest.main()
