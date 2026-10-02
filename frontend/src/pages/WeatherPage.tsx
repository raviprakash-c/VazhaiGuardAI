import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  Leaf,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  //Sprout,
  ThermometerSun,
  Wind,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useWeather } from "../hooks/useWeather";
//import type { WeatherData } from "../types/weather";

import {
  getWeatherIntelligence,
  type WeatherInsight,
  type WeatherRiskLevel,
} from "../utils/weatherIntelligence";

type Language = "en" | "ta";

type SavedFarm = {
  location?: {
    latitude?: number;
    longitude?: number;
    label?: string;
  };

  farm_profile?: {
    farm_name?: string;
    banana_variety?: string;
    planting_age?: string;
    approximate_plants?: number;
  };

  parcel_metadata?: {
    district?: string;
    taluk?: string;
    village?: string;
  };
};

function readSavedFarm(): SavedFarm | null {
  try {
    const raw = localStorage.getItem(
      "vazhaiguard_farm_complete"
    );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SavedFarm;
  } catch {
    return null;
  }
}

function formatDirection(
  degrees: number
): string {
  const directions = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];

  const normalized =
    ((degrees % 360) + 360) % 360;

  return directions[
    Math.round(normalized / 45) % 8
  ];
}

function formatTime(
  value: string,
  timezone: string
): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  try {
    return parsed.toLocaleString(
      "en-IN",
      {
        timeZone:
          timezone || undefined,
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      }
    );
  } catch {
    return parsed.toLocaleString(
      "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }
}

function riskStyle(
  level: WeatherRiskLevel
) {
  switch (level) {
    case "danger":
      return {
        card: "border-red-200 bg-red-50",
        icon: "bg-red-100 text-red-700",
        badge:
          "bg-red-100 text-red-700",
        bar: "bg-red-500",
      };

    case "warning":
      return {
        card:
          "border-orange-200 bg-orange-50",
        icon:
          "bg-orange-100 text-orange-700",
        badge:
          "bg-orange-100 text-orange-700",
        bar: "bg-orange-500",
      };

    case "watch":
      return {
        card:
          "border-yellow-200 bg-yellow-50",
        icon:
          "bg-yellow-100 text-yellow-700",
        badge:
          "bg-yellow-100 text-yellow-700",
        bar: "bg-yellow-500",
      };

    default:
      return {
        card:
          "border-green-200 bg-green-50",
        icon:
          "bg-green-100 text-green-700",
        badge:
          "bg-green-100 text-green-700",
        bar: "bg-green-500",
      };
  }
}

function riskLabel(
  level: WeatherRiskLevel,
  language: Language
) {
  if (language === "ta") {
    switch (level) {
      case "danger":
        return "மிகவும் கவனம்";

      case "warning":
        return "எச்சரிக்கை";

      case "watch":
        return "கவனிக்கவும்";

      default:
        return "சாதாரணம்";
    }
  }

  switch (level) {
    case "danger":
      return "High attention";

    case "warning":
      return "Warning";

    case "watch":
      return "Watch";

    default:
      return "Normal";
  }
}

function InsightCard({
  insight,
  language,
}: {
  insight: WeatherInsight;
  language: Language;
}) {
  const style =
    riskStyle(insight.level);

  const Icon =
    insight.type === "rain"
      ? CloudRain
      : insight.type === "wind"
        ? Wind
        : insight.type === "heat"
          ? ThermometerSun
          : Droplets;

  const title =
    language === "ta"
      ? insight.titleTa
      : insight.title;

  const message =
    language === "ta"
      ? insight.messageTa
      : insight.message;

  const action =
    language === "ta"
      ? insight.actionTa
      : insight.action;

  return (
    <div
      className={`rounded-[24px] border p-5 ${style.card}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-[#13271d]">
              {title}
            </h4>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
            >
              {riskLabel(
                insight.level,
                language
              )}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-[#596a60]">
            {message}
          </p>

          <div className="mt-4 rounded-xl bg-white/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#718078]">
              {language === "ta"
                ? "விவசாயி செய்ய வேண்டியது"
                : "Recommended action"}
            </p>

            <p className="mt-1 text-sm font-semibold leading-5 text-[#13271d]">
              {action}
            </p>
          </div>

          {insight.value && (
            <p className="mt-3 text-xs font-bold text-[#146c43]">
              {insight.value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0]">
        <Icon className="h-5 w-5 text-[#146c43]" />
      </div>

      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#718078]">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight text-[#13271d]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-[#718078]">
        {helper}
      </p>
    </div>
  );
}

export default function WeatherPage() {
  const navigate = useNavigate();

  const {
    weather,
    isLoadingWeather,
    weatherError,
    fetchWeather,
    refreshWeather,
  } = useWeather();

  const [farm, setFarm] =
    useState<SavedFarm | null>(null);

  const [language, setLanguage] =
    useState<Language>("ta");

  const [locationError, setLocationError] =
    useState("");

  useEffect(() => {
    setFarm(readSavedFarm());
  }, []);

  const latitude =
    farm?.location?.latitude;

  const longitude =
    farm?.location?.longitude;

  const farmName =
    farm?.farm_profile?.farm_name ||
    "Your registered farm";

  const variety =
    farm?.farm_profile?.banana_variety ||
    "Banana farm";

  const village =
    farm?.parcel_metadata?.village;

  const district =
    farm?.parcel_metadata?.district;

  const locationText = [
    village,
    district,
  ]
    .filter(Boolean)
    .join(", ");

  const loadWeather =
    useCallback(
      async (
        forceRefresh = false
      ) => {
        setLocationError("");

        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          setLocationError(
            "Registered farm coordinates are not available."
          );

          return;
        }

        if (forceRefresh) {
          await refreshWeather(
            latitude,
            longitude
          );
        } else {
          await fetchWeather(
            latitude,
            longitude
          );
        }
      },
      [
        latitude,
        longitude,
        fetchWeather,
        refreshWeather,
      ]
    );

  useEffect(() => {
    if (
      typeof latitude === "number" &&
      typeof longitude === "number"
    ) {
      void loadWeather();
    }
  }, [
    latitude,
    longitude,
    loadWeather,
  ]);

  const intelligence =
    useMemo(() => {
      if (!weather) {
        return null;
      }

      return getWeatherIntelligence(
        weather
      );
    }, [weather]);

  const currentDirection =
    weather
      ? formatDirection(
          weather.current
            .wind_direction
        )
      : "—";

  const peakGustTime =
    weather?.next_24_hours
      .peak_gust_time
      ? formatTime(
          weather.next_24_hours
            .peak_gust_time,
          weather.location.timezone
        )
      : "—";

  const displayError =
    locationError ||
    weatherError;

  const text =
    language === "ta"
      ? {
          back: "பின்செல்",
          title: "வானிலை நுண்ணறிவு",
          live: "நேரடி வானிலை",
          refresh: "வானிலையை புதுப்பிக்கவும்",
          updating: "புதுப்பிக்கிறது...",
          current: "தற்போதைய வானிலை",
          next24: "அடுத்த 24 மணி நேரம்",
          temperature: "வெப்பநிலை",
          rain: "மழை",
          wind: "காற்றின் வேகம்",
          gust: "காற்று வேகம்",
          rainProbability:
            "மழை வாய்ப்பு",
          rainfall:
            "எதிர்பார்க்கப்படும் மழைப்பொழிவு",
          maxWind:
            "அதிகபட்ச காற்று",
          maxGust:
            "அதிகபட்ச காற்று அலை",
          actions:
            "விவசாயி செய்ய வேண்டியவை",
          system:
            "செயலாக்க நிலை",
          connected:
            "இணைக்கப்பட்டுள்ளது",
          processed:
            "தரவு செயலாக்கப்பட்டது",
          backend:
            "Backend வானிலை தரவு",
        }
      : {
          back: "Back",
          title: "Farm Weather Intelligence",
          live: "Live weather",
          refresh: "Refresh weather",
          updating: "Updating...",
          current: "Current weather",
          next24: "Next 24 hours",
          temperature: "Temperature",
          rain: "Rain now",
          wind: "Wind speed",
          gust: "Current gust",
          rainProbability:
            "Rain probability",
          rainfall:
            "Expected precipitation",
          maxWind:
            "Maximum wind",
          maxGust:
            "Maximum gust",
          actions:
            "Recommended farmer actions",
          system:
            "System status",
          connected:
            "Connected",
          processed:
            "Data processed",
          backend:
            "Backend weather data",
        };

  return (
    <div className="min-h-screen bg-[#f4f9f5]">
      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">

        {/* TOP BAR */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
                navigate(-1)
              }
              className="h-10 rounded-xl border-[#dfe9e2] bg-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {text.back}
            </Button>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                VazhaiGuard AI
              </p>

              <h1 className="text-xl font-bold text-[#13271d] sm:text-2xl">
                {text.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-[#dfe9e2] bg-white p-1">
              <button
                onClick={() =>
                  setLanguage("ta")
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  language === "ta"
                    ? "bg-[#073b2a] text-white"
                    : "text-[#718078]"
                }`}
              >
                தமிழ்
              </button>

              <button
                onClick={() =>
                  setLanguage("en")
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  language === "en"
                    ? "bg-[#073b2a] text-white"
                    : "text-[#718078]"
                }`}
              >
                English
              </button>
            </div>

            {weather && (
              <div className="flex items-center gap-2 rounded-xl border border-[#dfe9e2] bg-white px-3 py-2 text-xs text-[#637269]">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {text.live}
              </div>
            )}

            <Button
              onClick={() =>
                void loadWeather(true)
              }
              disabled={isLoadingWeather}
              variant="outline"
              className="h-10 rounded-xl border-[#cfe0d4] bg-white text-[#146c43]"
            >
              {isLoadingWeather ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}

              {isLoadingWeather
                ? text.updating
                : text.refresh}
            </Button>
          </div>
        </div>

        {/* HERO */}
        <section className="overflow-hidden rounded-[32px] bg-[#073b2a] shadow-[0_25px_80px_rgba(7,59,42,0.18)]">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#b8df4b]" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                    {text.live}
                  </span>
                </div>

                <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  {language === "ta"
                    ? "உங்கள் வயலுக்கு புரியும் வானிலை."
                    : "Weather your farm can understand."}
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                  {language === "ta"
                    ? "VazhaiGuard நேரடி வானிலை தரவை விவசாயிக்கு புரியும் எளிய தகவலாக மாற்றுகிறது."
                    : "VazhaiGuard converts live weather data into simple farmer-facing information."}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                    {farmName}
                  </span>

                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                    {variety}
                  </span>

                  {locationText && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {locationText}
                    </span>
                  )}
                </div>
              </div>

              {/* INTELLIGENCE STATUS */}
              <div className="rounded-[28px] border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                  {language === "ta"
                    ? "வானிலை நிலை"
                    : "Weather status"}
                </p>

                {intelligence ? (
                  <>
                    <h3 className="mt-3 text-2xl font-bold text-white">
                      {language === "ta"
                        ? intelligence.titleTa
                        : intelligence.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-white/60">
                      {language === "ta"
                        ? intelligence.summaryTa
                        : intelligence.summary}
                    </p>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#b8df4b] px-3 py-1.5 text-xs font-bold text-[#073b2a]">
                      <ShieldCheck className="h-4 w-4" />
                      {riskLabel(
                        intelligence.overallLevel,
                        language
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-white/60">
                    {language === "ta"
                      ? "வானிலை தரவை ஏற்றுகிறது..."
                      : "Loading weather intelligence..."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {displayError && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-bold">
                {language === "ta"
                  ? "வானிலை சேவையில் சிக்கல்"
                  : "Weather service issue"}
              </p>

              <p className="mt-1">
                {displayError}
              </p>
            </div>
          </div>
        )}

        {/* NO LOCATION */}
        {!latitude ||
        !longitude ? (
          <section className="mt-6 rounded-[28px] border border-[#dfe9e2] bg-white p-8 text-center shadow-sm">
            <MapPin className="mx-auto h-10 w-10 text-[#146c43]" />

            <h3 className="mt-4 text-xl font-bold text-[#13271d]">
              {language === "ta"
                ? "முதலில் பண்ணை இருப்பிடத்தை உறுதிப்படுத்தவும்"
                : "Farm location is required"}
            </h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#718078]">
              {language === "ta"
                ? "உங்கள் பண்ணையின் இருப்பிடம் சேமிக்கப்பட்ட பிறகு நேரடி வானிலையை பெற முடியும்."
                : "Save your registered farm location before loading live weather."}
            </p>

            <Button
              onClick={() =>
                navigate(
                  "/farm/location"
                )
              }
              className="mt-5 rounded-xl bg-[#073b2a] text-white"
            >
              {language === "ta"
                ? "பண்ணை இருப்பிடம்"
                : "Confirm farm location"}
            </Button>
          </section>
        ) : null}

        {/* LOADING */}
        {isLoadingWeather &&
          !weather && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="h-40 animate-pulse rounded-[24px] bg-white"
                  />
                )
              )}
            </div>
          )}

        {weather && (
          <>
            {/* CURRENT WEATHER */}
            <section className="mt-6">
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                  {text.current}
                </p>

                <h3 className="mt-1 text-2xl font-bold text-[#13271d]">
                  {farmName}
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={ThermometerSun}
                  label={text.temperature}
                  value={`${weather.current.temperature.toFixed(1)}°C`}
                  helper={
                    language === "ta"
                      ? "பண்ணை அருகிலுள்ள தற்போதைய வெப்பநிலை."
                      : "Current air temperature near the farm."
                  }
                />

                <MetricCard
                  icon={Droplets}
                  label={text.rain}
                  value={`${weather.current.rain.toFixed(1)} mm`}
                  helper={
                    language === "ta"
                      ? "தற்போதைய மழைப்பொழிவு."
                      : "Current rainfall."
                  }
                />

                <MetricCard
                  icon={Wind}
                  label={text.wind}
                  value={`${weather.current.wind_speed.toFixed(1)} km/h`}
                  helper={
                    language === "ta"
                      ? `${currentDirection} திசையில் காற்று.`
                      : `Wind from ${currentDirection}.`
                  }
                />

                <MetricCard
                  icon={Gauge}
                  label={text.gust}
                  value={`${weather.current.wind_gust.toFixed(1)} km/h`}
                  helper={
                    language === "ta"
                      ? "தற்போதைய அதிகபட்ச காற்று வேகம்."
                      : "Current wind gust."
                  }
                />
              </div>
            </section>

            {/* INTELLIGENCE */}
            {intelligence && (
              <section className="mt-8">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                      AI farm intelligence
                    </p>

                    <h3 className="mt-1 text-2xl font-bold text-[#13271d]">
                      {language === "ta"
                        ? "விவசாயிக்கு முக்கியமான தகவல்"
                        : "What should the farmer know?"}
                    </h3>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {intelligence.insights.map(
                    (insight, index) => (
                      <InsightCard
                        key={`${insight.type}-${index}`}
                        insight={insight}
                        language={language}
                      />
                    )
                  )}
                </div>
              </section>
            )}

            {/* 24 HOURS */}
            <section className="mt-8 rounded-[30px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0]">
                  <CloudSun className="h-5 w-5 text-[#146c43]" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                    {text.next24}
                  </p>

                  <h3 className="text-xl font-bold text-[#13271d]">
                    {language === "ta"
                      ? "அடுத்த 24 மணி நேர முன்னறிவிப்பு"
                      : "Forecast around your farm"}
                  </h3>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={CloudRain}
                  label={text.rainProbability}
                  value={`${Math.round(
                    weather.next_24_hours
                      .max_rain_probability
                  )}%`}
                  helper={
                    language === "ta"
                      ? "அதிகபட்ச மழை வாய்ப்பு."
                      : "Highest rain probability."
                  }
                />

                <MetricCard
                  icon={Droplets}
                  label={text.rainfall}
                  value={`${weather.next_24_hours.total_precipitation.toFixed(1)} mm`}
                  helper={
                    language === "ta"
                      ? "எதிர்பார்க்கப்படும் மழைப்பொழிவு."
                      : "Expected precipitation."
                  }
                />

                <MetricCard
                  icon={Wind}
                  label={text.maxWind}
                  value={`${weather.next_24_hours.max_wind_speed.toFixed(1)} km/h`}
                  helper={
                    language === "ta"
                      ? "அதிகபட்ச காற்றின் வேகம்."
                      : "Maximum wind speed."
                  }
                />

                <MetricCard
                  icon={Gauge}
                  label={text.maxGust}
                  value={`${weather.next_24_hours.max_wind_gust.toFixed(1)} km/h`}
                  helper={
                    language === "ta"
                      ? "அதிகபட்ச காற்று அலை."
                      : "Maximum wind gust."
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#073b2a] p-5 text-white">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-[#b8df4b]" />

                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      {language === "ta"
                        ? "அதிக காற்று நேரம்"
                        : "Peak gust timing"}
                    </p>
                  </div>

                  <p className="mt-3 text-2xl font-bold">
                    {peakGustTime}
                  </p>

                  <p className="mt-2 text-xs text-white/55">
                    {weather.next_24_hours.max_wind_gust.toFixed(
                      1
                    )}{" "}
                    km/h
                  </p>
                </div>

                <div className="rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-5">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-[#146c43]" />

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#718078]">
                      {text.actions}
                    </p>
                  </div>

                  <p className="mt-3 text-lg font-bold text-[#13271d]">
                    {language === "ta"
                      ? "வானிலையை பார்த்து வயல் பணியை திட்டமிடுங்கள்."
                      : "Plan field work using the weather signal."}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-[#718078]">
                    {language === "ta"
                      ? "இந்த தகவல் விவசாய முடிவுகளுக்கு உதவும் விழிப்புணர்வு கருவியாகும்."
                      : "This is a decision-support awareness signal, not a crop-damage prediction."}
                  </p>
                </div>
              </div>
            </section>

            {/* PIPELINE */}
            <section className="mt-8 rounded-[30px] bg-[#073b2a] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8df4b]">
                  <CheckCircle2 className="h-5 w-5 text-[#073b2a]" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8df4b]">
                    {text.system}
                  </p>

                  <h3 className="text-xl font-bold">
                    {language === "ta"
                      ? "VazhaiGuard செயலாக்க ஓட்டம்"
                      : "VazhaiGuard processing flow"}
                  </h3>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {[
                  language === "ta"
                    ? "📍 பண்ணை இருப்பிடம்"
                    : "📍 Farm location",

                  language === "ta"
                    ? "🌦️ Weather API"
                    : "🌦️ Weather API",

                  language === "ta"
                    ? "🧠 Intelligence"
                    : "🧠 Intelligence",

                  language === "ta"
                    ? "👨‍🌾 Farmer Action"
                    : "👨‍🌾 Farmer Action",
                ].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="rounded-2xl bg-white/[0.07] p-4"
                    >
                      <p className="text-xs font-bold">
                        {index + 1}. {item}
                      </p>

                      <p className="mt-2 text-[11px] text-[#b8df4b]">
                        {text.connected}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* DATA SOURCE */}
            <section className="mt-6 rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[#637269]">
                  <ShieldCheck className="h-4 w-4 text-[#146c43]" />

                  <span>
                    {text.backend}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-[#849188]">
                  <span>
                    Lat:{" "}
                    {weather.location.latitude.toFixed(
                      4
                    )}
                  </span>

                  <span>
                    Lon:{" "}
                    {weather.location.longitude.toFixed(
                      4
                    )}
                  </span>

                  <span>
                    {weather.location.timezone}
                  </span>

                  <span>
                    {formatTime(
                      weather.current.time,
                      weather.location.timezone
                    )}
                  </span>
                </div>
              </div>
            </section>

            <p className="mx-auto mt-6 max-w-4xl text-center text-[11px] leading-5 text-[#849188]">
              {language === "ta"
                ? "VazhaiGuard வானிலை தரவை விவசாய முடிவுகளுக்கான விழிப்புணர்வு தகவலாக மாற்றுகிறது. இது சரிபார்க்கப்பட்ட பயிர் சேத முன்னறிவிப்பு மாதிரி அல்ல."
                : "VazhaiGuard converts weather data into decision-support information for farmers. It is not a validated crop-damage prediction model."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}