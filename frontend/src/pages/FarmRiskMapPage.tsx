import "leaflet/dist/leaflet.css";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  CloudRain,
  Layers3,
  MapPinned,
  Mic,
  RefreshCw,
  Ruler,
  Satellite,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wind,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { LatLngExpression } from "leaflet";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import type { SatelliteEvidence } from "../services/satelliteApi";

const DEFAULT_CENTER: LatLngExpression = [9.5, 77.5];
type RiskLevel = "low" | "moderate" | "high";
type Coordinate = [number, number];

type SavedDecision = {
  risk?: {
    score?: number;
    level?: RiskLevel;
    evidence_confidence?: number;
    signals_used?: string[];
    evidence_state?: { satellite_reliability?: number; conflicts?: Array<{ type?: string }> };
  };
  action?: string;
  vision?: { observation?: string; needs_field_verification?: boolean };
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

function polygonPaths(boundary: SavedFarm["boundary"]): LatLngExpression[][] {
  const geometry = boundaryGeometry(boundary);
  if (!geometry?.coordinates) return [];
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as Coordinate[][];
    return rings.slice(0, 1).map((ring) => ring.map(([lng, lat]) => [lat, lng] as Coordinate));
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as Coordinate[][][];
    return polygons.map((polygon) => polygon[0]?.map(([lng, lat]) => [lat, lng] as Coordinate)).filter((path): path is Coordinate[] => Boolean(path));
  }
  return [];
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
  if (hours == null || !Number.isFinite(hours)) return "தகவல் இல்லை";
  if (hours < 24) return `${Math.max(1, Math.round(hours))} மணி முன்`;
  const days = Math.round(hours / 24);
  return `${days} நாள் முன்`;
}

export default function FarmRiskMapPage() {
  const navigate = useNavigate();
  const { speak, isSpeaking } = useVoiceAssistant();
  const [decision, setDecision] = useState<SavedDecision | null>(null);
  const [farm, setFarm] = useState<SavedFarm | null>(null);
  const [satellite, setSatellite] = useState<SatelliteEvidence | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setDecision(readObject<SavedDecision>("vazhaiguard_last_decision"));
      setFarm(readObject<SavedFarm>("vazhaiguard_farm_complete"));
      setSatellite(readObject<SatelliteEvidence>("vazhaiguard_last_satellite_evidence"));
      setRefreshing(false);
    }, 280);
  };

  useEffect(() => reload(), []);

  const score = Number(decision?.risk?.score ?? satellite?.risk_score ?? 0);
  const level = decision?.risk?.level ?? levelFromScore(score);
  const text = riskText[level];
  const center = useMemo<LatLngExpression>(() => {
    const lat = Number(farm?.location?.latitude);
    const lng = Number(farm?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : DEFAULT_CENTER;
  }, [farm]);
  const paths = polygonPaths(farm?.boundary);
  const satelliteUsed = decision?.risk?.signals_used?.includes("satellite") ?? false;
  const hasSatelliteConflict = decision?.risk?.evidence_state?.conflicts?.some((item) => item.type === "temporal_crop_conflict") ?? false;
  const confidence = Math.round(Number(decision?.risk?.evidence_confidence ?? satellite?.confidence ?? 0) * 100);
  const areaHa = satellite?.farm_geometry?.area_hectares;
  const areaAcres = satellite?.farm_geometry?.area_acres;
  const farmerConfirmedBoundary = satellite?.farm_geometry?.is_farmer_confirmed ?? paths.length > 0;
  const trend = satellite?.trend;

  const speakSummary = () => {
    const message = decision?.action || `உங்கள் தோட்டத்தின் தற்போதைய ஆபத்து ${text.tamil}. ${satellite?.trend === "declining" ? "தாவர வளர்ச்சி குறைந்து வருகிறது. களத்தில் மீண்டும் சரிபார்க்கவும்." : "புகைப்படம் எடுத்து மீண்டும் சரிபார்க்கவும்."}`;
    speak(message, "ta-IN");
  };

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]"><Sparkles className="h-3.5 w-3.5" /> VazhaiGuard AI • Satellite farm view</div>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">உங்கள் தோட்டத்தின் ஆபத்து வரைபடம்</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#596a60]">பண்ணை எல்லைக்குள் கிடைத்த சமீபத்திய satellite + photo + weather evidence-ஐ எளிய முறையில் காட்டுகிறது.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload} disabled={refreshing} className="rounded-xl border-[#dfe9e2] bg-white" aria-label="Refresh risk map">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "புதுப்பிக்கிறது" : "Refresh"}
            </Button>
            <Button onClick={() => navigate("/inspect")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]"><Camera className="mr-2 h-4 w-4" /> புதிய படம்</Button>
          </div>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-[#718078]"><Ruler className="h-4 w-4 text-[#146c43]" /> பண்ணை பரப்பு</div><p className="mt-2 text-xl font-bold text-[#13271d]">{areaHa != null ? `${areaHa.toFixed(2)} ha` : "—"}</p><p className="text-[11px] text-[#718078]">{areaAcres != null ? `${areaAcres.toFixed(2)} acres` : "அளவு கிடைக்கவில்லை"}</p></div>
          <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-[#718078]"><Satellite className="h-4 w-4 text-violet-600" /> Satellite observation</div><p className="mt-2 text-xl font-bold text-[#13271d]">{formatAge(satellite?.observation_age_hours)}</p><p className="text-[11px] text-[#718078]">{satellite?.image_count ?? 0} usable image(s)</p></div>
          <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-[#718078]"><Layers3 className="h-4 w-4 text-emerald-600" /> Vegetation trend</div><p className={`mt-2 text-xl font-bold ${trend === "declining" ? "text-red-700" : trend === "improving" ? "text-emerald-700" : "text-[#13271d]"}`}>{trend === "declining" ? "குறைவு" : trend === "improving" ? "மேம்பாடு" : trend === "stable" ? "நிலையானது" : "தகவல் குறைவு"}</p><p className="text-[11px] text-[#718078]">NDVI baseline comparison</p></div>
          <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-[#718078]"><ShieldCheck className="h-4 w-4 text-[#146c43]" /> Evidence confidence</div><p className="mt-2 text-xl font-bold text-[#13271d]">{confidence > 0 ? `${confidence}%` : "—"}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e9f0eb]"><div className="h-full rounded-full bg-[#146c43] transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} /></div></div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-sm">
            <div className="relative h-[460px] sm:h-[560px]">
              <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapRecenter center={center} />
                {paths.map((path, index) => <Polygon key={index} positions={path} pathOptions={{ color: text.ring, fillColor: text.fill, fillOpacity: 0.25, weight: 3, dashArray: farmerConfirmedBoundary ? undefined : "8 8" }} />)}
                <CircleMarker center={center} radius={9} pathOptions={{ color: "#13271d", fillColor: "#ffffff", fillOpacity: 1, weight: 3 }} />
              </MapContainer>

              <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[310px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-[#146c43]" /><div><p className="text-xs font-bold text-[#13271d]">பண்ணை எல்லை</p><p className="text-[11px] text-[#718078]">{farmerConfirmedBoundary ? "Farmer-confirmed boundary" : "Location buffer — boundary not confirmed"}</p></div></div>
                <div className={`mt-3 rounded-xl border px-3 py-2 ${text.className}`}><p className="text-sm font-bold">{text.tamil}</p><p className="text-xs">Farm-level risk • {score.toFixed(0)}/100</p></div>
              </div>

              <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Map meaning</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#596a60]"><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500" /> healthy</span><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-500" /> watch</span><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500" /> act soon</span></div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className={`rounded-[24px] border p-5 shadow-sm ${text.className}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Farm risk</p><h2 className="mt-1 text-2xl font-bold">{text.tamil}</h2></div><div className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">{score.toFixed(0)}/100</div></div>
              <p className="mt-3 text-sm leading-6">{decision?.action || "புதிய படம் எடுத்து கள நிலையை சரிபார்க்கவும்."}</p>
              <Button onClick={speakSummary} disabled={isSpeaking} variant="outline" className="mt-4 w-full rounded-xl border-current bg-white/70"><Volume2 className="mr-2 h-4 w-4" /> {isSpeaking ? "கேட்கிறது…" : "தமிழில் கேளுங்கள்"}</Button>
            </div>

            <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-bold text-[#13271d]">Evidence status</h3><CheckCircle2 className="h-5 w-5 text-[#146c43]" /></div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Satellite className="h-4 w-4" /> Satellite</span><span className="font-semibold">{satelliteUsed ? "Used" : "Available"}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><CloudRain className="h-4 w-4" /> Weather</span><span className="font-semibold">{decision?.risk?.signals_used?.includes("weather") ? "Used" : "Not available"}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Camera className="h-4 w-4" /> Farmer photo</span><span className="font-semibold">{decision?.vision?.observation ? "Used" : "Not available"}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#596a60]"><Clock3 className="h-4 w-4" /> Observation</span><span className="font-semibold">{formatAge(satellite?.observation_age_hours)}</span></div>
              </div>
              {hasSatelliteConflict && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mr-1 inline h-4 w-4" /> Satellite and recent crop evidence disagree. Field verification is recommended.</div>}
            </div>

            <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
              <h3 className="font-bold text-[#13271d]">அடுத்து என்ன செய்ய வேண்டும்?</h3>
              <p className="mt-2 text-sm leading-6 text-[#596a60]">{decision?.action || "தோட்டத்தில் பாதிக்கப்பட்ட பகுதியின் புதிய புகைப்படத்தை எடுக்கவும்."}</p>
              <div className="mt-4 grid gap-2">
                <Button onClick={() => navigate("/inspect")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]"><Camera className="mr-2 h-4 w-4" /> மீண்டும் படம் எடுக்கவும்</Button>
                <Button onClick={() => navigate(-1)} variant="outline" className="rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> பின்செல்லவும்</Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex items-center gap-2 font-bold"><Wind className="h-4 w-4" /> Satellite ≠ live camera</div><p className="mt-2 leading-6">Satellite observation கால இடைவெளியுடன் கிடைக்கும். இது தோட்டத்தின் vegetation pattern-ஐ காட்டுகிறது; ஒரு தனி வாழை மரத்தின் நோயை உறுதி செய்யாது.</p></div>
            <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 text-xs leading-5 text-[#718078]">{farmerConfirmedBoundary ? "இந்த வரைபடத்தின் எல்லை நீங்கள் உறுதிப்படுத்திய farm boundary-ஐ அடிப்படையாகக் கொண்டது." : "Farm boundary உறுதி செய்யப்படவில்லை; வரைபடம் location buffer-ஐ மட்டும் காட்டுகிறது."} {satellite?.farm_geometry?.area_m2 != null ? `பரப்பு: ${satellite.farm_geometry.area_m2.toFixed(0)} m².` : ""}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
