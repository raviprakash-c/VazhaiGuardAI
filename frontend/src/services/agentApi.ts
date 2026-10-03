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
  const response = await fetch(`${API_BASE_URL}/ai/bedrock/voice-turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: payload.user_query,
      language: payload.language,
      farm_context: payload.context,
      decision_context: payload.context?.decision_context ?? null,
      conversation_history: [],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail || "Unable to get a response from VazhaiGuard AI."
    );
  }

  const result = (await response.json()) as {
    reply_text: string;
    intent: string;
    urgency: string;
    actions: string[];
    next_question: string | null;
    should_listen_again: boolean;
    confidence: number;
    language: string;
    model: string;
    latency_ms: number;
    source: string;
  };

  const actionText = result.actions.length
    ? `\n\n${
        payload.language === "ta-IN" ? "இப்போது செய்ய வேண்டியது:" : "What to do now:"
      }\n${result.actions.map((action, index) => `${index + 1}. ${action}`).join("\n")}`
    : "";

  const followUpText = result.next_question
    ? `\n\n${result.next_question}`
    : "";

  return {
    success: true,
    farm_id: payload.farm_id ?? null,
    user_query: payload.user_query,
    task_type: result.intent,
    response: `${result.reply_text}${actionText}${followUpText}`.trim(),
    routing: {
      task_type: result.intent,
      selected_model: "Ministral 8B",
      model_id: result.model,
      reason: "Farmer voice turn routed to the approved Bedrock model.",
      fallback_model: null,
    },
    verification: {
      status: "structured",
      issues: result.confidence < 0.5 ? ["Low model confidence"] : [],
    },
    trace: [
      {
        stage: "speech_transcript",
        status: "received",
      },
      {
        stage: "farmer_intent",
        intent: result.intent,
        confidence: result.confidence,
      },
      {
        stage: "action_plan",
        urgency: result.urgency,
        actions: result.actions,
      },
      {
        stage: "bedrock_response",
        model: result.model,
        latency_ms: result.latency_ms,
      },
    ],
  };
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
