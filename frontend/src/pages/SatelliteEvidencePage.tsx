import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Cloud, Leaf, MapPin, RefreshCw, Satellite, ShieldCheck, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { getSatelliteEvidence, getSatellitePreview, type SatelliteEvidence } from "../services/satelliteApi";

type FarmLocation = {
  latitude: number;
  longitude: number;
  boundary?: Record<string, unknown>;
};

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
    return {
      latitude,
      longitude,
      boundary: boundary && typeof boundary === "object" ? boundary as Record<string, unknown> : undefined,
    };
  } catch {
    return null;
  }
}

function formatMetric(value: number | null | undefined, suffix = "") {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}${suffix}`;
}

function formatAge(hours: number | null | undefined) {
  if (hours == null || !Number.isFinite(hours)) return "Not reported";
  if (hours < 24) return `${Math.max(0, Math.round(hours))} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function trendLabel(trend?: string) {
  switch (trend) {
    case "improving": return "Improving";
    case "declining": return "Declining";
    case "stable": return "Stable";
    case "insufficient_history": return "Building baseline";
    default: return trend || "Not available";
  }
}

export default function SatelliteEvidencePage() {
  const navigate = useNavigate();
  const [location] = useState<FarmLocation | null>(() => readSavedFarmLocation());
  const [evidence, setEvidence] = useState<SatelliteEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const refreshEvidence = async () => {
    if (!location || loading) return;
    setLoading(true);
    setError("");
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    try {
      const result = await getSatelliteEvidence({
        latitude: location.latitude,
        longitude: location.longitude,
        boundary: location.boundary,
        lookbackDays: 45,
        baselineDays: 45,
        maxCloudPercent: 35,
      });
      setEvidence(result);
      try {
        localStorage.setItem("vazhaiguard_last_satellite_evidence", JSON.stringify(result));
        localStorage.setItem("vazhaiguard_last_satellite_evidence_at", new Date().toISOString());
      } catch {
        // Evidence remains usable for the current session if local storage is unavailable.
      }
    } catch (err) {
      setEvidence(null);
      setError(err instanceof Error ? err.message : "Satellite evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!location || previewLoading) return;
    setPreviewLoading(true);
    setError("");
    try {
      const url = await getSatellitePreview({
        latitude: location.latitude,
        longitude: location.longitude,
        boundary: location.boundary,
        lookbackDays: 45,
        baselineDays: 45,
        maxCloudPercent: 35,
      });
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Satellite preview is not available.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const metrics = [
    { label: "Vegetation · NDVI", value: formatMetric(evidence?.ndvi), icon: Leaf, note: "Greenness signal" },
    { label: "Red-edge · NDRE", value: formatMetric(evidence?.ndre), icon: Activity, note: "Vegetation response" },
    { label: "Water · NDWI", value: formatMetric(evidence?.ndwi), icon: Waves, note: "Surface moisture signal" },
    { label: "Cloud cover", value: formatMetric(evidence?.cloud_percent_mean, "%"), icon: Cloud, note: "Scene quality" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl text-[#596a60] hover:bg-[#eaf3ec] hover:text-[#073b2a]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#dce8df] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#146c43]">
          <span className="h-2 w-2 rounded-full bg-[#22a35a]" /> Evidence workspace
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#073b2a] via-[#0b4d36] to-[#146c43] p-6 text-white shadow-[0_22px_65px_rgba(7,59,42,0.16)] sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#b8df4b]/15 blur-3xl" />
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c6e77b]">
              <Satellite className="h-3.5 w-3.5" /> Sentinel-2 · Farm-scale intelligence
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">See the farm beyond the leaf.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Review vegetation, moisture, observation age and image quality from the latest available satellite evidence.
            </p>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-white/55">
              Satellite observations are periodic, not live video. They support farm-level context and do not diagnose individual plants.
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
            {location ? (
              <p className="mt-3 text-[11px] tabular-nums text-white/55">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-white/60">Complete farm setup and confirm the location to request satellite evidence.</p>
            )}
            <Button onClick={refreshEvidence} disabled={!location || loading} className="mt-4 min-h-11 w-full rounded-xl bg-[#b8df4b] font-bold text-[#073b2a] hover:bg-[#c9ed6a] disabled:opacity-50">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Updating evidence…" : "Refresh satellite evidence"}
            </Button>
          </div>
        </div>
      </section>

      {!location && (
        <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-950">Confirm your farm location first</p><p className="mt-1 text-xs leading-5 text-amber-800">We won't substitute an unconfirmed location for your farm boundary.</p></div></div>
          <Button onClick={() => navigate("/farm/location")} className="rounded-xl bg-[#073b2a] text-white hover:bg-[#0b4d36]">Set farm location</Button>
        </div>
      )}

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</div>}

      {evidence && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return <div key={metric.label} className="rounded-[24px] border border-[#dce8df] bg-white p-5 shadow-[0_8px_30px_rgba(7,59,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(7,59,42,0.08)]">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#718078]">{metric.label}</p><p className="mt-3 text-3xl font-black tracking-tight text-[#13271d]">{metric.value}</p><p className="mt-1 text-[11px] text-[#718078]">{metric.note}</p></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#146c43]"><Icon className="h-5 w-5" /></div></div>
              </div>;
            })}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">Observation profile</p><h2 className="mt-1 text-xl font-bold text-[#13271d]">What the satellite can tell us</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Context across the farm, not a diagnosis for one plant.</p></div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${evidence.available ? "bg-[#eaf5ec] text-[#146c43]" : "bg-amber-50 text-amber-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${evidence.available ? "bg-[#22a35a]" : "bg-amber-500"}`} />{evidence.available ? "Evidence available" : "Evidence unavailable"}</span>
              </div>
              {evidence.available ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Vegetation trend</p><p className="mt-2 text-lg font-bold text-[#13271d]">{trendLabel(evidence.trend)}</p><p className="mt-1 text-xs leading-5 text-[#718078]">Baseline NDVI: {formatMetric(evidence.baseline_ndvi)}</p></div>
                  <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Latest observation</p><p className="mt-2 text-lg font-bold text-[#13271d]">{formatAge(evidence.observation_age_hours)}</p><p className="mt-1 text-xs leading-5 text-[#718078]">{evidence.latest_observation || evidence.observed_at || "Acquisition date not reported"}</p></div>
                  <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Farm footprint</p><p className="mt-2 text-lg font-bold text-[#13271d]">{evidence.farm_geometry?.area_acres != null ? `${evidence.farm_geometry.area_acres.toFixed(2)} acres` : "Area not reported"}</p><p className="mt-1 text-xs leading-5 text-[#718078]">{evidence.farm_geometry?.is_farmer_confirmed ? "Farmer-confirmed boundary" : evidence.farm_geometry?.source || "Geometry source not reported"}</p></div>
                  <div className="rounded-2xl bg-[#f6faf7] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Signal confidence</p><p className="mt-2 text-lg font-bold text-[#13271d]">{evidence.confidence == null ? "Not reported" : `${Math.round(evidence.confidence * 100)}%`}</p><p className="mt-1 text-xs leading-5 text-[#718078]">Confidence depends on scene quality and available history.</p></div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">No usable satellite observation</p><p className="mt-1 text-xs leading-5 text-amber-800">{evidence.reason || "The provider did not return a suitable scene. Other evidence sources can still be used."}</p></div>
              )}
              {evidence.warnings?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Evidence notes</p><ul className="mt-2 space-y-1">{evidence.warnings.slice(0, 4).map((warning) => <li key={warning} className="text-xs leading-5 text-amber-800">• {warning}</li>)}</ul></div> : null}
            </div>

            <div className="rounded-[28px] border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">Satellite imagery</p><h2 className="mt-1 text-xl font-bold text-[#13271d]">Farm preview</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7f0] text-[#146c43]"><Satellite className="h-5 w-5" /></div></div>
              <p className="mt-2 text-xs leading-5 text-[#718078]">Preview availability depends on provider coverage, cloud conditions and the saved farm geometry.</p>
              {previewUrl ? <img src={previewUrl} alt="Satellite preview of the confirmed farm area" className="mt-4 aspect-[4/3] w-full rounded-2xl border border-[#dce8df] bg-[#f6faf7] object-cover" /> : <div className="mt-4 flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c8dbce] bg-[#f6faf7] p-5 text-center"><Satellite className="h-8 w-8 text-[#8da698]" /><p className="mt-3 text-sm font-bold text-[#13271d]">Imagery preview</p><p className="mt-1 text-xs leading-5 text-[#718078]">Load the available scene when you're ready.</p></div>}
              <Button onClick={loadPreview} disabled={!location || previewLoading} variant="outline" className="mt-4 min-h-11 w-full rounded-xl border-[#c8dbce] text-[#0b4d36] hover:bg-[#eef7f0]">
                <Satellite className={`mr-2 h-4 w-4 ${previewLoading ? "animate-pulse" : ""}`} />{previewLoading ? "Loading imagery…" : "Load farm preview"}
              </Button>
            </div>
          </section>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dce8df] bg-white p-4 text-xs leading-5 text-[#66766d]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" /><p><strong className="text-[#13271d]">Evidence guardrail:</strong> Satellite indicators describe farm-scale vegetation and moisture context. They are periodic observations, not live video, and must not override a newer farmer photo when the sources conflict.</p></div>
        </>
      )}

      {!evidence && !loading && location && !error && (
        <section className="mt-5 rounded-[28px] border border-[#dce8df] bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#eef7f0] text-[#146c43]"><Satellite className="h-7 w-7" /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">Ready when you are</p><h2 className="mt-1 text-xl font-bold text-[#13271d]">Load your farm's latest evidence</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">We'll use the saved farm location and boundary, then show what was available, how recent it is, and whether scene quality limits confidence.</p></div>
          </div>
          <Button onClick={refreshEvidence} disabled={loading} className="mt-5 rounded-xl bg-[#0b4d36] text-white hover:bg-[#146c43]"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Loading evidence…" : "Load satellite evidence"}</Button>
        </section>
      )}
    </div>
  );
}
