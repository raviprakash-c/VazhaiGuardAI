export type RiskSeverity = "low" | "moderate" | "high";

export interface WeatherEvidenceItem {
  label: string;
  labelTa: string;
  value: string;
}

export interface WeatherDerivedRisk {
  level: RiskSeverity;
  label: string;
  labelTa: string;
  reason: string;
  reasonTa: string;
  recommendation: string;
  recommendationTa: string;
  evidence: WeatherEvidenceItem[];
}
