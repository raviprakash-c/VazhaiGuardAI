import type {
  CopilotLanguage,
  CopilotRequest,
  CopilotResponse,
} from "../types/copilot";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function askCopilot(
  payload: CopilotRequest
): Promise<CopilotResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail || "Unable to get a response from VazhaiGuard AI."
    );
  }

  return response.json();
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
