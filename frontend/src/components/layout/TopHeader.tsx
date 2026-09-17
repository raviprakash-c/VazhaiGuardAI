import {
  Bell,
  ChevronDown,
  CloudSun,
  MapPin,
} from "lucide-react";

export default function TopHeader() {
  return (
    <header className="sticky top-0 z-30 hidden h-[88px] items-center justify-between border-b border-border/70 bg-white/90 px-8 backdrop-blur-xl lg:flex">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-[#22a35a]" />

          <span>Farm location</span>

          <span className="text-border">•</span>

          <span>Waiting for setup</span>
        </div>

        <h2 className="vg-heading mt-1 text-[22px] font-bold text-[#13271d]">
          Farm Operations Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-border bg-[#f8faf8] px-4 py-2.5 xl:flex">
          <CloudSun className="h-[17px] w-[17px] text-[#146c43]" />

          <span className="text-xs font-medium text-muted-foreground">
            Live weather ready
          </span>

          <span className="h-1.5 w-1.5 rounded-full bg-[#22a35a]" />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:bg-muted"
        >
          <Bell className="h-[18px] w-[18px]" />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#f4d83f]" />
        </button>

        <button
          type="button"
          className="flex items-center gap-3 rounded-full border border-border bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-muted"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#073b2a] text-xs font-bold text-white">
            RP
          </div>

          <div className="hidden text-left xl:block">
            <p className="text-xs font-semibold text-[#13271d]">
              Farm Operator
            </p>

            <p className="text-[10px] text-muted-foreground">
              VazhaiGuard
            </p>
          </div>

          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}