import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Ruler,
  Square,
} from "lucide-react";

import SatelliteMap from "../components/farm/SatelliteMap";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useGeolocation } from "../hooks/useGeolocation";
import {
  saveFarmLocation,
  createFarmProfile,
  type FarmLocationSaveRequest,
  type CreateFarmProfileRequest,
} from "../services/farmMapApi";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type FarmLocationData = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  boundary: FarmPolygonGeometry | null;
  source: "gps-pin" | "drawn";
};

type BoundaryMetrics = {
  areaAcres: number;
  perimeterM: number;
};

type FarmProfile = Record<string, unknown>;

export default function FarmLocationPage() {
  const navigate = useNavigate();

  const [farmProfile, setFarmProfile] =
    useState<FarmProfile | null>(null);

  const {
    latitude,
    longitude,
    accuracy,
    loading: geoLoading,
    error: geoError,
    getCurrentLocation,
  } = useGeolocation();

  const [mapMode, setMapMode] =
    useState<"drop-pin" | "draw">("drop-pin");

  const [startDrawSignal, setStartDrawSignal] = useState(0);
  const [clearDrawSignal, setClearDrawSignal] = useState(0);

  const [locationData, setLocationData] =
    useState<FarmLocationData>({
      latitude: 9.5,
      longitude: 77.5,
      accuracy: undefined,
      boundary: null,
      source: "gps-pin",
    });

  const [boundaryMetrics, setBoundaryMetrics] =
    useState<BoundaryMetrics | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(
      "vazhaiguard_farm_profile"
    );

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setFarmProfile(parsed);
        }
      } catch (error) {
        console.error(
          "Failed to parse farm profile",
          error
        );
      }
    }

    getCurrentLocation();
  }, [getCurrentLocation]);

  useEffect(() => {
    if (
      latitude !== null &&
      longitude !== null &&
      !locationData.boundary
    ) {
      setLocationData((previous) => ({
        ...previous,
        latitude,
        longitude,
        accuracy,
      }));
    }
  }, [
    latitude,
    longitude,
    accuracy,
    locationData.boundary,
  ]);

  const handleBoundaryChange = (
    boundary: FarmPolygonGeometry | null
  ) => {
    setLocationData((previous) => ({
      ...previous,
      boundary,
      source: boundary ? "drawn" : "gps-pin",
    }));

    if (!boundary) {
      setBoundaryMetrics(null);
    }
  };

  const handleSave = async () => {
    if (
      !Number.isFinite(locationData.latitude) ||
      !Number.isFinite(locationData.longitude)
    ) {
      setSaveError(
        "Please select your farm location on the map."
      );
      return;
    }

    if (!locationData.boundary) {
      setSaveError(
        "Please draw your farm boundary before continuing."
      );
      return;
    }

    if (!boundaryMetrics) {
      setSaveError(
        "Farm area could not be calculated. Please redraw the boundary."
      );
      return;
    }

    if (boundaryMetrics.areaAcres <= 0) {
      setSaveError(
        "The selected farm boundary has no valid area. Please redraw it."
      );
      return;
    }

    if (!farmProfile) {
      setSaveError(
        "Farm registration details were not found. Please complete voice registration again."
      );
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      /*
       * STEP 1
       * Save farmer-confirmed location and boundary.
       *
       * The backend creates the canonical farm_id.
       */
      const locationPayload: FarmLocationSaveRequest = {
        farm_profile: farmProfile,

        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          label: "Farmer confirmed farm",
        },

        boundary: locationData.boundary,

        mapped_area_acres: boundaryMetrics.areaAcres,
        perimeter_m: boundaryMetrics.perimeterM,

        farmer_confirmed: true,
        boundary_source: "farmer_drawn_satellite",
      };

      const locationResponse =
        await saveFarmLocation(locationPayload);

      /*
       * STEP 2
       * Use the SAME farm_id to create the AI farm profile.
       *
       * Bedrock + verification + DynamoDB update happen
       * inside the backend.
       */
      const profilePayload: CreateFarmProfileRequest = {
        farm_id: locationResponse.farm_id,

        farm_profile: farmProfile,

        location: locationResponse.location,

        boundary: locationResponse.boundary,

        mapped_area_acres:
          locationResponse.mapped_area_acres,

        perimeter_m: locationResponse.perimeter_m,

        farmer_confirmed: true,

        boundary_source:
          "farmer_drawn_satellite",
      };

      const profileResponse =
        await createFarmProfile(profilePayload);

      /*
       * Keep a small local cache for frontend navigation.
       * DynamoDB remains the persistent source of truth.
       */
      const completedFarm = {
        farm_id: locationResponse.farm_id,
        farm_profile: farmProfile,
        location: locationResponse.location,
        boundary: locationResponse.boundary,
        mapped_area_acres:
          locationResponse.mapped_area_acres,
        perimeter_m:
          locationResponse.perimeter_m,
        farmer_confirmed:
          locationResponse.farmer_confirmed,
        boundary_source:
          locationResponse.boundary_source,
        profile_status:
          profileResponse.profile_status,
        ai_profile: profileResponse.profile,
        verification:
          profileResponse.verification,
        next_questions:
          profileResponse.next_questions,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(
        "vazhaiguard_farm_complete",
        JSON.stringify(completedFarm)
      );

      localStorage.setItem(
        "vazhaiguard_farm_id",
        locationResponse.farm_id
      );

      navigate("/dashboard");
    } catch (error) {
      console.error(
        "Farm persistence failed:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to save your farm. Please try again.";

      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (geoLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5fbf6]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#146c43] border-t-transparent" />

          <p className="text-[#13271d]">
            Detecting your farm location...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbf6] pb-20">
      <header className="sticky top-0 z-10 border-b border-[#dae7dd] bg-white/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#13271d]">
              Farm Location & Boundary
            </h1>

            <p className="text-xs text-muted-foreground">
              Select your farm location and draw the farm boundary
            </p>
          </div>

          <span className="rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#146c43]">
            Step 2 / 3
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {(geoError || saveError) && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="text-sm text-red-700">
                {saveError || geoError}
              </p>
            </div>
          </div>
        )}

        <Card className="mb-6 overflow-hidden border-0 shadow-lg">
          <SatelliteMap
            accessToken={MAPBOX_TOKEN}
            location={{
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              label: "Farm location",
            }}
            boundary={locationData.boundary}
            startDrawSignal={startDrawSignal}
            clearDrawSignal={clearDrawSignal}
            dropPinMode={mapMode === "drop-pin"}
            onLocationChange={(location) => {
              setLocationData((previous) => ({
                ...previous,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                source: "gps-pin",
              }));
            }}
            onBoundaryChange={handleBoundaryChange}
            onBoundaryMetricsChange={setBoundaryMetrics}
          />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant={
              mapMode === "drop-pin"
                ? "default"
                : "outline"
            }
            onClick={() => {
              setMapMode("drop-pin");
              setClearDrawSignal(
                (previous) => previous + 1
              );
            }}
            className={`h-14 rounded-xl text-base ${
              mapMode === "drop-pin"
                ? "bg-[#073b2a] hover:bg-[#0b4d36]"
                : "bg-white text-[#13271d]"
            }`}
          >
            <MapPin className="mr-2 h-5 w-5" />

            {mapMode === "drop-pin"
              ? "Select Farm Location"
              : "Change Farm Location"}
          </Button>

          <Button
            variant={
              mapMode === "draw"
                ? "default"
                : "outline"
            }
            onClick={() => {
              setMapMode("draw");
              setStartDrawSignal(
                (previous) => previous + 1
              );
            }}
            className={`h-14 rounded-xl text-base ${
              mapMode === "draw"
                ? "bg-[#073b2a] hover:bg-[#0b4d36]"
                : "bg-white text-[#13271d]"
            }`}
          >
            <Pencil className="mr-2 h-5 w-5" />

            {locationData.boundary
              ? "Redraw Farm Boundary"
              : "Draw Farm Boundary"}
          </Button>
        </div>

        {boundaryMetrics &&
          locationData.boundary && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card className="border-[#cae5d1] bg-[#f3fbf5] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <Square className="h-6 w-6 text-[#146c43]" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Farm Area
                    </p>

                    <p className="text-2xl font-bold text-[#13271d]">
                      {boundaryMetrics.areaAcres.toFixed(
                        2
                      )}{" "}
                      acres
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-[#cae5d1] bg-[#f3fbf5] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <Ruler className="h-6 w-6 text-[#146c43]" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Boundary Perimeter
                    </p>

                    <p className="text-2xl font-bold text-[#13271d]">
                      {boundaryMetrics.perimeterM.toFixed(
                        0
                      )}{" "}
                      m
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

        {locationData.boundary && (
          <div className="mt-6 rounded-xl border border-[#cae5d1] bg-[#f3fbf5] p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#22a35a]" />

              <div>
                <h3 className="font-semibold text-[#13271d]">
                  Farm boundary ready
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Review the highlighted boundary and measurements
                  before confirming your farm.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={isSaving}
            className="h-12 rounded-xl border-[#dae7dd] bg-white text-[#13271d] hover:bg-[#f5fbf6]"
          >
            Back
          </Button>

          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !locationData.boundary ||
              !boundaryMetrics
            }
            className="h-12 flex-1 rounded-xl bg-[#073b2a] px-6 text-white hover:bg-[#0b4d36] disabled:opacity-50"
          >
            {isSaving
              ? "Saving your farm..."
              : "Confirm Farm & Continue"}

            {!isSaving && (
              <ChevronRight className="ml-2 h-4 w-4" />
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}