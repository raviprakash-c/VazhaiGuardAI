export type CopilotLanguage = "ta-IN" | "en-IN";

export interface CopilotRequest {
  farm_id?: string | null;
  user_query: string;
  language: CopilotLanguage;
  context: Record<string, unknown>;
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
}
