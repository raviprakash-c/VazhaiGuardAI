import "leaflet/dist/leaflet.css";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPinned,
  Mic,
  RefreshCw,
  ShieldCheck,
  Satellite,
  Volume2,
  CloudRain,
  Wind,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { LatLngExpression } from "leaflet";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";

const DEFAULT_CENTER: LatLngExpression = [9.5, 77.5];

type RiskLevel = "low" | "moderate" | "high";

type SavedDecision = {
  risk?: {
    score?: number;
    level?: RiskLevel;
    evidence_confidence?: number;
    signals_used?: string[];
    evidence_state?: {
      satellite_reliability?: number;
      conflicts?: Array<{ type?: string }>;
    };
  };
  action?: string;
  vision?: {
    observation?: string;
    needs_field_verification?: boolean;
  };
};

type SavedFarm = {
  location?: { latitude?: number; longitude?: number };
  boundary?: {
    type?: "Polygon" | "MultiPolygon";
    coordinates?: unknown;
  };
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

function polygonRings(boundary: SavedFarm["boundary"]): LatLngExpression[][] {
  if (!boundary?.coordinates || boundary.type !== "Polygon") return [];
  const rings = boundary.coordinates as number[][][][];
  return rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLngExpression));
}

const riskText: Record<RiskLevel, { title: string; tamil: string; className: string }> = {
  low: { title: "Low risk", tamil: "ஆபத்து குறைவு", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  moderate: { title: "Watch this area", tamil: "கவனமாக கண்காணிக்கவும்", className: "border-amber-200 bg-amber-50 text-amber-900" },
  high: { title: "Act soon", tamil: "விரைவாக நடவடிக்கை எடுக்கவும்", className: "border-red-200 bg-red-50 text-red-800" },
};

function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

export default function FarmRiskMapPage() {
  const navigate = useNavigate();
  const { speak, isSpeaking } = useVoiceAssistant();
  const [decision, setDecision] = useState<SavedDecision | null>(null);
  const [farm, setFarm] = useState<SavedFarm | null>(null);

  const reload = () => {
    setDecision(readObject<SavedDecision>("vazhaiguard_last_decision"));
    setFarm(readObject<SavedFarm>("vazhaiguard_farm_complete"));
  };

  useEffect(() => {
    reload();
  }, []);

  const score = Number(decision?.risk?.score ?? 0);
  const level = decision?.risk?.level ?? levelFromScore(score);
  const text = riskText[level];
  const center = useMemo<LatLngExpression>(() => {
    const lat = Number(farm?.location?.latitude);
    const lng = Number(farm?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : DEFAULT_CENTER;
  }, [farm]);
  const rings = polygonRings(farm?.boundary);
  const satelliteUsed = decision?.risk?.signals_used?.includes("satellite") ?? false;
  const hasSatelliteConflict = decision?.risk?.evidence_state?.conflicts?.some(
    (item) => item.type === "temporal_crop_conflict",
  ) ?? false;
  const confidence = Math.round(Number(decision?.risk?.evidence_confidence ?? 0) * 100);

  const speakSummary = () => {
    const message = decision?.action
      ? decision.action
      : `உங்கள் தோட்டத்தின் தற்போதைய ஆபத்து ${text.tamil}. புகைப்படம் எடுத்து மீண்டும் சரிபார்க்கவும்.`;
    speak(message, "ta-IN");
  };

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">VazhaiGuard AI • Farm safety map</p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">உங்கள் தோட்டத்தின் ஆபத்து வரைபடம்</h1>
            <p className="mt-1 text-sm text-[#596a60]">நிறத்தை பார்த்தால் போதும்: பச்சை = பாதுகாப்பு, மஞ்சள் = கவனம், சிவப்பு = விரைவாக நடவடிக்கை.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload} className="rounded-xl border-[#dfe9e2] bg-white" aria-label="Refresh risk map">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/inspect")} className="rounded-xl border-[#dfe9e2] bg-white">
              <Camera className="mr-2 h-4 w-4" /> புதிய படம்
            </Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="overflow-hidden rounded-[28px] border border-[#dfe9e2] bg-white shadow-sm">
            <div className="relative h-[460px] sm:h-[560px]">
              <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter center={center} />
                {rings.map((ring, index) => (
                  <Polygon
                    key={index}
                    positions={ring}
                    pathOptions={{
                      color: level === "high" ? "#b91c1c" : level === "moderate" ? "#b7791f" : "#15803d",
                      fillColor: level === "high" ? "#ef4444" : level === "moderate" ? "#f59e0b" : "#22c55e",
                      fillOpacity: 0.28,
                      weight: 3,
                    }}
                  />
                ))}
                <CircleMarker
                  center={center}
                  radius={10}
                  pathOptions={{ color: "#13271d", fillColor: "#ffffff", fillOpacity: 1, weight: 3 }}
                />
              </MapContainer>

              <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[290px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-5 w-5 text-[#146c43]" />
                  <div>
                    <p className="text-xs font-bold text-[#13271d]">தற்போதைய பண்ணை நிலை</p>
                    <p className="text-[11px] text-[#718078]">Evidence-based screening</p>
                  </div>
                </div>
                <div className={`mt-3 rounded-xl border px-3 py-2 ${text.className}`}>
                  <p className="text-sm font-bold">{text.tamil}</p>
                  <p className="text-xs">{score.toFixed(0)}/100</p>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Map meaning</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#596a60]">
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500" /> குறைவு</span>
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-500" /> கவனம்</span>
                  <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500" /> அதிகம்</span>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className={`rounded-[28px] border p-6 shadow-sm ${text.className}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em]">இப்போது</p>
                  <h2 className="mt-2 text-3xl font-bold">{text.tamil}</h2>
                  <p className="mt-1 text-sm opacity-80">{text.title} • {score.toFixed(0)}/100</p>
                </div>
                {level === "high" ? <AlertTriangle className="h-9 w-9" /> : level === "moderate" ? <Wind className="h-9 w-9" /> : <ShieldCheck className="h-9 w-9" />}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[#13271d]">என்ன செய்ய வேண்டும்?</h2>
              <div className="mt-4 flex gap-3 rounded-2xl bg-[#f8fbf9] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#146c43]" />
                <p className="text-sm leading-6 text-[#39483f]">{decision?.action ?? "முதலில் ஒரு தெளிவான வாழை இலை / செடி புகைப்படம் எடுத்து AI-யிடம் சரிபார்க்கவும்."}</p>
              </div>
              <Button onClick={speakSummary} className="mt-4 w-full rounded-xl bg-[#146c43] hover:bg-[#0f5836]">
                {isSpeaking ? <Volume2 className="mr-2 h-4 w-4 animate-pulse" /> : <Mic className="mr-2 h-4 w-4" />}
                {isSpeaking ? "கேளுங்கள்..." : "குரலில் கேட்க"}
              </Button>
            </section>

            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[#13271d]">ஆதாரம்</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-[#f8fbf9] p-3"><span className="flex items-center gap-2"><Camera className="h-4 w-4 text-[#146c43]" /> புகைப்படம்</span><b>{decision ? "உள்ளது" : "இல்லை"}</b></div>
                <div className="flex items-center justify-between rounded-xl bg-[#f8fbf9] p-3"><span className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-[#146c43]" /> வானிலை</span><b>{decision?.risk?.signals_used?.includes("weather") ? "உள்ளது" : "இல்லை"}</b></div>
                <div className="flex items-center justify-between rounded-xl bg-[#f8fbf9] p-3"><span className="flex items-center gap-2"><Satellite className="h-4 w-4 text-[#146c43]" /> செயற்கைக்கோள்</span><b>{satelliteUsed ? "உள்ளது" : "இல்லை"}</b></div>
              </div>
              <div className="mt-3 rounded-xl border border-[#dfe9e2] p-3 text-xs leading-5 text-[#596a60]">
                {hasSatelliteConflict
                  ? "பழைய satellite தகவல் தற்போதைய பயிருடன் முரண்பட்டதால், அதை ஆபத்து கணக்கில் நம்பகமான ஆதாரமாக பயன்படுத்தவில்லை."
                  : satelliteUsed
                    ? "Satellite தகவல் கிடைத்துள்ளது; அதன் freshness-ஐ கருத்தில் கொண்டு risk கணக்கிடப்படுகிறது."
                    : "Satellite படம் இல்லை. அது இல்லாததால் AI எந்த தகவலையும் உருவாக்கவில்லை."}
              </div>
            </section>

            <section className="rounded-2xl border border-[#dfe9e2] bg-white p-4 text-xs leading-5 text-[#718078]">
              <p className="font-bold text-[#596a60]">முக்கிய குறிப்பு</p>
              <p className="mt-1">இந்த வரைபடம் முழு பண்ணைக்கான தற்போதைய evidence risk-ஐ காட்டுகிறது. ஒவ்வொரு மரத்திற்கும் தனித்தனி ஆபத்து என்று பொருள் இல்லை. உண்மையான zone-level signal கிடைத்தால் மட்டுமே தனி பகுதி நிறம் மாற்றப்படும்.</p>
              {confidence > 0 && <p className="mt-2">ஆதார நம்பகத்தன்மை: {confidence}%</p>}
            </section>
          </aside>
        </div>

        {!decision && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            முதலில் ஒரு புகைப்படத்தை AI மூலம் சரிபார்க்கவும். அதன் பிறகு இந்த வரைபடம் உங்கள் சமீபத்திய முடிவை காட்டும்.
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl bg-white"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Button>
          <Button variant="outline" onClick={() => navigate("/risk")} className="rounded-xl bg-white">வானிலை ஆபத்து</Button>
        </div>
      </div>
    </div>
  );
}
