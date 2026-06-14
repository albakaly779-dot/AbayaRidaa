import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Users, Package, AlertTriangle, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import { supabase } from "@/lib/supabase";
import brandLogo from "@/assets/brand-logo.png";

export default function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  const { settings } = useSettingsStore();
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const displayLogo = settings.logoUrl || brandLogo;

  const NAV_ITEMS = role === "admin" ? [
    { path: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, isLogo: true },
    { path: "/orders", label: "الطلبات", icon: ShoppingBag },
    { path: "/products", label: "المنتجات", icon: Package },
    { path: "/debts", label: "الديون", icon: AlertTriangle },
    { path: "/reports", label: "التقارير", icon: BarChart3 },
  ] : role === "operations" ? [
    { path: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, isLogo: true },
    { path: "/orders", label: "الطلبات", icon: ShoppingBag },
    { path: "/customers", label: "العملاء", icon: Users },
    { path: "/products", label: "المنتجات", icon: Package },
  ] : [
    { path: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, isLogo: true },
    { path: "/customers", label: "العملاء", icon: Users },
    { path: "/notifications", label: "الإشعارات", icon: AlertTriangle },
  ];

  useEffect(() => {
    supabase.from("products").select("code, stock_quantity, min_stock_alert")
      .eq("is_active", true).gt("stock_quantity", 0)
      .then(({ data }) => {
        if (data) {
          const alerts = data.filter((p: { stock_quantity: number; min_stock_alert: number }) => p.stock_quantity <= p.min_stock_alert);
          setStockAlertCount(alerts.length);
        }
      });
  }, [location.pathname]);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur-lg safe-area-bottom lg:hidden">
      <div className="flex items-center justify-around px-1 py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
          const showBadge = item.path === "/products" && stockAlertCount > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 min-w-[56px] transition-all active:scale-95 ${
                isActive ? "text-navy bg-gold/15" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className="relative">
                {item.isLogo && isActive ? (
                  <img src={displayLogo} alt="" className="size-5 rounded object-cover" />
                ) : (
                  <item.icon className={`size-5 ${isActive ? "text-navy" : ""}`} />
                )}
                {showBadge && (
                  <span className="absolute -top-1 -start-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white">
                    {stockAlertCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold leading-tight ${isActive ? "text-navy" : ""}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -top-0.5 inset-x-3 h-0.5 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
