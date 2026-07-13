import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Users, Package, AlertTriangle,
  Truck, RotateCcw, Receipt, UserCheck, FileText, Bell, Download,
  Settings, LogOut, X, ClipboardList, Upload, Zap, Shield, Image, BarChart3, PhoneCall, KeyRound,
  PieChart, FileSpreadsheet, Sparkles, Activity, FileImage, Mail, DollarSign,
  ShieldCheck, HardDrive, MonitorSmartphone,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import brandLogo from "@/assets/brand-logo.png";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  section?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  // Dashboards
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, section: "لوحات" },
  { path: "/executive-dashboard", label: "اللوحة التنفيذية", icon: Sparkles, roles: ["admin"], section: "لوحات" },
  { path: "/partner-dashboard", label: "لوحة الشريك", icon: PieChart, roles: ["admin"], section: "لوحات" },
  // Operations
  { path: "/orders", label: "الطلبات", icon: ShoppingBag, roles: ["admin", "operations"], section: "العمليات" },
  { path: "/customers", label: "العملاء", icon: Users, section: "العمليات" },
  { path: "/phone-validator", label: "فحص الأرقام", icon: PhoneCall, roles: ["admin"], section: "العمليات" },
  { path: "/products", label: "المنتجات والمخزون", icon: Package, roles: ["admin", "operations"], section: "العمليات" },
  { path: "/debts", label: "المديونيات", icon: AlertTriangle, roles: ["admin"], section: "العمليات" },
  { path: "/suppliers", label: "الموردون", icon: Truck, roles: ["admin"], section: "العمليات" },
  { path: "/returns", label: "المرتجعات", icon: RotateCcw, roles: ["admin", "operations"], section: "العمليات" },
  { path: "/expenses", label: "المصروفات", icon: Receipt, roles: ["admin"], section: "العمليات" },
  // Team
  { path: "/reps", label: "المناديب", icon: UserCheck, roles: ["admin"], section: "الفريق" },
  { path: "/rep-performance", label: "أداء المناديب", icon: BarChart3, roles: ["admin"], section: "الفريق" },
  { path: "/rep-pricing", label: "تسعير المناديب", icon: DollarSign, roles: ["admin"], section: "الفريق" },
  { path: "/receipts", label: "معرض الإيصالات", icon: Image, roles: ["admin"], section: "الفريق" },
  { path: "/partners", label: "الشركاء", icon: PieChart, roles: ["admin"], section: "الفريق" },
  // Reports
  { path: "/reports", label: "التقارير", icon: FileText, roles: ["admin"], section: "التقارير" },
  { path: "/reports-automation", label: "تقارير Excel", icon: FileSpreadsheet, roles: ["admin"], section: "التقارير" },
  { path: "/activity-analytics", label: "تحليلات النشاط", icon: Activity, roles: ["admin"], section: "التقارير" },
  { path: "/rules", label: "محرك القواعد", icon: Zap, roles: ["admin"], section: "التقارير" },
  // System
  { path: "/notifications", label: "الإشعارات", icon: Bell, section: "النظام" },
  { path: "/export", label: "التصدير", icon: Download, roles: ["admin"], section: "النظام" },
  { path: "/import", label: "استيراد البيانات", icon: Upload, roles: ["admin"], section: "النظام" },
  { path: "/roles", label: "الصلاحيات", icon: Shield, roles: ["admin"], section: "النظام" },
  { path: "/audit", label: "سجل الأحداث", icon: ClipboardList, roles: ["admin"], section: "النظام" },
  { path: "/invoice-templates", label: "قوالب الفواتير", icon: FileImage, roles: ["admin"], section: "النظام" },
  { path: "/email-templates", label: "قوالب البريد", icon: Mail, roles: ["admin"], section: "النظام" },
  { path: "/approvals", label: "نظام الموافقات", icon: ShieldCheck, roles: ["admin", "operations"], section: "النظام" },
  { path: "/sessions", label: "إدارة الجلسات", icon: MonitorSmartphone, section: "النظام" },
  { path: "/smart-backups", label: "النسخ الاحتياطي", icon: HardDrive, roles: ["admin"], section: "النظام" },
  { path: "/settings", label: "الإعدادات", icon: Settings, roles: ["admin"], section: "النظام" },
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

  // Group by section
  const grouped: Record<string, NavItem[]> = {};
  navItems.forEach((item) => {
    const sec = item.section || "أخرى";
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(item);
  });

  const handleLogout = async () => { await logout(); };

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

        <nav className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              <p className="text-[9px] font-bold text-white/40 px-3 mb-1 uppercase tracking-wider">{section}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
                  return (
                    <Link key={item.path} to={item.path} onClick={onClose}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${isActive ? "bg-gold/20 text-gold-light" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
          <Link to="/change-password" onClick={onClose}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            <KeyRound className="size-4" /> تغيير كلمة المرور
          </Link>
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="size-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
