export interface SoilEvidence {
  available: boolean;
  provider?: string;
  source?: string;
  scope?: string;
  resolution_m?: number;
  depth?: string;
  properties?: { phh2o?: number | null; clay?: number | null; sand?: number | null; soc?: number | null; cec?: number | null };
  uncertainty?: Record<string, number | null>;
  risk_score?: number | null;
  confidence?: number | null;
  risk_method?: string;
  warnings?: string[];
  reason?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function getSoilEvidence(latitude: number, longitude: number): Promise<SoilEvidence> {
  const response = await fetch(API_BASE + "/ai/soil/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || ("Soil evidence failed (" + response.status + ")."));
  }
  return response.json() as Promise<SoilEvidence>;
}
