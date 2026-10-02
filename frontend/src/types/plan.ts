export type PlanCategory = "before" | "during" | "after";

export interface WeatherPlanStep {
  category: PlanCategory;
  title: string;
  titleTa: string;
  description: string;
  descriptionTa: string;
}

export interface WeatherActionPlan {
  summary: string;
  summaryTa: string;
  steps: WeatherPlanStep[];
}
