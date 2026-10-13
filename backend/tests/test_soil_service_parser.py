import unittest
from services.soil_service import _extract_mean_uncertainty
class SoilGridsParserTests(unittest.TestCase):
    def test_current_layers_schema(self):
        payload = {"properties": {"layers": [
            {"name": "phh2o", "depths": [
                {"label": "0-5cm", "values": {"mean": 65, "uncertainty": 4}}
            ]}
        ]}}
        self.assertEqual(_extract_mean_uncertainty(payload, "phh2o"), (65.0, 4.0))
    def test_null_values_remain_none(self):
        payload = {"properties": {"layers": [
            {"name": "clay", "depths": [
                {"label": "0-5cm", "values": {"mean": None, "uncertainty": None}}
            ]}
        ]}}
        self.assertEqual(_extract_mean_uncertainty(payload, "clay"), (None, None))
    def test_missing_property(self):
        self.assertEqual(_extract_mean_uncertainty({"properties": {"layers": []}}, "sand"), (None, None))
    def test_legacy_schema(self):
        payload = {"properties": {"soc": {
            "0-5cm": {"mean": 120, "uncertainty": 15}
        }}}
        self.assertEqual(_extract_mean_uncertainty(payload, "soc"), (120.0, 15.0))
if __name__ == "__main__":
    unittest.main()
