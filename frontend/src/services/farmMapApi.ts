export type FarmMapLocationPayload = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type FarmPolygonPayload = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type FarmLocationSaveRequest = {
  farm_profile: Record<string, unknown>;
  location: FarmMapLocationPayload;
  boundary: FarmPolygonPayload;
  mapped_area_acres: number;
  perimeter_m: number;
  farmer_confirmed: true;
  boundary_source: "farmer_drawn_satellite";
};

export type FarmLocationSaveResponse = {
  farm_id: string;
  saved: boolean;
  location: FarmMapLocationPayload;
  boundary: FarmPolygonPayload;
  mapped_area_acres: number;
  perimeter_m: number;
  farmer_confirmed: boolean;
  boundary_source: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function saveFarmLocation(
  payload: FarmLocationSaveRequest
): Promise<FarmLocationSaveResponse> {
  const response = await fetch(
    `${API_BASE_URL}/farm/location`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    let message = "Unable to save farm location.";

    try {
      const body = (await response.json()) as {
        detail?: string;
      };

      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // Keep the default message when the backend
      // does not return a JSON error response.
    }

    throw new Error(message);
  }

  return (await response.json()) as FarmLocationSaveResponse;
}
