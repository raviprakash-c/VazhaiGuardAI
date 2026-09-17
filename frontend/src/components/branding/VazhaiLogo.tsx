import { Leaf, ShieldCheck } from "lucide-react";

type VazhaiLogoProps = {
  compact?: boolean;
  light?: boolean;
};

export default function VazhaiLogo({
  compact = false,
  light = false,
}: VazhaiLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#b8df4b] shadow-sm">
        <ShieldCheck className="h-6 w-6 text-[#073b2a]" strokeWidth={2.4} />

        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
          <Leaf className="h-3 w-3 text-[#22a35a]" strokeWidth={2.5} />
        </div>
      </div>

      {!compact && (
        <div className="leading-none">
          <div
            className={`vg-heading text-[19px] font-bold ${
              light ? "text-white" : "text-[#073b2a]"
            }`}
          >
            VazhaiGuard
            <span className="ml-1 text-[#b8df4b]">AI</span>
          </div>

          <p
            className={`mt-1 text-[11px] font-medium ${
              light ? "text-white/55" : "text-muted-foreground"
            }`}
          >
            Protect smarter before the storm
          </p>
        </div>
      )}
    </div>
  );
}