import { useState } from "react";
import { ArrowLeft, AlertTriangle, FlaskConical, MapPin, RefreshCw, ShieldCheck, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { getSoilEvidence, type SoilEvidence } from "../services/soilApi";

type FarmLocation = { latitude: number; longitude: number };

function readSavedFarmLocation(): FarmLocation | null {
  try {
    const raw = localStorage.getItem("vazhaiguard_farm_complete");
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const location = saved.location as Record<string, unknown> | undefined;
    if (!location) return null;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function metric(value: number | null | undefined, suffix = "", digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}${suffix}`;
}

export default function SoilEvidencePage() {
  const navigate = useNavigate();
  const [location] = useState<FarmLocation | null>(() => readSavedFarmLocation());
  const [evidence, setEvidence] = useState<SoilEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!location || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await getSoilEvidence(location.latitude, location.longitude);
      setEvidence(result);
      try {
        localStorage.setItem("vazhaiguard_last_soil_evidence", JSON.stringify(result));
        localStorage.setItem("vazhaiguard_last_soil_evidence_at", new Date().toISOString());
      } catch {
        // The current result remains available even when browser storage is disabled.
      }
    } catch (err) {
      setEvidence({ available: false, reason: err instanceof Error ? err.message : "Soil evidence could not be loaded." });
      setError(err instanceof Error ? err.message : "Soil evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const properties = [
    { key: "phh2o", label: "Soil pH", value: metric(evidence?.properties?.phh2o, "", 2), unit: "pH estimate", note: "Acidity / alkalinity context" },
    { key: "soc", label: "Organic carbon", value: metric(evidence?.properties?.soc, " g/kg"), unit: "Modelled estimate", note: "Organic matter context" },
    { key: "clay", label: "Clay fraction", value: metric(evidence?.properties?.clay, "%"), unit: "Texture", note: "Water-holding context" },
    { key: "sand", label: "Sand fraction", value: metric(evidence?.properties?.sand, "%"), unit: "Texture", note: "Drainage context" },
    { key: "cec", label: "CEC", value: metric(evidence?.properties?.cec, " cmol(+)/kg"), unit: "Estimated capacity", note: "Nutrient-retention context" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl text-[#596a60] hover:bg-[#eaf3ec] hover:text-[#073b2a]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#dce8df] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#146c43]">
          <span className="h-2 w-2 rounded-full bg-[#22a35a]" /> Soil context workspace
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#073b2a] via-[#0b4d36] to-[#146c43] p-6 text-white shadow-[0_22px_65px_rgba(7,59,42,0.16)] sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#b8df4b]/15 blur-3xl" />
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c6e77b]">
              <Sprout className="h-3.5 w-3.5" /> ISRIC SoilGrids · Coarse soil context
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Understand the soil beneath the farm.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Review modelled soil pH, texture, organic carbon and nutrient-retention context for the saved farm location.
            </p>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-white/55">
              These estimates are roughly 250 m scale, not a soil-lab result or a live sensor. Use a local soil test before making fertilizer or treatment decisions.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8df4b] text-[#073b2a]"><MapPin className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/60">Farm location</p>
                <p className="mt-1 text-sm font-semibold">{location ? "Saved farm coordinates" : "Farm location needed"}</p>
              </div>
            </div>
            {location ? <p className="mt-3 text-[11px] tabular-nums text-white/55">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p> : <p className="mt-3 text-xs leading-5 text-white/60">Complete farm setup and confirm the farm location before requesting soil context.</p>}
            <Button onClick={refresh} disabled={!location || loading} className="mt-4 min-h-11 w-full rounded-xl bg-[#b8df4b] font-bold text-[#073b2a] hover:bg-[#c9ed6a] disabled:opacity-50">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading soil context…" : "Refresh soil evidence"}
            </Button>
          </div>
        </div>
      </section>

      {!location && <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-950">Confirm your farm location first</p><p className="mt-1 text-xs leading-5 text-amber-800">We use the saved farm location; this page does not silently substitute device GPS.</p></div></div>
        <Button onClick={() => navigate("/farm/location")} className="rounded-xl bg-[#073b2a] text-white hover:bg-[#0b4d36]">Set farm location</Button>
      </div>}

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</div>}

      {evidence && <>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((item) => <div key={item.key} className="rounded-[24px] border border-[#dce8df] bg-white p-5 shadow-[0_8px_30px_rgba(7,59,42,0.045)]">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#718078]">{item.label}</p><p className="mt-3 text-3xl font-black tracking-tight text-[#13271d]">{evidence.available ? item.value : "—"}</p><p className="mt-1 text-[11px] text-[#718078]">{item.note}</p></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#146c43]"><FlaskConical className="h-5 w-5" /></div></div>
          </div>)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">Soil profile</p><h2 className="mt-1 text-xl font-bold text-[#13271d]">What the model estimates</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Useful environmental context alongside farmer observations, weather and satellite signals.</p></div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${evidence.available ? "bg-[#eaf5ec] text-[#146c43]" : "bg-amber-50 text-amber-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${evidence.available ? "bg-[#22a35a]" : "bg-amber-500"}`} />{evidence.available ? "Evidence available" : "Evidence unavailable"}</span>
            </div>
            {evidence.available ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Model and depth</p><p className="mt-2 text-lg font-bold text-[#13271d]">{evidence.source || "SoilGrids"}</p><p className="mt-1 text-xs leading-5 text-[#718078]">Depth: {evidence.depth || "not reported"} · Approx. resolution: {evidence.resolution_m ?? "not reported"} m</p></div>
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Contextual risk index</p><p className="mt-2 text-lg font-bold text-[#13271d]">{evidence.risk_score == null ? "Not calculated" : `${Math.round(evidence.risk_score)}/100`}</p><p className="mt-1 text-xs leading-5 text-[#718078]">Heuristic context only; not a disease score or fertilizer prescription.</p></div>
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Model confidence</p><p className="mt-2 text-lg font-bold text-[#13271d]">{evidence.confidence == null ? "Not reported" : `${Math.round(evidence.confidence * 100)}%`}</p><p className="mt-1 text-xs leading-5 text-[#718078]">Conservative estimate reflecting coarse modelled evidence.</p></div>
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Evidence use</p><p className="mt-2 text-lg font-bold text-[#13271d]">Supporting signal</p><p className="mt-1 text-xs leading-5 text-[#718078]">Soil is weighted conservatively and cannot override a fresh plant photo.</p></div>
            </div> : <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">No usable soil estimate</p><p className="mt-1 text-xs leading-5 text-amber-800">{evidence.reason || "The provider did not return usable values. Photo, weather and satellite evidence can still be used."}</p></div>}
            {evidence.warnings?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Important limitations</p><ul className="mt-2 space-y-1">{evidence.warnings.slice(0, 5).map((warning) => <li key={warning} className="text-xs leading-5 text-amber-800">• {warning}</li>)}</ul></div> : null}
          </div>

          <div className="rounded-[28px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">Decision safety</p><h2 className="mt-1 text-xl font-bold text-[#13271d]">Use soil context responsibly</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7f0] text-[#146c43]"><ShieldCheck className="h-5 w-5" /></div></div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-sm font-bold text-[#13271d]">Use it to add context</p><p className="mt-1 text-xs leading-5 text-[#718078]">Texture and pH estimates can help explain conditions, but do not establish the cause of a visible crop symptom.</p></div>
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-sm font-bold text-[#13271d]">Confirm with a soil test</p><p className="mt-1 text-xs leading-5 text-[#718078]">For fertilizer, pH correction or treatment decisions, use a representative local soil sample and qualified agricultural guidance.</p></div>
              <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-sm font-bold text-[#13271d]">Missing data is not a failure</p><p className="mt-1 text-xs leading-5 text-[#718078]">If the public provider is unavailable, the system keeps the other evidence sources active rather than inventing soil values.</p></div>
            </div>
          </div>
        </section>
      </>}

      {!evidence && !loading && location && <div className="mt-5 rounded-[24px] border border-dashed border-[#c8dbce] bg-white p-8 text-center"><Sprout className="mx-auto h-9 w-9 text-[#8da698]" /><h2 className="mt-3 text-lg font-bold text-[#13271d]">Soil evidence has not been requested yet</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[#718078]">Refresh soil evidence to load the available modelled profile for your saved farm coordinates.</p></div>}

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dce8df] bg-[#f6faf7] p-4 text-xs leading-5 text-[#596a60]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" /><p>SoilGrids is a global predictive dataset, not a measurement of your exact field. Soil values may vary within a farm. This feature provides context only and must not be used alone to prescribe fertilizer, pesticide or fungicide dosage.</p></div>
    </div>
  );
}
