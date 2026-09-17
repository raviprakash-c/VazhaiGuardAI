import {
  CalendarDays,
  Leaf,
  Ruler,
  Sprout,
} from "lucide-react";

import { Input } from "../ui/input";

type Props = {
  farmName: string;
  bananaVariety: string;
  plantingMonth: string;
  approximateAreaAcres: number | "";
  approximatePlantCount: number | "";

  onChange: (
    field:
      | "farmName"
      | "bananaVariety"
      | "plantingMonth"
      | "approximateAreaAcres"
      | "approximatePlantCount",
    value: string | number
  ) => void;
};

export default function FarmDetailsStep({
  farmName,
  bananaVariety,
  plantingMonth,
  approximateAreaAcres,
  approximatePlantCount,
  onChange,
}: Props) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
          Step 2
        </p>

        <h2 className="vg-heading mt-1 text-2xl font-bold text-[#13271d]">
          Tell us about your banana farm
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Only enter basic farm information that cannot be
          determined reliably from weather or map services.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldCard
          icon={Leaf}
          title="Farm name"
          helper="A simple name you recognize"
        >
          <Input
            value={farmName}
            onChange={(event) =>
              onChange(
                "farmName",
                event.target.value
              )
            }
            placeholder="Example: South Banana Farm"
            className="mt-3 h-11 rounded-xl"
          />
        </FieldCard>

        <FieldCard
          icon={Sprout}
          title="Main banana variety"
          helper="Example: Grand Naine, Nendran, Poovan"
        >
          <Input
            value={bananaVariety}
            onChange={(event) =>
              onChange(
                "bananaVariety",
                event.target.value
              )
            }
            placeholder="Enter variety"
            className="mt-3 h-11 rounded-xl"
          />
        </FieldCard>

        <FieldCard
          icon={CalendarDays}
          title="Main planting month"
          helper="Used to estimate crop stage later"
        >
          <Input
            type="month"
            value={plantingMonth}
            onChange={(event) =>
              onChange(
                "plantingMonth",
                event.target.value
              )
            }
            className="mt-3 h-11 rounded-xl"
          />
        </FieldCard>

        <FieldCard
          icon={Ruler}
          title="Approximate farm area"
          helper="You can correct this later after boundary mapping"
        >
          <div className="relative mt-3">
            <Input
              type="number"
              min="0"
              value={approximateAreaAcres}
              onChange={(event) =>
                onChange(
                  "approximateAreaAcres",
                  event.target.value === ""
                    ? ""
                    : Number(
                        event.target.value
                      )
                )
              }
              placeholder="Example: 12"
              className="h-11 rounded-xl pr-16"
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              acres
            </span>
          </div>
        </FieldCard>

        <div className="md:col-span-2">
          <FieldCard
            icon={Sprout}
            title="Approximate plant count"
            helper="Optional for v1. This can later be estimated from area and spacing."
          >
            <Input
              type="number"
              min="0"
              value={approximatePlantCount}
              onChange={(event) =>
                onChange(
                  "approximatePlantCount",
                  event.target.value === ""
                    ? ""
                    : Number(
                        event.target.value
                      )
                )
              }
              placeholder="Example: 15000"
              className="mt-3 h-11 rounded-xl"
            />
          </FieldCard>
        </div>
      </div>
    </div>
  );
}

function FieldCard({
  icon: Icon,
  title,
  helper,
  children,
}: {
  icon: React.ElementType;
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-[#fafcfb] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ec] text-[#146c43]">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[#13271d]">
            {title}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {helper}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}