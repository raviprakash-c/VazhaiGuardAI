import axios from "axios";

import type {
  VoiceLanguage,
  VoiceStartResponse,
  VoiceTurnRequest,
  VoiceTurnResponse,
} from "../types/voice";

export async function startVoiceRegistration(
  language: VoiceLanguage
): Promise<VoiceStartResponse> {
  const response =
    await axios.get(
      "/api/voice/registration/start",
      {
        params: {
          language,
        },
      }
    );

  return response.data;
}

export async function sendVoiceRegistrationTurn(
  payload: VoiceTurnRequest
): Promise<VoiceTurnResponse> {
  const response =
    await axios.post(
      "/api/voice/registration/turn",
      payload
    );

  return response.data;
}