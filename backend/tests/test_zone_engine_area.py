import unittest

from shapely.geometry import Point, shape

from backend.services.zone_engine import (
    area_m2_to_acres,
    calculate_area_m2,
    generate_zones,
    polygon_to_geojson,
    validate_polygon_geojson,
)


class ZoneEngineAreaTests(unittest.TestCase):
    def setUp(self):
        self.outer = [
            [80.0000, 13.0000],
            [80.0010, 13.0000],
            [80.0010, 13.0010],
            [80.0000, 13.0010],
            [80.0000, 13.0000],
        ]
        self.hole = [
            [80.0002, 13.0002],
            [80.0004, 13.0002],
            [80.0004, 13.0004],
            [80.0002, 13.0004],
            [80.0002, 13.0002],
        ]

    def test_rectangle_area_is_positive(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [self.outer],
        }
        polygon = validate_polygon_geojson(boundary)
        area_m2 = calculate_area_m2(polygon)

        self.assertGreater(area_m2, 0)
        self.assertGreater(area_m2_to_acres(area_m2), 0)

    def test_polygon_hole_is_preserved(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [self.outer, self.hole],
        }
        polygon = validate_polygon_geojson(boundary)

        self.assertEqual(
            len(polygon.interiors),
            1,
            "The interior ring must not be discarded.",
        )

    def test_hole_reduces_calculated_area(self):
        solid = validate_polygon_geojson(
            {
                "type": "Polygon",
                "coordinates": [self.outer],
            }
        )
        with_hole = validate_polygon_geojson(
            {
                "type": "Polygon",
                "coordinates": [self.outer, self.hole],
            }
        )
        solid_area = calculate_area_m2(solid)
        hole_area = calculate_area_m2(with_hole)

        self.assertLess(
            hole_area,
            solid_area,
            "A polygon containing a hole must have less area.",
        )

    def test_geojson_serialization_preserves_hole(self):
        polygon = validate_polygon_geojson(
            {
                "type": "Polygon",
                "coordinates": [self.outer, self.hole],
            }
        )
        serialized = polygon_to_geojson(polygon)

        self.assertEqual(serialized["type"], "Polygon")
        self.assertEqual(len(serialized["coordinates"]), 2)

    def test_generated_zones_do_not_fill_polygon_hole(self):
        boundary = {
            "type": "Polygon",
            "coordinates": [self.outer, self.hole],
        }
        zones = generate_zones(
            boundary,
            target_zone_area_acres=0.1,
        )
        self.assertTrue(zones, "Expected generated zones.")

        hole_center = Point(80.0003, 13.0003)
        for zone in zones:
            self.assertEqual(zone["geometry"]["type"], "Polygon")
            self.assertFalse(
                shape(zone["geometry"]).covers(hole_center),
                "A generated zone must not cover the polygon hole.",
            )


if __name__ == "__main__":
    unittest.main()
