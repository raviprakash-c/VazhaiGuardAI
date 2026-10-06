import "leaflet/dist/leaflet.css";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudRain,
  Eye,
  EyeOff,
  Layers3,
  MapPinned,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Volume2,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import {
  getSatelliteEvidence,
  getSatelliteLayer,
  getSatellitePreview,
  type SatelliteEvidence,
  type SatelliteLayer,
} from "../services/satelliteApi";

const DEFAULT_CENTER: LatLngExpression = [9.5, 77.5];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

type RiskLevel = "low" | "moderate" | "high";
type Coordinate = [number, number];

type SavedDecision = {
  risk?: {
    score?: number;
    level?: RiskLevel;
    evidence_confidence?: number;
    signals_used?: string[];
    evidence_state?: { conflicts?: Array<{ type?: string }> };
  };
  action?: string;
  vision?: {
    observation?: string;
    visual_confidence?: number;
    stress_signals?: string[];
    recommended_checks?: string[];
  };
};

type SavedFarm = {
  farm_id?: string;
  farm_profile?: {
    farm_name?: string;
    banana_variety?: string;
    banana_area_acres?: number;
    approximate_plants?: number;
  };
  location?: { latitude?: number; longitude?: number; label?: string };
  boundary?: {
    type?: "Polygon" | "MultiPolygon" | "Feature" | "FeatureCollection";
    coordinates?: unknown;
    geometry?: unknown;
    features?: unknown[];
  };
  parcel_metadata?: {
    district?: string;
    taluk?: string;
    village?: string;
    survey_number?: string;
    subdivision?: string | null;
    block_id?: string;
    unit_id?: string;
    confidence?: number;
    source_file?: string;
  };
  farmer_confirmed?: boolean;
  boundary_source?: string;
};

type LayerState = Partial<Record<SatelliteLayer, string>>;

const riskText: Record<
  RiskLevel,
  {
    title: string;
    tamil: string;
    className: string;
    ring: string;
    fill: string;
  }
> = {
  low: {
    title: "Low risk",
    tamil: "ஆபத்து குறைவு",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ring: "#15803d",
    fill: "#22c55e",
  },
  moderate: {
    title: "Watch this area",
    tamil: "கவனமாக கண்காணிக்கவும்",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    ring: "#b7791f",
    fill: "#f59e0b",
  },
  high: {
    title: "Act soon",
    tamil: "விரைவாக நடவடிக்கை எடுக்கவும்",
    className: "border-red-200 bg-red-50 text-red-800",
    ring: "#b91c1c",
    fill: "#ef4444",
  },
};

const layerMeta: Record<
  SatelliteLayer,
  { label: string; description: string; resolution: string }
> = {
  ndvi: {
    label: "NDVI",
    description: "Vegetation vigor",
    resolution: "10 m",
  },
  ndre: {
    label: "NDRE",
    description: "Red-edge vegetation signal",
    resolution: "20 m source",
  },
  ndwi: {
    label: "NDWI",
    description: "Water / moisture signal",
    resolution: "10 m",
  },
  stress: {
    label: "Stress zones",
    description: "Vegetation-stress heuristic",
    resolution: "10 m display",
  },
};

function readObject<T>(keys: string[]): T | null {
  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (value) return JSON.parse(value) as T;
    } catch {
      // Try the next compatible key.
    }
  }
  return null;
}

function MapRecenter({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom() < 13 ? 16 : map.getZoom(), {
      animate: true,
    });
  }, [center, map]);

  return null;
}

function boundaryGeometry(
  boundary: SavedFarm["boundary"],
): { type?: string; coordinates?: unknown } | null {
  if (!boundary) return null;

  if (boundary.type === "Feature") {
    return (
      boundary.geometry as
        | { type?: string; coordinates?: unknown }
        | undefined
    ) || null;
  }

  if (boundary.type === "FeatureCollection") {
    const first = boundary.features?.[0] as
      | { geometry?: { type?: string; coordinates?: unknown } }
      | undefined;
    return first?.geometry || null;
  }

  return boundary;
}

function polygonPaths(boundary: SavedFarm["boundary"]): Coordinate[][] {
  const geometry = boundaryGeometry(boundary);

  if (!geometry?.coordinates) return [];

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as Coordinate[][];
    return rings
      .slice(0, 1)
      .map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }

  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as Coordinate[][][];
    return polygons
      .map((polygon) =>
        polygon[0]?.map(([lng, lat]) => [lat, lng]),
      )
      .filter((path): path is Coordinate[] => Boolean(path));
  }

  return [];
}

function boundsFromPaths(
  paths: Coordinate[][],
  center: LatLngExpression,
): LatLngBoundsExpression {
  const points = paths.flat();

  if (points.length) {
    const lats = points.map((point) => point[0]);
    const lngs = points.map((point) => point[1]);

    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }

  const [lat, lng] = center as Coordinate;
  return [
    [lat - 0.001, lng - 0.001],
    [lat + 0.001, lng + 0.001],
  ];
}

function formatAge(hours?: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 24) return Math.max(1, Math.round(hours)) + "h ago";
  return Math.max(1, Math.round(hours / 24)) + "d ago";
}

function formatObservation(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FarmRiskMapPage() {
  const navigate = useNavigate();

  const [decision] = useState(() =>
    readObject<SavedDecision>([
      "vazhaiguard_last_decision",
      "vazhaiguard:lastDecision",
    ]),
  );

  const [farm] = useState(() =>
    readObject<SavedFarm>([
      "vazhaiguard_farm_complete",
      "vazhaiguard:farm",
    ]),
  );

  const [satellite, setSatellite] = useState<SatelliteEvidence | null>(() =>
    readObject<SatelliteEvidence>([
      "vazhaiguard_last_satellite_evidence",
      "vazhaiguard:lastSatelliteEvidence",
    ]),
  );

  const [activeLayer, setActiveLayer] = useState<
    SatelliteLayer | "base" | "sentinel"
  >("stress");
  const [layerUrls, setLayerUrls] = useState<LayerState>({});
  const [sentinelPreviewUrl, setSentinelPreviewUrl] = useState<string | null>(null);
  const [showSatellite, setShowSatellite] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingLayer, setLoadingLayer] = useState(false);
  const [satelliteError, setSatelliteError] = useState<string | null>(
    null,
  );

  const { speak, isSpeaking } = useVoiceAssistant();

  const center: LatLngExpression = useMemo(() => {
    const latitude = farm?.location?.latitude;
    const longitude = farm?.location?.longitude;

    return typeof latitude === "number" &&
      typeof longitude === "number"
      ? [latitude, longitude]
      : DEFAULT_CENTER;
  }, [farm]);

  const paths = useMemo(
    () => polygonPaths(farm?.boundary),
    [farm?.boundary],
  );

  const imageBounds = useMemo(
    () => boundsFromPaths(paths, center),
    [paths, center],
  );

  const farmerConfirmedBoundary = Boolean(
    farm?.farmer_confirmed ||
      satellite?.farm_geometry?.is_farmer_confirmed,
  );

  const hasDecisionRisk =
    typeof decision?.risk?.score === "number" &&
    Boolean(decision?.risk?.level);

  const score = Math.min(
    100,
    Math.max(0, decision?.risk?.score ?? 0),
  );

  const level = hasDecisionRisk
    ? (decision?.risk?.level as RiskLevel)
    : "moderate";

  const risk = hasDecisionRisk
    ? riskText[level]
    : {
        title: "Evidence review",
        tamil: "ஆதாரத்தை சரிபார்க்கவும்",
        className: "border-violet-200 bg-violet-50 text-violet-900",
        ring: "#6d28d9",
        fill: "#8b5cf6",
      };

  const confidence = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        decision?.risk?.evidence_confidence ??
          (satellite?.confidence ?? 0) * 100,
      ),
    ),
  );

  const signals = decision?.risk?.signals_used ?? [];
  const weatherUsed = signals.some((signal) =>
    signal.toLowerCase().includes("weather"),
  );
  const stormUsed = signals.some((signal) =>
    signal.toLowerCase().includes("storm") ||
    signal.toLowerCase().includes("wind"),
  );

  const hasSatelliteConflict = Boolean(
    decision?.risk?.evidence_state?.conflicts?.length,
  );

  const currentLayerUrl =
    activeLayer === "base" || activeLayer === "sentinel"
      ? null
      : layerUrls[activeLayer] || null;

  const currentSentinelUrl =
    activeLayer === "sentinel" ? sentinelPreviewUrl : null;

  const stats = satellite?.statistics_quality;
  const validPixels = stats?.indices?.ndvi?.sampleCount ?? null;
  const noDataPixels = stats?.indices?.ndvi?.noDataCount ?? null;
  const statsQuality = stats?.quality === "valid_statistics";
  const trendLabel =
    satellite?.trend === "improving"
      ? "Improving"
      : satellite?.trend === "declining"
        ? "Declining"
        : satellite?.trend === "stable"
          ? "Stable"
          : "Insufficient history";

  const loadLayer = useCallback(
    async (layer: SatelliteLayer) => {
      const latitude = farm?.location?.latitude;
      const longitude = farm?.location?.longitude;

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return;
      }

      if (layerUrls[layer]) return;

      setLoadingLayer(true);
      setSatelliteError(null);

      try {
        const url = await getSatelliteLayer(
          {
            latitude,
            longitude,
            boundary: farm?.boundary as
              | Record<string, unknown>
              | undefined,
          },
          layer,
        );

        setLayerUrls((previous) => ({
          ...previous,
          [layer]: url,
        }));
      } catch (error) {
        setSatelliteError(
          error instanceof Error
            ? error.message
            : "Could not load " + layerMeta[layer].label + ".",
        );
      } finally {
        setLoadingLayer(false);
      }
    },
    [farm, layerUrls],
  );

  const refreshSatellite = useCallback(async () => {
    const latitude = farm?.location?.latitude;
    const longitude = farm?.location?.longitude;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      setSatelliteError(
        "Farm location is unavailable. Confirm the farm boundary first.",
      );
      return;
    }

    setRefreshing(true);
    setSatelliteError(null);

    try {
      const input = {
        latitude,
        longitude,
        boundary: farm?.boundary as
          | Record<string, unknown>
          | undefined,
        lookbackDays: 45,
        baselineDays: 45,
        maxCloudPercent: 35,
      };

      const result = await getSatelliteEvidence(input);
      setSatellite(result);

      localStorage.setItem(
        "vazhaiguard_last_satellite_evidence",
        JSON.stringify(result),
      );

      for (const url of Object.values(layerUrls)) {
        if (url) URL.revokeObjectURL(url);
      }

      setLayerUrls({});

      if (result.available) {
        if (activeLayer === "sentinel") {
          const nextPreview = await getSatellitePreview(input);
          setSentinelPreviewUrl(nextPreview);
        } else {
          const layerToLoad =
            activeLayer === "base" ? "stress" : activeLayer;

          const nextUrl = await getSatelliteLayer(
            input,
            layerToLoad,
          );

          setLayerUrls({
            [layerToLoad]: nextUrl,
          });
        }
      }
    } catch (error) {
      setSatelliteError(
        error instanceof Error
          ? error.message
          : "Satellite service is unavailable.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [activeLayer, farm, layerUrls, sentinelPreviewUrl]);

  useEffect(() => {
    void refreshSatellite();

    return () => {
      for (const url of Object.values(layerUrls)) {
        if (url) URL.revokeObjectURL(url);
      }
    };
    // The farm is the lifecycle boundary for the initial satellite load.
    // Layer changes are handled by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm]);

  useEffect(() => {
    if (activeLayer === "sentinel") {
      const latitude = farm?.location?.latitude;
      const longitude = farm?.location?.longitude;
      if (typeof latitude !== "number" || typeof longitude !== "number") return;

      const input = {
        latitude,
        longitude,
        boundary: farm?.boundary as Record<string, unknown> | undefined,
        lookbackDays: 45,
        baselineDays: 45,
        maxCloudPercent: 35,
      };

      setLoadingLayer(true);
      setSatelliteError(null);
      void getSatellitePreview(input)
        .then((url) => {
          setSentinelPreviewUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return url;
          });
        })
        .catch((error) => {
          setSatelliteError(
            error instanceof Error
              ? error.message
              : "Could not load Sentinel-2 true color.",
          );
        })
        .finally(() => setLoadingLayer(false));
    } else if (activeLayer !== "base") {
      void loadLayer(activeLayer);
    }
  }, [activeLayer, loadLayer]);

  const speakSummary = () => {
    const action =
      decision?.action ||
      "புதிய படம் எடுத்து களத்தில் மீண்டும் சரிபார்க்கவும்.";

    speak(
      "பண்ணை ஆபத்து " + risk.tamil + ". " + action,
      "ta-IN",
    );
  };

  const mapboxSatelliteUrl = MAPBOX_TOKEN
    ? "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=" +
      MAPBOX_TOKEN
    : null;

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#13271d]">
      <header className="sticky top-0 z-[1000] border-b border-[#dfe9e2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">
                VazhaiGuard AI
              </p>
              <h1 className="text-lg font-bold">
                Farm Evidence Map
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setShowSatellite((value) => !value)}
              variant="outline"
              className="rounded-xl border-[#dfe9e2] bg-white"
            >
              {showSatellite ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">
                Map layers
              </span>
            </Button>

            <Button
              onClick={() => void refreshSatellite()}
              disabled={refreshing}
              variant="outline"
              className="rounded-xl border-[#dfe9e2] bg-white"
            >
              <RefreshCw
                className={
                  "mr-2 h-4 w-4 " +
                  (refreshing ? "animate-spin" : "")
                }
              />
              Refresh evidence
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-sm">
          <div className="relative h-[600px]">
            <MapContainer
              center={center}
              zoom={16}
              scrollWheelZoom
              className="h-full w-full"
            >
              {mapboxSatelliteUrl ? (
                <TileLayer
                  attribution='© Mapbox © Maxar'
                  url={mapboxSatelliteUrl}
                  maxZoom={22}
                  maxNativeZoom={18}
                />
              ) : (
                <TileLayer
                  attribution="© OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              )}

              <MapRecenter center={center} />

              {showSatellite && currentLayerUrl && (
                <ImageOverlay
                  url={currentLayerUrl}
                  bounds={imageBounds}
                  opacity={0.68}
                  zIndex={300}
                />
              )}

              {showSatellite && currentSentinelUrl && (
                <ImageOverlay
                  url={currentSentinelUrl}
                  bounds={imageBounds}
                  opacity={0.82}
                  zIndex={300}
                />
              )}

              {paths.map((path, index) => (
                <Polygon
                  key={index}
                  positions={path}
                  pathOptions={{
                    color: farmerConfirmedBoundary
                      ? "#f8f3cf"
                      : "#ffffff",
                    fillColor: risk.fill,
                    fillOpacity: 0.08,
                    weight: 4,
                    dashArray: farmerConfirmedBoundary
                      ? undefined
                      : "8 8",
                  }}
                />
              ))}

              <CircleMarker
                center={center}
                radius={8}
                pathOptions={{
                  color: "#13271d",
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                  weight: 3,
                }}
              />
            </MapContainer>

            <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[360px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <Satellite className="h-5 w-5 text-[#146c43]" />
                <div>
                  <p className="text-xs font-bold text-[#13271d]">
                    Farm evidence map
                  </p>
                  <p className="text-[11px] text-[#718078]">
                    {farmerConfirmedBoundary
                      ? "Farmer-confirmed cadastral reference boundary"
                      : "Location fallback — boundary not confirmed"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-xs font-bold text-violet-900">
                  {activeLayer === "base"
                    ? "High-resolution visual imagery"
                    : activeLayer === "sentinel"
                      ? "Sentinel-2 true color"
                      : layerMeta[activeLayer as SatelliteLayer].label}
                </p>
                <p className="mt-0.5 text-[11px] text-violet-700">
                  {activeLayer === "base"
                    ? "Mapbox satellite basemap"
                    : activeLayer === "sentinel"
                      ? "Real Copernicus Sentinel-2 L2A scene"
                      : layerMeta[activeLayer as SatelliteLayer].description}
                </p>
              </div>

              <div
                className={
                  "mt-3 rounded-xl border px-3 py-2 " +
                  risk.className
                }
              >
                <p className="text-sm font-bold">{risk.tamil}</p>
                <p className="text-xs">
                  Farm-level evidence • {confidence}% confidence
                </p>
              </div>
            </div>

            {showSatellite && (
              <div className="absolute right-4 top-4 z-[500] w-[220px] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-[#146c43]" />
                  <p className="text-xs font-bold">
                    Evidence layers
                  </p>
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveLayer("base")}
                    className={
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold " +
                      (activeLayer === "base"
                        ? "bg-[#073b2a] text-white"
                        : "bg-[#f2f6f3] text-[#596a60]")
                    }
                  >
                    Visual satellite base
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLayer("sentinel")}
                    className={
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold " +
                      (activeLayer === "sentinel"
                        ? "bg-violet-700 text-white"
                        : "bg-violet-50 text-violet-800")
                    }
                  >
                    Sentinel-2 true color
                    <span className="ml-1 opacity-70">• real scene</span>
                  </button>

                  {(Object.keys(layerMeta) as SatelliteLayer[]).map(
                    (layer) => (
                      <button
                        key={layer}
                        type="button"
                        onClick={() => setActiveLayer(layer)}
                        className={
                          "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold " +
                          (activeLayer === layer
                            ? "bg-[#146c43] text-white"
                            : "bg-[#f2f6f3] text-[#596a60]")
                        }
                      >
                        {layerMeta[layer].label}
                        <span className="ml-1 opacity-70">
                          • {layerMeta[layer].resolution}
                        </span>
                      </button>
                    ),
                  )}
                </div>

                {loadingLayer && (
                  <p className="mt-2 text-[10px] font-semibold text-[#718078]">
                    Loading Copernicus layer…
                  </p>
                )}
              </div>
            )}

            {refreshing && (
              <div className="absolute bottom-4 right-4 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg">
                Loading latest Sentinel-2 evidence…
              </div>
            )}

            {satelliteError && (
              <div className="absolute bottom-4 right-4 z-[500] max-w-[360px] rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-lg">
                {satelliteError}
              </div>
            )}

            <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">
                Map interpretation
              </p>

              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#596a60]">
                <span>
                  <i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500" />
                  lower stress
                </span>
                <span>
                  <i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-500" />
                  watch
                </span>
                <span>
                  <i className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500" />
                  higher stress
                </span>
              </div>

              <p className="mt-2 max-w-[360px] text-[10px] leading-4 text-[#718078]">
                Stress colours are a farm/zone vegetation-stress heuristic.
                They are not an individual banana disease diagnosis.
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div
            className={
              "rounded-[24px] border p-5 shadow-sm " +
              risk.className
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">
                  Farm risk
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {risk.title}
                </h2>
                <p className="mt-1 text-sm font-semibold">
                  {risk.tamil}
                </p>
              </div>

              <div className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">
                {hasDecisionRisk ? score.toFixed(0) + "/100" : "Evidence only"}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[11px] leading-4 text-amber-900">
              <p className="font-bold">Interpretation note</p>
              <p className="mt-0.5">
                The satellite stress score is a prototype vegetation-stress heuristic, not a disease probability. Confirm plant-level symptoms with a farmer photo or field inspection.
              </p>
            </div>

            {hasDecisionRisk ? (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-current transition-all duration-700"
                  style={{ width: Math.min(100, Math.max(0, score)) + "%" }}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-violet-200 bg-white/60 p-3 text-xs">
                No fused decision is available yet. Satellite values are shown as evidence, not as a disease-risk score.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-violet-600" />
              <h3 className="font-bold text-[#13271d]">
                Real satellite evidence
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric label="NDVI" value={satellite?.ndvi} />
              <Metric label="NDRE" value={satellite?.ndre} />
              <Metric label="NDWI" value={satellite?.ndwi} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <InfoCard
                label="Latest observation"
                value={formatObservation(
                  satellite?.latest_observation,
                )}
              />
              <InfoCard
                label="Age"
                value={formatAge(
                  satellite?.observation_age_hours,
                )}
              />
              <InfoCard
                label="Scene cloud"
                value={
                  satellite?.cloud_percent_mean != null
                    ? satellite.cloud_percent_mean.toFixed(1) + "%"
                    : "—"
                }
              />
              <InfoCard
                label="Source resolution"
                value={
                  satellite?.resolution_m
                    ? satellite.resolution_m + " m"
                    : "—"
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <InfoCard
                label="Valid pixels"
                value={validPixels != null ? validPixels.toFixed(0) : "—"}
              />
              <InfoCard
                label="No-data pixels"
                value={noDataPixels != null ? noDataPixels.toFixed(0) : "—"}
              />
              <InfoCard
                label="NDVI trend"
                value={trendLabel}
              />
              <InfoCard
                label="Stats quality"
                value={statsQuality ? "Validated" : "Incomplete"}
              />
            </div>

            <div className={
              "mt-3 flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-4 " +
              (statsQuality
                ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                : "border-amber-100 bg-amber-50 text-amber-900")
            }>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">
                  {statsQuality ? "Farm-level statistics validated" : "Statistics need verification"}
                </p>
                <p className="mt-0.5">
                  {statsQuality
                    ? "Measurements are based on multiple valid Sentinel-2 pixels inside the farm boundary."
                    : "Do not use the stress score as a decision signal until statistics are complete."}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700">
                Data source
              </p>
              <p className="mt-1 text-xs font-semibold text-violet-950">
                Copernicus Data Space • Sentinel-2 L2A
              </p>
              <p className="mt-1 text-[11px] leading-4 text-violet-800">
                Farm/zone-level spectral evidence. Sentinel-2 is periodic
                imagery, not a live camera.
              </p>
            </div>

            {satellite?.warnings?.map((warning) => (
              <div
                key={warning}
                className="mt-2 rounded-xl border border-amber-100 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900"
              >
                {warning}
              </div>
            ))}

            {hasSatelliteConflict && (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Satellite and temporal crop evidence disagree. Field
                verification is recommended.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-[#146c43]" />
                <h3 className="font-bold text-[#13271d]">
                  Cadastral reference
                </h3>
              </div>

              <span
                className={
                  "rounded-full px-2.5 py-1 text-[10px] font-bold " +
                  (farmerConfirmedBoundary
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800")
                }
              >
                {farmerConfirmedBoundary
                  ? "Farmer confirmed"
                  : "Needs confirmation"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <InfoCard
                label="Village"
                value={farm?.parcel_metadata?.village || "—"}
              />
              <InfoCard
                label="Survey No."
                value={
                  farm?.parcel_metadata?.survey_number || "—"
                }
              />
              <InfoCard
                label="District"
                value={farm?.parcel_metadata?.district || "—"}
              />
              <InfoCard
                label="Taluk"
                value={farm?.parcel_metadata?.taluk || "—"}
              />
              <InfoCard
                label="Block"
                value={farm?.parcel_metadata?.block_id || "—"}
              />
              <InfoCard
                label="Unit"
                value={farm?.parcel_metadata?.unit_id || "—"}
              />
            </div>

            <p className="mt-3 text-[10px] leading-4 text-[#718078]">
              This is a cadastral reference parcel supplied by the farm
              records. It is not a legal ownership verification.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#146c43]" />
                <h3 className="font-bold text-[#13271d]">
                  Evidence fusion
                </h3>
              </div>

              <span className="text-xs font-bold text-[#146c43]">
                {confidence}% confidence
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <EvidenceRow
                icon={<Camera className="h-4 w-4" />}
                label="Farmer photo"
                enabled={Boolean(
                  decision?.vision?.observation,
                )}
              />
              <EvidenceRow
                icon={<CloudRain className="h-4 w-4" />}
                label="Weather"
                enabled={weatherUsed}
              />
              <EvidenceRow
                icon={<Satellite className="h-4 w-4" />}
                label="Sentinel-2"
                enabled={Boolean(satellite?.available)}
              />
              <EvidenceRow
                icon={<Wind className="h-4 w-4" />}
                label="Storm context"
                enabled={stormUsed}
              />
            </div>
          </div>

          {decision?.vision?.observation && (
            <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#146c43]" />
                <h3 className="font-bold text-[#13271d]">
                  Farmer photo evidence
                </h3>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#596a60]">
                {decision.vision.observation}
              </p>

              {decision.vision.stress_signals?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {decision.vision.stress_signals.map(
                    (signal) => (
                      <span
                        key={signal}
                        className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-semibold text-[#146c43]"
                      >
                        {signal}
                      </span>
                    ),
                  )}
                </div>
              ) : null}

              {decision.vision.recommended_checks?.length ? (
                <div className="mt-4 rounded-xl bg-[#f8fbf9] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
                    Recommended field checks
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#596a60]">
                    {decision.vision.recommended_checks
                      .slice(0, 3)
                      .map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">
              What to do now
            </p>

            <p className="mt-2 text-base font-semibold leading-7 text-[#13271d]">
              {decision?.action ||
                "புதிய படம் எடுத்து களத்தில் மீண்டும் சரிபார்க்கவும்."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                onClick={speakSummary}
                variant="outline"
                className="rounded-xl border-[#dfe9e2]"
                disabled={isSpeaking}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {isSpeaking ? "Speaking…" : "கேளுங்கள்"}
              </Button>

              <Button
                onClick={() => navigate("/inspection")}
                className="rounded-xl bg-[#146c43] hover:bg-[#0f5b38]"
              >
                <Camera className="mr-2 h-4 w-4" />
                புதிய படம்
              </Button>
            </div>
          </div>

          {!MAPBOX_TOKEN && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Mapbox token is not configured, so the map is using OpenStreetMap
              as a fallback. Add VITE_MAPBOX_TOKEN to enable the high-resolution
              satellite basemap.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  return (
    <div className="rounded-xl bg-[#f5fbf7] p-3 text-center">
      <p className="text-[11px] text-[#718078]">{label}</p>
      <p className="mt-1 font-bold text-[#13271d]">
        {value != null ? value.toFixed(3) : "—"}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7eee9] bg-[#fbfdfb] p-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[#8a9a90]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-[#13271d]">
        {value}
      </p>
    </div>
  );
}

function EvidenceRow({
  icon,
  label,
  enabled,
}: {
  icon: ReactNode;
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[#596a60]">
        {icon}
        {label}
      </span>
      <span
        className={
          enabled
            ? "font-bold text-emerald-700"
            : "font-semibold text-[#9aa9a0]"
        }
      >
        {enabled ? "✓" : "—"}
      </span>
    </div>
  );
}
