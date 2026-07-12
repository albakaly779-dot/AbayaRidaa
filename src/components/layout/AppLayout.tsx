import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Menu, AlertTriangle, Search, Command } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import GlobalSearch from "@/components/features/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePageVisitLogger } from "@/hooks/useActivityLogger";
import brandLogo from "@/assets/brand-logo.png";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuth();
  const { settings, initializeSettings } = useSettingsStore();

  // Auto-log page visits for activity tracking
  usePageVisitLogger();

  // Initialize settings globally so logo & invoice settings load on any first page
  useEffect(() => {
    if (user?.id) initializeSettings(user.id);
  }, [user?.id, initializeSettings]);

  // Global search keyboard shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
          <h1 className="font-kufi text-sm font-bold text-navy flex-1">{displayName}</h1>
          <button onClick={() => setSearchOpen(true)} className="rounded-lg p-2 hover:bg-gray-100 transition-all" aria-label="بحث">
            <Search className="size-4" />
          </button>
        </header>

        {/* Desktop search bar (top of content) */}
        <div className="hidden lg:flex sticky top-0 z-20 items-center justify-end gap-3 border-b bg-white/80 px-8 py-2.5 backdrop-blur-md">
          <button onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 hover:border-gold hover:text-navy transition-colors min-w-[300px] justify-between">
            <span className="flex items-center gap-2">
              <Search className="size-3.5" /> ابحث في كل شيء...
            </span>
            <span className="flex items-center gap-1 text-[10px] border border-gray-200 rounded-md px-1.5 py-0.5">
              <Command className="size-2.5" /> K
            </span>
          </button>
        </div>

        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

        {/* Password change banner if required */}
        {user?.mustChangePassword && (
          <div className="sticky top-0 z-40 bg-gradient-to-l from-amber-500 to-orange-500 text-white shadow-lg">
            <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
              <AlertTriangle className="size-4 shrink-0" />
              <p className="text-xs font-bold flex-1">يرجى تغيير كلمة المرور المؤقتة لأسباب أمنية</p>
              <Link to="/change-password" className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-[11px] font-bold transition-colors">
                تغيير كلمة المرور ←
              </Link>
            </div>
          </div>
        )}

        <main className="p-3 pb-20 sm:p-4 sm:pb-20 lg:p-8 lg:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav for mobile */}
        <BottomNav />
      </div>
    </div>
  );
}
