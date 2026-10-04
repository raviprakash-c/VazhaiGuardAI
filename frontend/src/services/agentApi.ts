import type {
  CopilotLanguage,
  CopilotRequest,
  CopilotResponse,
} from "../types/copilot";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function askCopilot(payload: CopilotRequest): Promise<CopilotResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Unable to get a response from VazhaiGuard AI.");
  }
  return response.json();
}

export interface ActionFeedbackRequest {
  action_id: string;
  outcome: "completed" | "unable" | "needs_help" | "recheck";
  farmer_id?: string | null;
  language: CopilotLanguage;
  note?: string;
}

export interface ActionFeedbackResponse {
  success: boolean;
  action_id: string;
  outcome: string;
  next_state: string;
  farmer_message: string;
  recorded_at: string;
}

export async function sendActionFeedback(
  payload: ActionFeedbackRequest
): Promise<ActionFeedbackResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Unable to save the action feedback.");
  }
  return response.json();
}

export function saveLatestAgentLoop(loop: unknown): void {
  window.localStorage.setItem("vazhaiguard_latest_agent_loop", JSON.stringify(loop));
  window.localStorage.setItem("vazhaiguard_latest_agent_loop_at", new Date().toISOString());
}

export function getLatestAgentLoop<T>(): T | null {
  const raw = window.localStorage.getItem("vazhaiguard_latest_agent_loop");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStoredFarmContext(): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    try {
      context[key] = JSON.parse(raw);
    } catch {
      context[key] = raw;
    }
  }
  return context;
}

export function languageLabel(language: CopilotLanguage): string {
  return language === "ta-IN" ? "தமிழ்" : "English";
}
