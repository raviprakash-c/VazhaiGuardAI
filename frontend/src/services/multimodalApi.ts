export interface CropInspectionResult {
  zone_id: string | null;
  vision: {
    observation: string;
    crop_visible: boolean;
    stress_signals: string[];
    possible_causes: string[];
    urgency: "low" | "medium" | "high";
    visual_confidence: number;
    needs_field_verification: boolean;
    recommended_checks: string[];
    farmer_message: string;
    model: string;
    fallback_used: boolean;
  };
  latency_ms: number;
  source: string;
}

export interface RiskFusionResult {
  zone_id: string | null;
  risk: {
    score: number;
    level: "low" | "moderate" | "high";
    signals_used: string[];
  };
  signal_scores: {
    vision: number;
    weather: number;
    satellite: number;
  };
  action: string;
  decision_model: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function inspectCropImage(input: {
  imageDataUrl: string;
  language?: string;
  zoneId?: string;
  farmContext?: Record<string, unknown>;
  weatherContext?: Record<string, unknown>;
}): Promise<CropInspectionResult> {
  const response = await fetch(`${API_BASE}/ai/multimodal/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_data_url: input.imageDataUrl,
      language: input.language || "ta-IN",
      zone_id: input.zoneId || null,
      farm_context: input.farmContext || null,
      weather_context: input.weatherContext || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Inspection failed (${response.status})`);
  }

  return response.json();
}

export async function fuseRisk(input: {
  vision: CropInspectionResult["vision"];
  weather?: Record<string, unknown>;
  satellite?: Record<string, unknown>;
  zoneId?: string;
  language?: string;
}): Promise<RiskFusionResult> {
  const response = await fetch(`${API_BASE}/ai/multimodal/risk-fusion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vision: input.vision,
      weather: input.weather || null,
      satellite: input.satellite || null,
      zone_id: input.zoneId || null,
      language: input.language || "ta-IN",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Risk fusion failed (${response.status})`);
  }

  return response.json();
}
