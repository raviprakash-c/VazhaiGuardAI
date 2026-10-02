import { CheckCircle2, Clock3, CloudSun, Sprout } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useWeather } from "../hooks/useWeather";
import { getWeatherActionPlan } from "../services/planApi";
import { Button } from "../components/ui/button";

export default function ActionPlanPage() {
  const navigate = useNavigate();
  const { weather, isLoadingWeather, weatherError } = useWeather();

  const plan = useMemo(() => {
    if (!weather) return null;
    return getWeatherActionPlan(weather);
  }, [weather]);

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
              VazhaiGuard AI
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d]">Action plan</h1>
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
            <CloudSun className="mx-auto h-10 w-10 text-[#146c43]" />
            <h2 className="mt-4 text-xl font-bold text-[#13271d]">Weather plan is waiting for live data</h2>
            <p className="mt-2 text-sm text-[#718078]">
              Connect your location from the dashboard to generate a weather-based action plan.
            </p>
          </div>
        )}

        {isLoadingWeather && (
          <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center text-sm text-[#718078]">
            Building farmer action plan...
          </div>
        )}

        {weatherError && (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {weatherError}
          </div>
        )}

        {plan && (
          <div className="space-y-5">
            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#146c43]">
                  <Sprout className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">Farmer guidance</p>
                  <h2 className="text-xl font-bold text-[#13271d]">{plan.summary}</h2>
                  <p className="mt-1 text-sm text-[#596a60]">{plan.summaryTa}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {plan.steps.map((step) => (
                <div key={`${step.category}-${step.title}`} className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    {step.category === "before" ? (
                      <Clock3 className="h-4 w-4 text-[#146c43]" />
                    ) : step.category === "during" ? (
                      <CloudSun className="h-4 w-4 text-[#146c43]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-[#146c43]" />
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                      {step.category === "before" ? "Before weather" : step.category === "during" ? "During weather" : "After weather"}
                    </p>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-[#13271d]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[#596a60]">{step.titleTa}</p>

                  <p className="mt-3 text-sm leading-6 text-[#596a60]">{step.description}</p>
                  <p className="mt-2 text-xs leading-5 text-[#718078]">{step.descriptionTa}</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
