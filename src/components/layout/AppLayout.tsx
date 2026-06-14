import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import brandLogo from "@/assets/brand-logo.png";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { settings, initializeSettings } = useSettingsStore();

  // Initialize settings globally so logo & invoice settings load on any first page
  useEffect(() => {
    if (user?.id) initializeSettings(user.id);
  }, [user?.id, initializeSettings]);

  const displayLogo = settings.logoUrl || brandLogo;
  const displayName = settings.businessName || "رداء";

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 lg:mr-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-gray-100 active:scale-95 transition-all" aria-label="فتح القائمة">
            <Menu className="size-5" />
          </button>
          <img src={displayLogo} alt={displayName} className="size-7 rounded-lg object-cover" />
          <h1 className="font-kufi text-sm font-bold text-navy">{displayName}</h1>
        </header>

        <main className="p-3 pb-20 sm:p-4 sm:pb-20 lg:p-8 lg:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav for mobile */}
        <BottomNav />
      </div>
    </div>
  );
}
