import {
  Bot,
  Home,
  Map,
  Menu,
  Sparkles,
} from "lucide-react";

const navItems = [
  {
    name: "Home",
    icon: Home,
    active: true,
  },
  {
    name: "Farm",
    icon: Map,
    active: false,
  },
  {
    name: "Plan",
    icon: Sparkles,
    active: false,
  },
  {
    name: "AI",
    icon: Bot,
    active: false,
  },
  {
    name: "More",
    icon: Menu,
    active: false,
  },
];

export default function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(7,59,42,0.06)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              type="button"
              className="flex flex-col items-center justify-center gap-1"
            >
              <div
                className={`flex h-9 w-12 items-center justify-center rounded-xl transition ${
                  item.active
                    ? "bg-[#eaf5ec] text-[#0b4d36]"
                    : "text-muted-foreground"
                }`}
              >
                <Icon
                  className="h-[19px] w-[19px]"
                  strokeWidth={item.active ? 2.4 : 2}
                />
              </div>

              <span
                className={`text-[10px] font-medium ${
                  item.active
                    ? "text-[#073b2a]"
                    : "text-muted-foreground"
                }`}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}