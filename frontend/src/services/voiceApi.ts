import type {
  VoiceLanguage,
  VoiceStartResponse,
  VoiceTurnRequest,
  VoiceTurnResponse,
} from "../types/voice";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function startVoiceRegistration(
  language: VoiceLanguage
): Promise<VoiceStartResponse> {
  const response = await fetch(
    `${API_BASE_URL}/voice/registration/start?language=${encodeURIComponent(language)}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to start voice registration."
    );
  }

  return response.json();
}

export async function sendVoiceRegistrationTurn(
  payload: VoiceTurnRequest
): Promise<VoiceTurnResponse> {
  const response = await fetch(
    `${API_BASE_URL}/voice/registration/turn`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new Error(
      body?.detail ||
      "Unable to process voice response."
    );
  }

  return response.json();
}