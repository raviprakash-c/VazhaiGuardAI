import "leaflet/dist/leaflet.css";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudRain,
  Eye,
  EyeOff,
  MapPinned,
  RefreshCw,
  Satellite,
  Volume2,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { getSatelliteEvidence, getSatellitePreview } from "../services/satelliteApi";
import type { SatelliteEvidence } from "../services/satelliteApi";

const DEFAULT_CENTER: LatLngExpression = [9.5, 77.5];
type RiskLevel = "low" | "moderate" | "high";
type Coordinate = [number, number];

type SavedDecision = {
  risk?: { score?: number; level?: RiskLevel; evidence_confidence?: number; signals_used?: string[]; evidence_state?: { conflicts?: Array<{ type?: string }> } };
  action?: string;
  vision?: { observation?: string };
};

type SavedFarm = {
  location?: { latitude?: number; longitude?: number };
  boundary?: { type?: "Polygon" | "MultiPolygon" | "Feature" | "FeatureCollection"; coordinates?: unknown; geometry?: unknown; features?: unknown[] };
};

function readObject<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function MapRecenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() < 13 ? 16 : map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

function boundaryGeometry(boundary: SavedFarm["boundary"]): { type?: string; coordinates?: unknown } | null {
  if (!boundary) return null;
  if (boundary.type === "Feature") return (boundary.geometry as { type?: string; coordinates?: unknown } | undefined) || null;
  if (boundary.type === "FeatureCollection") {
    const first = boundary.features?.[0] as { geometry?: { type?: string; coordinates?: unknown } } | undefined;
    return first?.geometry || null;
  }
  return boundary;
}

function polygonPaths(boundary: SavedFarm["boundary"]): Coordinate[][] {
  const geometry = boundaryGeometry(boundary);
  if (!geometry?.coordinates) return [];
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as Coordinate[][];
    return rings.slice(0, 1).map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as Coordinate[][][];
    return polygons.map((polygon) => polygon[0]?.map(([lng, lat]) => [lat, lng])).filter((path): path is Coordinate[] => Boolean(path));
  }
  return [];
}

function boundsFromPaths(paths: Coordinate[][], center: LatLngExpression): LatLngBoundsExpression {
  const points = paths.flat();
  if (points.length) {
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  }
  const [lat, lng] = center as Coordinate;
  return [[lat - 0.001, lng - 0.001], [lat + 0.001, lng + 0.001]];
}

const riskText: Record<RiskLevel, { title: string; tamil: string; className: string; ring: string; fill: string }> = {
  low: { title: "Low risk", tamil: "ஆபத்து குறைவு", className: "border-emerald-200 bg-emerald-50 text-emerald-800", ring: "#15803d", fill: "#22c55e" },
  moderate: { title: "Watch this area", tamil: "கவனமாக கண்காணிக்கவும்", className: "border-amber-200 bg-amber-50 text-amber-900", ring: "#b7791f", fill: "#f59e0b" },
  high: { title: "Act soon", tamil: "விரைவாக நடவடிக்கை எடுக்கவும்", className: "border-red-200 bg-red-50 text-red-800", ring: "#b91c1c", fill: "#ef4444" },
};

function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

function formatAge(hours?: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h ago`;
  return `${Math.max(1, Math.round(hours / 24))}d ago`;
}

export default function FarmRiskMapPage() {
  const navigate = useNavigate();
  const [decision] = useState(() => readObject<SavedDecision>("vazhaiguard:lastDecision"));
  const [farm] = useState(() => readObject<SavedFarm>("vazhaiguard:farm"));
  const [satellite, setSatellite] = useState<SatelliteEvidence | null>(() => readObject<SatelliteEvidence>("vazhaiguard:lastSatelliteEvidence"));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSatellite, setShowSatellite] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [satelliteError, setSatelliteError] = useState<string | null>(null);
  const { speak, isSpeaking } = useVoiceAssistant();

  const center: LatLngExpression = useMemo(() => {
    const latitude = farm?.location?.latitude;
    const longitude = farm?.location?.longitude;
    return typeof latitude === "number" && typeof longitude === "number" ? [latitude, longitude] : DEFAULT_CENTER;
  }, [farm]);
  const paths = useMemo(() => polygonPaths(farm?.boundary), [farm?.boundary]);
  const imageBounds = useMemo(() => boundsFromPaths(paths, center), [paths, center]);
  const farmerConfirmedBoundary = Boolean(satellite?.farm_geometry?.is_farmer_confirmed || farm?.boundary);
  const score = Math.min(100, Math.max(0, decision?.risk?.score ?? satellite?.risk_score ?? 0));
  const level = decision?.risk?.level ?? levelFromScore(score);
  const text = riskText[level];
  const confidence = Math.round(Math.min(100, Math.max(0, decision?.risk?.evidence_confidence ?? satellite?.confidence ?? 0)));
  const satelliteUsed = Boolean(satellite?.available);
  const signals = decision?.risk?.signals_used ?? [];
  const weatherUsed = signals.some((signal) => signal.toLowerCase().includes("weather"));
  const stormUsed = signals.some((signal) => signal.toLowerCase().includes("storm") || signal.toLowerCase().includes("wind"));
  const hasSatelliteConflict = Boolean(decision?.risk?.evidence_state?.conflicts?.length);

  const refreshSatellite = useCallback(async () => {
    const latitude = farm?.location?.latitude;
    const longitude = farm?.location?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") return;
    setRefreshing(true);
    setSatelliteError(null);
    try {
      const input = { latitude, longitude, boundary: farm?.boundary as Record<string, unknown> | undefined };
      const result = await getSatelliteEvidence(input);
      setSatellite(result);
      localStorage.setItem("vazhaiguard:lastSatelliteEvidence", JSON.stringify(result));
      try {
        const nextPreview = await getSatellitePreview(input);
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return nextPreview;
        });
      } catch (previewError) {
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
        if (previewError instanceof Error) setSatelliteError(previewError.message);
      }
    } catch (error) {
      setSatelliteError(error instanceof Error ? error.message : "Satellite service is unavailable.");
    } finally {
      setRefreshing(false);
    }
  }, [farm]);

  useEffect(() => {
    void refreshSatellite();
    return () => {
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    };
  }, [refreshSatellite]);

  const speakSummary = () => {
    const action = decision?.action || "புதிய படம் எடுத்து களத்தில் மீண்டும் சரிபார்க்கவும்.";
    speak(`பண்ணை ஆபத்து ${text.tamil}. ${action}`, "ta-IN");
  };

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#13271d]">
      <header className="sticky top-0 z-[1000] border-b border-[#dfe9e2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">VazhaiGuard AI</p><h1 className="text-lg font-bold">Farm Risk Map</h1></div></div>
          <div className="flex gap-2"><Button onClick={() => setShowSatellite((value) => !value)} variant="outline" className="rounded-xl border-[#dfe9e2] bg-white">{showSatellite ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button onClick={() => void refreshSatellite()} disabled={refreshing} variant="outline" className="rounded-xl border-[#dfe9e2] bg-white"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh satellite</Button></div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-sm">
          <div className="relative h-[560px]">
            <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapRecenter center={center} />
              {showSatellite && previewUrl && <ImageOverlay url={previewUrl} bounds={imageBounds} opacity={0.78} zIndex={200} />}
              {paths.map((path, index) => <Polygon key={index} positions={path} pathOptions={{ color: text.ring, fillColor: text.fill, fillOpacity: showSatellite ? 0.08 : 0.25, weight: 3, dashArray: farmerConfirmedBoundary ? undefined : "8 8" }} />)}
              <CircleMarker center={center} radius={9} pathOptions={{ color: "#13271d", fillColor: "#ffffff", fillOpacity: 1, weight: 3 }} />
            </MapContainer>

            <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[330px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-[#146c43]" /><div><p className="text-xs font-bold text-[#13271d]">பண்ணை எல்லை</p><p className="text-[11px] text-[#718078]">{farmerConfirmedBoundary ? "Farmer-confirmed boundary" : "Location buffer — boundary not confirmed"}</p></div></div>
              {previewUrl && <p className="mt-2 text-[11px] font-semibold text-violet-700">🛰 Copernicus Sentinel-2 imagery</p>}
              <div className={`mt-3 rounded-xl border px-3 py-2 ${text.className}`}><p className="text-sm font-bold">{text.tamil}</p><p className="text-xs">Farm-level risk • {score.toFixed(0)}/100</p></div>
            </div>

            {refreshing && <div className="absolute right-4 top-4 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg">Loading latest satellite observation…</div>}
            {satelliteError && !previewUrl && <div className="absolute bottom-4 right-4 z-[500] max-w-[330px] rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-lg">{satelliteError}</div>}
            <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Map meaning</p><div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#596a60]"><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500" /> healthy</span><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-500" /> watch</span><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500" /> act soon</span></div></div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className={`rounded-[24px] border p-5 shadow-sm ${text.className}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Farm risk</p><h2 className="mt-1 text-2xl font-bold">{text.title}</h2><p className="mt-1 text-sm font-semibold">{text.tamil}</p></div><div className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">{score.toFixed(0)}/100</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-current transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></div></div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Satellite className="h-5 w-5 text-violet-600" /><h3 className="font-bold text-[#13271d]">Satellite evidence</h3></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#f5fbf7] p-3"><p className="text-[11px] text-[#718078]">NDVI</p><p className="mt-1 font-bold text-[#13271d]">{satellite?.ndvi != null ? satellite.ndvi.toFixed(3) : "—"}</p></div><div className="rounded-xl bg-[#f5fbf7] p-3"><p className="text-[11px] text-[#718078]">NDRE</p><p className="mt-1 font-bold text-[#13271d]">{satellite?.ndre != null ? satellite.ndre.toFixed(3) : "—"}</p></div><div className="rounded-xl bg-[#f5fbf7] p-3"><p className="text-[11px] text-[#718078]">NDWI</p><p className="mt-1 font-bold text-[#13271d]">{satellite?.ndwi != null ? satellite.ndwi.toFixed(3) : "—"}</p></div><div className="rounded-xl bg-[#f5fbf7] p-3"><p className="text-[11px] text-[#718078]">Cloud</p><p className="mt-1 font-bold text-[#13271d]">{satellite?.cloud_percent_mean != null ? `${satellite.cloud_percent_mean.toFixed(1)}%` : "—"}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl border border-[#e7eee9] p-3"><p className="text-[#718078]">Observation</p><p className="mt-1 font-semibold text-[#13271d]">{formatAge(satellite?.observation_age_hours)}</p></div><div className="rounded-xl border border-[#e7eee9] p-3"><p className="text-[#718078]">Scenes found</p><p className="mt-1 font-semibold text-[#13271d]">{satellite?.image_count ?? "—"}</p></div></div><p className="mt-4 text-xs leading-5 text-[#718078]">Copernicus Sentinel-2 provides farm/zone-level vegetation evidence. It is periodic imagery, not a live camera, and it does not diagnose individual banana trees.</p>{satellite?.warnings?.map((warning) => <div key={warning} className="mt-2 rounded-xl border border-amber-100 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900">{warning}</div>)}{hasSatelliteConflict && <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Satellite and temporal crop evidence disagree; field verification is recommended.</div>}</div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#146c43]" /><h3 className="font-bold text-[#13271d]">Evidence sources</h3></div><span className="text-xs font-bold text-[#146c43]">{confidence}% confidence</span></div><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Camera className="h-4 w-4" /> Farmer photo</span><span className="font-semibold">{decision?.vision?.observation ? "✓" : "—"}</span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><CloudRain className="h-4 w-4" /> Weather</span><span className="font-semibold">{weatherUsed ? "✓" : "—"}</span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Satellite className="h-4 w-4" /> Satellite</span><span className="font-semibold">{satelliteUsed ? "✓" : "—"}</span></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Wind className="h-4 w-4" /> Storm context</span><span className="font-semibold">{stormUsed ? "✓" : "—"}</span></div></div></div>

          <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">What to do now</p><p className="mt-2 text-base font-semibold leading-7 text-[#13271d]">{decision?.action || "புதிய படம் எடுத்து களத்தில் மீண்டும் சரிபார்க்கவும்."}</p><div className="mt-4 grid grid-cols-2 gap-3"><Button onClick={speakSummary} variant="outline" className="rounded-xl border-[#dfe9e2]" disabled={isSpeaking}><Volume2 className="mr-2 h-4 w-4" /> {isSpeaking ? "Speaking…" : "கேளுங்கள்"}</Button><Button onClick={() => navigate("/inspection")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5b38]"><Camera className="mr-2 h-4 w-4" /> புதிய படம்</Button></div></div>
        </aside>
      </main>
    </div>
  );
}
