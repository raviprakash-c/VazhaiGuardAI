export type CopilotLanguage = "ta-IN" | "en-IN";

export interface CopilotRequest {
  farm_id?: string | null;
  user_query: string;
  language: CopilotLanguage;
  context: Record<string, unknown>;
}

export interface CopilotLoopState {
  state: string;
  action_id: string | null;
  primary_action: Record<string, unknown>;
  follow_up_check?: string | null;
  recheck_after?: string | null;
  needs_field_verification?: boolean;
  risk?: {
    score?: number | null;
    level?: string | null;
    signals_used?: string[];
  };
}

export interface CopilotResponse {
  success: boolean;
  farm_id?: string | null;
  user_query: string;
  task_type: string;
  response: string;
  routing: {
    task_type: string;
    selected_model: string;
    model_id: string;
    reason: string;
    fallback_model?: string | null;
  };
  verification: {
    status: string;
    issues: string[];
  };
  trace: Array<Record<string, unknown>>;
  loop: CopilotLoopState;
}
