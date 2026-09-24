export type ZoneGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

export type FarmZone = {
  zone_id: string;
  row: number;
  column: number;
  area_acres: number;
  area_m2: number;
  center_latitude: number;
  center_longitude: number;
  geometry: ZoneGeometry;
};

export type GenerateZonesRequest = {
  farm_id: string;
  boundary: ZoneGeometry;
  mapped_area_acres?: number;
  target_zone_area_acres?: number;
};

export type GenerateZonesResponse = {
  success: boolean;
  farm_id: string;
  total_area_acres: number;
  zone_count: number;
  zones: FarmZone[];
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function generateFarmZones(
  payload: GenerateZonesRequest,
): Promise<GenerateZonesResponse> {

  const response = await fetch(
    `${API_BASE_URL}/farm/zones/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      message || "Failed to generate farm zones",
    );
  }

  return response.json();
}