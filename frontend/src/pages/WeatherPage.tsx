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
  Sprout,
  Wind,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useWeather } from "../hooks/useWeather";
import type { WeatherData } from "../types/weather";


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
    survey_number?: string;
    subdivision?: string | null;
  };
};


type FarmProfileStore = {
  profile?: {
    farm_summary?: {
      farm_name?: string;
      crop?: string;
      variety?: string;
      planting_age?: string;
      approximate_plants?: number | null;
    };
  };
};


type WeatherWatch = {
  level:
    | "calm"
    | "active"
    | "strong";

  label: string;
  title: string;
  summary: string;

  className: string;
  iconClassName: string;

  Icon: typeof CloudSun;
};


function readSavedFarm(): SavedFarm | null {
  try {
    const raw =
      localStorage.getItem(
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


function readAiProfile(): FarmProfileStore | null {
  try {
    const raw =
      localStorage.getItem(
        "vazhaiguard_ai_profile"
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as FarmProfileStore;
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

  const index =
    Math.round(
      normalized / 45
    ) % 8;

  return directions[index];
}


function formatWeatherTime(
  value: string,
  timezone: string
): string {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
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


function getWeatherWatch(
  weather: WeatherData | null
): WeatherWatch {
  if (!weather) {
    return {
      level: "calm",
      label: "Waiting for weather",
      title:
        "Connect your registered farm location",
      summary:
        "VazhaiGuard needs the saved farm coordinates before it can read live weather conditions.",
      className:
        "border-[#dfe9e2] bg-[#f8faf8]",
      iconClassName:
        "bg-[#edf7ef] text-[#146c43]",
      Icon: MapPin,
    };
  }

  const rain =
    weather.next_24_hours
      .max_rain_probability;

  const rainfall =
    weather.next_24_hours
      .total_precipitation;

  const gust =
    weather.next_24_hours
      .max_wind_gust;

  if (
    rain >= 85 ||
    rainfall >= 20 ||
    gust >= 45
  ) {
    return {
      level: "strong",
      label: "Strong weather watch",
      title:
        "Conditions need closer attention",
      summary:
        "The next 24 hours show stronger rain or wind-gust conditions. This is a weather signal for closer monitoring, not a crop-damage prediction.",
      className:
        "border-[#efc4c0] bg-[#fff8f7]",
      iconClassName:
        "bg-[#fde8e6] text-[#c13c34]",
      Icon: AlertTriangle,
    };
  }

  if (
    rain >= 50 ||
    rainfall >= 8 ||
    gust >= 25
  ) {
    return {
      level: "active",
      label: "Active weather watch",
      title:
        "Keep watching the forecast",
      summary:
        "Rain or wind may become noticeable during the next 24 hours. Check again before important field work.",
      className:
        "border-[#f0dfb2] bg-[#fffbf2]",
      iconClassName:
        "bg-[#fff3d6] text-[#b8780a]",
      Icon: CloudRain,
    };
  }

  return {
    level: "calm",
    label: "Light weather watch",
    title:
      "Forecast currently looks relatively calm",
    summary:
      "The current 24-hour forecast does not show stronger rain or gust values in this simple weather view. Continue normal monitoring.",
    className:
      "border-[#cae6d2] bg-[#f6fcf7]",
    iconClassName:
      "bg-[#e5f6eb] text-[#177944]",
    Icon: CloudSun,
  };
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
    <div className="rounded-[24px] border border-[#dfe9e2] bg-white p-5 shadow-[0_12px_35px_rgba(7,59,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f0]">
          <Icon className="h-5 w-5 text-[#146c43]" />
        </div>

        <span className="rounded-full bg-[#f5f8f5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
          Live
        </span>
      </div>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#718078]">
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


function ForecastMetric({
  icon: Icon,
  label,
  value,
  explanation,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
  explanation: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e3ebe5] bg-[#fbfdfb] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#146c43]" />

        <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#718078]">
          {label}
        </p>
      </div>

      <p className="mt-2 text-xl font-bold text-[#13271d]">
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-5 text-[#718078]">
        {explanation}
      </p>
    </div>
  );
}


export default function WeatherPage() {
  const navigate =
    useNavigate();

  const {
    weather,
    isLoadingWeather,
    weatherError,
    fetchWeather,
  } = useWeather();

  const [
    savedFarm,
    setSavedFarm,
  ] = useState<SavedFarm | null>(
    null
  );

  const [
    aiProfile,
    setAiProfile,
  ] = useState<FarmProfileStore | null>(
    null
  );

  const [
    locationError,
    setLocationError,
  ] = useState("");

  useEffect(() => {
    setSavedFarm(
      readSavedFarm()
    );

    setAiProfile(
      readAiProfile()
    );
  }, []);


  const latitude =
    savedFarm?.location?.latitude;

  const longitude =
    savedFarm?.location?.longitude;


  const farmName =
    savedFarm
      ?.farm_profile
      ?.farm_name ||
    aiProfile
      ?.profile
      ?.farm_summary
      ?.farm_name ||
    "Your registered farm";


  const variety =
    savedFarm
      ?.farm_profile
      ?.banana_variety ||
    aiProfile
      ?.profile
      ?.farm_summary
      ?.variety ||
    "Banana farm";


  const village =
    savedFarm
      ?.parcel_metadata
      ?.village;

  const district =
    savedFarm
      ?.parcel_metadata
      ?.district;


  const loadWeather =
    useCallback(
      async () => {
        setLocationError("");

        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          setLocationError(
            "Your registered farm location could not be found. Please confirm the farm location first."
          );

          return;
        }

        await fetchWeather(
          latitude,
          longitude
        );
      },
      [
        latitude,
        longitude,
        fetchWeather,
      ]
    );


  useEffect(() => {
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      void loadWeather();
    }
  }, [
    latitude,
    longitude,
    loadWeather,
  ]);


  const watch =
    useMemo(
      () =>
        getWeatherWatch(
          weather
        ),
      [weather]
    );


  const WatchIcon =
    watch.Icon;


  const currentDirection =
    weather
      ? formatDirection(
          weather.current
            .wind_direction
        )
      : "—";


  const peakGustTime =
    weather
      ?.next_24_hours
      ?.peak_gust_time
      ? formatWeatherTime(
          weather.next_24_hours
            .peak_gust_time,
          weather.location
            .timezone
        )
      : "No peak identified";


  const locationText = [
    village,
    district,
  ]
    .filter(Boolean)
    .join(", ");


  return (
    <div className="min-h-screen bg-[#f5faf6]">
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
              Back
            </Button>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">
                VazhaiGuard AI
              </p>

              <h1 className="text-xl font-bold text-[#13271d] sm:text-2xl">
                Farm Weather Intelligence
              </h1>
            </div>
          </div>

          <Button
            onClick={() =>
              void loadWeather()
            }
            disabled={
              isLoadingWeather
            }
            variant="outline"
            className="h-10 rounded-xl border-[#cfe0d4] bg-white text-[#146c43]"
          >
            {isLoadingWeather ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}

            {isLoadingWeather
              ? "Updating..."
              : "Refresh weather"}
          </Button>
        </div>


        {/* HERO */}
        <section className="overflow-hidden rounded-[30px] bg-[#073b2a] shadow-[0_25px_80px_rgba(7,59,42,0.18)]">
          <div className="relative p-6 sm:p-8 lg:p-10">

            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#b8df4b]/10 blur-3xl" />

            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#b8df4b]" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                    Live farm weather
                  </span>
                </div>

                <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  Weather your farm can
                  <span className="block text-[#b8df4b]">
                    understand at a glance.
                  </span>
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                  VazhaiGuard reads weather around your registered farm and turns
                  rain, wind and gust information into a simple farmer-facing watch.
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


              {/* STATUS */}
              <div className="rounded-[26px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                      Farm weather watch
                    </p>

                    <p className="mt-2 text-xl font-bold text-white">
                      {watch.label}
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8df4b]">
                    <WatchIcon className="h-6 w-6 text-[#073b2a]" />
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-2xl font-bold text-white">
                    {watch.title}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {watch.summary}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs text-white/50">
                  <ShieldCheck className="h-4 w-4 text-[#b8df4b]" />
                  Weather signal based on your registered farm location.
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ERROR */}
        {(weatherError ||
          locationError) && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#efc4c0] bg-[#fff8f7] p-4 text-sm text-[#a83a34]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-bold">
                Weather needs attention
              </p>

              <p className="mt-1 leading-5">
                {locationError ||
                  weatherError}
              </p>
            </div>
          </div>
        )}


        {/* NO LOCATION */}
        {!latitude ||
        !longitude ? (
          <section className="mt-6 rounded-[26px] border border-[#dfe9e2] bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef7f0]">
              <MapPin className="h-6 w-6 text-[#146c43]" />
            </div>

            <h3 className="mt-4 text-xl font-bold text-[#13271d]">
              Your farm location is required
            </h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#718078]">
              Confirm your registered farm boundary first. Once the location
              is saved, VazhaiGuard can automatically load weather for that
              farm instead of using your phone's current location.
            </p>

            <Button
              onClick={() =>
                navigate(
                  "/farm/location"
                )
              }
              className="mt-5 rounded-xl bg-[#073b2a] text-white hover:bg-[#0b4d36]"
            >
              Confirm farm location
            </Button>
          </section>
        ) : null}


        {/* LOADING */}
        {isLoadingWeather &&
          !weather && (
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                1,
                2,
                3,
              ].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-[24px] bg-white shadow-sm"
                />
              ))}
            </section>
          )}


        {weather && (
          <>
            {/* CURRENT CONDITIONS */}
            <section className="mt-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                    Right now
                  </p>

                  <h3 className="mt-1 text-2xl font-bold text-[#13271d]">
                    Current farm conditions
                  </h3>
                </div>

                <p className="hidden text-xs text-[#718078] sm:block">
                  Updated{" "}
                  {formatWeatherTime(
                    weather.current.time,
                    weather.location.timezone
                  )}
                </p>
              </div>


              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={CloudSun}
                  label="Temperature"
                  value={`${weather.current.temperature.toFixed(1)}°C`}
                  helper="Air temperature near your registered farm."
                />

                <MetricCard
                  icon={Droplets}
                  label="Rain now"
                  value={`${weather.current.rain.toFixed(1)} mm`}
                  helper="Rain recorded for the current weather period."
                />

                <MetricCard
                  icon={Wind}
                  label="Wind speed"
                  value={`${weather.current.wind_speed.toFixed(1)} km/h`}
                  helper={`Wind from ${currentDirection} (${Math.round(
                    weather.current.wind_direction
                  )}°).`}
                />

                <MetricCard
                  icon={Gauge}
                  label="Current gust"
                  value={`${weather.current.wind_gust.toFixed(1)} km/h`}
                  helper="Recent maximum wind gust."
                />
              </div>
            </section>


            {/* FARMER EXPLANATION */}
            <section
              className={`mt-6 rounded-[26px] border p-5 sm:p-6 ${watch.className}`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${watch.iconClassName}`}
                >
                  <WatchIcon className="h-6 w-6" />
                </div>

                <div className="max-w-4xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
                    What this means for you
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-[#13271d]">
                    {watch.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#596a60]">
                    {watch.summary}
                  </p>
                </div>
              </div>
            </section>


            {/* 24 HOUR */}
            <section className="mt-6 rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-[0_15px_45px_rgba(7,59,42,0.05)] sm:p-7">

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                    Next 24 hours
                  </p>

                  <h3 className="mt-1 text-2xl font-bold text-[#13271d]">
                    What may happen around your farm
                  </h3>
                </div>

                <p className="text-xs text-[#718078]">
                  Short-range forecast summary
                </p>
              </div>


              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                <ForecastMetric
                  icon={CloudRain}
                  label="Rain probability"
                  value={`${Math.round(
                    weather.next_24_hours
                      .max_rain_probability
                  )}%`}
                  explanation="Highest chance of precipitation during the next 24 hours."
                />

                <ForecastMetric
                  icon={Droplets}
                  label="Expected precipitation"
                  value={`${weather.next_24_hours.total_precipitation.toFixed(
                    1
                  )} mm`}
                  explanation="Combined precipitation expected over the next 24 hours."
                />

                <ForecastMetric
                  icon={Wind}
                  label="Maximum wind"
                  value={`${weather.next_24_hours.max_wind_speed.toFixed(
                    1
                  )} km/h`}
                  explanation="Highest forecast wind speed during this period."
                />

                <ForecastMetric
                  icon={Gauge}
                  label="Maximum gust"
                  value={`${weather.next_24_hours.max_wind_gust.toFixed(
                    1
                  )} km/h`}
                  explanation="Strongest forecast gust during this period."
                />
              </div>


              <div className="mt-4 grid gap-4 md:grid-cols-2">

                <div className="rounded-2xl bg-[#073b2a] p-5 text-white">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-[#b8df4b]" />

                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/55">
                      Peak wind timing
                    </p>
                  </div>

                  <p className="mt-2 text-lg font-bold">
                    {peakGustTime}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/55">
                    This is when the forecast currently expects the strongest gust.
                  </p>
                </div>


                <div className="rounded-2xl border border-[#e0e9e3] bg-[#f8fbf8] p-5">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-[#146c43]" />

                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#718078]">
                      Farmer view
                    </p>
                  </div>

                  <p className="mt-2 text-sm font-bold text-[#13271d]">
                    Watch rain and wind before field work.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#718078]">
                    VazhaiGuard will later combine this weather information
                    with field condition, crop and zone-risk data.
                  </p>
                </div>

              </div>
            </section>


            {/* WHY THIS MATTERS */}
            <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">

              <div className="rounded-[26px] border border-[#dfe9e2] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7f0]">
                    <Sprout className="h-5 w-5 text-[#146c43]" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                      Why VazhaiGuard shows this
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-[#13271d]">
                      From weather to farm awareness
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm leading-6 text-[#5f7066]">
                  <p>
                    <strong className="text-[#13271d]">
                      Rain
                    </strong>{" "}
                    helps you understand whether wetter conditions may develop.
                  </p>

                  <p>
                    <strong className="text-[#13271d]">
                      Wind
                    </strong>{" "}
                    helps you notice periods when stronger field conditions may occur.
                  </p>

                  <p>
                    <strong className="text-[#13271d]">
                      Gusts
                    </strong>{" "}
                    highlight short periods of stronger wind that deserve closer attention.
                  </p>
                </div>
              </div>


              <div className="rounded-[26px] border border-[#dfe9e2] bg-[#073b2a] p-6 text-white shadow-[0_15px_45px_rgba(7,59,42,0.12)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8df4b]">
                    <CheckCircle2 className="h-5 w-5 text-[#073b2a]" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b8df4b]">
                      Next intelligence layer
                    </p>

                    <h3 className="mt-1 text-lg font-bold">
                      Weather is now ready for risk analysis
                    </h3>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-white/65">
                  This weather layer is the foundation for the next VazhaiGuard
                  stage: combining weather with your registered farm boundary,
                  crop information and field conditions to identify where attention
                  may be needed.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white/70">
                  <ShieldCheck className="h-4 w-4 text-[#b8df4b]" />
                  Farm location verified
                </div>
              </div>

            </section>


            {/* DISCLAIMER */}
            <p className="mx-auto mt-6 max-w-4xl text-center text-[11px] leading-5 text-[#849188]">
              Weather Watch is currently a simple product-level interpretation
              of forecast rain and wind values. It is not a validated banana
              damage prediction model. The future VazhaiGuard risk engine will
              combine weather with farm-specific and zone-specific information.
            </p>
          </>
        )}

      </main>
    </div>
  );
}