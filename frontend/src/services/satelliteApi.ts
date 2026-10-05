export interface SatelliteEvidence {
  available: boolean;
  provider?: string;
  source?: string;
  datasets?: { sentinel2?: string; dynamic_world?: string };
  analysis_scope?: string;
  resolution_m?: number;
  latest_observation?: string;
  observed_at?: string;
  observation_age_hours?: number | null;
  image_count?: number;
  cloud_percent_mean?: number | null;
  ndvi?: number | null;
  ndre?: number | null;
  ndwi?: number | null;
  baseline_ndvi?: number | null;
  ndvi_trend?: number | null;
  trend?: "improving" | "stable" | "declining" | "insufficient_history" | string;
  crop_state?: string;
  dynamic_world?: {
    image_count?: number;
    crop_probability?: number | null;
    tree_probability?: number | null;
  };
  health_index?: number | null;
  risk_score?: number | null;
  confidence?: number | null;
  risk_method?: string;
  warnings?: string[];
  reason?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function getSatelliteEvidence(input: {
  latitude: number;
  longitude: number;
  boundary?: Record<string, unknown>;
  lookbackDays?: number;
  baselineDays?: number;
  maxCloudPercent?: number;
}): Promise<SatelliteEvidence> {
  const response = await fetch(`${API_BASE}/ai/satellite/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: input.latitude,
      longitude: input.longitude,
      boundary: input.boundary || null,
      lookback_days: input.lookbackDays ?? 45,
      baseline_days: input.baselineDays ?? 45,
      max_cloud_percent: input.maxCloudPercent ?? 35,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Satellite evidence failed (${response.status}).`);
  }

  return response.json() as Promise<SatelliteEvidence>;
}
