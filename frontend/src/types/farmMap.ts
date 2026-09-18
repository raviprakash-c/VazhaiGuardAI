import type { VoiceFarmState } from "./voice";

export type MapCoordinate = [number, number];

export interface FarmPolygonGeometry {
  type: "Polygon";
  coordinates: MapCoordinate[][];
}

export interface FarmMapLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface FarmLocationSaveRequest {
  farm_profile: VoiceFarmState;
  location: FarmMapLocation;
  boundary: FarmPolygonGeometry;
  mapped_area_acres: number;
  perimeter_m: number;
  farmer_confirmed: true;
  boundary_source: "farmer_drawn_satellite";
}

export interface FarmLocationSaveResponse {
  farm_id: string;
  saved: boolean;
  location: FarmMapLocation;
  boundary: FarmPolygonGeometry;
  mapped_area_acres: number;
  perimeter_m: number;
  farmer_confirmed: boolean;
  boundary_source: string;
}
