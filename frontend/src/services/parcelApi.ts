/* =========================================================
   PARCEL API
   VazhaiGuardAI
   ========================================================= */

/* =========================================================
   GEOMETRY TYPES
   ========================================================= */

export type ParcelGeometry =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

/* =========================================================
   PARCEL CANDIDATE
   ========================================================= */

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

/* =========================================================
   PARCEL SEARCH REQUEST
   ========================================================= */

export type ParcelSearchRequest = {
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
   PARCEL SEARCH RESPONSE
   ========================================================= */

export type ParcelSearchResponse = {
  success: boolean;

  candidates: ParcelCandidate[];

  search_summary?: Record<string, unknown>;
};

/* =========================================================
   PARCEL CONFIRM REQUEST
   ========================================================= */

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

/* =========================================================
   PARCEL CONFIRM RESPONSE
   ========================================================= */

export type ParcelConfirmResponse = {
  success: boolean;

  farm_id: string;

  parcel_id: string;

  status: string;

  farmer_confirmed: boolean;

  message: string;
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
   SEARCH FARM PARCELS
   ========================================================= */

export async function searchFarmParcels(
  payload: ParcelSearchRequest
): Promise<ParcelSearchResponse> {
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
      "[ParcelAPI] Parcel search network error:",
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
        "Unable to search farm parcels."
      );

    console.error(
      "[ParcelAPI] Parcel search failed:",
      response.status,
      message
    );

    throw new Error(message);
  }

  const data =
    (await response.json()) as ParcelSearchResponse;

  if (!data || typeof data !== "object") {
    throw new Error(
      "Invalid parcel search response from backend."
    );
  }

  return data;
}

/* =========================================================
   CONFIRM FARM PARCEL
   ========================================================= */

export async function confirmFarmParcel(
  payload: ParcelConfirmRequest
): Promise<ParcelConfirmResponse> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/farm/parcels/confirm`,
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
      "[ParcelAPI] Parcel confirmation network error:",
      error
    );

    throw new Error(
      "Unable to connect to VazhaiGuardAI backend while confirming the parcel. " +
        "Make sure FastAPI is running on port 8000."
    );
  }

  if (!response.ok) {
    const message =
      await getErrorMessage(
        response,
        "Unable to confirm farm parcel."
      );

    console.error(
      "[ParcelAPI] Parcel confirmation failed:",
      response.status,
      message
    );

    throw new Error(message);
  }

  const data =
    (await response.json()) as ParcelConfirmResponse;

  if (!data || typeof data !== "object") {
    throw new Error(
      "Invalid parcel confirmation response from backend."
    );
  }

  return data;
}

/* =========================================================
   HELPER
   ========================================================= */

/**
 * Returns true when the supplied geometry is a
 * valid Polygon or MultiPolygon.
 */
export function isParcelGeometry(
  geometry: unknown
): geometry is ParcelGeometry {
  if (!geometry || typeof geometry !== "object") {
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

/**
 * Keeps cadastral geometry unchanged.
 *
 * IMPORTANT:
 * Do not convert MultiPolygon into Polygon here.
 * The cadastral dataset legitimately contains
 * MultiPolygon parcels.
 */
export function normalizeParcelGeometry(
  geometry: ParcelGeometry
): ParcelGeometry {
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