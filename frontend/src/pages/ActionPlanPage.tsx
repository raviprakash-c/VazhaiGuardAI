import {
  CheckCircle2,
  CheckSquare2,
  Clock3,
  CloudSun,
  ListChecks,
  PlayCircle,
  Sprout,
  Volume2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useWeather } from "../hooks/useWeather";
import { getWeatherActionPlan } from "../services/planApi";
import { Button } from "../components/ui/button";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import type { FarmerActionItem } from "../types/plan";

const priorityStyles = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-[#dfe9e2] bg-[#f5fbf7] text-[#146c43]",
};

const urgencyLabel = {
  now: "Do now",
  today: "Today",
  monitor: "Monitor",
  normal: "Normal",
};

export default function ActionPlanPage() {
  const navigate = useNavigate();
  const { weather, isLoadingWeather, weatherError } = useWeather();
  const { isSpeaking, speak, cancelSpeech } = useVoiceAssistant();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const plan = useMemo(() => {
    if (!weather) return null;
    return getWeatherActionPlan(weather);
  }, [weather]);

  const decision = plan?.decision;
  const weatherData = weather?.next_24_hours ?? {
    max_rain_probability: 0,
    total_precipitation: 0,
    max_wind_gust: 0,
  };

  const toggleAction = (action: FarmerActionItem) => {
    setCompleted((current) => ({
      ...current,
      [action.id]: !current[action.id],
    }));
  };

  const readPlan = () => {
    if (!decision) return;
    cancelSpeech();
    const firstActions = decision.actions
      .slice(0, 3)
      .map((item, index) => `${index + 1}. ${item.titleTa}. ${item.reasonTa}`)
      .join(" ");
    speak(`${decision.headlineTa}. ${decision.explanationTa}. ${firstActions}`, "ta-IN");
  };

  return (
    <div className="min-h-screen bg-[#f5fbf7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
              VazhaiGuard AI • Decision Engine
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#13271d] sm:text-3xl">
              Farmer Action Plan
            </h1>
            <p className="mt-1 text-sm text-[#718078]">
              Turn live weather signals into a simple field checklist.
            </p>
          </div>

          <div className="flex gap-2">
            {decision && (
              <Button
                variant="outline"
                onClick={readPlan}
                className="rounded-xl border-[#dfe9e2] bg-white"
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {isSpeaking ? "Speaking..." : "Read in Tamil"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border-[#dfe9e2] bg-white"
            >
              Back
            </Button>
          </div>
        </div>

        {!weather && !isLoadingWeather && !weatherError && (
          <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center shadow-sm">
            <CloudSun className="mx-auto h-10 w-10 text-[#146c43]" />
            <h2 className="mt-4 text-xl font-bold text-[#13271d]">Weather plan is waiting for live data</h2>
            <p className="mt-2 text-sm text-[#718078]">
              Connect your location from the dashboard to generate the farmer action plan.
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

        {plan && decision && (
          <div className="space-y-5">
            <section className="rounded-[28px] border border-[#dfe9e2] bg-[#073b2a] p-6 text-white shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#b8df4b] text-[#073b2a]">
                    <Sprout className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {decision.status === "attention" ? "Attention" : decision.status === "monitor" ? "Monitor" : "Favorable"}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {urgencyLabel[decision.urgency]}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold sm:text-2xl">{decision.headline}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/75">{decision.explanation}</p>
                    <p className="mt-2 text-sm leading-6 text-[#dff0c4]">{decision.headlineTa}</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">{decision.explanationTa}</p>
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl bg-white/[0.08] px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">Decision confidence</p>
                  <p className="mt-1 text-lg font-bold">{decision.confidence}</p>
                  <p className="text-[10px] text-white/55">weather signals</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Rain chance</p>
                <p className="mt-1 text-2xl font-bold text-[#13271d]">{Math.round(weatherData.max_rain_probability)}%</p>
              </div>
              <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Expected rain</p>
                <p className="mt-1 text-2xl font-bold text-[#13271d]">{weatherData.total_precipitation.toFixed(1)} mm</p>
              </div>
              <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">Peak gust</p>
                <p className="mt-1 text-2xl font-bold text-[#13271d]">{weatherData.max_wind_gust.toFixed(0)} km/h</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#146c43]">
                    <ListChecks className="h-5 w-5" />
                    <p className="text-sm font-bold">What the farmer should do</p>
                  </div>
                  <p className="mt-1 text-xs text-[#718078]">Start from the top. Mark each action when it is completed.</p>
                </div>
                <span className="text-xs font-semibold text-[#718078]">
                  {decision.actions.filter((item) => completed[item.id]).length}/{decision.actions.length} completed
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {decision.actions.map((item) => {
                  const isDone = Boolean(completed[item.id]);
                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl border p-4 transition ${isDone ? "border-[#cfe2d5] bg-[#f5fbf7] opacity-70" : "border-[#dfe9e2] bg-white"}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleAction(item)}
                          className="mt-0.5 shrink-0 text-[#146c43]"
                          aria-label={isDone ? "Mark action incomplete" : "Mark action complete"}
                        >
                          {isDone ? <CheckSquare2 className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${priorityStyles[item.priority]}`}>
                              {item.priority}
                            </span>
                            <span className="rounded-full bg-[#f2f5f3] px-2.5 py-1 text-[10px] font-bold text-[#596a60]">
                              {urgencyLabel[item.urgency]}
                            </span>
                          </div>

                          <h3 className={`mt-2 text-base font-bold text-[#13271d] ${isDone ? "line-through" : ""}`}>
                            {item.title}
                          </h3>
                          <p className="mt-0.5 text-sm font-semibold text-[#146c43]">{item.titleTa}</p>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-[#f8fbf9] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">Why</p>
                              <p className="mt-1 text-xs leading-5 text-[#596a60]">{item.reason}</p>
                              <p className="mt-1 text-xs leading-5 text-[#718078]">{item.reasonTa}</p>
                            </div>
                            <div className="rounded-xl bg-[#f8fbf9] p-3">
                              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]"><Clock3 className="h-3 w-3" /> When</p>
                              <p className="mt-1 text-xs leading-5 text-[#596a60]">{item.timing}</p>
                              <p className="mt-1 text-xs leading-5 text-[#718078]">{item.timingTa}</p>
                            </div>
                            <div className="rounded-xl bg-[#f8fbf9] p-3">
                              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]"><PlayCircle className="h-3 w-3" /> Check</p>
                              <p className="mt-1 text-xs leading-5 text-[#596a60]">{item.resource}</p>
                              <p className="mt-1 text-xs leading-5 text-[#718078]">{item.resourceTa}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#eef7f0] p-2 text-[#146c43]">
                  <CloudSun className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#13271d]">Use this plan with Copilot</h2>
                  <p className="mt-1 text-sm leading-6 text-[#596a60]">
                    Ask the farmer assistant what to do first, why an action matters, or what to check after the weather window. The latest decision plan is saved locally so the Copilot can use it as context.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#718078]">
                    "முதலில் நான் என்ன செய்ய வேண்டும்?" என்று கேட்டு தொடங்கலாம்.
                  </p>
                  <Button
                    onClick={() => navigate("/copilot")}
                    className="mt-4 rounded-xl bg-[#073b2a] hover:bg-[#0a4d38]"
                  >
                    <Volume2 className="mr-2 h-4 w-4" />
                    Ask Farmer Copilot
                  </Button>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-center gap-2 pb-4 text-[10px] text-[#718078]">
              {completed && Object.values(completed).some(Boolean) ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#146c43]" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Weather source: Open-Meteo • Plan generated from current 24-hour signals
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
