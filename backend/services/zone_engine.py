from __future__ import annotations

import math
from typing import Any, Dict, List

from shapely.geometry import Polygon, box, mapping
from shapely.ops import transform


# ---------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------

SQ_METERS_PER_ACRE = 4046.8564224


# ---------------------------------------------------------
# GEOJSON VALIDATION
# ---------------------------------------------------------

def validate_polygon_geojson(boundary: Dict[str, Any]) -> Polygon:
    """
    Convert GeoJSON Polygon into a Shapely Polygon.
    """

    if not isinstance(boundary, dict):
        raise ValueError("Boundary must be a JSON object.")

    if boundary.get("type") != "Polygon":
        raise ValueError("Only Polygon boundaries are supported.")

    coordinates = boundary.get("coordinates")

    if not coordinates:
        raise ValueError("Boundary coordinates are missing.")

    if not coordinates[0]:
        raise ValueError("Boundary ring is empty.")

    polygon = Polygon(coordinates[0])

    if polygon.is_empty:
        raise ValueError("Boundary polygon is empty.")

    if not polygon.is_valid:
        polygon = polygon.buffer(0)

    if polygon.is_empty:
        raise ValueError("Boundary could not be repaired.")

    if polygon.geom_type != "Polygon":
        raise ValueError("Boundary must represent a single polygon.")

    return polygon


# ---------------------------------------------------------
# AREA CALCULATION
# ---------------------------------------------------------

def calculate_area_m2(polygon: Polygon) -> float:
    """
    Calculate approximate real-world area in square metres.

    The incoming polygon uses longitude/latitude.
    We use a local equirectangular projection around
    the farm center to obtain a practical area estimate.
    """

    center = polygon.centroid

    lon0 = center.x
    lat0 = center.y

    earth_radius = 6371000.0

    lat0_rad = math.radians(lat0)

    def project(x, y, z=None):
        x_m = math.radians(x - lon0) * earth_radius * math.cos(lat0_rad)
        y_m = math.radians(y - lat0) * earth_radius

        if z is not None:
            return x_m, y_m, z

        return x_m, y_m

    projected = transform(project, polygon)

    return abs(projected.area)


def area_m2_to_acres(area_m2: float) -> float:
    return area_m2 / SQ_METERS_PER_ACRE


# ---------------------------------------------------------
# LOCAL PROJECTION
# ---------------------------------------------------------

def create_local_projection(polygon: Polygon):
    """
    Returns forward and inverse projection functions.

    Used so grid generation happens in metres rather than
    raw latitude/longitude degrees.
    """

    center = polygon.centroid

    lon0 = center.x
    lat0 = center.y

    earth_radius = 6371000.0
    lat0_rad = math.radians(lat0)

    def forward(x, y, z=None):
        x_m = math.radians(x - lon0) * earth_radius * math.cos(lat0_rad)
        y_m = math.radians(y - lat0) * earth_radius

        if z is not None:
            return x_m, y_m, z

        return x_m, y_m

    def inverse(x, y, z=None):
        lon = lon0 + math.degrees(
            x / (earth_radius * math.cos(lat0_rad))
        )

        lat = lat0 + math.degrees(
            y / earth_radius
        )

        if z is not None:
            return lon, lat, z

        return lon, lat

    return forward, inverse


# ---------------------------------------------------------
# ZONE SIZE
# ---------------------------------------------------------

def calculate_grid_dimensions(
    area_m2: float,
    target_zone_area_acres: float,
) -> tuple[int, int]:
    """
    Determine a practical number of rows and columns.

    We keep zones approximately square and avoid creating
    an excessive number of zones.
    """

    target_area_m2 = (
        target_zone_area_acres * SQ_METERS_PER_ACRE
    )

    estimated_zone_count = max(
        1,
        math.ceil(area_m2 / target_area_m2)
    )

    side = math.ceil(
        math.sqrt(estimated_zone_count)
    )

    rows = max(1, side)
    columns = max(1, side)

    return rows, columns


# ---------------------------------------------------------
# ZONE LABEL
# ---------------------------------------------------------

def zone_label(row: int, column: int) -> str:
    """
    Example:

    row=0,column=0 -> A1
    row=0,column=1 -> A2
    row=1,column=0 -> B1
    row=1,column=1 -> B2
    """

    row_letter = chr(ord("A") + row)

    return f"{row_letter}{column + 1}"


# ---------------------------------------------------------
# GEOJSON CONVERSION
# ---------------------------------------------------------

def polygon_to_geojson(polygon: Polygon) -> Dict[str, Any]:
    result = mapping(polygon)

    return {
        "type": "Polygon",
        "coordinates": [
            [
                [
                    float(point[0]),
                    float(point[1]),
                ]
                for point in result["coordinates"][0]
            ]
        ],
    }


# ---------------------------------------------------------
# MAIN ZONE GENERATOR
# ---------------------------------------------------------

def generate_zones(
    boundary: Dict[str, Any],
    target_zone_area_acres: float = 0.5,
) -> List[Dict[str, Any]]:
    """
    Divide a farmer-confirmed polygon into practical zones.

    The zones are generated from a rectangular grid and clipped
    to the actual farm boundary.
    """

    farm_polygon = validate_polygon_geojson(boundary)

    forward, inverse = create_local_projection(
        farm_polygon
    )

    projected_farm = transform(
        forward,
        farm_polygon
    )

    farm_area_m2 = abs(projected_farm.area)

    rows, columns = calculate_grid_dimensions(
        farm_area_m2=farm_area_m2,
        target_zone_area_acres=target_zone_area_acres,
    )

    min_x, min_y, max_x, max_y = projected_farm.bounds

    width = max_x - min_x
    height = max_y - min_y

    cell_width = width / columns
    cell_height = height / rows

    zones: List[Dict[str, Any]] = []

    for row in range(rows):

        for column in range(columns):

            x1 = min_x + column * cell_width
            x2 = min_x + (column + 1) * cell_width

            y1 = min_y + row * cell_height
            y2 = min_y + (row + 1) * cell_height

            grid_cell = box(
                x1,
                y1,
                x2,
                y2,
            )

            clipped_zone = projected_farm.intersection(
                grid_cell
            )

            if clipped_zone.is_empty:
                continue

            if clipped_zone.geom_type != "Polygon":
                continue

            zone_area_m2 = abs(
                clipped_zone.area
            )

            if zone_area_m2 < 25:
                continue

            zone_center = clipped_zone.centroid

            center_lon, center_lat = inverse(
                zone_center.x,
                zone_center.y,
            )

            geographic_zone = transform(
                inverse,
                clipped_zone,
            )

            zone_id = zone_label(
                row,
                column,
            )

            zones.append(
                {
                    "zone_id": zone_id,
                    "row": row,
                    "column": column,
                    "area_m2": round(
                        zone_area_m2,
                        2,
                    ),
                    "area_acres": round(
                        area_m2_to_acres(
                            zone_area_m2
                        ),
                        4,
                    ),
                    "center_latitude": round(
                        center_lat,
                        7,
                    ),
                    "center_longitude": round(
                        center_lon,
                        7,
                    ),
                    "geometry": polygon_to_geojson(
                        geographic_zone
                    ),
                }
            )

    return zones


# ---------------------------------------------------------
# COMPLETE FARM ZONE RESULT
# ---------------------------------------------------------

def build_zone_result(
    farm_id: str,
    boundary: Dict[str, Any],
    target_zone_area_acres: float = 0.5,
) -> Dict[str, Any]:

    polygon = validate_polygon_geojson(
        boundary
    )

    area_m2 = calculate_area_m2(
        polygon
    )

    area_acres = area_m2_to_acres(
        area_m2
    )

    zones = generate_zones(
        boundary=boundary,
        target_zone_area_acres=target_zone_area_acres,
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "total_area_acres": round(
            area_acres,
            4,
        ),
        "zone_count": len(zones),
        "zones": zones,
    }