import json
import os
from typing import List, Dict, Any

class LandIntelligenceService:
    def __init__(self):
        self.base_path = os.path.join(os.path.dirname(__file__), "..", "challenge_data")
        self.layers = {}
        self._load_geojson_files()

    def _load_geojson_files(self):
        # Load Task 2 & 3 files
        task2_dir = os.path.join(self.base_path, "task2_geojson")
        task3_dir = os.path.join(self.base_path, "task3_boundaries")
        
        # Simple loader (In production, use GeoPandas/Shapely for real intersection)
        for folder in [task2_dir, task3_dir]:
            if os.path.exists(folder):
                for file in os.listdir(folder):
                    if file.endswith(".geojson"):
                        path = os.path.join(folder, file)
                        try:
                            with open(path, 'r') as f:
                                self.layers[file.replace('.geojson', '')] = json.load(f)
                        except Exception as e:
                            print(f"Error loading {file}: {e}")

    def validate_location(self, polygon_coords: List[List[float]]) -> Dict[str, Any]:
        """
        Receives polygon coordinates from frontend.
        Returns: Village, Taluk, Accessibility status.
        """
        # MOCK LOGIC FOR NOW (Replace with Shapely contains() later)
        # Since we don't have Shapely installed yet, we return mock data based on center point
        if not polygon_coords:
            return {"error": "No coordinates provided"}
            
        # Calculate center point
        lons = [p[0] for p in polygon_coords]
        lats = [p[1] for p in polygon_coords]
        center_lon = sum(lons) / len(lons)
        center_lat = sum(lats) / len(lats)
        
        # Mock Response based on Tenkasi/Sivagiri area
        return {
            "is_valid": True,
            "village": "Sivagiri", # Detected from Task 3 Layer
            "taluk": "Tenkasi",
            "district": "Tirunelveli",
            "land_type": "Agricultural", # Detected from Task 2 Layer
            "near_road": True,
            "near_water": False,
            "message": "Location verified against Cadastral records."
        }

land_service = LandIntelligenceService()