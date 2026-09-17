import {
  ArrowRight,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Map,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  Wind,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      {/* MOBILE PAGE INTRO */}
      <section className="mb-5 lg:hidden">
        <p className="text-xs font-medium text-muted-foreground">
          Farm Operations
        </p>

        <h1 className="vg-heading mt-1 text-[27px] font-bold leading-tight text-[#13271d]">
          Protect smarter
          <br />
          before the storm.
        </h1>
      </section>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#073b2a] shadow-[0_18px_60px_rgba(7,59,42,0.15)]">
        <div className="absolute -right-24 -top-32 h-[360px] w-[360px] rounded-full bg-[#b8df4b]/15 blur-3xl" />

        <div className="absolute bottom-[-160px] right-[18%] h-[300px] w-[300px] rounded-full bg-[#22a35a]/20 blur-3xl" />

        <div className="relative grid min-h-[310px] items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10 xl:px-12">
          <div className="max-w-[650px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#b8df4b]" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                Pre-storm farm intelligence
              </span>
            </div>

            <h1 className="vg-display max-w-[600px] text-[32px] font-bold leading-[1.03] text-white sm:text-[40px] lg:text-[46px] xl:text-[50px]">
              From weather warning
              <span className="block text-[#b8df4b]">
                to farm action.
              </span>
            </h1>

            <p className="mt-5 max-w-[570px] text-sm leading-6 text-white/62 sm:text-[15px]">
              VazhaiGuard combines weather, farm conditions and available
              resources to help banana farmers prepare before severe weather
              arrives.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                className="group flex items-center gap-2 rounded-xl bg-[#b8df4b] px-5 py-3 text-sm font-semibold text-[#073b2a] transition hover:bg-[#c8eb66]"
              >
                Set up my farm

                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                className="rounded-xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                View weather
              </button>
            </div>
          </div>

          {/* HERO VISUAL */}
          <div className="relative hidden min-h-[250px] lg:block">
            <div className="absolute right-4 top-4 w-[290px] rounded-[26px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
                    Weather status
                  </p>

                  <p className="mt-1 text-lg font-semibold text-white">
                    Live forecast ready
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8df4b]">
                  <CloudSun className="h-5 w-5 text-[#073b2a]" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/10 p-3">
                  <Wind className="mb-2 h-4 w-4 text-white/55" />

                  <p className="text-xs font-semibold text-white">
                    Wind & gust
                  </p>

                  <p className="mt-1 text-[10px] text-white/45">
                    Awaiting GPS
                  </p>
                </div>

                <div className="rounded-2xl bg-black/10 p-3">
                  <CloudRain className="mb-2 h-4 w-4 text-white/55" />

                  <p className="text-xs font-semibold text-white">
                    Rainfall
                  </p>

                  <p className="mt-1 text-[10px] text-white/45">
                    Awaiting GPS
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-5 left-2 w-[230px] rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Sparkles className="h-5 w-5 text-[#b8df4b]" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-white">
                    Storm planning
                  </p>

                  <p className="mt-0.5 text-[10px] text-white/45">
                    Available after farm setup
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK STATUS */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={MapPin}
          title="Farm Setup"
          value="Not completed"
          description="Add farm location and planting blocks"
          accent="green"
        />

        <StatusCard
          icon={CloudSun}
          title="Weather"
          value="API ready"
          description="Connect GPS to load live forecast"
          accent="blue"
        />

        <StatusCard
          icon={ShieldCheck}
          title="Risk Analysis"
          value="Waiting for data"
          description="Needs weather and farm information"
          accent="yellow"
        />

        <StatusCard
          icon={Sparkles}
          title="Storm Plan"
          value="Not generated"
          description="Add resources after risk analysis"
          accent="lime"
        />
      </section>

      {/* MAIN CONTENT */}
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        {/* FARM OVERVIEW */}
        <div className="vg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
                Farm overview
              </p>

              <h2 className="vg-heading mt-1 text-xl font-bold">
                Your banana farm
              </h2>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf7ef]">
              <Map className="h-5 w-5 text-[#146c43]" />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-[#b9cabe] bg-[#f2f7f3]">
              <div className="absolute inset-0 opacity-40">
                <div className="absolute left-[15%] top-[15%] h-32 w-32 rounded-full bg-[#b8df4b]/20 blur-2xl" />

                <div className="absolute bottom-[10%] right-[18%] h-40 w-40 rounded-full bg-[#22a35a]/15 blur-3xl" />
              </div>

              <div className="relative max-w-[340px] px-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <MapPin className="h-6 w-6 text-[#146c43]" />
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#13271d]">
                  Register your farm
                </h3>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use your current location and farm boundary to create the
                  operational map used by VazhaiGuard.
                </p>

                <button
                  type="button"
                  className="mt-5 rounded-xl bg-[#0b4d36] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#073b2a]"
                >
                  Start farm setup
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PREPARATION */}
        <div className="vg-card">
          <div className="border-b border-border/70 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
              Readiness
            </p>

            <h2 className="vg-heading mt-1 text-xl font-bold">
              Preparation status
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <ReadinessItem
              number="01"
              title="Farm registration"
              description="Location, boundary and crop details"
              completed={false}
            />

            <ReadinessItem
              number="02"
              title="Live weather"
              description="GPS-based hourly weather forecast"
              completed={false}
            />

            <ReadinessItem
              number="03"
              title="Risk assessment"
              description="Block-level vulnerability reasoning"
              completed={false}
            />

            <ReadinessItem
              number="04"
              title="Resource plan"
              description="Workers, materials and preparation time"
              completed={false}
            />
          </div>
        </div>
      </section>

      {/* AI / NEXT ACTION */}
      <section className="mt-5 grid gap-5 pb-5 lg:grid-cols-2">
        <div className="vg-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#073b2a]">
              <Sparkles className="h-5 w-5 text-[#b8df4b]" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
                AI Copilot
              </p>

              <h3 className="vg-heading mt-1 text-lg font-bold">
                Farm-aware assistance
              </h3>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The copilot will explain risk reasons, preparation actions and
                supporting agronomic evidence once your farm is registered.
              </p>

              <span className="mt-4 inline-flex rounded-full bg-muted px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                Available in a later milestone
              </span>
            </div>
          </div>
        </div>

        <div className="vg-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef7f0]">
              <Users className="h-5 w-5 text-[#146c43]" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
                Next step
              </p>

              <h3 className="vg-heading mt-1 text-lg font-bold">
                Complete farm setup
              </h3>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                After registration, VazhaiGuard can combine your farm blocks
                with the live weather engine you already built.
              </p>

              <button
                type="button"
                className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#0b4d36]"
              >
                Continue setup

                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type StatusCardProps = {
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
  accent: "green" | "blue" | "yellow" | "lime";
};

function StatusCard({
  icon: Icon,
  title,
  value,
  description,
  accent,
}: StatusCardProps) {
  const accents = {
    green: "bg-[#e6f4e9] text-[#146c43]",
    blue: "bg-[#e7f2fc] text-[#3184d6]",
    yellow: "bg-[#fff3d6] text-[#b8780a]",
    lime: "bg-[#eef7d2] text-[#5d7c12]",
  };

  return (
    <div className="vg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}
        >
          <Icon className="h-[19px] w-[19px]" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-0.5 truncate text-sm font-semibold text-[#13271d]">
            {value}
          </p>

          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

type ReadinessItemProps = {
  number: string;
  title: string;
  description: string;
  completed: boolean;
};

function ReadinessItem({
  number,
  title,
  description,
  completed,
}: ReadinessItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${
          completed
            ? "bg-[#e5f6eb] text-[#177944]"
            : "bg-[#f1f4f2] text-muted-foreground"
        }`}
      >
        {completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          number
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-[#13271d]">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}