export type FarmMapLocationPayload = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type FarmPolygonPayload =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

export type BoundarySource =
  | "cadastral_parcel"
  | "cadastral_edited"
  | "farmer_drawn_satellite";

export type FarmLocationSaveRequest = {
  farm_profile: Record<string, unknown>;

  location: FarmMapLocationPayload;

  boundary: FarmPolygonPayload;

  mapped_area_acres: number;

  perimeter_m: number;

  farmer_confirmed: true;

  boundary_source: BoundarySource;

  parcel_id?: string;

  parcel_metadata?: Record<string, unknown>;
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

  parcel_id?: string;

  parcel_metadata?: Record<string, unknown>;
};

export type CreateFarmProfileRequest = {
  farm_id: string;

  farm_profile: Record<string, unknown>;

  location: FarmMapLocationPayload;

  boundary: FarmPolygonPayload;

  mapped_area_acres: number;

  perimeter_m: number;

  farmer_confirmed: true;

  boundary_source: BoundarySource;

  parcel_id?: string;

  parcel_metadata?: Record<string, unknown>;
};

export type CreateFarmProfileResponse = {
  farm_id: string;

  profile_status: string;

  profile: Record<string, unknown>;

  next_questions: string[];

  verification: {
    status: string;
    issues: string[];
    checked_fields: string[];
  };
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
      const body = await response.json();

      if (body?.detail) {
        message = body.detail;
      }
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function createFarmProfile(
  payload: CreateFarmProfileRequest
): Promise<CreateFarmProfileResponse> {
  const response = await fetch(
    `${API_BASE_URL}/farm/profile`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    let message = "Unable to create AI farm profile.";

    try {
      const body = await response.json();

      if (body?.detail) {
        message = body.detail;
      }
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  return response.json();
}