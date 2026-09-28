export type ParcelGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: any;
};

export type ParcelCandidate = {
  layer: "cadastral" | "fmb";
  geometry: ParcelGeometry;
  properties: Record<string, unknown>;
  centroid: {
    latitude: number;
    longitude: number;
  } | null;
  score: number;
  evidence: string[];
};

export type LocationSearchRequest = {
  transcript?: string;
  district?: string;
  taluk?: string;
  village?: string;
  survey_no?: string;
  road?: string;
  landmarks?: string[];
  latitude?: number;
  longitude?: number;
  limit?: number;
};

export type LocationSearchResponse = {
  parsed_clues: {
    district: string | null;
    taluk: string | null;
    village: string | null;
    survey_no: string | null;
    road: string | null;
    landmarks: Array<{
      type: string;
      query: string;
    }>;
    relations: string[];
  };

  candidate_count: number;

  candidates: ParcelCandidate[];

  data_sources: string[];

  missing_layers: string[];

  status: string;

  message: string;
};