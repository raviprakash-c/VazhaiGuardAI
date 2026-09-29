import {
  ArrowRight,
  CheckCircle2,
  CloudRain,
  FileCheck2,
  Leaf,
  MapPinned,
  ShieldAlert,
  Sprout,
  Wallet,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type FarmLocation = {
  latitude?: number;
  longitude?: number;
  label?: string;
};

type FarmBoundary = {
  type?: "Polygon" | "MultiPolygon";
  coordinates?: unknown;
};

type Verification = {
  status?: string;
  issues?: string[];
  checked_fields?: string[];
};

type FarmProfile = {
  farm_summary?: {
    farm_name?: string;
    crop?: string;
    variety?: string;
    crop_status?: string;
    planting_age?: string;
    approximate_plants?: number | null;
  };

  land?: {
    mapped_area_acres?: number | null;
    registered_area_acres?: number | null;
  };

  field_conditions?: {
    drainage?: string;
    support?: string;
    accessibility?: string;
  };

  known_information?: string[];

  missing_information?: string[];

  recommended_next_step?: string;

  confidence?: number;
};

type CompletedFarm = {
  farm_id?: string;

  farm_profile?: Record<string, unknown>;

  location?: FarmLocation;

  boundary?: FarmBoundary;

  mapped_area_acres?: number;

  perimeter_m?: number;

  farmer_confirmed?: boolean;

  boundary_source?: string;

  profile_status?: string;

  ai_profile?: FarmProfile;

  verification?: Verification;

  next_questions?: string[];

  timestamp?: string;
};

/* =========================================================
   STORAGE HELPERS
========================================================= */

function readCompletedFarm(): CompletedFarm | null {
  try {
    const raw = localStorage.getItem(
      "vazhaiguard_farm_complete"
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as CompletedFarm;
  } catch (error) {
    console.error(
      "[FarmHome] Failed to read completed farm:",
      error
    );

    return null;
  }
}

/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatArea(
  area: number | null | undefined
): string {
  if (
    area === null ||
    area === undefined ||
    !Number.isFinite(area)
  ) {
    return "Not available";
  }

  return `${area.toFixed(2)} acres`;
}

function formatPerimeter(
  perimeter: number | null | undefined
): string {
  if (
    perimeter === null ||
    perimeter === undefined ||
    !Number.isFinite(perimeter)
  ) {
    return "Not available";
  }

  return `${perimeter.toFixed(1)} m`;
}

function formatCoordinate(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toFixed(6);
}

function formatBoundaryType(
  type: string | undefined
): string {
  if (type === "MultiPolygon") {
    return "MultiPolygon";
  }

  if (type === "Polygon") {
    return "Polygon";
  }

  return "Not available";
}

function formatBoundarySource(
  source: string | undefined
): string {
  switch (source) {
    case "cadastral_parcel":
      return "Cadastral parcel";

    case "cadastral_edited":
      return "Cadastral parcel edited";

    case "farmer_drawn_satellite":
      return "Farmer confirmed satellite boundary";

    default:
      return source || "Not available";
  }
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function FarmHomePage() {
  const navigate = useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const [
    completedFarm,
    setCompletedFarm,
  ] = useState<CompletedFarm | null>(null);

  const [
    refreshed,
    setRefreshed,
  ] = useState(false);

  /* -------------------------------------------------------
     Read completed farm
  ------------------------------------------------------- */

  useEffect(() => {
    const loadFarm = () => {
      setCompletedFarm(
        readCompletedFarm()
      );

      setRefreshed(true);
    };

    loadFarm();

    window.addEventListener(
      "storage",
      loadFarm
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadFarm
      );
    };
  }, []);

  /* -------------------------------------------------------
     Farm ID
  ------------------------------------------------------- */

  const farmId =
    searchParams.get("farm_id") ||
    completedFarm?.farm_id ||
    localStorage.getItem(
      "vazhaiguard_farm_id"
    ) ||
    "";

  /* -------------------------------------------------------
     AI profile
  ------------------------------------------------------- */

  const profile =
    useMemo<FarmProfile | null>(() => {
      if (completedFarm?.ai_profile) {
        return completedFarm.ai_profile;
      }

      /*
       * Backward compatibility with the older
       * localStorage key.
       */
      try {
        const raw =
          localStorage.getItem(
            "vazhaiguard_ai_profile"
          );

        if (!raw) {
          return null;
        }

        const parsed =
          JSON.parse(raw);

        if (
          parsed &&
          typeof parsed === "object"
        ) {
          return (
            parsed.profile ??
            parsed.ai_profile ??
            null
          );
        }

        return null;
      } catch {
        return null;
      }
    }, [completedFarm]);

  /* -------------------------------------------------------
     Display values
  ------------------------------------------------------- */

  const farmName =
    profile?.farm_summary?.farm_name ||
    "Your Banana Farm";

  const crop =
    profile?.farm_summary?.crop ||
    "Banana";

  const variety =
    profile?.farm_summary?.variety ||
    "Not provided";

  const plantingAge =
    profile?.farm_summary?.planting_age ||
    "Not provided";

  const cropStatus =
    profile?.farm_summary?.crop_status ||
    "Not provided";

  const plants =
    profile?.farm_summary?.approximate_plants;

  const drainage =
    profile?.field_conditions?.drainage ||
    "Not provided";

  const support =
    profile?.field_conditions?.support ||
    "Not provided";

  const accessibility =
    profile?.field_conditions?.accessibility ||
    "Not provided";

  const mappedArea =
    completedFarm?.mapped_area_acres ??
    profile?.land?.mapped_area_acres;

  const perimeter =
    completedFarm?.perimeter_m;

  const confidence =
    profile?.confidence;

  const verificationStatus =
    completedFarm?.verification?.status ||
    completedFarm?.profile_status ||
    "REGISTERED";

  const boundaryType =
    completedFarm?.boundary?.type;

  const boundarySource =
    completedFarm?.boundary_source;

  const latitude =
    completedFarm?.location?.latitude;

  const longitude =
    completedFarm?.location?.longitude;

  const hasFarm =
    Boolean(
      completedFarm ||
      farmId
    );

  /* -------------------------------------------------------
     Verification status
  ------------------------------------------------------- */

  const verificationLabel =
    verificationStatus === "VERIFIED"
      ? "AI profile verified"
      : verificationStatus === "NEEDS_REVIEW"
        ? "Profile needs review"
        : "Farm registered";

  const verificationDescription =
    verificationStatus === "VERIFIED"
      ? "Your farm information has passed the current AI profile checks."
      : verificationStatus === "NEEDS_REVIEW"
        ? "Your farm is registered, but some information still needs review."
        : "Your farmer profile and farm boundary have been registered.";

  /* -------------------------------------------------------
     Continue registration
  ------------------------------------------------------- */

  const handleEditFarm =
    () => {
      navigate(
        "/farm/location"
      );
    };

  const handleDashboard =
    () => {
      navigate(
        "/dashboard"
      );
    };

  const handleWeather =
    () => {
      navigate(
        "/weather"
      );
    };

  const handleRisk =
    () => {
      navigate(
        "/risk"
      );
    };

  const handlePlan =
    () => {
      navigate(
        "/farm/setup"
      );
    };

  /* -------------------------------------------------------
     Empty state
  ------------------------------------------------------- */

  if (
    refreshed &&
    !hasFarm
  ) {
    return (
      <div className="min-h-screen bg-[#f5fbf6] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">

          <section className="rounded-[30px] bg-[#073b2a] p-7 text-white shadow-[0_20px_70px_rgba(7,59,42,0.12)] sm:p-10">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b8df4b]">
              <Leaf className="h-7 w-7 text-[#073b2a]" />
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#b8df4b]">
              VazhaiGuard AI
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              No registered farm found
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Complete your farm registration and confirm
              your farm boundary before using the farm
              intelligence modules.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/farm/location"
                )
              }
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#b8df4b] px-5 py-3 text-sm font-bold text-[#073b2a] transition hover:bg-[#c8eb68]"
            >
              Register farm
              <ArrowRight className="h-4 w-4" />
            </button>

          </section>

        </div>
      </div>
    );
  }

  /* =======================================================
     REGISTERED FARM HOME
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f5fbf6] pb-16">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="border-b border-[#dce8df] bg-white">

        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#073b2a]">
              <Leaf className="h-5 w-5 text-[#b8df4b]" />
            </div>

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                VazhaiGuard AI
              </p>

              <p className="text-sm font-bold text-[#13271d]">
                Farm Home
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={handleDashboard}
            className="rounded-xl border border-[#d9e8dd] bg-white px-4 py-2 text-xs font-bold text-[#146c43] transition hover:bg-[#f2f8f3]"
          >
            Dashboard
          </button>

        </div>

      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* =================================================
            FARM HERO
        ================================================= */}

        <section className="overflow-hidden rounded-[30px] bg-[#073b2a] text-white shadow-[0_20px_70px_rgba(7,59,42,0.14)]">

          <div className="grid lg:grid-cols-[1fr_360px]">

            <div className="p-7 sm:p-9">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8df4b]">
                  <Sprout className="h-6 w-6 text-[#073b2a]" />
                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8df4b]">
                    Registered farm
                  </p>

                  <p className="mt-1 text-xs text-white/55">
                    VazhaiGuard AI farm intelligence
                  </p>

                </div>

              </div>

              <h1 className="mt-7 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
                {farmName}
              </h1>

              <p className="mt-3 text-sm text-white/70">
                {crop}
                {" · "}
                {variety}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">

                <StatusPill
                  text="Registered"
                  success
                />

                {completedFarm?.farmer_confirmed && (
                  <StatusPill
                    text="Farmer confirmed"
                    success
                  />
                )}

                {boundaryType && (
                  <StatusPill
                    text={boundaryType}
                  />
                )}

              </div>

            </div>

            {/* FARM ID */}

            <div className="border-t border-white/10 bg-white/[0.04] p-7 lg:border-l lg:border-t-0">

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                Farm ID
              </p>

              <p className="mt-2 break-all text-sm font-bold text-white">
                {farmId || "Not available"}
              </p>

              <div className="mt-7 border-t border-white/10 pt-5">

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  Registration status
                </p>

                <div className="mt-2 flex items-center gap-2">

                  <CheckCircle2 className="h-5 w-5 text-[#b8df4b]" />

                  <p className="text-sm font-bold text-white">
                    {verificationLabel}
                  </p>

                </div>

                <p className="mt-2 text-xs leading-5 text-white/55">
                  {verificationDescription}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            FARM SUMMARY
        ================================================= */}

        <section className="mt-6">

          <div className="mb-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
              Farm overview
            </p>

            <h2 className="mt-1 text-2xl font-bold text-[#13271d]">
              Your registered farm
            </h2>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <MetricCard
              icon={MapPinned}
              label="Mapped area"
              value={formatArea(mappedArea)}
            />

            <MetricCard
              icon={RulerIcon}
              label="Boundary perimeter"
              value={formatPerimeter(perimeter)}
            />

            <MetricCard
              icon={Sprout}
              label="Crop"
              value={crop}
            />

            <MetricCard
              icon={Leaf}
              label="Variety"
              value={variety}
            />

          </div>

        </section>

        {/* =================================================
            AI PROFILE
        ================================================= */}

        <section className="mt-6 rounded-[26px] border border-[#d9e8dd] bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                AI farm profile
              </p>

              <h2 className="mt-1 text-xl font-bold text-[#13271d]">
                Farm information captured
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                These are the farm details collected during
                registration and used by VazhaiGuard AI.
              </p>

            </div>

            {confidence !== undefined &&
              Number.isFinite(confidence) && (
                <div className="shrink-0 rounded-full bg-[#edf7ef] px-4 py-2 text-xs font-bold text-[#146c43]">
                  {Math.round(
                    confidence * 100
                  )}
                  % profile confidence
                </div>
              )}

          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <InfoCard
              title="Crop"
              value={crop}
            />

            <InfoCard
              title="Variety"
              value={variety}
            />

            <InfoCard
              title="Planting age"
              value={plantingAge}
            />

            <InfoCard
              title="Crop status"
              value={cropStatus}
            />

            <InfoCard
              title="Approximate plants"
              value={
                plants !== null &&
                plants !== undefined
                  ? String(plants)
                  : "Not provided"
              }
            />

            <InfoCard
              title="Drainage"
              value={drainage}
            />

            <InfoCard
              title="Support"
              value={support}
            />

            <InfoCard
              title="Accessibility"
              value={accessibility}
            />

            <InfoCard
              title="Boundary source"
              value={formatBoundarySource(
                boundarySource
              )}
            />

          </div>

        </section>

        {/* =================================================
            LOCATION
        ================================================= */}

        <section className="mt-6 rounded-[26px] border border-[#d9e8dd] bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf7ef]">
                <MapPinned className="h-6 w-6 text-[#146c43]" />
              </div>

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                  Farm location
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#13271d]">
                  Farmer-confirmed boundary
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This confirmed location can be used for
                  weather, crop monitoring and farm-risk
                  intelligence.
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={handleEditFarm}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#cfe1d4] bg-white px-4 py-3 text-xs font-bold text-[#146c43] transition hover:bg-[#f2f8f3]"
            >
              Edit farm location
              <ArrowRight className="h-4 w-4" />
            </button>

          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <InfoCard
              title="Latitude"
              value={formatCoordinate(
                latitude
              )}
            />

            <InfoCard
              title="Longitude"
              value={formatCoordinate(
                longitude
              )}
            />

            <InfoCard
              title="Boundary"
              value={formatBoundaryType(
                boundaryType
              )}
            />

            <InfoCard
              title="Area"
              value={formatArea(
                mappedArea
              )}
            />

          </div>

        </section>

        {/* =================================================
            VERIFICATION
        ================================================= */}

        <section className="mt-6 rounded-[26px] border border-[#d9e8dd] bg-white p-5 shadow-sm sm:p-6">

          <div className="flex items-start gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf7ef]">
              <FileCheck2 className="h-6 w-6 text-[#146c43]" />
            </div>

            <div className="min-w-0 flex-1">

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                Registration verification
              </p>

              <h2 className="mt-1 text-xl font-bold text-[#13271d]">
                {verificationLabel}
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {verificationDescription}
              </p>

              {completedFarm?.verification?.issues &&
                completedFarm.verification.issues.length > 0 && (

                  <div className="mt-4 rounded-2xl border border-[#f0dfb2] bg-[#fffbf2] p-4">

                    <p className="text-xs font-bold text-[#956009]">
                      Items requiring attention
                    </p>

                    <ul className="mt-2 space-y-1">

                      {completedFarm.verification.issues.map(
                        (
                          issue,
                          index
                        ) => (
                          <li
                            key={`${issue}-${index}`}
                            className="text-xs leading-5 text-[#79520b]"
                          >
                            • {issue}
                          </li>
                        )
                      )}

                    </ul>

                  </div>

                )}

              {completedFarm?.next_questions &&
                completedFarm.next_questions.length > 0 && (

                  <div className="mt-4 rounded-2xl bg-[#f5faf6] p-4">

                    <p className="text-xs font-bold text-[#146c43]">
                      Next information needed
                    </p>

                    <ul className="mt-2 space-y-1">

                      {completedFarm.next_questions.map(
                        (
                          question,
                          index
                        ) => (
                          <li
                            key={`${question}-${index}`}
                            className="text-xs leading-5 text-[#52635a]"
                          >
                            • {question}
                          </li>
                        )
                      )}

                    </ul>

                  </div>

                )}

            </div>

          </div>

        </section>

        {/* =================================================
            INTELLIGENCE MODULES
        ================================================= */}

        <section className="mt-8">

          <div className="mb-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
              Farm intelligence
            </p>

            <h2 className="mt-1 text-2xl font-bold text-[#13271d]">
              What do you want to do?
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Your registered farm is now the foundation
              for these intelligence features.
            </p>

          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <ModuleCard
              icon={Sprout}
              title="Farm setup"
              tamil="பண்ணை அமைப்பு"
              description="Review your registered farm information and continue farm configuration."
              onClick={handlePlan}
            />

            <ModuleCard
              icon={CloudRain}
              title="Weather"
              tamil="வானிலை"
              description="View weather information relevant to your registered farm."
              onClick={handleWeather}
            />

            <ModuleCard
              icon={ShieldAlert}
              title="Risk"
              tamil="ஆபத்து கண்காணிப்பு"
              description="Open the farm risk intelligence area for weather and field risks."
              featured
              onClick={handleRisk}
            />

            <ModuleCard
              icon={Wallet}
              title="Farm dashboard"
              tamil="பண்ணை டாஷ்போர்டு"
              description="Return to the main VazhaiGuard AI dashboard."
              onClick={handleDashboard}
            />

          </div>

        </section>

        {/* =================================================
            NEXT LAYER
        ================================================= */}

        <section className="mt-6 rounded-[26px] border border-[#cfe1d4] bg-[#f8fbf9] p-5 sm:p-6">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
              <CloudRain className="h-5 w-5 text-[#146c43]" />
            </div>

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#146c43]">
                Next intelligence layer
              </p>

              <h2 className="mt-1 text-lg font-bold text-[#13271d]">
                Your farm boundary is ready for analysis
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                The registered farm location and boundary
                can now become the spatial foundation for
                weather monitoring, crop intelligence and
                farm-risk analysis.
              </p>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

/* =========================================================
   STATUS PILL
========================================================= */

function StatusPill({
  text,
  success = false,
}: {
  text: string;
  success?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold ${
        success
          ? "bg-[#b8df4b] text-[#073b2a]"
          : "bg-white/10 text-white/75"
      }`}
    >
      {success && (
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
      )}

      {text}
    </span>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#dfe9e2] bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf7ef]">
          <Icon className="h-5 w-5 text-[#146c43]" />
        </div>

      </div>

      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold capitalize text-[#13271d]">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f7faf8] p-4">

      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </p>

      <p className="mt-2 break-words text-sm font-bold text-[#13271d]">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   MODULE CARD
========================================================= */

function ModuleCard({
  icon: Icon,
  title,
  tamil,
  description,
  onClick,
  featured = false,
}: {
  icon: React.ElementType;
  title: string;
  tamil: string;
  description: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-[24px] border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${
        featured
          ? "border-[#b8df4b] bg-[#073b2a]"
          : "border-[#dfe9e2] bg-white"
      }`}
    >

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          featured
            ? "bg-[#b8df4b] text-[#073b2a]"
            : "bg-[#edf7ef] text-[#146c43]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p
        className={`mt-5 text-lg font-bold ${
          featured
            ? "text-white"
            : "text-[#13271d]"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-1 text-xs font-semibold ${
          featured
            ? "text-[#b8df4b]"
            : "text-[#146c43]"
        }`}
      >
        {tamil}
      </p>

      <p
        className={`mt-3 text-sm leading-6 ${
          featured
            ? "text-white/65"
            : "text-muted-foreground"
        }`}
      >
        {description}
      </p>

      <div
        className={`mt-5 flex items-center gap-2 text-xs font-bold ${
          featured
            ? "text-[#b8df4b]"
            : "text-[#146c43]"
        }`}
      >
        Open

        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>

    </button>
  );
}

/* =========================================================
   RULER ICON
========================================================= */

function RulerIcon(
  props: React.SVGProps<SVGSVGElement>
) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z" />
      <path d="m14 5 5 5" />
      <path d="m11 8 2 2" />
      <path d="m8 11 2 2" />
      <path d="m5 14 2 2" />
    </svg>
  );
}