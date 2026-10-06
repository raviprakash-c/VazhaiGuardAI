export interface SatelliteEvidence {
  available: boolean;
  provider?: string;
  source?: string;
  datasets?: { sentinel2?: string };
  analysis_scope?: string;
  farm_geometry?: { source?: string; is_farmer_confirmed?: boolean; geometry_type?: string; area_m2?: number | null; area_hectares?: number | null; area_acres?: number | null };
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
  health_index?: number | null;
  risk_score?: number | null;
  confidence?: number | null;
  risk_method?: string;
  scene_id?: string;
  warnings?: string[];
  reason?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
type SatelliteInput = { latitude: number; longitude: number; boundary?: Record<string, unknown>; lookbackDays?: number; baselineDays?: number; maxCloudPercent?: number };
function toPayload(input: SatelliteInput) { return { latitude: input.latitude, longitude: input.longitude, boundary: input.boundary || null, lookback_days: input.lookbackDays ?? 45, baseline_days: input.baselineDays ?? 45, max_cloud_percent: input.maxCloudPercent ?? 35 }; }

export async function getSatelliteEvidence(input: SatelliteInput): Promise<SatelliteEvidence> {
  const response = await fetch(`${API_BASE}/ai/satellite/evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(input)) });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || `Satellite evidence failed (${response.status}).`); }
  return response.json() as Promise<SatelliteEvidence>;
}

export async function getSatellitePreview(input: SatelliteInput): Promise<string> {
  const response = await fetch(`${API_BASE}/ai/satellite/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(input)) });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || `Satellite preview failed (${response.status}).`); }
  return URL.createObjectURL(await response.blob());
}


export type SatelliteLayer = "ndvi" | "ndre" | "ndwi" | "stress";

export async function getSatelliteLayer(
  input: SatelliteInput,
  layer: SatelliteLayer,
): Promise<string> {
  const response = await fetch(`${API_BASE}/ai/satellite/layer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...toPayload(input),
      layer,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Satellite ${layer} layer failed (${response.status}).`);
  }

  return URL.createObjectURL(await response.blob());
}
