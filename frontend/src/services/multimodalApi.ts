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

export interface FarmerDecision {
  summary: string;
  priority_actions: Array<{
    priority: number;
    action: string;
    reason: string;
  }>;
  follow_up_check: string;
  recheck_after: string;
  needs_field_verification: boolean;
  farmer_message: string;
}

export interface RiskFusionResult {
  zone_id: string | null;
  risk: {
    score: number;
    level: "low" | "moderate" | "high";
    signals_used: string[];
    weights_used?: Record<string, number>;
  };
  signal_scores: {
    vision: number;
    weather: number;
    satellite: number;
  };
  decision?: FarmerDecision;
  action: string;
  decision_model: string;
  latency_ms?: number;
  source?: string;
}

export interface DecisionEvaluation {
  quality_score: number;
  grade: "pass" | "review" | "fail";
  decision_safe_to_show: boolean;
  requires_field_verification: boolean;
  checks: Record<string, boolean>;
  issues: Array<{
    code: string;
    severity: "critical" | "high" | "medium" | "low";
    message: string;
  }>;
  evidence_trace: {
    signals_used: string[];
    conflict_count: number;
    satellite_freshness?: string;
  };
  evaluator: string;
}

export interface IncidentActionPlan {
  incident: string;
  incidents: string[];
  severity: "low" | "moderate" | "high";
  when: { start?: string | null; end?: string | null; peak_rain?: string | null; peak_wind?: string | null };
  where: string;
  actions: Array<{ priority: number; action: string; when: string; where: string; reason: string }>;
  field_verification_required: boolean;
  evidence_basis: Record<string, unknown>;
  engine: string;
}

export interface InspectionStorage {
  stored: boolean;
  status: string;
  bucket?: string | null;
  key?: string | null;
  s3_uri?: string | null;
  error?: string;
}

export interface InspectAndDecideResult extends CropInspectionResult {
  risk: RiskFusionResult["risk"];
  signal_scores: RiskFusionResult["signal_scores"];
  decision: FarmerDecision;
  action: string;
  decision_model: string;
  evaluation: DecisionEvaluation;
  inspection_id: string;
  parent_inspection_id: string | null;
  farm_id?: string | null;
  incident: IncidentActionPlan;
  action_plan: IncidentActionPlan;
  inspection_storage?: InspectionStorage;
  reinspection?: { is_reinspection: boolean; parent_inspection_id: string | null };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function inspectCropImage(input: {
  imageDataUrl: string;
  language?: string;
  zoneId?: string;
  farmContext?: Record<string, unknown>;
  weatherContext?: Record<string, unknown>;
  satelliteContext?: Record<string, unknown>;
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
      satellite_context: input.satelliteContext || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Inspection failed (${response.status})`);
  }

  return response.json();
}

export async function inspectAndDecide(input: {
  imageDataUrl: string;
  farmId?: string;
  language?: string;
  zoneId?: string;
  farmContext?: Record<string, unknown>;
  weatherContext?: Record<string, unknown>;
  satelliteContext?: Record<string, unknown>;
}): Promise<InspectAndDecideResult> {
  const response = await fetch(`${API_BASE}/ai/multimodal/inspect-and-decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      farm_id: input.farmId || null,
      image_data_url: input.imageDataUrl,
      language: input.language || "ta-IN",
      zone_id: input.zoneId || null,
      farm_context: input.farmContext || null,
      weather_context: input.weatherContext || null,
      satellite_context: input.satelliteContext || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Multimodal decision failed (${response.status})`);
  }

  return response.json();
}

export async function fuseRisk(input: {
  vision: CropInspectionResult["vision"];
  weather?: Record<string, unknown>;
  satellite?: Record<string, unknown>;
  farmContext?: Record<string, unknown>;
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
      farm_context: input.farmContext || null,
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


export async function reinspectCrop(input: {
  farmId: string;
  imageDataUrl: string;
  language?: string;
  zoneId?: string;
  weatherContext?: Record<string, unknown>;
  satelliteContext?: Record<string, unknown>;
}): Promise<InspectAndDecideResult> {
  const response = await fetch(
    `${API_BASE}/ai/inspections/reinspect`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: input.farmId,
        image_data_url: input.imageDataUrl,
        language: input.language || "ta-IN",
        zone_id: input.zoneId || null,
        weather_context: input.weatherContext || null,
        satellite_context: input.satelliteContext || null,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Reinspection failed (${response.status})`);
  }

  return response.json();
}

export async function getInspectionHistory(
  farmId: string
): Promise<{ farm_id: string; inspections: Array<Record<string, unknown>> }> {
  const response = await fetch(
    `${API_BASE}/ai/inspections/${encodeURIComponent(farmId)}/history`
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Inspection history failed (${response.status})`);
  }
  return response.json();
}
