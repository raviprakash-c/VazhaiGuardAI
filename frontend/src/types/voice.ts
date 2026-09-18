export type VoiceLanguage =
  | "ta-IN"
  | "en-IN";

export type RegistrationField =
  | "farm_name"
  | "banana_variety"
  | "planting_age"
  | "approximate_plants"
  | "drainage"
  | "support"
  | "accessibility"
  | "complete";

export interface VoiceFarmState {
  farm_name?: string;

  banana_variety?: string;

  planting_age?: string;

  approximate_plants?:
    | number
    | null;

  drainage?:
    | "good"
    | "moderate"
    | "poor";

  support?:
    | "good"
    | "partial"
    | "low";

  accessibility?:
    | "easy"
    | "moderate"
    | "difficult";
}

export interface VoiceStartResponse {
  session_id: string;

  current_field:
    RegistrationField;

  question: string;

  farm_state:
    VoiceFarmState;

  complete: boolean;
}

export interface VoiceTurnRequest {
  session_id: string;

  language:
    VoiceLanguage;

  current_field:
    RegistrationField;

  transcript: string;

  farm_state:
    VoiceFarmState;
}

export interface VoiceTurnResponse {
  session_id: string;

  accepted: boolean;

  current_field:
    RegistrationField;

  next_field:
    RegistrationField;

  normalized_value:
    unknown;

  reply_text: string;

  next_question: string;

  farm_state:
    VoiceFarmState;

  confidence: number;

  complete: boolean;
}