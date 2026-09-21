import {
  useMemo,
} from "react";

import {
  ArrowRight,
  CloudRain,
  Leaf,
  MapPinned,
  ShieldAlert,
  Sprout,
  Wallet,
} from "lucide-react";

import {
  useSearchParams,
  useNavigate,
} from "react-router-dom";


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
    mapped_area_acres?: number;
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


export default function FarmHomePage() {

  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const farmId =
    searchParams.get(
      "farm_id"
    );


  const profile =
    useMemo<FarmProfile | null>(
      () => {

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

          return parsed?.profile ??
            null;

        } catch {

          return null;
        }

      },
      []
    );


  const farmName =
    profile?.farm_summary
      ?.farm_name ||
    "Your Banana Farm";


  const variety =
    profile?.farm_summary
      ?.variety ||
    "Banana";


  const area =
    profile?.land
      ?.mapped_area_acres;


  const confidence =
    profile?.confidence;


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      {/* HEADER */}

      <section className="rounded-[30px] bg-[#073b2a] p-6 text-white sm:p-8">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8df4b]">

                <Leaf className="h-6 w-6 text-[#073b2a]" />

              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  VazhaiGuard AI
                </p>

                <p className="mt-1 text-sm text-white/75">
                  Farm intelligence
                </p>

              </div>

            </div>


            <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">

              {farmName}

            </h1>


            <p className="mt-2 text-sm text-white/70">

              {variety}

              {area
                ? ` · ${area.toFixed(2)} acres mapped`
                : ""
              }

            </p>

          </div>


          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3">

            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">
              Farm state
            </p>

            <p className="mt-1 text-sm font-semibold">
              Farmer confirmed
            </p>

            {farmId && (
              <p className="mt-1 text-[10px] text-white/40">
                {farmId}
              </p>
            )}

          </div>

        </div>

      </section>


      {/* AI PROFILE */}

      <section className="mt-6 rounded-[24px] border border-[#d9e8dd] bg-white p-5 shadow-sm">

        <div className="flex items-start justify-between gap-4">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">
              AI farm profile
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#13271d]">
              Your farm is ready for the next step
            </h2>

          </div>


          {confidence !== undefined && (

            <div className="rounded-full bg-[#edf7ef] px-3 py-1 text-xs font-semibold text-[#146c43]">

              {Math.round(
                confidence * 100
              )}% profile confidence

            </div>

          )}

        </div>


        <div className="mt-5 grid gap-3 sm:grid-cols-3">

          <InfoCard
            title="Crop"
            value={
              profile?.farm_summary
                ?.crop ||
              "Banana"
            }
          />

          <InfoCard
            title="Planting age"
            value={
              profile?.farm_summary
                ?.planting_age ||
              "Not provided"
            }
          />

          <InfoCard
            title="Drainage"
            value={
              profile?.field_conditions
                ?.drainage ||
              "Not provided"
            }
          />

        </div>

      </section>


      {/* MAIN MODULES */}

      <section className="mt-6">

        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">
          Farm intelligence
        </p>

        <h2 className="mt-1 text-2xl font-bold text-[#13271d]">
          What do you want to do?
        </h2>


        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <ModuleCard
            icon={Sprout}
            title="Plan"
            tamil="பயிர் திட்டமிடல்"
            description="Plan planting, water, soil and farm resources."
            onClick={() =>
              navigate(
                "/farm/plan"
              )
            }
          />


          <ModuleCard
            icon={Leaf}
            title="Grow & Monitor"
            tamil="வளர்ச்சி கண்காணிப்பு"
            description="Check crop growth, field photos and visible health signals."
            onClick={() =>
              navigate(
                "/farm/growth"
              )
            }
          />


          <ModuleCard
            icon={ShieldAlert}
            title="StormGuard"
            tamil="புயல் பாதுகாப்பு"
            description="Prepare high-risk farm zones before severe wind or rain."
            featured
            onClick={() =>
              navigate(
                "/farm/stormguard"
              )
            }
          />


          <ModuleCard
            icon={Wallet}
            title="Value & Recover"
            tamil="மதிப்பு & மீட்பு"
            description="Explore value opportunities and document damage after loss."
            onClick={() =>
              navigate(
                "/farm/recovery"
              )
            }
          />

        </div>

      </section>


      {/* LOCATION */}

      <section className="mt-6 rounded-[24px] border border-border bg-white p-5">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf7ef]">

            <MapPinned className="h-5 w-5 text-[#146c43]" />

          </div>

          <div>

            <p className="text-sm font-semibold text-[#13271d]">
              Farmer-confirmed farm boundary
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              This boundary is used for farm weather,
              crop monitoring and StormGuard analysis.
            </p>

          </div>

        </div>

      </section>


      {/* WEATHER NEXT */}

      <section className="mt-6 rounded-[24px] border border-[#d9e8dd] bg-[#f8fbf9] p-5">

        <div className="flex items-start gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">

            <CloudRain className="h-5 w-5 text-[#146c43]" />

          </div>

          <div>

            <p className="text-sm font-semibold text-[#13271d]">
              Next intelligence layer
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Weather and farm-zone analysis will use
              this confirmed farm boundary.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}


function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {

  return (
    <div className="rounded-2xl bg-[#f8faf8] p-4">

      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </p>

      <p className="mt-2 text-sm font-bold capitalize text-[#13271d]">
        {value}
      </p>

    </div>
  );
}


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
      className={`group text-left rounded-[24px] border p-5 transition hover:-translate-y-1 hover:shadow-lg ${
        featured
          ? "border-[#b8df4b] bg-[#073b2a] text-white"
          : "border-border bg-white"
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
        className={`mt-1 text-xs ${
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
        className={`mt-5 flex items-center gap-2 text-xs font-semibold ${
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