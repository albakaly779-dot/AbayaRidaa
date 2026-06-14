import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign, ShoppingBag, Users, AlertTriangle, ArrowLeft,
  TrendingUp, TrendingDown, Receipt, Loader2, Bell, X, MessageCircle, Send, CloudUpload,
  UserPlus, Phone, Tag, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useSupplierStore } from "@/stores/supplierStore";
import { useRepStore } from "@/stores/repStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getPaymentStatusLabel, getPaymentStatusColor } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import SalesChart from "@/components/features/SalesChart";
import WhatsAppButton from "@/components/features/WhatsAppButton";
import BulkWhatsAppDialog from "@/components/features/BulkWhatsAppDialog";
import BackupScheduler, { useBackupAlert } from "@/components/features/BackupScheduler";
import { WHATSAPP_TEMPLATES } from "@/constants/config";
import { supabase } from "@/lib/supabase";
import type { StockAlert } from "@/types";

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  whatsapp: { label: "واتساب", color: "bg-emerald-100 text-emerald-700", icon: "💬" },
  instagram: { label: "إنستقرام", color: "bg-pink-100 text-pink-700", icon: "📸" },
  facebook: { label: "فيسبوك", color: "bg-blue-100 text-blue-700", icon: "📘" },
  direct: { label: "زيارة مباشرة", color: "bg-amber-100 text-amber-700", icon: "🏪" },
  referral: { label: "توصية", color: "bg-purple-100 text-purple-700", icon: "🤝" },
  other: { label: "أخرى", color: "bg-gray-100 text-gray-600", icon: "•" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { orders, customers, loading, initializeData, getTotalSales, getTotalDebt, getDebtors } = useDataStore();
  const { getTotalExpenses, initializeData: initExpenses } = useExpenseStore();
  const { getTotalSupplierDebt, initializeData: initSuppliers } = useSupplierStore();
  const { getTotalPendingCommissions, initializeData: initReps } = useRepStore();
  const { settings, initializeSettings } = useSettingsStore();
  const backupAlert = useBackupAlert();

  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [bulkMode, setBulkMode] = useState<"debtors" | "ready" | null>(null);

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initExpenses(user.id);
      initSuppliers(user.id);
      initReps(user.id);
      initializeSettings(user.id);
    }
  }, [user?.id, initializeData, initExpenses, initSuppliers, initReps, initializeSettings]);

  useEffect(() => {
    const loadAlerts = async () => {
      const { data } = await supabase.from("products").select("code, name, stock_quantity, min_stock_alert, category")
        .gt("stock_quantity", 0).eq("is_active", true);
      if (data) {
        const alerts = data.filter((p: { stock_quantity: number; min_stock_alert: number }) => p.stock_quantity <= p.min_stock_alert)
          .map((p: { code: string; name: string; stock_quantity: number; min_stock_alert: number; category: string }) => ({
            code: p.code, name: p.name, stock: p.stock_quantity, minAlert: p.min_stock_alert, category: p.category,
          }));
        setStockAlerts(alerts);
      }
    };
    loadAlerts();
  }, []);

  // Last 5 customers added
  const recentCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 5);
  }, [customers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-navy" />
      </div>
    );
  }

  const totalSales = getTotalSales();
  const totalDebt = getTotalDebt();
  const totalExpenses = getTotalExpenses();
  const supplierDebt = getTotalSupplierDebt();
  const pendingCommissions = getTotalPendingCommissions();
  const debtors = getDebtors();
  const recentOrders = orders.slice(0, 7);
  const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const readyOrders = orders.filter((o) => o.status === "ready").length;
  const netIncome = totalSales - totalExpenses - pendingCommissions;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">مرحباً، {user?.username || "المدير"} 👋</h1>
          <p className="text-xs text-gray-500 sm:text-sm">إليك ملخص أعمالك اليوم</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {debtors.length > 0 && (
            <button onClick={() => setBulkMode("debtors")}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
              <Send className="size-3.5" /> مطالبة المدينين ({debtors.length})
            </button>
          )}
          {readyOrders > 0 && (
            <button onClick={() => setBulkMode("ready")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <MessageCircle className="size-3.5" /> إبلاغ الجاهزة ({readyOrders})
            </button>
          )}
          {settings.featureStockAlerts && stockAlerts.length > 0 && (
            <Link to="/products" className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 animate-pulse">
              <Bell className="size-3.5" /> {stockAlerts.length} تنبيه مخزون
            </Link>
          )}
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 sm:rounded-xl sm:px-4 sm:py-2 ${netIncome > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            {netIncome > 0 ? <TrendingUp className="size-3.5 text-emerald-600 sm:size-4" /> : <TrendingDown className="size-3.5 text-red-600 sm:size-4" />}
            <span className={`text-xs font-semibold sm:text-sm ${netIncome > 0 ? "text-emerald-700" : "text-red-700"}`}>
              صافي: {formatCurrency(netIncome)}
            </span>
          </div>
        </div>
      </div>

      {backupAlert.showAlert && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <div>
                <p className="text-sm font-bold text-red-700">تحذير: لم يتم أخذ نسخة احتياطية منذ {backupAlert.daysSince} يوم!</p>
                <p className="text-xs text-red-500">يُنصح بأخذ نسخة احتياطية لحماية بياناتك</p>
              </div>
            </div>
            <Link to="/export"
              className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors">
              <CloudUpload className="size-3.5" /> نسخ الآن
            </Link>
          </div>
        </div>
      )}

      {showAlerts && settings.featureStockAlerts && stockAlerts.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2"><AlertTriangle className="size-4" /> تنبيهات انخفاض المخزون</h3>
            <button onClick={() => setShowAlerts(false)} className="text-amber-600 hover:text-amber-800"><X className="size-4" /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stockAlerts.slice(0, 6).map((a) => (
              <div key={a.code} className="shrink-0 flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-amber-200">
                <span className="text-xs font-bold text-navy" dir="ltr">{a.code}</span>
                <span className="text-xs text-amber-600 font-semibold">{a.stock} متبقي</span>
              </div>
            ))}
            {stockAlerts.length > 6 && (
              <Link to="/products" className="shrink-0 flex items-center rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">
                +{stockAlerts.length - 6} المزيد
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="إجمالي المبيعات" value={formatCurrency(totalSales)} icon={DollarSign} trend={`${formatCurrency(totalSales, "SAR")}`} trendUp delay={0} />
        <StatCard title="الطلبات النشطة" value={`${activeOrders} طلب`} icon={ShoppingBag} trend={`${orders.length} إجمالي · ${readyOrders} جاهزة`} trendUp delay={1} />
        <StatCard title="المصروفات" value={formatCurrency(totalExpenses)} icon={Receipt} trend={`عمولات: ${formatCurrency(pendingCommissions)}`} delay={2} />
        <StatCard title="المديونيات" value={formatCurrency(totalDebt)} icon={AlertTriangle}
          trend={`زبائن: ${debtors.length} · موردين: ${formatCurrency(supplierDebt)}`} trendUp={false} delay={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy sm:text-base">الرسوم البيانية</h2>
            <Link to="/reports" className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-dark">
              التقارير <ArrowLeft className="size-3" />
            </Link>
          </div>
          <SalesChart />
        </div>

        <div className="xl:col-span-4 space-y-4">
          <BackupScheduler compact />

          <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 lg:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy sm:text-base">أعلى المديونيات</h2>
              <div className="flex items-center gap-2">
                {debtors.length > 0 && (
                  <button onClick={() => setBulkMode("debtors")} className="flex items-center gap-1 text-[10px] font-semibold text-red-600 hover:text-red-700 bg-red-50 rounded-lg px-2 py-1">
                    <Send className="size-3" /> مطالبة الكل
                  </button>
                )}
                <Link to="/debts" className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-dark">
                  عرض الكل <ArrowLeft className="size-3" />
                </Link>
              </div>
            </div>
            <div className="space-y-2.5">
              {debtors.slice(0, 5).map((d, idx) => (
                <div key={d.customer.id} className="flex items-center justify-between rounded-xl bg-cream/60 p-2.5 sm:p-3 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(idx + 4) * 100}ms` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                      {d.customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy sm:text-sm">{d.customer.name}</p>
                      <p className="text-[10px] text-gray-400">{d.orders.length} طلبات</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-left">
                      <span className="text-xs font-bold text-red-600 tabular-nums sm:text-sm">{formatCurrency(d.debt)}</span>
                      <p className="text-[10px] text-gray-400">{formatCurrency(d.debt, "SAR")}</p>
                    </div>
                    <WhatsAppButton phone={d.customer.phone} message={WHATSAPP_TEMPLATES.paymentReminder(d.customer.name, d.debt)} />
                  </div>
                </div>
              ))}
              {debtors.length === 0 && <p className="py-8 text-center text-sm text-gray-400">لا توجد مديونيات 🎉</p>}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Recent Customers Widget */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 lg:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2">
              <UserPlus className="size-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-navy sm:text-base">آخر العملاء المضافين</h2>
              <p className="text-[10px] text-gray-400">أحدث 5 عملاء وُضِعوا في النظام</p>
            </div>
          </div>
          <Link to="/customers" className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-dark">
            عرض كل العملاء <ArrowLeft className="size-3" />
          </Link>
        </div>
        {recentCustomers.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto size-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">لم يتم إضافة عملاء بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {recentCustomers.map((c, idx) => {
              const sourceInfo = SOURCE_LABELS[c.source || "other"] || SOURCE_LABELS.other;
              return (
                <Link key={c.id} to={`/customers/${c.id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-gray-100 bg-cream/30 p-3 hover:border-gold hover:shadow-md transition-all animate-fade-in opacity-0"
                  style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-bl from-emerald-500 to-emerald-600 text-sm font-bold text-white">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy truncate group-hover:text-gold transition-colors">{c.name}</p>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1" dir="ltr">
                        <Phone className="size-2.5" /> {c.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-semibold ${sourceInfo.color}`}>
                      <span>{sourceInfo.icon}</span> {sourceInfo.label}
                    </span>
                    {c.addedByName && c.addedByName !== user?.username && (
                      <span className="text-[9px] text-gray-400 truncate" title={`أضافه: ${c.addedByName}`}>
                        بواسطة {c.addedByName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100">
                    <span className="flex items-center gap-1"><Clock className="size-2.5" /> {formatDate(c.createdAt)}</span>
                    {c.city && <span className="truncate">{c.city}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 lg:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy sm:text-base">آخر الطلبات</h2>
          <Link to="/orders" className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-dark">
            عرض الكل <ArrowLeft className="size-3" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b text-right">
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">رقم الطلب</th>
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">العميل</th>
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">المبلغ</th>
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">الحالة</th>
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">الدفع</th>
                <th className="pb-2.5 text-[11px] font-semibold text-gray-400 sm:text-xs">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentOrders.map((order, idx) => (
                <tr key={order.id} className="animate-fade-in opacity-0" style={{ animationDelay: `${(idx + 6) * 60}ms` }}>
                  <td className="py-2.5 text-xs font-semibold text-navy sm:text-sm" dir="ltr">{order.orderNumber}</td>
                  <td className="py-2.5 text-xs text-gray-700 sm:text-sm">{order.customerName}</td>
                  <td className="py-2.5">
                    <span className="text-xs font-bold text-gold tabular-nums sm:text-sm">{formatCurrency(order.total)}</span>
                    <span className="text-[10px] text-gray-400 ms-1">{formatCurrency(order.total, "SAR")}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${getPaymentStatusColor(order.paymentStatus)}`}>{getPaymentStatusLabel(order.paymentStatus)}</span>
                  </td>
                  <td className="py-2.5 text-[10px] text-gray-400 sm:text-xs">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && <p className="py-8 text-center text-sm text-gray-400">لا توجد طلبات بعد — أضف أول طلب من صفحة الطلبات</p>}
      </div>

      {bulkMode && <BulkWhatsAppDialog open={!!bulkMode} onClose={() => setBulkMode(null)} mode={bulkMode} />}
    </div>
  );
}
