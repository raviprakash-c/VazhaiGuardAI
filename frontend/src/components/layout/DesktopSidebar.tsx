import {
  Bot,
  ChartNoAxesCombined,
  CloudSun,
  FileText,
  LayoutDashboard,
  Map,
  Mic,
  Settings,
  ShieldAlert,
  Sparkles,
  Tractor,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import VazhaiLogo from "../branding/VazhaiLogo";

/* =========================================================
   PRIMARY NAVIGATION
========================================================= */

const primaryNavigation = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    enabled: true,
  },

  {
    name: "My Farm",
    icon: Map,
    path: "/farm/setup",
    enabled: true,
  },

  {
    name: "Voice Registration",
    tamilName: "குரல் பதிவு",
    icon: Mic,
    path: "/farm/voice-register",
    enabled: true,
    badge: "AI",
  },

  {
    name: "Weather & Alerts",
    icon: CloudSun,
    path: "/weather",
    enabled: false,
  },

  {
    name: "Risk Analysis",
    icon: ShieldAlert,
    path: "/risk",
    enabled: false,
  },

  {
    name: "Storm Plan",
    icon: Sparkles,
    path: "/plan",
    enabled: false,
  },

  {
    name: "AI Copilot",
    icon: Bot,
    path: "/copilot",
    enabled: false,
  },
];

/* =========================================================
   SECONDARY NAVIGATION
========================================================= */

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

/* =========================================================
   DESKTOP SIDEBAR
========================================================= */

export default function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-[#073b2a] lg:flex">

      {/* ===================================================
          BRAND
      ==================================================== */}

      <div className="flex h-[88px] items-center px-6">
        <VazhaiLogo light />
      </div>

      <div className="mx-5 h-px bg-white/10" />

      {/* ===================================================
          NAVIGATION
      ==================================================== */}

      <nav className="flex-1 overflow-y-auto px-4 py-6">

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Workspace
        </p>

        <div className="space-y-1.5">

          {primaryNavigation.map((item) => {
            const Icon = item.icon;

            /* =============================================
               ENABLED NAVIGATION ITEM
            ============================================== */

            if (item.enabled) {
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `group relative flex w-full items-center justify-between overflow-hidden rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                      isActive
                        ? "bg-white text-[#073b2a] shadow-sm"
                        : "text-white/68 hover:bg-white/[0.08] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* active left indicator */}

                      {isActive && (
                        <div className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#b8df4b]" />
                      )}

                      <div className="flex min-w-0 items-center gap-3">

                        <Icon
                          className={`h-[19px] w-[19px] shrink-0 ${
                            isActive
                              ? "text-[#146c43]"
                              : item.name === "Voice Registration"
                                ? "text-[#b8df4b]"
                                : "text-white/60 group-hover:text-white"
                          }`}
                          strokeWidth={2}
                        />

                        <div className="min-w-0">

                          <span className="block truncate text-[14px] font-medium">
                            {item.name}
                          </span>

                          {item.tamilName && (
                            <span
                              className={`mt-0.5 block text-[9px] ${
                                isActive
                                  ? "text-[#146c43]/70"
                                  : "text-white/35"
                              }`}
                            >
                              {item.tamilName}
                            </span>
                          )}

                        </div>
                      </div>

                      {/* Voice AI badge */}

                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                            isActive
                              ? "bg-[#eaf5ec] text-[#146c43]"
                              : "bg-[#b8df4b] text-[#073b2a]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            }

            /* =============================================
               COMING SOON ITEM
            ============================================== */

            return (
              <button
                key={item.name}
                type="button"
                disabled
                className="group flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-3 text-left text-white/45"
              >
                <div className="flex items-center gap-3">

                  <Icon
                    className="h-[19px] w-[19px] text-white/35"
                    strokeWidth={2}
                  />

                  <span className="text-[14px] font-medium">
                    {item.name}
                  </span>

                </div>

                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/35">
                  Soon
                </span>

              </button>
            );
          })}

        </div>

        {/* =================================================
            FARM OPERATIONS
        ================================================== */}

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
                disabled
                className="group flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-left text-white/40"
              >
                <div className="flex items-center gap-3">

                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={2}
                  />

                  <span className="text-[13px] font-medium">
                    {item.name}
                  </span>

                </div>

                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/25">
                  Soon
                </span>

              </button>
            );
          })}

        </div>

      </nav>

      {/* ===================================================
          BOTTOM AI CARD
      ==================================================== */}

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
                Farm intelligence assistant
              </p>

            </div>

          </div>

          <p className="text-[11px] leading-5 text-white/45">
            Voice-first storm preparation intelligence for banana farmers.
          </p>

        </div>

        {/* Settings */}

        <button
          type="button"
          className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Settings className="h-[18px] w-[18px]" />

          <span className="text-[13px] font-medium">
            Settings
          </span>
        </button>

      </div>

    </aside>
  );
}