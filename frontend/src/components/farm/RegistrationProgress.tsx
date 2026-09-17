import {
  Check,
  MapPin,
  Sprout,
  Grid2X2,
  ShieldCheck,
} from "lucide-react";

type Props = {
  currentStep: number;
};

const steps = [
  {
    label: "Location",
    icon: MapPin,
  },
  {
    label: "Crop",
    icon: Sprout,
  },
  {
    label: "Blocks",
    icon: Grid2X2,
  },
  {
    label: "Readiness",
    icon: ShieldCheck,
  },
];

export default function RegistrationProgress({
  currentStep,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => {
        const number = index + 1;
        const completed = currentStep > number;
        const active = currentStep === number;
        const Icon = step.icon;

        return (
          <div
            key={step.label}
            className="relative"
          >
            <div
              className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition ${
                active
                  ? "border-[#8dbc39] bg-[#f2f9df]"
                  : completed
                    ? "border-[#bcdcc5] bg-[#f2faf4]"
                    : "border-border bg-white"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  active
                    ? "bg-[#b8df4b] text-[#073b2a]"
                    : completed
                      ? "bg-[#22a35a] text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              <span
                className={`text-[10px] font-semibold sm:text-xs ${
                  active || completed
                    ? "text-[#073b2a]"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}