import { Camera, CheckCircle2, ImagePlus, Loader2, MapPinned, ShieldAlert, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { fuseRisk, inspectCropImage, type CropInspectionResult, type RiskFusionResult } from "../services/multimodalApi";

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

export default function CropInspectionPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [inspection, setInspection] = useState<CropInspectionResult | null>(null);
  const [risk, setRisk] = useState<RiskFusionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { speak, isSpeaking } = useVoiceAssistant();

  const chooseImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a plant or leaf photo.");
      return;
    }
    try {
      setError("");
      setInspection(null);
      setRisk(null);
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
      const result = await inspectCropImage({
        imageDataUrl,
        language: "ta-IN",
        zoneId: "field-photo",
      });
      setInspection(result);

      const fused = await fuseRisk({
        vision: result.vision,
        zoneId: result.zone_id || "field-photo",
        language: "ta-IN",
      });
      setRisk(fused);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed. Check the backend and Bedrock access.");
    } finally {
      setBusy(false);
    }
  };

  const speakAdvice = () => {
    if (!risk) return;
    speak(risk.action, "ta-IN");
  };

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">VazhaiGuard AI • Multimodal Field Check</p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">பயிர் புகைப்படம் சரிபார்ப்பு</h1>
            <p className="mt-1 text-sm text-[#718078]">ஒரு இலை அல்லது வாழை மரத்தின் தெளிவான புகைப்படத்தை எடுத்து, AI மூலம் தெரியும் அறிகுறிகளைச் சரிபார்க்கவும்.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/copilot")} className="rounded-xl border-[#dfe9e2] bg-white">Ask Copilot</Button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2 text-[#146c43]">
              <Camera className="h-5 w-5" />
              <h2 className="font-bold">Step 1 • Take a field photo</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#596a60]">முடிந்தால் முழு செடியை விட, பாதிக்கப்பட்ட இலை அல்லது பகுதியை நெருக்கமாகவும் தெளிவாகவும் படம் எடுக்கவும்.</p>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              capture="environment"
              className="hidden"
              onChange={(event) => void chooseImage(event.target.files?.[0])}
            />

            <div className="mt-5 overflow-hidden rounded-2xl border border-dashed border-[#b9cfc0] bg-[#f8fbf9]">
              {preview ? (
                <img src={preview} alt="Selected banana crop" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center p-8 text-center">
                  <ImagePlus className="h-10 w-10 text-[#146c43]" />
                  <p className="mt-3 font-semibold text-[#13271d]">புகைப்படம் இன்னும் எடுக்கப்படவில்லை</p>
                  <p className="mt-1 text-xs text-[#718078]">Camera அல்லது gallery பயன்படுத்தலாம்.</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => inputRef.current?.click()} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]">
                <Camera className="mr-2 h-4 w-4" /> Take / choose photo
              </Button>
              {preview && (
                <Button onClick={() => void inspect()} disabled={busy} variant="outline" className="rounded-xl border-[#cfe2d5] bg-white">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                  {busy ? "Checking..." : "Inspect with AI"}
                </Button>
              )}
            </div>

            {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </section>

          <section className="space-y-5">
            {!inspection && !busy && (
              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <MapPinned className="mt-1 h-5 w-5 text-[#146c43]" />
                  <div>
                    <h2 className="font-bold text-[#13271d]">Why a photo?</h2>
                    <p className="mt-2 text-sm leading-6 text-[#596a60]">Weather and farm-level signals tell us where risk may be. The photo gives the multimodal model plant-level visual evidence. The final decision combines evidence instead of relying on one signal.</p>
                  </div>
                </div>
              </div>
            )}

            {busy && (
              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center shadow-sm">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#146c43]" />
                <p className="mt-3 font-semibold text-[#13271d]">படத்தை ஆய்வு செய்கிறேன்...</p>
                <p className="mt-1 text-xs text-[#718078]">Visual evidence → risk → farmer action</p>
              </div>
            )}

            {inspection && (
              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Visual analysis</p>
                    <h2 className="mt-1 text-lg font-bold text-[#13271d]">AI பார்த்தது</h2>
                  </div>
                  <span className="rounded-full border border-[#dfe9e2] px-3 py-1 text-[10px] font-bold text-[#596a60]">{Math.round(inspection.vision.visual_confidence * 100)}% confidence</span>
                </div>

                <p className="mt-4 text-sm leading-6 text-[#596a60]">{inspection.vision.observation}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {inspection.vision.stress_signals.map((signal) => <span key={signal} className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-semibold text-[#146c43]">{signal}</span>)}
                </div>

                {inspection.vision.needs_field_verification && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">இந்த முடிவு களத்தில் சரிபார்க்கப்பட வேண்டும். AI மட்டும் வைத்து நோயை உறுதி செய்ய வேண்டாம்.</div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718078]">Recommended checks</p>
                  <ul className="mt-2 space-y-2">
                    {inspection.vision.recommended_checks.map((check) => <li key={check} className="flex gap-2 text-sm text-[#596a60]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />{check}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {risk && (
              <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Unified risk engine</p>
                    <h2 className="mt-1 text-lg font-bold text-[#13271d]">Farmer action</h2>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskStyle[risk.risk.level]}`}>{risk.risk.level} • {risk.risk.score}/100</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Photo</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(risk.signal_scores.vision)}</p></div>
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Weather</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(risk.signal_scores.weather)}</p></div>
                  <div className="rounded-xl bg-[#f8fbf9] p-3 text-center"><p className="text-[10px] text-[#718078]">Satellite</p><p className="mt-1 font-bold text-[#13271d]">{Math.round(risk.signal_scores.satellite)}</p></div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#073b2a] p-4 text-white">
                  <p className="text-sm leading-6">{risk.action}</p>
                  <Button onClick={speakAdvice} variant="outline" className="mt-3 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <Volume2 className="mr-2 h-4 w-4" /> {isSpeaking ? "Speaking..." : "தமிழில் கேளுங்கள்"}
                  </Button>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => navigate("/copilot")} className="rounded-xl bg-[#146c43] hover:bg-[#0f5836]">Continue with Copilot</Button>
                  <Button onClick={() => navigate("/risk")} variant="outline" className="rounded-xl border-[#dfe9e2] bg-white">View farm risk map</Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
