import { Camera, CheckCircle2, ImagePlus, Loader2, MapPinned, ShieldAlert, Volume2, CloudRain, Satellite, Wind, Clock3, TriangleAlert, ArrowUpRight, Activity, Sparkles, Eye, Waves } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { inspectAndDecide, reinspectCrop, type InspectAndDecideResult } from "../services/multimodalApi";
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
  const [reinspectMode, setReinspectMode] = useState(false);
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
      if (!reinspectMode) setResult(null);
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

      const savedRaw = localStorage.getItem("vazhaiguard_farm_complete");
      let farmId = "";
      let savedFarmProfile: Record<string, unknown> = {};
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw) as Record<string, unknown>;
          farmId = String(saved.farm_id || saved.farmId || "");
          if (saved.farm_profile && typeof saved.farm_profile === "object") {
            savedFarmProfile = saved.farm_profile as Record<string, unknown>;
          } else if (saved.profile && typeof saved.profile === "object") {
            savedFarmProfile = saved.profile as Record<string, unknown>;
          }
        } catch {
          farmId = "";
        }
      }

      const decision = reinspectMode
        ? await reinspectCrop({
            farmId,
            imageDataUrl,
            language: "ta-IN",
            zoneId: "field-photo",
            weatherContext: weather || undefined,
            satelliteContext: satellite?.available ? satellite as unknown as Record<string, unknown> : undefined,
          })
        : await inspectAndDecide({
        imageDataUrl,
        farmId: farmId || undefined,
        language: "ta-IN",
        zoneId: "field-photo",
        farmContext: {
          ...savedFarmProfile,
          farm_name: savedFarmProfile.farm_name || savedFarmProfile.name || "your farm",
          crop: savedFarmProfile.crop || "banana",
          inspection_source: "farmer_photo",
          location_source: locationSource === "saved-farm" ? "farmer_confirmed_farm" : locationSource === "device" ? "device_gps_fallback" : "unavailable",
        },
        weatherContext: weather || undefined,
        satelliteContext: satellite?.available ? satellite as unknown as Record<string, unknown> : undefined,
      });

      setResult(decision);
      setReinspectMode(false);
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

  const startReinspection = () => {
    try {
      const raw = localStorage.getItem("vazhaiguard_farm_complete");
      const saved = raw ? JSON.parse(raw) as Record<string, unknown> : null;
      const farmId = String(saved?.farm_id || saved?.farmId || "");
      if (!farmId) {
        setError("Farm ID is missing. Re-save the farm before starting a reinspection.");
        return;
      }
    } catch {
      setError("Farm information could not be read. Please re-save the farm.");
      return;
    }
    setReinspectMode(true);
    setError("");
    inputRef.current?.click();
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

  const hourlyForecast = Array.isArray(next24?.hourly_forecast)
    ? next24.hourly_forecast as Array<Record<string, unknown>>
    : [];

  const chartData = hourlyForecast.map((item, index) => {
    const time = typeof item.time === "string" ? item.time : "";
    const hourMatch = time.match(/T(\d{2}):/);
    const hour = hourMatch ? Number(hourMatch[1]) : index;
    return {
      label: `${String(hour).padStart(2, "0")}:00`,
      rain: Number(item.rain_probability ?? 0),
      gust: Number(item.wind_gust ?? 0),
    };
  });

  const peakRainLabel = formatForecastTime(peakRainTime);
  const peakWindLabel = formatForecastTime(peakGustTime);
  const incidentScore = weatherAlert === "high"
    ? Math.min(98, Math.max(82, Math.round(Math.max(rainProbability, maxWindGust * 1.6))))
    : weatherAlert === "moderate"
      ? Math.min(78, Math.max(52, Math.round(Math.max(rainProbability * 0.8, maxWindGust * 1.25))))
      : Math.max(18, Math.round(Math.max(rainProbability * 0.45, maxWindGust * 0.7)));

  const weatherHeadline =
    maxWindGust >= 45 && rainProbability >= 70
      ? "மழையும் பலத்த காற்றும் சேர்ந்து வரலாம்"
      : maxWindGust >= 45
        ? "பலத்த காற்றுக்கு முன் தயாராகுங்கள்"
        : precipitation >= 15 || rainProbability >= 80
          ? "கனமழைக்கு முன் தயாராகுங்கள்"
          : weatherAlert === "moderate"
            ? "மழை / காற்றை முன்கூட்டியே கவனிக்கவும்"
            : "பெரிய வானிலை ஆபத்து தெரியவில்லை";

  return (
    <div className="min-h-screen bg-[#f3f8f4] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#073b2a] text-[#b8df4b] shadow-[0_10px_30px_rgba(7,59,42,.18)]"><Waves className="h-5 w-5" /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#146c43]">VazhaiGuard AI • Field protection</p><h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#13271d] sm:text-2xl">பண்ணை நிலை & பாதுகாப்பு</h1></div>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/risk-map")} className="rounded-xl border-[#d7e4da] bg-white text-[#264137] shadow-sm">ஆபத்து வரைபடம்</Button><Button variant="outline" onClick={() => navigate("/copilot")} className="rounded-xl border-[#d7e4da] bg-white text-[#264137] shadow-sm">Ask Copilot</Button></div>
        </header>

        {!result && !busy && (
          <div className="mb-5 rounded-[30px] border border-[#d9e8dd] bg-[#073b2a] p-5 text-white shadow-[0_18px_50px_rgba(7,59,42,.14)] sm:p-7">
            <div className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#dff6c0]"><Sparkles className="h-3.5 w-3.5" /> Photo + weather + satellite context</div><h2 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">பயிரை மட்டும் பார்க்காமல்,<br className="hidden sm:block" /> <span className="text-[#b8df4b]">வரப்போகும் ஆபத்தையும் முன்கூட்டியே பார்க்கலாம்.</span></h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">பாதிக்கப்பட்ட இலைப் புகைப்படத்தைச் சேர்க்கவும். AI ஆதாரங்களை இணைத்து, விவசாயிக்கு புரியும் வகையில் என்ன நடக்கலாம், எப்போது, எங்கு, என்ன செய்ய வேண்டும் என்பதை முன்னிலைப்படுத்தும்.</p></div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="overflow-hidden rounded-[30px] border border-[#dce8df] bg-white shadow-[0_12px_40px_rgba(7,59,42,.06)]">
            <div className="border-b border-[#edf2ee] px-5 py-4 sm:px-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">STEP 01</p><h2 className="mt-1 font-bold text-[#13271d]">பயிர் புகைப்படம்</h2></div><div className="rounded-full bg-[#eef7f0] px-3 py-1 text-[10px] font-bold text-[#146c43]">Plant-level evidence</div></div></div>
            <div className="p-5 sm:p-6">
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" className="hidden" onChange={(event) => void chooseImage(event.target.files?.[0])} />
              <div className="group relative overflow-hidden rounded-[24px] border border-[#d8e6dc] bg-[#f7fbf8]">
                {preview ? <><img src={preview} alt="Selected banana crop" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur"><Eye className="h-3 w-3" /> FIELD PHOTO</div><button type="button" onClick={() => inputRef.current?.click()} className="absolute bottom-3 right-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-[#13271d] shadow-lg backdrop-blur">மாற்றவும்</button></> : <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-[4/3] w-full flex-col items-center justify-center p-8 text-center transition hover:bg-[#f0f8f2]"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e5f5e9] text-[#146c43]"><ImagePlus className="h-8 w-8" /></div><p className="mt-4 font-bold text-[#13271d]">இலையை தெளிவாக படம் எடுக்கவும்</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#718078]">பாதிக்கப்பட்ட பகுதியை நெருக்கமாகவும், நல்ல வெளிச்சத்திலும் படம் எடுக்கவும்.</p></button>}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><Button onClick={() => inputRef.current?.click()} className="h-11 rounded-xl bg-[#146c43] shadow-[0_8px_20px_rgba(20,108,67,.18)] hover:bg-[#0f5836]"><Camera className="mr-2 h-4 w-4" /> புகைப்படம் எடுக்கவும்</Button>{preview && <Button onClick={() => void inspect()} disabled={busy} variant="outline" className="h-11 rounded-xl border-[#cfe0d4] bg-white font-semibold">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}{busy ? "சரிபார்க்கிறது..." : "AI சரிபார்ப்பு"}</Button>}</div>
              {busy && <div className="mt-4 rounded-2xl border border-[#d7e8dc] bg-[#f4faf6] p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#146c43]"><Loader2 className="h-4 w-4 animate-spin" /> ஆதாரங்களை இணைக்கிறது...</div><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-[#607269]"><span className="rounded-full bg-white px-2.5 py-1">PHOTO</span><span>→</span><span className="rounded-full bg-white px-2.5 py-1">WEATHER</span><span>→</span><span className="rounded-full bg-white px-2.5 py-1">SATELLITE</span><span>→</span><span className="rounded-full bg-white px-2.5 py-1">DECISION</span></div></div>}
              {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"><TriangleAlert className="mr-2 inline h-4 w-4" />{error}</div>}
            </div>
          </section>

          <section className="space-y-5">
            {result ? (
              <>
                <div className={weatherAlert === "high" ? "relative overflow-hidden rounded-[32px] border border-red-200 bg-gradient-to-br from-[#fff7f6] via-white to-[#ffe9e7] p-5 shadow-[0_20px_55px_rgba(223,75,67,.12)] sm:p-7" : weatherAlert === "moderate" ? "relative overflow-hidden rounded-[32px] border border-amber-200 bg-gradient-to-br from-[#fffaf0] via-white to-[#fff1d1] p-5 shadow-[0_20px_55px_rgba(233,165,36,.10)] sm:p-7" : "relative overflow-hidden rounded-[32px] border border-emerald-200 bg-gradient-to-br from-[#f5fff7] via-white to-[#e6f7eb] p-5 shadow-[0_20px_55px_rgba(35,153,90,.10)] sm:p-7"}>
                  <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/70 blur-2xl" />
                  <div className="relative">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="max-w-2xl"><div className="flex flex-wrap items-center gap-2"><span className={weatherAlert === "high" ? "rounded-full bg-red-100 px-3 py-1 text-[10px] font-bold tracking-wide text-red-700" : weatherAlert === "moderate" ? "rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold tracking-wide text-amber-800" : "rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold tracking-wide text-emerald-700"}>{weatherAlert === "high" ? "ACTION NEEDED" : weatherAlert === "moderate" ? "PREPARE" : "NORMAL"}</span><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#718078]">FARMER ALERT • NEXT 24 HOURS</span></div><h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-[#13271d] sm:text-3xl">{weatherHeadline}</h2><p className="mt-2 text-sm leading-6 text-[#596a60]">உங்கள் பண்ணை பகுதியில் • வானிலை அடிப்படையிலான முன் எச்சரிக்கை</p></div><div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{background: `conic-gradient(${weatherAlert === "high" ? "#df4b43" : weatherAlert === "moderate" ? "#e9a524" : "#23995a"} ${incidentScore * 3.6}deg, #e7eee9 0deg)`}}><div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white shadow-inner"><span className="text-2xl font-bold text-[#13271d]">{incidentScore}</span><span className="text-[8px] font-bold uppercase text-[#718078]">alert index</span></div></div></div>
                    <div className="mt-6 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur"><div className="flex items-center gap-2 text-[#146c43]"><Clock3 className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-wide">எப்போது?</p></div><p className="mt-2 text-sm font-bold text-[#13271d]">{peakRainLabel}</p><p className="mt-1 text-xs text-[#596a60]">மழை வாய்ப்பு {Math.round(rainProbability)}%</p></div><div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur"><div className="flex items-center gap-2 text-[#146c43]"><MapPinned className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-wide">எங்கே?</p></div><p className="mt-2 text-sm font-bold text-[#13271d]">உங்கள் பண்ணை</p><p className="mt-1 text-xs text-[#596a60]">{farmLocationSource === "saved-farm" ? "உறுதிப்படுத்திய பண்ணை இடம்" : "கிடைத்த இடத்தை அடிப்படையாகக் கொண்டு"}</p></div><div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur"><div className="flex items-center gap-2 text-[#146c43]"><Wind className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-wide">காற்று</p></div><p className="mt-2 text-sm font-bold text-[#13271d]">{Math.round(maxWindGust)} km/h gust</p><p className="mt-1 text-xs text-[#596a60]">{maxWindGust >= 30 ? `உச்சம் • ${peakWindLabel}` : "பெரிய காற்று அறிகுறி இல்லை"}</p></div></div>
                    <div className="mt-5 rounded-[24px] bg-[#073b2a] p-4 text-white shadow-[0_12px_30px_rgba(7,59,42,.16)] sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b8df4b]">DO THIS NOW</p><h3 className="mt-1 text-base font-bold">இப்போது என்ன செய்ய வேண்டும்?</h3></div><ArrowUpRight className="h-5 w-5 text-[#b8df4b]" /></div><div className="mt-4 grid gap-2">{stormActions.map((action, index) => <div key={action} className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-3.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b8df4b] text-xs font-black text-[#073b2a]">{index + 1}</span><p className="text-sm leading-6 text-white/90">{action}</p></div>)}</div></div>
                  </div>
                </div>

                {chartData.length > 0 && <div className="rounded-[30px] border border-[#dce8df] bg-white p-5 shadow-[0_12px_40px_rgba(7,59,42,.055)] sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">STORM TIMELINE</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">அடுத்த 24 மணி நேர சம்பவ சாளரம்</h2></div><div className="flex gap-3 text-[10px] font-semibold text-[#718078]"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3184d6]" />மழை வாய்ப்பு</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#e9a524]" />காற்று gust</span></div></div><div className="mt-5 h-56 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3184d6" stopOpacity={0.25} /><stop offset="100%" stopColor="#3184d6" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e8efea" vertical={false} /><XAxis dataKey="label" tick={{fontSize: 9, fill: "#718078"}} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 7))} /><YAxis yAxisId="rain" domain={[0, 100]} tick={{fontSize: 9, fill: "#718078"}} tickLine={false} axisLine={false} width={30} /><YAxis yAxisId="wind" orientation="right" tick={{fontSize: 9, fill: "#718078"}} tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{borderRadius: 14, border: "1px solid #dce8df", boxShadow: "0 12px 30px rgba(7,59,42,.10)", fontSize: 11}} formatter={(value, name) => [`${Math.round(Number(value))}${name === "rain" ? "%" : " km/h"}`, name === "rain" ? "Rain probability" : "Wind gust"]} /><Area yAxisId="rain" type="monotone" dataKey="rain" stroke="#3184d6" strokeWidth={2.5} fill="url(#rainFill)" /><Area yAxisId="wind" type="monotone" dataKey="gust" stroke="#e9a524" strokeWidth={2.5} fill="transparent" /></AreaChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl bg-[#f6faf7] p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Peak rain</p><p className="mt-1 text-sm font-bold text-[#13271d]">{Math.round(rainProbability)}%</p><p className="text-[10px] text-[#718078]">{peakRainLabel}</p></div><div className="rounded-2xl bg-[#f6faf7] p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Rain volume</p><p className="mt-1 text-sm font-bold text-[#13271d]">{precipitation.toFixed(1)} mm</p><p className="text-[10px] text-[#718078]">next 24 hours</p></div><div className="rounded-2xl bg-[#f6faf7] p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Peak gust</p><p className="mt-1 text-sm font-bold text-[#13271d]">{Math.round(maxWindGust)} km/h</p><p className="text-[10px] text-[#718078]">{peakWindLabel}</p></div><div className="rounded-2xl bg-[#f6faf7] p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Location</p><p className="mt-1 text-sm font-bold text-[#13271d]">Farm area</p><p className="text-[10px] text-[#718078]">not row-level</p></div></div></div>}

                <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[26px] border border-[#dce8df] bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><div className="rounded-xl bg-[#eaf4ff] p-2 text-[#3184d6]"><CloudRain className="h-4 w-4" /></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-[#718078]">Weather context</p><h3 className="font-bold text-[#13271d]">மழை நிலை</h3></div></div><div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight text-[#13271d]">{Math.round(rainProbability)}%</span><span className="mb-1 text-xs font-semibold text-[#718078]">chance</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eaf0ec]"><div className="h-full rounded-full bg-[#3184d6]" style={{width: `${Math.min(100, rainProbability)}%`}} /></div><p className="mt-3 text-xs leading-5 text-[#66766d]">{precipitation.toFixed(1)} mm expected across the next 24 hours.</p></div><div className="rounded-[26px] border border-[#dce8df] bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><div className="rounded-xl bg-[#fff5df] p-2 text-[#d28a12]"><Wind className="h-4 w-4" /></div><div><p className="text-[9px] font-bold uppercase tracking-wide text-[#718078]">Wind context</p><h3 className="font-bold text-[#13271d]">காற்று நிலை</h3></div></div><div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight text-[#13271d]">{Math.round(maxWindGust)}</span><span className="mb-1 text-xs font-semibold text-[#718078]">km/h gust</span></div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#66766d]"><span className="h-2 w-2 rounded-full bg-[#e9a524]" />{maxWindGust >= 45 ? "Strong wind preparation needed" : maxWindGust >= 30 ? "Prepare supports" : "No major gust signal"}</div></div></div>

                <details className="rounded-[30px] border border-[#dce8df] bg-white shadow-sm"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#13271d] sm:px-6">AI evidence & technical details <span className="ml-2 text-xs font-normal text-[#718078]">தொழில்நுட்ப விவரங்கள் — தேவையெனில் மட்டும்</span></summary><div className="space-y-5 border-t border-[#edf2ee] p-5 sm:p-6">
                  <div className="rounded-[24px] border border-[#e0e9e2] bg-[#fbfdfb] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#718078]">Visual analysis</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">AI பார்த்தது</h2></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#596a60]">{Math.round(result.vision.visual_confidence * 100)}% confidence</span></div><p className="mt-4 text-sm leading-6 text-[#596a60]">{result.vision.observation}</p><div className="mt-4 flex flex-wrap gap-2">{result.vision.stress_signals.map((signal) => <span key={signal} className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-semibold text-[#146c43]">{signal}</span>)}</div>{result.vision.needs_field_verification && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">இந்த முடிவு களத்தில் சரிபார்க்கப்பட வேண்டும். AI மட்டும் வைத்து நோயை உறுதி செய்ய வேண்டாம்.</div>}<div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718078]">Recommended checks</p><ul className="mt-2 space-y-2">{result.vision.recommended_checks.map((check) => <li key={check} className="flex gap-2 text-sm text-[#596a60]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />{check}</li>)}</ul></div></div>
                  <div className="rounded-[24px] border border-[#e0e9e2] bg-[#fbfdfb] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#718078]">Satellite evidence</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">பண்ணை பகுதி நிலை</h2></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">{satelliteAvailable ? (satelliteCurrentUse ? "REAL SATELLITE" : "REAL SATELLITE • CONTEXT") : "NOT INCLUDED"}</span></div><div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-violet-700"><Satellite className="h-3 w-3" />Sentinel-2 L2A</span><span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600">{farmLocationSource === "saved-farm" ? "Farmer-confirmed farm location" : farmLocationSource === "device" ? "Device GPS fallback" : "Location unavailable"}</span></div>{satelliteEvidence?.available ? <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white p-3 text-center"><p className="text-[10px] text-[#718078]">NDVI</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndvi?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-white p-3 text-center"><p className="text-[10px] text-[#718078]">NDRE</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndre?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-white p-3 text-center"><p className="text-[10px] text-[#718078]">NDWI</p><p className="mt-1 font-bold text-[#13271d]">{satelliteEvidence.ndwi?.toFixed(2) ?? "—"}</p></div><div className="rounded-xl bg-white p-3 text-center"><p className="text-[10px] text-[#718078]">Freshness</p><p className="mt-1 font-bold text-[#13271d]">{satelliteFreshness}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Trend</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.trend || "—"}</p></div><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Latest</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.observation_age_hours != null ? `${Math.max(0, Math.round(satelliteEvidence.observation_age_hours / 24))} days ago` : "—"}</p></div><div className="rounded-xl border border-[#e5ece7] p-3"><p className="text-[10px] font-bold uppercase text-[#718078]">Cloud</p><p className="mt-1 text-sm font-semibold text-[#13271d]">{satelliteEvidence.cloud_percent_mean != null ? `${satelliteEvidence.cloud_percent_mean.toFixed(0)}% scene cloud` : "—"}</p></div></div>{satelliteEvidence.warnings?.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{satelliteEvidence.warnings[0]}</div> : null}</> : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">{satelliteEvidence?.reason || "Satellite evidence was not available. Photo and weather evidence can still be used."}</div>}</div>
                  <div className="grid gap-4 md:grid-cols-2"><div className="rounded-[24px] border border-[#e0e9e2] bg-[#fbfdfb] p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#718078]">Output evaluation</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">Decision quality</h2></div><span className={result.evaluation.grade === "pass" ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : result.evaluation.grade === "review" ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800" : "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"}>{result.evaluation.grade.toUpperCase()}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-3"><p className="text-[9px] uppercase text-[#718078]">Quality</p><p className="mt-1 text-xl font-bold text-[#13271d]">{Math.round(result.evaluation.quality_score * 100)}%</p></div><div className="rounded-xl bg-white p-3"><p className="text-[9px] uppercase text-[#718078]">Verification</p><p className="mt-1 text-sm font-bold text-[#13271d]">{result.evaluation.requires_field_verification ? "Required" : "Not required"}</p></div></div>{result.evaluation.issues.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">{result.evaluation.issues.slice(0, 3).map((issue) => <div key={issue.code}>• {issue.message}</div>)}</div>}</div><div className="rounded-[24px] border border-[#e0e9e2] bg-[#fbfdfb] p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#718078]">Unified risk</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">Evidence mix</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskStyle[result.risk.level]}`}>{result.risk.level} • {result.risk.score}/100</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white p-3 text-center"><p className="text-[9px] text-[#718078]">Photo</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(result.signal_scores.vision)}</p></div><div className="rounded-xl bg-white p-3 text-center"><p className="text-[9px] text-[#718078]">Weather</p><p className="mt-1 font-bold text-[#13271d]">{weatherLoaded ? Math.round(result.signal_scores.weather) : "—"}</p></div><div className="rounded-xl bg-white p-3 text-center"><p className="text-[9px] text-[#718078]">Satellite</p><p className="mt-1 font-bold text-[#13271d]">{satelliteIncluded ? Math.round(result.signal_scores.satellite) : "—"}</p></div></div></div></div>
                  </div>
                </details>

                {result.comparison?.available && (
                  <div className={result.comparison.status === "worsened" ? "rounded-[30px] border border-red-200 bg-red-50 p-5 shadow-sm sm:p-6" : result.comparison.status === "improved" ? "rounded-[30px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6" : "rounded-[30px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6"}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-white/80 p-2"><CheckCircle2 className="h-5 w-5 text-[#146c43]" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">REINSPECTION RESULT</p>
                        <h2 className="mt-1 text-xl font-bold text-[#13271d]">{result.comparison.headline}</h2>
                        <p className="mt-2 text-sm leading-6 text-[#596a60]">{result.comparison.summary}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#146c43]">{result.comparison.status}</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/80 p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Risk change</p><p className="mt-1 text-lg font-black text-[#13271d]">{result.comparison.risk.change == null ? "—" : `${result.comparison.risk.change > 0 ? "+" : ""}${result.comparison.risk.change}`}</p><p className="text-[10px] text-[#718078]">previous → current</p></div>
                      <div className="rounded-2xl bg-white/80 p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">New signals</p><p className="mt-1 text-sm font-bold text-[#13271d]">{result.comparison.signals.new.length ? result.comparison.signals.new.slice(0, 2).join(", ") : "None detected"}</p></div>
                      <div className="rounded-2xl bg-white/80 p-3"><p className="text-[9px] font-bold uppercase text-[#718078]">Cleared</p><p className="mt-1 text-sm font-bold text-[#13271d]">{result.comparison.signals.cleared.length ? result.comparison.signals.cleared.slice(0, 2).join(", ") : "None yet"}</p></div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-[#073b2a] p-3.5 text-sm leading-6 text-white"><span className="font-bold text-[#b8df4b]">NEXT:</span> {result.comparison.next_step}</div>
                  </div>
                )}

                <div className="rounded-[30px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">FIELD INCIDENT</p>
                      <h2 className="mt-1 text-xl font-bold text-[#13271d]">{result.incident.incident.replaceAll("_", " ")}</h2>
                      <p className="mt-1 text-sm text-[#66766d]">{result.incident.where} • {result.incident.severity.toUpperCase()}</p>
                    </div>
                    <span className="rounded-full bg-[#eef7f0] px-3 py-1 text-[10px] font-bold text-[#146c43]">ACTION PLAN</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {result.incident.actions.map((item) => <div key={`${item.priority}-${item.action}`} className="rounded-2xl border border-[#e5ece7] bg-[#f8fbf8] p-3.5">
                      <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#073b2a] text-xs font-black text-white">{item.priority}</span><div><p className="text-sm font-bold text-[#13271d]">{item.action}</p><p className="mt-1 text-xs text-[#66766d]">WHEN: {item.when}</p><p className="mt-1 text-xs text-[#66766d]">WHERE: {item.where}</p></div></div>
                    </div>)}
                  </div>
                  {result.incident.field_verification_required && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-bold text-amber-900">ஒரு முறை கூடுதல் களச் சரிபார்ப்பு தேவை</p><p className="mt-1 text-xs leading-5 text-amber-800">புதிய புகைப்படம் மூலம் முடிவை மீண்டும் சரிபார்க்கலாம்.</p></div>
                    <Button onClick={startReinspection} className="rounded-xl bg-amber-700 text-white hover:bg-amber-800">மீண்டும் சரிபார்க்கவும்</Button>
                  </div>}
                  {result.inspection_storage?.stored && <p className="mt-3 text-[10px] font-semibold text-[#718078]">✓ Inspection evidence securely stored in S3 and linked to farm history.</p>}
                </div>

                <div className="rounded-[30px] bg-[#073b2a] p-5 text-white shadow-[0_18px_45px_rgba(7,59,42,.16)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#b8df4b]">AI FIELD DECISION</p><h2 className="mt-1 text-xl font-bold">பண்ணைக்கு அடுத்த செயல்</h2></div><div className="rounded-xl bg-white/10 p-2"><ShieldAlert className="h-5 w-5 text-[#b8df4b]" /></div></div><p className="mt-4 text-sm leading-6 text-white/85">{result.decision.summary}</p><div className="mt-4 space-y-2">{result.decision.priority_actions.map((item) => <div key={`${item.priority}-${item.action}`} className="rounded-2xl border border-white/10 bg-white/10 p-3.5"><p className="text-xs font-bold">{item.priority}. {item.action}</p><p className="mt-1 text-[11px] leading-5 text-white/65">{item.reason}</p></div>)}</div>{result.decision.follow_up_check && <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs leading-5 text-white/80">களச் சரிபார்ப்பு: {result.decision.follow_up_check}</p>}<div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button onClick={speakAdvice} variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"><Volume2 className="mr-2 h-4 w-4" />{isSpeaking ? "Speaking..." : "தமிழில் கேளுங்கள்"}</Button><Button onClick={() => navigate("/risk-map")} variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20">Farm risk map <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></div>
              </>
            ) : busy ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[32px] border border-[#dce8df] bg-white p-8 text-center shadow-sm"><div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#e7f1ea]"><div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#146c43]" /><Activity className="h-8 w-8 text-[#146c43]" /></div><h2 className="mt-6 text-xl font-bold text-[#13271d]">பண்ணையை புரிந்துகொள்கிறேன்...</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#718078]">புகைப்பட அறிகுறி, வானிலை முன்னறிவிப்பு, satellite context மற்றும் safety checks ஒன்றாக மதிப்பிடப்படுகின்றன.</p></div>
            ) : (
              <div className="flex min-h-[520px] flex-col justify-center rounded-[32px] border border-[#dce8df] bg-white p-6 shadow-sm sm:p-8"><div className="rounded-[28px] bg-[#f6faf7] p-6"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f2fc] text-[#3184d6]"><CloudRain className="h-4 w-4" /></div><p className="mt-3 text-sm font-bold text-[#13271d]">வானிலை</p><p className="mt-1 text-xs leading-5 text-[#718078]">மழை / காற்று வருவதற்கு முன் எச்சரிக்கை.</p></div><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1eafd] text-violet-600"><Satellite className="h-4 w-4" /></div><p className="mt-3 text-sm font-bold text-[#13271d]">Satellite</p><p className="mt-1 text-xs leading-5 text-[#718078]">பண்ணை பகுதி அளவிலான ஆதாரம்.</p></div><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f5ec] text-[#146c43]"><ShieldAlert className="h-4 w-4" /></div><p className="mt-3 text-sm font-bold text-[#13271d]">Action</p><p className="mt-1 text-xs leading-5 text-[#718078]">என்ன செய்ய வேண்டும் என்பதை முதலில் காட்டும்.</p></div></div><div className="mt-6 rounded-2xl border border-dashed border-[#c8dbce] bg-white p-5 text-center"><p className="text-sm font-bold text-[#13271d]">முதலில் ஒரு புகைப்படத்தைச் சேர்க்கவும்</p><p className="mt-1 text-xs text-[#718078]">பின்னர் “AI சரிபார்ப்பு” அழுத்துங்கள்.</p></div></div></div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

}
