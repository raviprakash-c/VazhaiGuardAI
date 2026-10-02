export type PlanCategory = "before" | "during" | "after";

export interface WeatherPlanStep {
  category: PlanCategory;
  title: string;
  titleTa: string;
  description: string;
  descriptionTa: string;
}

export type DecisionPriority = "critical" | "high" | "medium" | "low";
export type DecisionUrgency = "normal" | "monitor" | "today" | "now";

export interface FarmerActionItem {
  id: string;
  priority: DecisionPriority;
  urgency: DecisionUrgency;
  title: string;
  titleTa: string;
  reason: string;
  reasonTa: string;
  timing: string;
  timingTa: string;
  resource: string;
  resourceTa: string;
  done: boolean;
}

export interface FarmerDecisionPlan {
  status: "favorable" | "monitor" | "attention";
  urgency: DecisionUrgency;
  headline: string;
  headlineTa: string;
  explanation: string;
  explanationTa: string;
  confidence: "high" | "medium";
  generatedAt: string;
  actions: FarmerActionItem[];
}

export interface WeatherActionPlan {
  summary: string;
  summaryTa: string;
  steps: WeatherPlanStep[];
  decision?: FarmerDecisionPlan;
}
