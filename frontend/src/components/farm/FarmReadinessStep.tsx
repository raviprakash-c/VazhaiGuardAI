import {
  Accessibility,
  Droplets,
  ShieldCheck,
} from "lucide-react";

type Props = {
  drainage: string;
  support: string;
  accessibility: string;

  onChange: (
    field:
      | "drainage"
      | "support"
      | "accessibility",
    value: string
  ) => void;
};

export default function FarmReadinessStep({
  drainage,
  support,
  accessibility,
  onChange,
}: Props) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
          Step 4
        </p>

        <h2 className="vg-heading mt-1 text-2xl font-bold text-[#13271d]">
          Farm readiness
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Give simple field-condition information that maps and
          weather APIs cannot reliably know.
        </p>
      </div>

      <div className="space-y-5">
        <ChoiceGroup
          icon={Droplets}
          title="Drainage condition"
          description="How easily does excess rainwater leave the farm?"
          value={drainage}
          options={[
            {
              value: "good",
              label: "Good",
              helper:
                "Water normally drains quickly",
            },
            {
              value: "moderate",
              label: "Moderate",
              helper:
                "Some water stays after heavy rain",
            },
            {
              value: "poor",
              label: "Poor",
              helper:
                "Waterlogging is common",
            },
          ]}
          onChange={(value) =>
            onChange(
              "drainage",
              value
            )
          }
        />

        <ChoiceGroup
          icon={ShieldCheck}
          title="Plant support condition"
          description="General condition of propping/support across the farm."
          value={support}
          options={[
            {
              value: "good",
              label: "Good",
              helper:
                "Most required plants are supported",
            },
            {
              value: "partial",
              label: "Partial",
              helper:
                "Some areas still need support",
            },
            {
              value: "low",
              label: "Low",
              helper:
                "Many areas may need support",
            },
          ]}
          onChange={(value) =>
            onChange(
              "support",
              value
            )
          }
        />

        <ChoiceGroup
          icon={Accessibility}
          title="Farm accessibility"
          description="How easily can workers move between blocks?"
          value={accessibility}
          options={[
            {
              value: "easy",
              label: "Easy",
              helper:
                "Workers can move quickly",
            },
            {
              value: "moderate",
              label: "Moderate",
              helper:
                "Some areas take more time",
            },
            {
              value: "difficult",
              label: "Difficult",
              helper:
                "Movement is slow or constrained",
            },
          ]}
          onChange={(value) =>
            onChange(
              "accessibility",
              value
            )
          }
        />
      </div>
    </div>
  );
}

function ChoiceGroup({
  icon: Icon,
  title,
  description,
  options,
  value,
  onChange,
}: {
  icon: React.ElementType;
  title: string;
  description: string;

  options: {
    value: string;
    label: string;
    helper: string;
  }[];

  value: string;

  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-[#fafcfb] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ec] text-[#146c43]">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[#13271d]">
            {title}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {options.map(
          (option) => {
            const selected =
              value ===
              option.value;

            return (
              <button
                key={
                  option.value
                }
                type="button"
                onClick={() =>
                  onChange(
                    option.value
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-[#8dbc39] bg-[#f1f9dd] shadow-sm"
                    : "border-border bg-white hover:border-[#b8cbbd]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      selected
                        ? "border-[#146c43] bg-[#22a35a] shadow-[inset_0_0_0_2px_white]"
                        : "border-[#aab8af]"
                    }`}
                  />

                  <span className="text-xs font-semibold text-[#13271d]">
                    {
                      option.label
                    }
                  </span>
                </div>

                <p className="mt-2 pl-5 text-[10px] leading-4 text-muted-foreground">
                  {
                    option.helper
                  }
                </p>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}