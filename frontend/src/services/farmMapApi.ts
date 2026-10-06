/* =========================================================
   VAZHAIGUARDAI FARM MAP API
   ========================================================= */

export type FarmMapLocationPayload = {
  latitude: number;
  longitude: number;
  label?: string;
};

/* =========================================================
   FARM GEOMETRY
   ========================================================= */

export type FarmPolygonPayload =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

/* =========================================================
   BOUNDARY SOURCE
   ========================================================= */

export type BoundarySource =
  | "cadastral_parcel"
  | "cadastral_edited"
  | "farmer_drawn_satellite";

/* =========================================================
   LOCATION SEARCH REQUEST
   Used by useLandIntelligence.ts
   ========================================================= */

export type LocationSearchRequest = {
  district?: string;
  taluk?: string;
  village?: string;

  survey_number?: string;
  subdivision?: string;

  road_name?: string;
  landmark_name?: string;
  landmark_type?: string;

  latitude?: number;
  longitude?: number;

  limit?: number;
};

/* =========================================================
   REFERENCE PARCEL
   ========================================================= */

export type ReferenceParcel = {
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

  confidence?: number;

  match_reasons?: string[];

  source_file?: string | null;

  geometry: FarmPolygonPayload;
};

/* =========================================================
   REFERENCE PARCEL SEARCH RESPONSE
   ========================================================= */

export type ReferenceParcelSearchResponse = {
  success: boolean;

  candidates: ReferenceParcel[];

  search_summary?: Record<string, unknown>;
};

/* =========================================================
   FARM LOCATION SAVE REQUEST
   ========================================================= */

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

/* =========================================================
   FARM LOCATION SAVE RESPONSE
   ========================================================= */

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

/* =========================================================
   CREATE FARM PROFILE REQUEST
   ========================================================= */

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

/* =========================================================
   CREATE FARM PROFILE RESPONSE
   ========================================================= */

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

/* =========================================================
   API BASE URL
   ========================================================= */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

/* =========================================================
   COMMON ERROR READER
   ========================================================= */

async function getErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = await response.json();

    if (
      body &&
      typeof body === "object" &&
      "detail" in body
    ) {
      const detail = (
        body as {
          detail?: unknown;
        }
      ).detail;

      if (typeof detail === "string") {
        return detail;
      }

      if (detail !== undefined) {
        return JSON.stringify(detail);
      }
    }
  } catch {
    // Response was not JSON.
  }

  return fallback;
}

/* =========================================================
   SEARCH REFERENCE PARCELS
   Used by useLandIntelligence.ts
   ========================================================= */

export async function searchReferenceParcels(
  payload: LocationSearchRequest
): Promise<ReferenceParcelSearchResponse> {

  let response: Response;

  try {

    response = await fetch(
      `${API_BASE_URL}/farm/parcels/search`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          ...payload,

          limit:
            payload.limit ??
            10,
        }),
      }
    );

  } catch (error) {

    console.error(
      "[FarmMapAPI] Reference parcel search network error:",
      error
    );

    throw new Error(
      "Unable to connect to VazhaiGuardAI backend. " +
      "Make sure FastAPI is running on port 8000."
    );
  }

  if (!response.ok) {

    const message =
      await getErrorMessage(
        response,
        "Unable to search reference parcels."
      );

    console.error(
      "[FarmMapAPI] Reference parcel search failed:",
      response.status,
      message
    );

    throw new Error(message);
  }

  const data =
    (await response.json()) as ReferenceParcelSearchResponse;

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid reference parcel response from backend."
    );
  }

  return data;
}

/* =========================================================
   SAVE FARM LOCATION
   ========================================================= */

export async function saveFarmLocation(
  payload: FarmLocationSaveRequest
): Promise<FarmLocationSaveResponse> {

  let response: Response;

  try {

    response = await fetch(
      `${API_BASE_URL}/farm/location`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

  } catch (error) {

    console.error(
      "[FarmMapAPI] Farm location network error:",
      error
    );

    throw new Error(
      "Unable to connect to VazhaiGuardAI backend while saving farm location."
    );
  }

  if (!response.ok) {

    const message =
      await getErrorMessage(
        response,
        "Unable to save farm location."
      );

    console.error(
      "[FarmMapAPI] Farm location save failed:",
      response.status,
      message
    );

    throw new Error(message);
  }

  const data =
    (await response.json()) as FarmLocationSaveResponse;

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid farm location response from backend."
    );
  }

  return data;
}


/* =========================================================
   GET SAVED FARM
   ========================================================= */

export async function getSavedFarm(
  farmId: string
): Promise<Record<string, unknown>> {
  if (!farmId) {
    throw new Error("Farm ID is required.");
  }

  let response: Response;

  try {
    response = await fetch(
      API_BASE_URL + "/farm/" + encodeURIComponent(farmId),
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
  } catch {
    throw new Error(
      "Unable to connect to VazhaiGuardAI backend while loading the saved farm."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to load the saved farm."
      )
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (!data || typeof data !== "object") {
    throw new Error("Invalid saved farm response from backend.");
  }

  return data;
}

/* =========================================================
   CREATE AI FARM PROFILE
   ========================================================= */

export async function createFarmProfile(
  payload: CreateFarmProfileRequest
): Promise<CreateFarmProfileResponse> {

  let response: Response;

  try {

    response = await fetch(
      `${API_BASE_URL}/farm/profile`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

  } catch (error) {

    console.error(
      "[FarmMapAPI] Farm profile network error:",
      error
    );

    throw new Error(
      "Unable to connect to VazhaiGuardAI backend while creating AI farm profile."
    );
  }

  if (!response.ok) {

    const message =
      await getErrorMessage(
        response,
        "Unable to create AI farm profile."
      );

    console.error(
      "[FarmMapAPI] Farm profile creation failed:",
      response.status,
      message
    );

    throw new Error(message);
  }

  const data =
    (await response.json()) as CreateFarmProfileResponse;

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Invalid AI farm profile response from backend."
    );
  }

  return data;
}

/* =========================================================
   GEOMETRY VALIDATION
   ========================================================= */

export function isFarmGeometry(
  geometry: unknown
): geometry is FarmPolygonPayload {

  if (
    !geometry ||
    typeof geometry !== "object"
  ) {
    return false;
  }

  const value =
    geometry as {
      type?: unknown;
      coordinates?: unknown;
    };

  if (
    value.type !== "Polygon" &&
    value.type !== "MultiPolygon"
  ) {
    return false;
  }

  return Array.isArray(
    value.coordinates
  );
}

/* =========================================================
   GEOMETRY NORMALIZATION
   ========================================================= */

export function normalizeFarmGeometry(
  geometry: FarmPolygonPayload
): FarmPolygonPayload {

  if (
    geometry.type === "Polygon"
  ) {

    return {
      type: "Polygon",

      coordinates:
        geometry.coordinates,
    };
  }

  return {
    type: "MultiPolygon",

    coordinates:
      geometry.coordinates,
  };
}