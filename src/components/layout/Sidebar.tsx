import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Users, Package, AlertTriangle,
  Truck, RotateCcw, Receipt, UserCheck, FileText, Bell, Download,
  Settings, LogOut, X, ClipboardList, Upload, Zap, Shield, Image, BarChart3, PhoneCall,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import brandLogo from "@/assets/brand-logo.png";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/orders", label: "الطلبات", icon: ShoppingBag, roles: ["admin", "operations"] },
  { path: "/customers", label: "العملاء", icon: Users },
  { path: "/phone-validator", label: "فحص الأرقام", icon: PhoneCall, roles: ["admin"] },
  { path: "/products", label: "المنتجات والمخزون", icon: Package, roles: ["admin", "operations"] },
  { path: "/debts", label: "المديونيات", icon: AlertTriangle, roles: ["admin"] },
  { path: "/suppliers", label: "الموردون", icon: Truck, roles: ["admin"] },
  { path: "/returns", label: "المرتجعات", icon: RotateCcw, roles: ["admin", "operations"] },
  { path: "/expenses", label: "المصروفات", icon: Receipt, roles: ["admin"] },
  { path: "/reps", label: "المناديب", icon: UserCheck, roles: ["admin"] },
  { path: "/rep-performance", label: "أداء المناديب", icon: BarChart3, roles: ["admin"] },
  { path: "/receipts", label: "معرض الإيصالات", icon: Image, roles: ["admin"] },
  { path: "/reports", label: "التقارير", icon: FileText, roles: ["admin"] },
  { path: "/rules", label: "محرك القواعد", icon: Zap, roles: ["admin"] },
  { path: "/notifications", label: "الإشعارات", icon: Bell },
  { path: "/export", label: "التصدير", icon: Download, roles: ["admin"] },
  { path: "/import", label: "استيراد البيانات", icon: Upload, roles: ["admin"] },
  { path: "/roles", label: "الصلاحيات", icon: Shield, roles: ["admin"] },
  { path: "/audit", label: "سجل الأحداث", icon: ClipboardList, roles: ["admin"] },
  { path: "/settings", label: "الإعدادات", icon: Settings, roles: ["admin"] },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "المدير العام",
  operations: "مدير عمليات",
  support: "دعم فني",
  rep: "مندوب",
};

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const { settings } = useSettingsStore();
  const displayLogo = settings.logoUrl || brandLogo;
  const displayName = settings.businessName || "رداء";

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (role === "admin") return true;
    return item.roles.includes(role);
  });

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 right-0 z-50 flex h-screen w-64 flex-col bg-navy transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={displayLogo} alt={displayName} className="size-10 rounded-xl object-cover bg-white" />
            <div>
              <h2 className="font-kufi text-sm font-bold text-white">{displayName}</h2>
              <p className="text-[10px] text-white/50">نظام إدارة المبيعات</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden transition-colors" aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-gold/20 text-gold-light" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
                <item.icon className="size-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-2">
          {user && (
            <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold-light">
                {user.username?.charAt(0) || "م"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.username || "المدير"}</p>
                <p className="text-[10px] text-white/40 truncate">{ROLE_LABELS[role] || role}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="size-[18px]" /> تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
