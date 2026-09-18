import { useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import {
  Mic,
  ArrowRight,
  
} from "lucide-react";
import {
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  MapPin,
  RefreshCcw,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Wind,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";

import { useGeolocation } from "../hooks/useGeolocation";
import { useWeather } from "../hooks/useWeather";

import type { WeatherData } from "../types/weather";

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    coords,
    isLocating,
    locationError,
    getCurrentLocation,
  } = useGeolocation();
  const {
    weather,
    isLoadingWeather,
    weatherError,
    fetchWeather,
  } = useWeather();

  useEffect(() => {
    if (!coords) return;

    fetchWeather(
      coords.latitude,
      coords.longitude
    );
    // fetchWeather intentionally excluded because
    // the hook function may be recreated on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const weatherWatch =
    getWeatherWatch(weather);

  const WeatherWatchIcon =
    weatherWatch.icon;

  const handleRefreshWeather = () => {
    if (!coords) return;

    fetchWeather(
      coords.latitude,
      coords.longitude
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      {/* =====================================================
          MOBILE INTRO
      ====================================================== */}

      <section className="mb-5 lg:hidden">
        <p className="text-xs font-medium text-muted-foreground">
          Live Weather Intelligence
        </p>

        <h1 className="vg-heading mt-1 text-[28px] font-bold leading-tight text-[#13271d]">
          Understand weather
          <br />
          before it becomes damage.
        </h1>
      </section>

      {/* =====================================================
          HERO SECTION
      ====================================================== */}
      <section className="mt-6">
  <div className="relative overflow-hidden rounded-[28px] border border-[#dce8df] bg-gradient-to-br from-[#073b2a] via-[#0b4d36] to-[#146c43] p-6 text-white shadow-[0_18px_60px_rgba(7,59,42,0.15)] sm:p-7">

    {/* Background glow */}
    <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#b8df4b]/15 blur-3xl" />

    <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

      <div className="flex items-start gap-4">

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#b8df4b] shadow-lg">
          <Mic className="h-6 w-6 text-[#073b2a]" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b8df4b]">
              AI Voice Registration
            </p>

            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-semibold text-white/70">
              <Sparkles className="h-3 w-3" />
              Farmer Friendly
            </span>
          </div>

          <h2 className="mt-2 text-xl font-bold sm:text-2xl">
            பேசிப் பதிவு செய்யுங்கள்
          </h2>

          <p className="mt-1 text-sm font-medium text-white/80">
            Register your banana farm by speaking
          </p>

          <p className="mt-3 max-w-xl text-xs leading-5 text-white/55">
            படிக்கவோ type செய்யவோ தேவையில்லை.
            VazhaiGuard கேள்வி கேட்கும்.
            நீங்கள் சாதாரணமாக தமிழில் பேசினால் போதும்.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>navigate(
            "/farm/voice-register"
          )
        }
        className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#b8df4b] px-6 text-sm font-bold text-[#073b2a] shadow-lg transition hover:bg-[#c8eb65]"
      >
        <Mic className="h-4 w-4" />

        குரல் பதிவு தொடங்கு

        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </div>
</section>

      <section className="relative overflow-hidden rounded-[30px] bg-[#073b2a] shadow-[0_20px_70px_rgba(7,59,42,0.16)]">
        {/* Background glow */}

        <div className="absolute -left-20 -top-28 h-[350px] w-[350px] rounded-full bg-[#22a35a]/10 blur-3xl" />

        <div className="absolute -bottom-40 right-[15%] h-[330px] w-[330px] rounded-full bg-[#b8df4b]/10 blur-3xl" />

        {/* Animated rain */}

        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
          {Array.from({
            length: 24,
          }).map((_, index) => (
            <motion.span
              key={index}
              className="absolute block h-5 w-[1.5px] rounded-full bg-white/20"
              initial={{
                y: -30,
                opacity: 0,
              }}
              animate={{
                y: [0, 80],
                opacity: [
                  0,
                  0.42,
                  0,
                ],
              }}
              transition={{
                duration:
                  1.5 +
                  (index % 5) *
                    0.18,
                repeat: Infinity,
                delay:
                  index *
                  0.07,
                ease: "linear",
              }}
              style={{
                left: `${
                  3 +
                  index * 4.2
                }%`,
                top: `${
                  4 +
                  (index % 6) *
                    7
                }%`,
                rotate: "17deg",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 grid min-h-[430px] items-center gap-10 p-6 sm:p-8 lg:grid-cols-[0.92fr_1.08fr] lg:p-10 xl:px-12 xl:py-11">
          {/* =================================================
              LEFT HERO CONTENT
          ================================================== */}

          <div className="relative z-20 max-w-[620px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[#b8df4b]" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                Live farm weather intelligence
              </span>
            </div>

            <h1 className="vg-display text-[33px] font-bold leading-[1.03] text-white sm:text-[42px] lg:text-[45px] xl:text-[50px]">
              Weather that farmers can
              <span className="block text-[#b8df4b]">
                understand at a glance.
              </span>
            </h1>

            <p className="mt-5 max-w-[540px] text-sm leading-6 text-white/62 sm:text-[15px]">
              VazhaiGuard turns GPS-based
              weather into an easy visual
              view of rain, wind, gust and
              the next 24-hour conditions
              around your banana farm.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                onClick={
                  getCurrentLocation
                }
                disabled={
                  isLocating ||
                  isLoadingWeather
                }
                className="h-12 rounded-xl bg-[#b8df4b] px-5 text-sm font-semibold text-[#073b2a] shadow-[0_8px_25px_rgba(184,223,75,0.18)] hover:bg-[#c8e95f]"
              >
                <MapPin className="mr-2 h-4 w-4" />

                {isLocating
                  ? "Getting location..."
                  : isLoadingWeather
                    ? "Loading weather..."
                    : weather
                      ? "Update farm location"
                      : "Use my farm location"}
              </Button>

              {coords && (
                <Button
                  variant="outline"
                  onClick={
                    handleRefreshWeather
                  }
                  disabled={
                    isLoadingWeather
                  }
                  className="h-12 rounded-xl border-white/15 bg-white/[0.07] px-5 text-sm font-medium text-white backdrop-blur-md hover:bg-white/12 hover:text-white"
                >
                  <RefreshCcw
                    className={`mr-2 h-4 w-4 ${
                      isLoadingWeather
                        ? "animate-spin"
                        : ""
                    }`}
                  />

                  Refresh
                </Button>
              )}
            </div>

            {(locationError ||
              weatherError) && (
              <div className="mt-5 max-w-[540px] rounded-2xl border border-red-200/20 bg-red-900/20 px-4 py-3 backdrop-blur-md">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />

                  <p className="text-xs leading-5 text-red-50">
                    {locationError ||
                      weatherError}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              RIGHT — REALISTIC VAZHAI THOPPU
          ================================================== */}

          <div className="relative hidden min-h-[360px] lg:block">
            {/* Green ambient glow */}

            <div className="absolute -right-10 top-8 h-[300px] w-[300px] rounded-full bg-[#38b86a]/25 blur-[90px]" />

            <div className="absolute -bottom-8 left-12 h-[220px] w-[220px] rounded-full bg-[#b8df4b]/15 blur-[80px]" />

            {/* FARM IMAGE */}

            <div className="absolute inset-0 overflow-hidden rounded-[30px] border border-white/15 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
              <img
                src="/images/banana-storm-hero.webp"
                alt="Vazhai banana plantation"
                className="h-full w-full object-cover object-center"
              />

              {/* Soft green tint */}

              <div className="absolute inset-0 bg-[#073b2a]/5" />

              {/* Blend left image into hero */}

              <div className="absolute inset-y-0 left-0 w-[25%] bg-gradient-to-r from-[#073b2a]/80 via-[#073b2a]/30 to-transparent" />

              {/* Bottom overlay */}

              <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-[#032a1e]/90 via-[#073b2a]/30 to-transparent" />

              {/* Top overlay */}

              <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-black/20 to-transparent" />
            </div>

            {/* LIVE FARM VIEW LABEL */}

            <div className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-[#052f22]/55 px-3.5 py-2 backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b8df4b] opacity-60" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#b8df4b]" />
              </span>

              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                Live farm view
              </span>
            </div>

            {/* WEATHER STATUS */}

            <div className="absolute right-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#073b2a]/60 px-4 py-3 shadow-xl backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b8df4b]">
                <CloudSun className="h-[18px] w-[18px] text-[#073b2a]" />
              </div>

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  Farm weather
                </p>

                <p className="mt-0.5 text-xs font-semibold text-white">
                  {weather
                    ? "Live forecast"
                    : "Awaiting GPS"}
                </p>
              </div>
            </div>

            {/* VAZHAI INSIGHT */}

            <div className="absolute bottom-[105px] left-5 z-20 max-w-[225px] rounded-2xl border border-white/12 bg-[#052f22]/58 px-3.5 py-3 shadow-xl backdrop-blur-xl">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Sparkles className="h-4 w-4 text-[#b8df4b]" />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-white">
                    Vazhai insight
                  </p>

                  <p className="mt-1 text-[9px] leading-4 text-white/55">
                    {weather
                      ? weatherWatch.shortText
                      : "Connect location for live farm weather intelligence"}
                  </p>
                </div>
              </div>
            </div>

            {/* BOTTOM WEATHER GLASS BAR */}

            <div className="absolute inset-x-5 bottom-5 z-20 rounded-[22px] border border-white/15 bg-[#052f22]/68 p-3.5 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-4 divide-x divide-white/10">
                <FarmImageMetric
                  icon={Wind}
                  label="Wind"
                  value={
                    weather
                      ? `${weather.current.wind_speed}`
                      : "--"
                  }
                  unit="km/h"
                />

                <FarmImageMetric
                  icon={CloudRain}
                  label="Rain"
                  value={
                    weather
                      ? `${weather.next_24_hours.max_rain_probability}`
                      : "--"
                  }
                  unit="%"
                />

                <FarmImageMetric
                  icon={Thermometer}
                  label="Temp"
                  value={
                    weather
                      ? `${weather.current.temperature}`
                      : "--"
                  }
                  unit="°C"
                />

                <FarmImageMetric
                  icon={Compass}
                  label="Direction"
                  value={
                    weather
                      ? formatDirection(
                          weather.current
                            .wind_direction
                        )
                      : "--"
                  }
                  unit={
                    weather
                      ? `${weather.current.wind_direction}°`
                      : ""
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          LOCATION STATUS
      ====================================================== */}

      <section className="mt-5">
        <Card className="vg-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ef]">
                <MapPin className="h-5 w-5 text-[#146c43]" />
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Farm location
                </p>

                <p className="mt-1 text-sm font-semibold text-[#13271d]">
                  {coords
                    ? `${coords.latitude.toFixed(
                        5
                      )}, ${coords.longitude.toFixed(
                        5
                      )}`
                    : "Location not connected"}
                </p>
              </div>
            </div>

            <Badge
              className={
                weather
                  ? "w-fit rounded-full bg-[#e5f6eb] px-3 py-1 text-[#177944] hover:bg-[#e5f6eb]"
                  : "w-fit rounded-full bg-[#f1f4f2] px-3 py-1 text-muted-foreground hover:bg-[#f1f4f2]"
              }
            >
              <span
                className={
                  weather
                    ? "mr-2 h-1.5 w-1.5 rounded-full bg-[#22a35a]"
                    : "mr-2 h-1.5 w-1.5 rounded-full bg-[#a9b6ae]"
                }
              />

              {weather
                ? "Live weather connected"
                : "Waiting for GPS"}
            </Badge>
          </CardContent>
        </Card>
      </section>

      {/* =====================================================
          CURRENT WEATHER
      ====================================================== */}

      <section className="mt-7">
        <SectionHeading
          eyebrow="Current weather"
          title="Weather now on your farm"
          description="Live conditions from your detected farm location."
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <WeatherMetricCard
            icon={Thermometer}
            title="Temperature"
            tamil="வெப்பநிலை"
            value={
              weather
                ? `${weather.current.temperature}°C`
                : "--"
            }
            color="orange"
          />

          <WeatherMetricCard
            icon={Wind}
            title="Wind speed"
            tamil="காற்று வேகம்"
            value={
              weather
                ? `${weather.current.wind_speed} km/h`
                : "--"
            }
            color="green"
          />

          <WeatherMetricCard
            icon={Sparkles}
            title="Wind gust"
            tamil="திடீர் காற்றடிப்பு"
            value={
              weather
                ? `${weather.current.wind_gust} km/h`
                : "--"
            }
            color="blue"
          />

          <WeatherMetricCard
            icon={Compass}
            title="Wind direction"
            tamil="காற்றுத் திசை"
            value={
              weather
                ? formatDirection(
                    weather.current
                      .wind_direction
                  )
                : "--"
            }
            helper={
              weather
                ? `${weather.current.wind_direction}°`
                : undefined
            }
            color="lime"
          />
        </div>
      </section>

      {/* =====================================================
          NEXT 24 HOURS + FARMER MEANING
      ====================================================== */}

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        {/* 24-HOUR FORECAST */}

        <Card className="vg-card overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <SectionHeading
              eyebrow="Next 24 hours"
              title="Farm weather watch"
              description="A visual summary of the strongest forecast conditions."
              compact
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ForecastCard
                icon={CloudRain}
                title="Rain probability"
                tamil="மழை வாய்ப்பு"
                value={
                  weather
                    ? `${weather.next_24_hours.max_rain_probability}%`
                    : "--"
                }
                description="Highest forecast rain probability"
                progress={
                  weather
                    ? weather
                        .next_24_hours
                        .max_rain_probability
                    : 0
                }
                type="rain"
              />

              <ForecastCard
                icon={Droplets}
                title="Expected rainfall"
                tamil="மழை அளவு"
                value={
                  weather
                    ? `${weather.next_24_hours.total_precipitation} mm`
                    : "--"
                }
                description="Total forecast precipitation"
                type="water"
              />

              <ForecastCard
                icon={Wind}
                title="Maximum wind"
                tamil="அதிகபட்ச காற்று"
                value={
                  weather
                    ? `${weather.next_24_hours.max_wind_speed} km/h`
                    : "--"
                }
                description="Highest forecast wind speed"
                type="wind"
              />

              <ForecastCard
                icon={Sparkles}
                title="Peak gust"
                tamil="அதிகபட்ச திடீர் காற்று"
                value={
                  weather
                    ? `${weather.next_24_hours.max_wind_gust} km/h`
                    : "--"
                }
                description={
                  weather
                    ?.next_24_hours
                    .peak_gust_time
                    ? `Expected around ${formatPeakTime(
                        weather
                          .next_24_hours
                          .peak_gust_time
                      )}`
                    : "Peak gust time unavailable"
                }
                type="gust"
              />
            </div>
          </CardContent>
        </Card>

        {/* FARMER-FRIENDLY MEANING */}

        <Card className="vg-card overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <SectionHeading
              eyebrow="Easy understanding"
              title="What does this weather mean?"
              compact
            />

            <div
              className={`mt-5 rounded-[24px] border p-5 ${weatherWatch.panelClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${weatherWatch.iconClass}`}
                >
                  <WeatherWatchIcon className="h-6 w-6" />
                </div>

                <Badge
                  className={`${weatherWatch.badgeClass} rounded-full hover:opacity-100`}
                >
                  {weatherWatch.label}
                </Badge>
              </div>

              <h3 className="mt-5 text-lg font-semibold text-[#13271d]">
                {weatherWatch.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {weatherWatch.summary}
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              <MeaningRow
                icon={CloudRain}
                label="Rain watch"
                value={
                  weather
                    ? `${weather.next_24_hours.max_rain_probability}%`
                    : "--"
                }
              />

              <MeaningRow
                icon={Wind}
                label="Wind watch"
                value={
                  weather
                    ? `${weather.next_24_hours.max_wind_speed} km/h`
                    : "--"
                }
              />

              <MeaningRow
                icon={Sparkles}
                label="Gust watch"
                value={
                  weather
                    ? `${weather.next_24_hours.max_wind_gust} km/h`
                    : "--"
                }
              />

              <MeaningRow
                icon={CloudSun}
                label="Peak gust time"
                value={
                  weather
                    ?.next_24_hours
                    .peak_gust_time
                    ? formatPeakTime(
                        weather
                          .next_24_hours
                          .peak_gust_time
                      )
                    : "--"
                }
              />
            </div>

            <div className="mt-4 rounded-xl bg-[#f7faf8] px-3.5 py-3">
              <p className="text-[10px] leading-4 text-muted-foreground">
                Weather Watch is a simple
                interpretation of forecast
                conditions. It is not yet
                the banana crop vulnerability
                model.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* =========================================================
   FARM IMAGE WEATHER METRIC
========================================================= */

type FarmImageMetricProps = {
  icon: ElementType;
  label: string;
  value: string;
  unit?: string;
};

function FarmImageMetric({
  icon: Icon,
  label,
  value,
  unit,
}: FarmImageMetricProps) {
  return (
    <div className="min-w-0 px-3 first:pl-1 last:pr-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#b8df4b]" />

        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.07em] text-white/45">
          {label}
        </p>
      </div>

      <div className="mt-1.5 flex items-end gap-1">
        <span className="truncate text-[17px] font-bold leading-none text-white">
          {value}
        </span>

        {unit && (
          <span className="mb-[1px] truncate text-[8px] font-medium text-white/50">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SECTION HEADING
========================================================= */

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  compact?: boolean;
};

function SectionHeading({
  eyebrow,
  title,
  description,
  compact = false,
}: SectionHeadingProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#146c43]">
        {eyebrow}
      </p>

      <h2
        className={`vg-heading mt-1 font-bold text-[#13271d] ${
          compact
            ? "text-xl"
            : "text-[22px]"
        }`}
      >
        {title}
      </h2>

      {description && (
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   CURRENT WEATHER METRIC CARD
========================================================= */

type WeatherMetricCardProps = {
  icon: ElementType;
  title: string;
  tamil: string;
  value: string;
  helper?: string;

  color:
    | "orange"
    | "green"
    | "blue"
    | "lime";
};

function WeatherMetricCard({
  icon: Icon,
  title,
  tamil,
  value,
  helper,
  color,
}: WeatherMetricCardProps) {
  const styles = {
    orange: {
      icon:
        "bg-[#fff3df] text-[#d58708]",
      glow:
        "bg-[#f6b849]/10",
    },

    green: {
      icon:
        "bg-[#e7f6eb] text-[#1f8f4d]",
      glow:
        "bg-[#22a35a]/10",
    },

    blue: {
      icon:
        "bg-[#e7f2fc] text-[#3184d6]",
      glow:
        "bg-[#3184d6]/10",
    },

    lime: {
      icon:
        "bg-[#eef8dc] text-[#6c8f12]",
      glow:
        "bg-[#b8df4b]/15",
    },
  };

  const selected =
    styles[color];

  return (
    <Card className="vg-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_45px_rgba(7,59,42,0.09)]">
      <div
        className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${selected.glow}`}
      />

      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-[#263b30]">
              {title}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {tamil}
            </p>
          </div>

          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${selected.icon}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-6 flex items-end gap-2">
          <p className="text-[29px] font-bold leading-none tracking-[-0.04em] text-[#13271d]">
            {value}
          </p>

          {helper && (
            <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">
              {helper}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================
   FORECAST CARD
========================================================= */

type ForecastCardProps = {
  icon: ElementType;
  title: string;
  tamil: string;
  value: string;
  description: string;
  progress?: number;

  type:
    | "rain"
    | "water"
    | "wind"
    | "gust";
};

function ForecastCard({
  icon: Icon,
  title,
  tamil,
  value,
  description,
  progress,
  type,
}: ForecastCardProps) {
  const styles = {
    rain: {
      icon:
        "bg-[#e6f2fc] text-[#3184d6]",
      bar:
        "bg-[#3184d6]",
    },

    water: {
      icon:
        "bg-[#e7f5f6] text-[#218795]",
      bar:
        "bg-[#218795]",
    },

    wind: {
      icon:
        "bg-[#e7f6eb] text-[#1f8f4d]",
      bar:
        "bg-[#22a35a]",
    },

    gust: {
      icon:
        "bg-[#fff3d9] text-[#b7770a]",
      bar:
        "bg-[#e9a524]",
    },
  };

  const selected =
    styles[type];

  return (
    <div className="rounded-[22px] border border-border bg-[#f9fbf9] p-4 transition duration-300 hover:border-[#bad0bf] hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#263b30]">
            {title}
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {tamil}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-5 text-[25px] font-bold tracking-[-0.035em] text-[#13271d]">
        {value}
      </p>

      {typeof progress ===
        "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9eeeb]">
          <motion.div
            className={`h-full rounded-full ${selected.bar}`}
            initial={{
              width: 0,
            }}
            animate={{
              width: `${Math.min(
                Math.max(
                  progress,
                  0
                ),
                100
              )}%`,
            }}
            transition={{
              duration: 0.8,
            }}
          />
        </div>
      )}

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   FARMER MEANING ROW
========================================================= */

type MeaningRowProps = {
  icon: ElementType;
  label: string;
  value: string;
};

function MeaningRow({
  icon: Icon,
  label,
  value,
}: MeaningRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-[#fafcfb] px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7ef] text-[#146c43]">
          <Icon className="h-4 w-4" />
        </div>

        <p className="text-xs text-muted-foreground">
          {label}
        </p>
      </div>

      <p className="text-xs font-semibold text-[#13271d]">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   WEATHER WATCH INTERPRETATION

   IMPORTANT:
   This is a simple UI interpretation only.
   It is NOT a banana-damage prediction model.
========================================================= */

function getWeatherWatch(
  weather: WeatherData | null
) {
  if (!weather) {
    return {
      label:
        "Waiting for weather",

      title:
        "Connect your farm location",

      summary:
        "Use your current farm location to load live weather and the next 24-hour forecast.",

      shortText:
        "Waiting for farm location",

      icon: MapPin,

      panelClass:
        "border-[#dfe9e2] bg-[#f8faf8]",

      iconClass:
        "bg-[#edf7ef] text-[#146c43]",

      badgeClass:
        "bg-[#edf7ef] text-[#146c43]",
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

  /*
   * These are currently product-level
   * weather-watch bands for the UI.
   *
   * Later the VazhaiGuard hazard engine
   * should replace these with validated
   * weather/agronomic logic.
   */

  if (
    rain >= 85 ||
    rainfall >= 20 ||
    gust >= 45
  ) {
    return {
      label:
        "Strong weather watch",

      title:
        "Conditions need closer attention",

      summary:
        "The forecast currently shows stronger rain or gust conditions during the next 24 hours. Continue monitoring as the forecast updates.",

      shortText:
        "Stronger weather conditions are visible",

      icon: TriangleAlert,

      panelClass:
        "border-[#f0c9c5] bg-[#fff8f7]",

      iconClass:
        "bg-[#fde8e6] text-[#c13c34]",

      badgeClass:
        "bg-[#fde8e6] text-[#b52d27]",
    };
  }

  if (
    rain >= 50 ||
    rainfall >= 8 ||
    gust >= 25
  ) {
    return {
      label:
        "Active weather watch",

      title:
        "Keep watching the forecast",

      summary:
        "Rain or gust conditions may become more noticeable during the next 24 hours. Check the forecast again as conditions change.",

      shortText:
        "Rain or wind needs monitoring",

      icon: CloudRain,

      panelClass:
        "border-[#f0dfb2] bg-[#fffbf2]",

      iconClass:
        "bg-[#fff3d6] text-[#b8780a]",

      badgeClass:
        "bg-[#fff3d6] text-[#956009]",
    };
  }

  return {
    label:
      "Light weather watch",

    title:
      "Forecast currently looks relatively calm",

    summary:
      "The current 24-hour forecast does not show stronger rain or gust values in this simple weather view. Continue monitoring for updates.",

    shortText:
      "Weather currently looks relatively calm",

    icon: CloudSun,

    panelClass:
      "border-[#cae6d2] bg-[#f6fcf7]",

    iconClass:
      "bg-[#e5f6eb] text-[#177944]",

    badgeClass:
      "bg-[#e5f6eb] text-[#177944]",
  };
}

/* =========================================================
   WIND DIRECTION
========================================================= */

function formatDirection(
  degrees: number
) {
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
    ((degrees % 360) + 360) %
    360;

  const index =
    Math.round(
      normalized / 45
    ) % 8;

  return directions[index];
}

/* =========================================================
   PEAK GUST TIME
========================================================= */

function formatPeakTime(
  timeString: string
) {
  const date =
    new Date(timeString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return timeString;
  }

  return date.toLocaleString(
    [],
    {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }
  );
}