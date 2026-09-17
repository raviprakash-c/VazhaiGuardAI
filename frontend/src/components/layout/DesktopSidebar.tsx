import {
  Bot,
  ChartNoAxesCombined,
  CloudSun,
  FileText,
  LayoutDashboard,
  Map,
  Settings,
  ShieldAlert,
  Sparkles,
  Tractor,
} from "lucide-react";

import VazhaiLogo from "../branding/VazhaiLogo";

const primaryNavigation = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    active: true,
  },
  {
    name: "My Farm",
    icon: Map,
    active: false,
  },
  {
    name: "Weather & Alerts",
    icon: CloudSun,
    active: false,
  },
  {
    name: "Risk Analysis",
    icon: ShieldAlert,
    active: false,
  },
  {
    name: "Storm Plan",
    icon: Sparkles,
    active: false,
  },
  {
    name: "AI Copilot",
    icon: Bot,
    active: false,
  },
];

const secondaryNavigation = [
  {
    name: "Resources",
    icon: Tractor,
  },
  {
    name: "Reports",
    icon: FileText,
  },
  {
    name: "Analytics",
    icon: ChartNoAxesCombined,
  },
];

export default function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-[#073b2a] lg:flex">
      <div className="flex h-[88px] items-center px-6">
        <VazhaiLogo light />
      </div>

      <div className="mx-5 h-px bg-white/10" />

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Workspace
        </p>

        <div className="space-y-1.5">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                type="button"
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                  item.active
                    ? "bg-white text-[#073b2a] shadow-sm"
                    : "text-white/68 hover:bg-white/8 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-[19px] w-[19px] ${
                      item.active
                        ? "text-[#146c43]"
                        : "text-white/60 group-hover:text-white"
                    }`}
                    strokeWidth={2}
                  />

                  <span className="text-[14px] font-medium">
                    {item.name}
                  </span>
                </div>

                {!item.active && (
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/35">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Farm Operations
        </p>

        <div className="space-y-1">
          {secondaryNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/55 transition hover:bg-white/8 hover:text-white"
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />

                <span className="text-[13px] font-medium">{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b8df4b]">
              <Sparkles className="h-4 w-4 text-[#073b2a]" />
            </div>

            <div>
              <p className="text-xs font-semibold text-white">
                VazhaiGuard AI
              </p>
              <p className="text-[10px] text-white/45">
                Intelligence system
              </p>
            </div>
          </div>

          <p className="text-[11px] leading-5 text-white/45">
            Farm-aware storm preparation intelligence for banana farms.
          </p>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 transition hover:bg-white/8 hover:text-white"
        >
          <Settings className="h-[18px] w-[18px]" />

          <span className="text-[13px] font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}