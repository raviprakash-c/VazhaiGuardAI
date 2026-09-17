import { Bell } from "lucide-react";

import VazhaiLogo from "../branding/VazhaiLogo";

export default function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-border/70 bg-white/95 px-4 backdrop-blur-xl lg:hidden">
      <VazhaiLogo />

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />

        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#f4d83f]" />
      </button>
    </header>
  );
}