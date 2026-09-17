export type DrainageLevel = "good" | "moderate" | "poor";
export type SupportLevel = "good" | "partial" | "low";
export type AccessLevel = "easy" | "moderate" | "difficult";

export interface PlantingBlock {
  id: string;
  name: string;
  variety: string;
  plantingMonth: string;
  areaAcres: number | "";
  approximatePlants: number | "";
}

export interface FarmRegistrationData {
  farmName: string;

  location: {
    latitude: number | null;
    longitude: number | null;
    confirmed: boolean;
  };

  bananaVariety: string;
  plantingMonth: string;

  approximateAreaAcres: number | "";
  approximatePlantCount: number | "";

  blocks: PlantingBlock[];

  readiness: {
    drainage: DrainageLevel | "";
    support: SupportLevel | "";
    accessibility: AccessLevel | "";
  };
}