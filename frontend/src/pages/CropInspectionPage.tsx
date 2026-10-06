import { Camera, CheckCircle2, ImagePlus, Loader2, MapPinned, ShieldAlert, Volume2, CloudRain, Satellite } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { inspectAndDecide, type InspectAndDecideResult } from "../services/multimodalApi";
import { getSatelliteEvidence, type SatelliteEvidence } from "../services/satelliteApi";
import { getWeather } from "../services/weatherApi";

type WeatherContext = Record<string, unknown>;
type FarmLocation = { latitude: number; longitude: number; boundary?: Record<string, unknown> };

const riskStyle = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-800",
  moderate: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-800",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

function readSavedFarmLocation(): FarmLocation | null {
  try {
    const raw = localStorage.getItem("vazhaiguard_farm_complete");
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const location = saved.location as Record<string, unknown> | undefined;
    if (!location) return null;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const boundary = saved.boundary;
    return { latitude, longitude, boundary: boundary && typeof boundary === "object" ? boundary as Record<string, unknown> : undefined };
  } catch {
    return null;
  }
}

async function loadDeviceLocation(): Promise<FarmLocation | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function loadWeatherAt(location: FarmLocation | null): Promise<WeatherContext | null> {
  if (!location) return null;
  try {
    return await getWeather(location.latitude, location.longitude) as unknown as WeatherContext;
  } catch {
    return null;
  }
}

export default function CropInspectionPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [result, setResult] = useState<InspectAndDecideResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherContext | null>(null);
  const [satelliteEvidence, setSatelliteEvidence] = useState<SatelliteEvidence | null>(null);
  const [farmLocationSource, setFarmLocationSource] = useState<"saved-farm" | "device" | "unavailable">("unavailable");
  const { speak, isSpeaking } = useVoiceAssistant();

  const chooseImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a plant or leaf photo.");
      return;
    }
    try {
      setError("");
      setResult(null);
      setWeatherLoaded(false);
      setWeatherData(null);
      setSatelliteEvidence(null);
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the image.");
    }
  };

  const inspect = async () => {
    if (!imageDataUrl || busy) return;
    setBusy(true);
    setError("");
    try {
      const savedFarm = readSavedFarmLocation();
      const location = savedFarm || await loadDeviceLocation();
      const locationSource: "saved-farm" | "device" | "unavailable" = savedFarm ? "saved-farm" : location ? "device" : "unavailable";
      setFarmLocationSource(locationSource);

      const weather = await loadWeatherAt(location);
      setWeatherLoaded(Boolean(weather));
      setWeatherData(weather);

      let satellite: SatelliteEvidence | null = null;
      if (location) {
        try {
          satellite = await getSatelliteEvidence({
            latitude: location.latitude,
            longitude: location.longitude,
            boundary: savedFarm?.boundary,
            lookbackDays: 45,
            baselineDays: 45,
            maxCloudPercent: 35,
          });
        } catch (satelliteError) {
          satellite = { available: false, reason: satelliteError instanceof Error ? satelliteError.message : "Satellite evidence is not available." };
        }
      } else {
        satellite = { available: false, reason: "Farm location is unavailable. Confirm the farm location before using satellite evidence." };
      }
      setSatelliteEvidence(satellite);
      try {
        localStorage.setItem("vazhaiguard_last_satellite_evidence", JSON.stringify(satellite));
        localStorage.setItem("vazhaiguard_last_satellite_evidence_at", new Date().toISOString());
      } catch (storageError) {
        console.warn("Could not persist the latest satellite evidence.", storageError);
      }

      const decision = await inspectAndDecide({
        imageDataUrl,
        language: "ta-IN",
        zoneId: "field-photo",
        farmContext: {
          crop: "banana",
          inspection_source: "farmer_photo",
          location_source: locationSource === "saved-farm" ? "farmer_confirmed_farm" : locationSource === "device" ? "device_gps_fallback" : "unavailable",
        },
        weatherContext: weather || undefined,
        satelliteContext: satellite?.available ? satellite as unknown as Record<string, unknown> : undefined,
      });

      setResult(decision);
      try {
        localStorage.setItem("vazhaiguard_last_decision", JSON.stringify(decision));
        localStorage.setItem("vazhaiguard_last_decision_at", new Date().toISOString());
      } catch (storageError) {
        console.warn("Could not persist the latest decision for the risk map.", storageError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed. Check the backend and Bedrock access.");
    } finally {
      setBusy(false);
    }
  };

  const speakAdvice = () => {
    if (result) speak(result.action, "ta-IN");
  };

  const satelliteIncluded = satelliteEvidence?.available === true && result?.risk.signals_used.includes("satellite") === true;
  const satelliteAvailable = satelliteEvidence?.available === true;
  const satelliteFreshness = result?.evaluation.evidence_trace.satellite_freshness || "unknown";
  const satelliteCurrentUse = satelliteIncluded && satelliteFreshness !== "stale";

  const next24 = weatherData?.next_24_hours as Record<string, unknown> | undefined;
  const rainProbability = Number(next24?.max_rain_probability ?? 0);
  const precipitation = Number(next24?.total_precipitation ?? 0);
  const maxWindGust = Number(next24?.max_wind_gust ?? 0);
  const peakRainTime = typeof next24?.peak_rain_time === "string" ? next24.peak_rain_time : null;
  const peakGustTime = typeof next24?.peak_gust_time === "string" ? next24.peak_gust_time : null;

  const weatherAlert =
    rainProbability >= 80 || precipitation >= 15 || maxWindGust >= 45
      ? "high"
      : rainProbability >= 50 || precipitation >= 5 || maxWindGust >= 30
        ? "moderate"
        : "low";

  const formatForecastTime = (value: string | null) => {
    if (!value) return "அடுத்த 24 மணி நேரத்தில்";
    const match = value.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):/);
    if (!match) return value;
    const parts = match[1].split("-");
    const hour = Number(match[2]);
    const suffix = hour >= 12 ? "மாலை" : "காலை";
    const displayHour = hour % 12 || 12;
    return parts[2] + "/" + parts[1] + " • " + displayHour + " " + suffix;
  };

  const stormActions =
    weatherAlert === "high"
      ? [
          "மழை தொடங்குவதற்கு முன் வடிகால் பாதைகளைத் திறந்து தண்ணீர் தேங்காமல் பார்த்துக்கொள்ளுங்கள்.",
          maxWindGust >= 45
            ? "பலத்த காற்று வருவதற்கு முன் வாழை மரங்களின் ஆதரவு / கயிறுகளைச் சரிபார்த்து பலப்படுத்துங்கள்."
            : "கனமழைக்கு முன் தேவையற்ற வயல் வேலைகளை ஒத்திவையுங்கள்.",
          "கனமழை நேரத்தில் வயலில் செல்வதைத் தவிர்த்து, மழைக்குப் பிறகு மட்டும் நிலைமையை மீண்டும் பாருங்கள்.",
        ]
      : weatherAlert === "moderate"
        ? [
            "மழை அல்லது காற்று வருவதற்கு முன் வடிகால் மற்றும் வாழை மரங்களின் ஆதரவைச் சரிபார்க்கவும்.",
            "மழை நேரத்தில் தெளிப்பு போன்ற வானிலை சார்ந்த வேலைகளைத் தவிர்க்கவும்.",
            "நிலைமையை அடுத்த சில மணி நேரத்தில் மீண்டும் பார்க்கவும்.",
          ]
        : [
            "அடுத்த 24 மணி நேரத்தில் பெரிய மழை அல்லது பலத்த காற்று அறிகுறி இல்லை.",
            "வழக்கமான பண்ணை பணிகளைத் தொடரலாம்; வானிலை மாற்றத்தை கவனிக்கவும்.",
          ];

  const stormTitle =
    weatherAlert === "high"
      ? "கனமழை / பலத்த காற்றுக்கு தயாராகுங்கள்"
      : weatherAlert === "moderate"
        ? "மழை / காற்று — முன் தயாராகுங்கள்"
        : "அடுத்த 24 மணி நேர வானிலை";

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">VazhaiGuard AI • Multimodal Field Check</p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">பயிர் புகைப்படம் சரிபார்ப்பு</h1>
            <p className="mt-1 text-sm text-[#718078]">புகைப்படம் + வானிலை + உண்மையான Sentinel-2 satellite evidence + பண்ணை context ஆகியவற்றை ஒன்றாக வைத்து AI முடிவை உருவாக்குகிறது.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/risk-map")} className="rounded-xl border-[#dfe9e2] bg-white">ஆபத்து வரைபடம்</Button>
            <Button variant="outline" onClick={() => navigate("/copilot")} className="rounded-xl border-[#dfe9e2] bg-white">Ask Copilot</Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2 text-[#146c43]"><Camera className="h-5 w-5" /><h2 className="font-bold">Step 1 • Take a field photo</h2></div>
            <p className="mt-2 text-sm leading-6 text-[#596a60]">முடிந்தால் முழு செடியை விட, பாதிக்கப்பட்ட இலை அல்லது பகுதியை நெருக்கமாகவும் தெளிவாகவும் படம் எடுக்கவும்.</p>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])} />
            <div className="mt-5 overflow-hidden rounded-2xl border border-dashed border-[#b9cfc0] bg-[#f8fbf9]">{preview ? <img src={preview} alt="Selected banana crop" className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] flex-col items-center justify-center p-8 text-center"><ImagePlus className="h-10 w-10 text-[#146c43]" /><p className="mt-3 font-semibold text-[#13271d]">புகைப்படம் இன்னும் எடுக்கப்படவில்லை</p><p className="mt-1 text-xs text-[#718078]">Camera அல்லது gallery பயன்படுத்தலாம்.</p></div>}</div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button onClick={() => inputRef.current?.click()} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]"><Camera className="mr-2 h-4 w-4" /> Take / choose photo</Button>{preview && <Button onClick={() => void inspect()} disabled={busy} variant="outline" className="rounded-xl border-[#cfe2d5] bg-white">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}{busy ? "Checking photo + evidence..." : "Inspect with AI"}</Button>}</div>
            {busy && <div className="mt-4 rounded-2xl border border-[#dfe9e2] bg-[#f8fbf9] p-4 text-sm text-[#596a60]"><p className="font-semibold text-[#13271d]">பல ஆதாரங்களை இணைக்கிறேன்...</p><p className="mt-1">புகைப்படம் → வானிலை → Sentinel-2 → freshness → risk → Ministral 8B farmer action</p></div>}
            {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </section>

          <section className="space-y-5">
            {!result && !busy && <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><MapPinned className="mt-1 h-5 w-5 text-[#146c43]" /><div><h2 className="font-bold text-[#13271d]">Evidence fusion</h2><p className="mt-2 text-sm leading-6 text-[#596a60]">புகைப்படம் செடியின் கண்ணுக்குத் தெரியும் அறிகுறிகளைத் தருகிறது. வானிலை வெளிப்புற அழுத்தத்தைச் சொல்கிறது. Sentinel-2 பண்ணை பகுதி அளவில் spectral evidence தருகிறது. பழைய அல்லது முரண்படும் satellite evidence-ஐ deterministic risk engine குறைத்து மதிப்பிடும்.</p></div></div></div>}

            {result && <>
              <div className={weatherAlert === "high" ? "rounded-[28px] border border-red-200 bg-red-50 p-5 shadow-sm sm:p-6" : weatherAlert === "moderate" ? "rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6" : "rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">FARMER ALERT</p>
                    <h2 className="mt-1 text-xl font-bold text-[#13271d]">{stormTitle}</h2>
                    <p className="mt-1 text-sm text-[#596a60]">உங்கள் பண்ணை பகுதியில் • அடுத்த 24 மணி நேரம்</p>
                  </div>
                  <span className={weatherAlert === "high" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700" : weatherAlert === "moderate" ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800" : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"}>
                    {weatherAlert === "high" ? "ACTION NEEDED" : weatherAlert === "moderate" ? "PREPARE" : "NORMAL"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-[10px] font-bold uppercase text-[#718078]">எப்போது?</p>
                    <p className="mt-1 text-sm font-bold text-[#13271d]">{formatForecastTime(peakRainTime)}</p>
                    {rainProbability > 0 && <p className="mt-1 text-xs text-[#596a60]">மழை வாய்ப்பு {Math.round(rainProbability)}%</p>}
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-[10px] font-bold uppercase text-[#718078]">எங்கே?</p>
                    <p className="mt-1 text-sm font-bold text-[#13271d]">உங்கள் பண்ணை பகுதி</p>
                    <p className="mt-1 text-xs text-[#596a60]">{farmLocationSource === "saved-farm" ? "உறுதிப்படுத்திய பண்ணை இடம்" : "கிடைத்த இடத்தைக் கொண்டு"}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-[10px] font-bold uppercase text-[#718078]">முக்கிய குறிப்பு</p>
                    <p className="mt-1 text-sm font-bold text-[#13271d]">{maxWindGust >= 45 ? "பலத்த காற்று " + Math.round(maxWindGust) + " km/h வரை" : precipitation >= 15 ? precipitation.toFixed(1) + " mm மழை" : "மழை / காற்றை கண்காணிக்கவும்"}</p>
                    {peakGustTime && maxWindGust >= 30 && <p className="mt-1 text-xs text-[#596a60]">காற்று உச்சம்: {formatForecastTime(peakGustTime)}</p>}
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-[#073b2a] p-4 text-white">
                  <p className="text-sm font-bold">இப்போது என்ன செய்ய வேண்டும்?</p>
                  <ol className="mt-3 space-y-2">
                    {stormActions.map((action, index) => (
                      <li key={action} className="flex gap-3 rounded-xl bg-white/10 p-3 text-sm leading-6">
                        <span className="font-bold">{index + 1}.</span><span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <details className="rounded-[28px] border border-[#dfe9e2] bg-white shadow-sm">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#13271d]">
                  AI evidence & technical details
                  <span className="ml-2 text-xs font-normal text-[#718078]">தொழில்நுட்ப விவரங்கள் — தேவையெனில் மட்டும் பார்க்கவும்</span>
                </summary>
                <div className="space-y-5 border-t border-[#edf2ee] p-5 sm:p-6">

              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Visual analysis</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">AI பார்த்தது</h2></div><span className="rounded-full border border-[#dfe9e2] px-3 py-1 text-[10px] font-bold text-[#596a60]">{Math.round(result.vision.visual_confidence * 100)}% confidence</span></div><p className="mt-4 text-sm leading-6 text-[#596a60]">{result.vision.observation}</p><div className="mt-4 flex flex-wrap gap-2">{result.vision.stress_signals.map((signal) => <span key={signal} className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-semibold text-[#146c43]">{signal}</span>)}</div>{result.vision.needs_field_verification && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">இந்த முடிவு களத்தில் சரிபார்க்கப்பட வேண்டும். AI மட்டும் வைத்து நோயை உறுதி செய்ய வேண்டாம்.</div>}<div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718078]">Recommended checks</p><ul className="mt-2 space-y-2">{result.vision.recommended_checks.map((check) => <li key={check} className="flex gap-2 text-sm text-[#596a60]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />{check}</li>)}</ul></div></div>

              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Satellite evidence</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">பண்ணை பகுதி நிலை</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${satelliteIncluded ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{satelliteAvailable ? (satelliteCurrentUse ? "REAL SATELLITE" : "REAL SATELLITE • CONTEXT") : "NOT INCLUDED"}</span></div><div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-violet-700"><Satellite className="h-3 w-3" />Sentinel-2</span><span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600">{farmLocationSource === "saved-farm" ? "Farmer-confirmed farm location" : farmLocationSource === "device" ? "Device GPS fallback" : "Location unavailable"}</span></div>{satelliteEvidence?.available ? <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">NDVI</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndvi?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">NDRE</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndre?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">NDWI</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndwi?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Source</p><p className="mt-1 font-bold text-[#13271d]">Sentinel-2 L2A</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Vegetation trend</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.trend || "—"}</p></div><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Latest observation</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.observation_age_hours != null ? `${Math.max(0, Math.round(satelliteEvidence.observation_age_hours / 24))} days ago` : "—"}</p></div><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Cloud quality</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.cloud_percent_mean != null ? `${satelliteEvidence.cloud_percent_mean.toFixed(0)}% scene cloud` : "—"}</p></div></div>{satelliteEvidence.warnings?.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{satelliteEvidence.warnings[0]}</div> : null}</> : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">{satelliteEvidence?.reason || "Satellite evidence was not available. Photo and weather evidence can still be used."}</div>}</div>

              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Output evaluation</p>
                    <h2 className="mt-1 text-lg font-bold text-[#13271d]">Decision quality gate</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    result.evaluation.grade === "pass"
                      ? "bg-emerald-50 text-emerald-700"
                      : result.evaluation.grade === "review"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-red-50 text-red-700"
                  }`}>
                    {result.evaluation.grade.toUpperCase()}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#f8fbf9] p-3">
                    <p className="text-[10px] uppercase text-[#718078]">Quality score</p>
                    <p className="mt-1 text-xl font-bold text-[#13271d]">
                      {Math.round(result.evaluation.quality_score * 100)}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f8fbf9] p-3">
                    <p className="text-[10px] uppercase text-[#718078]">Field verification</p>
                    <p className="mt-1 text-sm font-bold text-[#13271d]">
                      {result.evaluation.requires_field_verification ? "Required" : "Not required"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.evaluation.checks).slice(0, 6).map(([name, passed]) => (
                    <span
                      key={name}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {passed ? "✓" : "!"} {name.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                {result.evaluation.issues.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-900">Quality warnings</p>
                    <ul className="mt-2 space-y-1 text-[11px] leading-5 text-amber-900">
                      {result.evaluation.issues.slice(0, 3).map((issue) => (
                        <li key={issue.code}>• {issue.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-[10px] leading-4 text-[#718078]">
                  Deterministic evaluator checks evidence trace, uncertainty, freshness and recommendation safety. It does not diagnose the crop.
                </p>
              </div>

              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Unified risk engine</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">Evidence-fused farmer action</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskStyle[result.risk.level]}`}>{result.risk.level} • {result.risk.score}/100</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Photo</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(result.signal_scores.vision)}</p></div><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Weather</p><p className="mt-1 font-bold text-[#13271d]">{weatherLoaded ? Math.round(result.signal_scores.weather) : "—"}</p></div><div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Satellite</p><p className="mt-1 font-bold text-[#13271d]">{satelliteIncluded ? Math.round(result.signal_scores.satellite) : "—"}</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${weatherLoaded ? "bg-sky-50 text-sky-700" : "bg-slate-50 text-slate-500"}`}><CloudRain className="h-3 w-3" />{weatherLoaded ? "Live weather included" : "Weather unavailable"}</span><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${satelliteIncluded ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-500"}`}><Satellite className="h-3 w-3" />{satelliteCurrentUse ? "Satellite included in risk" : satelliteAvailable ? "Satellite context only" : "Satellite not supplied"}</span></div><div className="mt-4 rounded-2xl bg-[#073b2a] p-4 text-white"><p className="text-sm font-semibold leading-6">{result.decision.summary}</p><div className="mt-3 space-y-2">{result.decision.priority_actions.map((item) => <div key={`${item.priority}-${item.action}`} className="rounded-xl bg-white/10 p-3"><p className="text-xs font-bold">{item.priority}. {item.action}</p><p className="mt-1 text-[11px] leading-5 text-white/70">{item.reason}</p></div>)}</div>{result.decision.follow_up_check && <p className="mt-3 text-xs leading-5 text-white/80">களச் சரிபார்ப்பு: {result.decision.follow_up_check}</p>}{result.decision.recheck_after && <p className="mt-1 text-xs leading-5 text-white/80">மீண்டும் பார்க்க: {result.decision.recheck_after}</p>}<div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3 text-sm leading-6">{result.action}</div><Button onClick={speakAdvice} variant="outline" className="mt-3 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"><Volume2 className="mr-2 h-4 w-4" />{isSpeaking ? "Speaking..." : "தமிழில் கேளுங்கள்"}</Button></div><p className="mt-3 text-[10px] text-[#718078]">Decision model: {result.decision_model} • Signals: {result.risk.signals_used.join(", ") || "none"} • Satellite: {satelliteFreshness}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button onClick={() => navigate("/copilot")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]">Continue with Copilot</Button><Button onClick={() => navigate("/risk-map")} variant="outline" className="rounded-xl border-[#dfe9e2] bg-white">View farm risk map</Button></div></div>
                </div>
              </details>
            </>}
          </section>
        </div>
      </div>
    </div>
  );
}
