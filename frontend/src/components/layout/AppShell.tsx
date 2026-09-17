import { Outlet } from "react-router-dom";

import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";
import MobileHeader from "./MobileHeader";
import TopHeader from "./TopHeader";

export default function AppShell() {
  return (
    <div className="vg-page-background min-h-screen">
      <DesktopSidebar />

      <div className="min-h-screen lg:pl-[260px]">
        <TopHeader />

        <MobileHeader />

        <main className="min-h-[calc(100vh-72px)] pb-24 lg:min-h-[calc(100vh-88px)] lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}