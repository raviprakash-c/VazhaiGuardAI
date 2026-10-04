import { Camera, CheckCircle2, ImagePlus, Loader2, MapPinned, ShieldAlert, Volume2, CloudRain, Satellite } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { inspectAndDecide, type InspectAndDecideResult } from "../services/multimodalApi";
import { getWeather } from "../services/weatherApi";

type WeatherContext = Record<string, unknown>;

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

async function loadNearbyWeather(): Promise<WeatherContext | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const weather = await getWeather(
            position.coords.latitude,
            position.coords.longitude,
          );
          resolve(weather as unknown as WeatherContext);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
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
      const weather = await loadNearbyWeather();
      setWeatherLoaded(Boolean(weather));

      const decision = await inspectAndDecide({
        imageDataUrl,
        language: "ta-IN",
        zoneId: "field-photo",
        farmContext: { crop: "banana", inspection_source: "farmer_photo" },
        weatherContext: weather || undefined,
        satelliteContext: undefined,
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
    if (!result) return;
    speak(result.action, "ta-IN");
  };

  const satelliteAvailable = result?.risk.signals_used.includes("satellite") ?? false;

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">VazhaiGuard AI • Multimodal Field Check</p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">பயிர் புகைப்படம் சரிபார்ப்பு</h1>
            <p className="mt-1 text-sm text-[#718078]">புகைப்படம் + வானிலை + கிடைக்கும் பண்ணை/செயற்கைக்கோள் ஆதாரங்களை ஒன்றாக வைத்து AI முடிவை உருவாக்குகிறது.</p>
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

            <div className="mt-5 overflow-hidden rounded-2xl border border-dashed border-[#b9cfc0] bg-[#f8fbf9]">
              {preview ? <img src={preview} alt="Selected banana crop" className="aspect-[4/3] w-full object-cover" /> : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center p-8 text-center">
                  <ImagePlus className="h-10 w-10 text-[#146c43]" />
                  <p className="mt-3 font-semibold text-[#13271d]">புகைப்படம் இன்னும் எடுக்கப்படவில்லை</p>
                  <p className="mt-1 text-xs text-[#718078]">Camera அல்லது gallery பயன்படுத்தலாம்.</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => inputRef.current?.click()} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]"><Camera className="mr-2 h-4 w-4" /> Take / choose photo</Button>
              {preview && <Button onClick={() => void inspect()} disabled={busy} variant="outline" className="rounded-xl border-[#cfe2d5] bg-white">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}{busy ? "Checking photo + evidence..." : "Inspect with AI"}</Button>}
            </div>

            {busy && <div className="mt-4 rounded-2xl border border-[#dfe9e2] bg-[#f8fbf9] p-4 text-sm text-[#596a60]"><p className="font-semibold text-[#13271d]">பல ஆதாரங்களை இணைக்கிறேன்...</p><p className="mt-1">புகைப்படம் → வானிலை → கிடைக்கும் satellite evidence → risk → Ministral 8B farmer action</p></div>}
            {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </section>

          <section className="space-y-5">
            {!result && !busy && <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><MapPinned className="mt-1 h-5 w-5 text-[#146c43]" /><div><h2 className="font-bold text-[#13271d]">Evidence fusion</h2><p className="mt-2 text-sm leading-6 text-[#596a60]">புகைப்படம் செடியின் கண்ணுக்குத் தெரியும் அறிகுறிகளைத் தருகிறது. வானிலை வெளிப்புற அழுத்தத்தைச் சொல்கிறது. உண்மையான satellite signal கிடைத்தால் அது தனியாக மூன்றாவது evidence ஆக சேர்க்கப்படும். கிடைக்காத ஆதாரத்தை AI ஒருபோதும் உருவாக்காது.</p></div></div></div>}

            {result && <>
              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Visual analysis</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">AI பார்த்தது</h2></div><span className="rounded-full border border-[#dfe9e2] px-3 py-1 text-[10px] font-bold text-[#596a60]">{Math.round(result.vision.visual_confidence * 100)}% confidence</span></div>
                <p className="mt-4 text-sm leading-6 text-[#596a60]">{result.vision.observation}</p>
                <div className="mt-4 flex flex-wrap gap-2">{result.vision.stress_signals.map((signal) => <span key={signal} className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-semibold text-[#146c43]">{signal}</span>)}</div>
                {result.vision.needs_field_verification && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">இந்த முடிவு களத்தில் சரிபார்க்கப்பட வேண்டும். AI மட்டும் வைத்து நோயை உறுதி செய்ய வேண்டாம்.</div>}
                <div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718078]">Recommended checks</p><ul className="mt-2 space-y-2">{result.vision.recommended_checks.map((check) => <li key={check} className="flex gap-2 text-sm text-[#596a60]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />{check}</li>)}</ul></div>
              </div>

              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Unified risk engine</p><h2 className="mt-1 text-lg font-bold text-[#13271d]">Evidence-fused farmer action</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskStyle[result.risk.level]}`}>{result.risk.level} • {result.risk.score}/100</span></div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Photo</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(result.signal_scores.vision)}</p></div>
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Weather</p><p className="mt-1 font-bold text-[#13271d]">{weatherLoaded ? Math.round(result.signal_scores.weather) : "—"}</p></div>
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Satellite</p><p className="mt-1 font-bold text-[#13271d]">{satelliteAvailable ? Math.round(result.signal_scores.satellite) : "—"}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${weatherLoaded ? "bg-sky-50 text-sky-700" : "bg-slate-50 text-slate-500"}`}><CloudRain className="h-3 w-3" />{weatherLoaded ? "Live weather included" : "Weather unavailable"}</span><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${satelliteAvailable ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-500"}`}><Satellite className="h-3 w-3" />{satelliteAvailable ? "Satellite included" : "Satellite not supplied"}</span></div>
                <div className="mt-4 rounded-2xl bg-[#073b2a] p-4 text-white">
                  <p className="text-sm font-semibold leading-6">{result.decision.summary}</p>
                  <div className="mt-3 space-y-2">{result.decision.priority_actions.map((item) => <div key={`${item.priority}-${item.action}`} className="rounded-xl bg-white/10 p-3"><p className="text-xs font-bold">{item.priority}. {item.action}</p><p className="mt-1 text-[11px] leading-5 text-white/70">{item.reason}</p></div>)}</div>
                  {result.decision.follow_up_check && <p className="mt-3 text-xs leading-5 text-white/80">களச் சரிபார்ப்பு: {result.decision.follow_up_check}</p>}
                  {result.decision.recheck_after && <p className="mt-1 text-xs leading-5 text-white/80">மீண்டும் பார்க்க: {result.decision.recheck_after}</p>}
                  <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3 text-sm leading-6">{result.action}</div>
                  <Button onClick={speakAdvice} variant="outline" className="mt-3 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"><Volume2 className="mr-2 h-4 w-4" /> {isSpeaking ? "Speaking..." : "தமிழில் கேளுங்கள்"}</Button>
                </div>
                <p className="mt-3 text-[10px] text-[#718078]">Decision model: {result.decision_model} • Signals: {result.risk.signals_used.join(", ") || "none"}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button onClick={() => navigate("/copilot")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]">Continue with Copilot</Button><Button onClick={() => navigate("/risk-map")} variant="outline" className="rounded-xl border-[#dfe9e2] bg-white">View farm risk map</Button></div>
              </div>
            </>}
          </section>
        </div>
      </div>
    </div>
  );
}
