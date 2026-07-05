import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

// Page path → human-readable Arabic label
const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/orders": "الطلبات",
  "/customers": "العملاء",
  "/phone-validator": "فحص أرقام العملاء",
  "/products": "المنتجات",
  "/debts": "المديونيات",
  "/suppliers": "الموردون",
  "/returns": "المرتجعات",
  "/expenses": "المصروفات",
  "/reps": "المناديب",
  "/rep-performance": "أداء المناديب",
  "/receipts": "معرض الإيصالات",
  "/reports": "التقارير",
  "/product-profitability": "ربحية المنتجات",
  "/rules": "قواعد الخصم",
  "/export": "التصدير",
  "/import": "الاستيراد",
  "/roles": "إدارة الصلاحيات",
  "/notifications": "الإشعارات",
  "/audit": "سجل الأحداث",
  "/settings": "الإعدادات",
  "/invoice-preview": "معاينة الفاتورة",
  "/change-password": "تغيير كلمة المرور",
  "/bulk-import-users": "استيراد المستخدمين",
  "/rep-dashboard": "لوحة المندوب",
};

function getPageLabel(path: string): string {
  const cleaned = path.replace(/\/[a-f0-9-]{36}/gi, "/:id").replace(/\/\d+/g, "/:id");
  return PAGE_LABELS[cleaned] || PAGE_LABELS[path] || path;
}

export async function logActivity(
  userEmail: string,
  userId: string,
  actionType: "login" | "logout" | "page_visit" | "action",
  actionName: string,
  extra: { entityType?: string; entityId?: string; details?: string; pagePath?: string } = {}
) {
  try {
    await supabase.from("user_activity_logs").insert({
      user_email: userEmail,
      user_id: userId,
      action_type: actionType,
      action_name: actionName,
      page_path: extra.pagePath || "",
      entity_type: extra.entityType || "",
      entity_id: extra.entityId || "",
      details: extra.details || "",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 200) : "",
    });
  } catch {
    // Silent fail — activity logging should never break the UX
  }
}

// Hook: auto-log page visits
export function usePageVisitLogger() {
  const { user } = useAuth();
  const location = useLocation();
  const lastLoggedPath = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.email || !user?.id) return;
    if (location.pathname === lastLoggedPath.current) return;

    // Debounce: only log if user stays on page for 1.5s (avoid rapid navigation spam)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      lastLoggedPath.current = location.pathname;
      logActivity(user.email, user.id, "page_visit", `زار ${getPageLabel(location.pathname)}`, {
        pagePath: location.pathname,
      });
    }, 1500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [location.pathname, user?.email, user?.id]);
}
