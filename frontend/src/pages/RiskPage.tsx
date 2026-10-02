import { AlertTriangle, CloudRain, ShieldCheck, Wind } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useWeather } from "../hooks/useWeather";
import { getWeatherDerivedRisk } from "../services/riskApi";
import { Button } from "../components/ui/button";

export default function RiskPage() {
  const navigate = useNavigate();
  const { weather, isLoadingWeather, weatherError } = useWeather();

  const risk = useMemo(() => {
    if (!weather) return null;
    return getWeatherDerivedRisk(weather);
  }, [weather]);

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
              VazhaiGuard AI
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d]">Weather Risk</h1>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border-[#dfe9e2] bg-white"
          >
            Back to dashboard
          </Button>
        </div>

        {!weather && !isLoadingWeather && !weatherError && (
          <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-10 w-10 text-[#146c43]" />
            <h2 className="mt-4 text-xl font-bold text-[#13271d]">Weather data is not available yet</h2>
            <p className="mt-2 text-sm text-[#718078]">
              Use the dashboard to get your farm location and load live weather before checking risk.
            </p>
          </div>
        )}

        {isLoadingWeather && (
          <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center text-sm text-[#718078]">
            Loading weather risk...
          </div>
        )}

        {weatherError && (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {weatherError}
          </div>
        )}

        {risk && (
          <div className="space-y-5">
            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                    Risk level
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-[#13271d]">{risk.label}</h2>
                  <p className="mt-2 text-sm text-[#596a60]">{risk.labelTa}</p>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#146c43]">
                  {risk.level === "high" ? <AlertTriangle className="h-7 w-7" /> : risk.level === "moderate" ? <Wind className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#718078]">Why this matters</p>
                <p className="mt-2 text-base font-medium text-[#13271d]">{risk.reason}</p>
                <p className="mt-1 text-sm text-[#596a60]">{risk.reasonTa}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#718078]">Recommended action</p>
                <p className="mt-2 text-base font-medium text-[#13271d]">{risk.recommendation}</p>
                <p className="mt-1 text-sm text-[#596a60]">{risk.recommendationTa}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#146c43]">
                  <CloudRain className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">Weather evidence</p>
                  <h3 className="text-xl font-bold text-[#13271d]">Forecast signals</h3>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {risk.evidence.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#718078]">{item.label}</p>
                    <p className="mt-2 text-lg font-bold text-[#13271d]">{item.value}</p>
                    <p className="mt-1 text-xs text-[#596a60]">{item.labelTa}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
