import {
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  MapPinned,
  Ruler,
  Satellite,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "../components/ui/button";
import FarmBoundaryEditor from "../components/farm/FarmBoundaryEditor";
import { saveFarmLocation } from "../services/farmMapApi";

import type {
  VoiceFarmState,
} from "../types/voice";

type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

const DEFAULT_LOCATION: FarmMapLocation = {
  latitude: 10.7905,
  longitude: 78.7047,
  label: "Tamil Nadu",
};

const SQ_METERS_PER_ACRE = 4046.8564224;
const EARTH_RADIUS_M = 6371008.8;

function getStoredFarmProfile(): VoiceFarmState {
  try {
    const value = localStorage.getItem(
      "vazhaiguard_farm_profile"
    );

    if (!value) {
      return {};
    }

    return JSON.parse(
      value
    ) as VoiceFarmState;
  } catch {
    return {};
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  first: [number, number],
  second: [number, number]
) {
  const [lon1, lat1] = first;
  const [lon2, lat2] = second;

  const dLat = toRadians(
    lat2 - lat1
  );
  const dLon = toRadians(
    lon2 - lon1
  );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_M *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function perimeterMeters(
  boundary: FarmPolygonGeometry
) {
  const ring =
    boundary.coordinates[0] ?? [];

  let total = 0;

  for (
    let index = 1;
    index < ring.length;
    index += 1
  ) {
    total += haversineMeters(
      ring[index - 1],
      ring[index]
    );
  }

  return total;
}

function polygonAreaSquareMeters(
  boundary: FarmPolygonGeometry
) {
  const ring =
    boundary.coordinates[0] ?? [];

  if (ring.length < 4) {
    return 0;
  }

  let total = 0;

  for (
    let index = 0;
    index < ring.length - 1;
    index += 1
  ) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];

    total +=
      toRadians(lon2 - lon1) *
      (
        2 +
        Math.sin(toRadians(lat1)) +
        Math.sin(toRadians(lat2))
      );
  }

  return Math.abs(
    total *
      EARTH_RADIUS_M *
      EARTH_RADIUS_M /
      2
  );
}

function areaAcres(
  boundary: FarmPolygonGeometry
) {
  return (
    polygonAreaSquareMeters(boundary) /
    SQ_METERS_PER_ACRE
  );
}

export default function FarmLocationPage() {
  const [farmProfile] =
    useState<VoiceFarmState>(
      getStoredFarmProfile
    );

  const [location, setLocation] =
    useState<FarmMapLocation>(
      DEFAULT_LOCATION
    );

  const [boundary, setBoundary] =
    useState<FarmPolygonGeometry | null>(
      null
    );

  const [searchText, setSearchText] =
    useState("");

  const [searchLabel, setSearchLabel] =
    useState("");

  const [isSearching, setIsSearching] =
    useState(false);

  const [isLocating, setIsLocating] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  const [dropPinMode, setDropPinMode] =
    useState(false);

  const [startDrawSignal, setStartDrawSignal] =
    useState(0);

  const [clearDrawSignal, setClearDrawSignal] =
    useState(0);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState("");

  const [savedFarmId, setSavedFarmId] =
    useState("");

  const accessToken =
    import.meta.env.VITE_MAPBOX_TOKEN || "";

  const mappedAreaAcres =
    useMemo(
      () =>
        boundary
          ? areaAcres(boundary)
          : 0,
      [boundary]
    );

  const mappedPerimeterM =
    useMemo(
      () =>
        boundary
          ? perimeterMeters(
              boundary
            )
          : 0,
      [boundary]
    );

  const registeredTotalAcres =
    Number(
      farmProfile.total_farm_acres ?? 0
    );

  const registeredBananaAcres =
    Number(
      farmProfile.banana_area_acres ?? 0
    );

  const areaDifferencePercent =
    registeredTotalAcres > 0 &&
    mappedAreaAcres > 0
      ? (
          Math.abs(
            mappedAreaAcres -
              registeredTotalAcres
          ) /
          registeredTotalAcres
        ) * 100
      : 0;

  const areaComparison =
    mappedAreaAcres === 0 ||
    registeredTotalAcres === 0
      ? null
      : areaDifferencePercent <= 10
        ? {
            label:
              "Close to your entered farm area",
            className:
              "border-[#cae5d1] bg-[#f3fbf5] text-[#146c43]",
          }
        : areaDifferencePercent <= 25
          ? {
              label:
                "Please visually recheck the boundary",
              className:
                "border-amber-200 bg-amber-50 text-amber-800",
            }
          : {
              label:
                "Boundary and entered area differ significantly",
              className:
                "border-red-200 bg-red-50 text-red-700",
            };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "GPS is not supported by this browser."
      );
      return;
    }

    setIsLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          label: "Current GPS location",
        });

        setSearchLabel(
          "Current GPS location detected. Zoom in and verify the correct field."
        );
        setDropPinMode(false);
        setIsLocating(false);
      },
      (error) => {
        if (error.code === 1) {
          setLocationError(
            "Location permission denied. Allow location access or search for your village."
          );
        } else if (error.code === 3) {
          setLocationError(
            "Location request timed out. Try again or search for your village."
          );
        } else {
          setLocationError(
            "Unable to detect your location. Search for your village or drop a pin."
          );
        }

        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleSearch = async () => {
    const clean = searchText.trim();

    if (!clean || !accessToken) {
      return;
    }

    setIsSearching(true);
    setLocationError("");

    try {
      const params = new URLSearchParams({
        q: clean,
        access_token: accessToken,
        country: "IN",
        limit: "5",
      });

      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          "Place search failed."
        );
      }

      const data =
        (await response.json()) as {
          features?: Array<{
            geometry?: {
              coordinates?: [
                number,
                number
              ];
            };
            properties?: {
              full_address?: string;
              name?: string;
              place_formatted?: string;
            };
          }>;
        };

      const result = data.features?.[0];
      const coordinates =
        result?.geometry?.coordinates;

      if (!coordinates) {
        setLocationError(
          "No matching place found. Try a nearby village, town or landmark."
        );
        return;
      }

      const [longitude, latitude] =
        coordinates;

      const label =
        result?.properties?.full_address ||
        [
          result?.properties?.name,
          result?.properties?.place_formatted,
        ]
          .filter(Boolean)
          .join(", ") ||
        clean;

      setLocation({
        latitude,
        longitude,
        label,
      });

      setSearchLabel(
        `${label}. Now zoom in and verify the exact farm.`
      );
      setDropPinMode(false);
    } catch (error) {
      console.error(
        "MAP SEARCH ERROR:",
        error
      );

      setLocationError(
        "Unable to search the place right now. You can still use GPS or drop a pin."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapLocationChange = (
    next: FarmMapLocation
  ) => {
    setLocation({
      ...next,
      label: "Farmer selected map point",
    });

    setSearchLabel(
      "Map point selected. Verify the satellite view, then draw the farm boundary."
    );
    setDropPinMode(false);
  };

  const handleSave = async () => {
    if (!boundary) {
      setSaveError(
        "Draw and verify your farm boundary before confirming."
      );
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const response =
        await saveFarmLocation({
          farm_profile:
            farmProfile as unknown as Record<
              string,
              unknown
            >,
          location,
          boundary,
          mapped_area_acres:
            Number(
              mappedAreaAcres.toFixed(4)
            ),
          perimeter_m:
            Number(
              mappedPerimeterM.toFixed(1)
            ),
          farmer_confirmed: true,
          boundary_source:
            "farmer_drawn_satellite",
        });

      localStorage.setItem(
        "vazhaiguard_farm_location",
        JSON.stringify(response)
      );

      setSavedFarmId(
        response.farm_id
      );
    } catch (error) {
      console.error(
        "FARM LOCATION SAVE ERROR:",
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the farm boundary. Check that the backend is running and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
          <CircleAlert className="h-7 w-7 text-amber-700" />
          <h1 className="mt-4 text-2xl font-bold text-[#13271d]">
            Mapbox token is required
          </h1>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">
            Create frontend/.env.local and add your public Mapbox token as VITE_MAPBOX_TOKEN.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xs">
            VITE_MAPBOX_TOKEN=pk_your_public_mapbox_token
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
              <Satellite className="h-[18px] w-[18px] text-[#146c43]" />
            </div>

            <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
              Farm Setup · Step 2 of 6
            </span>
          </div>

          <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.04em] text-[#13271d] sm:text-4xl">
            Find and mark your exact farm.
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Use GPS, search for your village, or drop a pin. Then zoom into the satellite view and tap the corners of your field to draw the boundary.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d9e8dd] bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#146c43]">
            Registered farm
          </p>
          <p className="mt-1 text-sm font-bold text-[#13271d]">
            {farmProfile.farm_name ||
              "Your banana farm"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {farmProfile.banana_variety ||
              "Banana"}
          </p>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["1", "Basic details", true],
          ["2", "Farm map", true],
          ["3", "Zones", false],
          ["4", "Photos", false],
          ["5", "Resources", false],
          ["6", "Review", false],
        ].map(([number, label, active]) => (
          <div
            key={String(number)}
            className={`rounded-xl border px-3 py-2.5 ${
              active
                ? "border-[#bcdcc5] bg-[#f2faf4]"
                : "border-border bg-white"
            }`}
          >
            <p className="text-[10px] font-bold text-[#146c43]">
              {number}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#13271d]">
              {label}
            </p>
          </div>
        ))}
      </div>

      <FarmBoundaryEditor
        accessToken={accessToken}
        location={location}
        boundary={boundary}
        searchText={searchText}
        searchLabel={searchLabel}
        isSearching={isSearching}
        isLocating={isLocating}
        locationError={locationError}
        startDrawSignal={startDrawSignal}
        clearDrawSignal={clearDrawSignal}
        dropPinMode={dropPinMode}
        onSearchTextChange={
          setSearchText
        }
        onSearch={handleSearch}
        onUseCurrentLocation={
          handleUseCurrentLocation
        }
        onToggleDropPin={() => {
          setDropPinMode(
            (previous) => !previous
          );
        }}
        onStartDraw={() => {
          setDropPinMode(false);
          setStartDrawSignal(
            (previous) => previous + 1
          );
        }}
        onClearBoundary={() => {
          setBoundary(null);
          setClearDrawSignal(
            (previous) => previous + 1
          );
        }}
        onLocationChange={
          handleMapLocationChange
        }
        onBoundaryChange={
          setBoundary
        }
      />

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <MetricCard
          icon={Ruler}
          label="Map-calculated farm area"
          value={
            boundary
              ? `${mappedAreaAcres.toFixed(2)} acres`
              : "Draw boundary"
          }
          helper="Calculated from the farmer-drawn polygon"
        />

        <MetricCard
          icon={MapPinned}
          label="Boundary perimeter"
          value={
            boundary
              ? `${mappedPerimeterM.toFixed(0)} m`
              : "—"
          }
          helper="Useful later for field access and zone context"
        />

        <div className="rounded-[22px] border border-[#d9e7dc] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">
            Compare with registration
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Farmer entered
              </p>
              <p className="mt-1 text-lg font-bold text-[#13271d]">
                {registeredTotalAcres > 0
                  ? `${registeredTotalAcres} ac`
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground">
                Banana area entered
              </p>
              <p className="mt-1 text-lg font-bold text-[#13271d]">
                {registeredBananaAcres > 0
                  ? `${registeredBananaAcres} ac`
                  : "—"}
              </p>
            </div>
          </div>

          {areaComparison && (
            <div
              className={`mt-4 rounded-xl border px-3 py-2.5 text-xs font-semibold ${areaComparison.className}`}
            >
              {areaComparison.label}
              {" · "}
              {areaDifferencePercent.toFixed(1)}% difference
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[26px] border border-[#d8e7dc] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-3xl items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#146c43]" />
            <div>
              <p className="text-sm font-bold text-[#13271d]">
                Farmer-confirmed boundary
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Satellite imagery helps you visually identify the field. This drawn boundary is for VazhaiGuard decision support and is not a legal cadastral survey. Banana crop confirmation will also use your registration and field-zone photographs.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={
              !boundary ||
              isSaving ||
              Boolean(savedFarmId)
            }
            className="h-12 rounded-xl bg-[#073b2a] px-6 text-white hover:bg-[#0b4d36]"
          >
            {savedFarmId
              ? "Farm Confirmed"
              : isSaving
                ? "Saving..."
                : "Confirm This Farm"}
            {!savedFarmId && (
              <ArrowRight className="ml-2 h-4 w-4" />
            )}
          </Button>
        </div>

        {saveError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        {savedFarmId && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#cae5d1] bg-[#f3fbf5] p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22a35a]" />
            <div>
              <p className="text-sm font-semibold text-[#13271d]">
                Farm location saved successfully
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Farm ID: {savedFarmId}. Next we can divide this exact polygon into practical banana working zones.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: MetricCardProps) {
  return (
    <div className="rounded-[22px] border border-[#d9e7dc] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
          <Icon className="h-4 w-4 text-[#146c43]" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">
          {label}
        </p>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[#13271d]">
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        {helper}
      </p>
    </div>
  );
}
