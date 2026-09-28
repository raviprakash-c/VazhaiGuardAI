export type ParcelGeometry =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

export type ParcelCandidate = {
  parcel_id: string;

  district?: string | null;
  taluk?: string | null;
  village?: string | null;

  survey_number?: string | null;
  subdivision?: string | null;

  land_id?: string | null;
  unit_id?: string | null;
  block_id?: string | null;
  kide?: string | null;

  area_acres?: number | null;

  confidence: number;

  match_reasons?: string[];

  source_file?: string | null;

  geometry: ParcelGeometry;
};

export type ParcelSearchRequest = {
  district?: string;
  taluk?: string;
  village?: string;

  survey_number?: string;
  subdivision?: string;

  limit?: number;
};

export type ParcelSearchResponse = {
  success: boolean;

  candidates: ParcelCandidate[];

  search_summary?: Record<string, unknown>;
};

export type ParcelConfirmRequest = {
  farm_id: string;

  parcel_id: string;

  farmer_confirmed: boolean;

  district?: string;
  taluk?: string;
  village?: string;

  survey_number?: string;
  subdivision?: string;

  geometry: ParcelGeometry;
};

export type ParcelConfirmResponse = {
  success: boolean;

  farm_id: string;

  parcel_id: string;

  status: string;

  farmer_confirmed: boolean;

  message: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function searchFarmParcels(
  payload: ParcelSearchRequest
): Promise<ParcelSearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/farm/parcels/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);

    throw new Error(
      body?.detail ||
        "Unable to search farm parcels."
    );
  }

  return response.json();
}

export async function confirmFarmParcel(
  payload: ParcelConfirmRequest
): Promise<ParcelConfirmResponse> {
  const response = await fetch(
    `${API_BASE_URL}/farm/parcels/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);

    throw new Error(
      body?.detail ||
        "Unable to confirm farm parcel."
    );
  }

  return response.json();
}