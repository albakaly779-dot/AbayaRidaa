import { useEffect } from "react";
import { Eye, DollarSign, TrendingUp, TrendingDown, PieChart, Loader2, Lock, ShoppingBag, Users, Package, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnersStore } from "@/stores/partnersStore";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useRepStore } from "@/stores/repStore";
import { formatCurrency } from "@/lib/formatters";
import SalesChart from "@/components/features/SalesChart";

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { partners, initializePartners, distributeProfit, loading } = usePartnersStore();
  const { orders, customers, initializeData, getTotalSales } = useDataStore();
  const { getTotalExpenses, expenses, initializeData: initExp } = useExpenseStore();
  const { getTotalPendingCommissions, initializeData: initReps } = useRepStore();

  useEffect(() => {
    if (user?.id) {
      initializePartners(user.id);
      initializeData(user.id);
      initExp(user.id);
      initReps(user.id);
    }
  }, [user?.id, initializePartners, initializeData, initExp, initReps]);

  const totalRevenue = getTotalSales();
  const totalExpenses = getTotalExpenses() + getTotalPendingCommissions();
  const result = distributeProfit(totalRevenue, totalExpenses);

  const currentPartner = partners.find((p) => p.partnerEmail === user?.email);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-bl from-navy to-navy-light p-6 text-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-xl bg-white/20 p-3"><Eye className="size-6" /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              لوحة الشريك
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                <Lock className="size-3" /> قراءة فقط
              </span>
            </h1>
            <p className="text-sm text-white/80">
              مرحباً {currentPartner?.partnerName || user?.username || user?.email} — عرض تحليلي للنشاط
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="rounded-lg bg-emerald-50 p-2 w-fit mb-2"><DollarSign className="size-4 text-emerald-600" /></div>
          <p className="text-xs text-gray-500">إجمالي المبيعات</p>
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="rounded-lg bg-red-50 p-2 w-fit mb-2"><TrendingDown className="size-4 text-red-600" /></div>
          <p className="text-xs text-gray-500">المصروفات</p>
          <p className="text-lg font-bold text-red-700 tabular-nums">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="rounded-lg bg-navy/10 p-2 w-fit mb-2"><TrendingUp className={`size-4 ${result.netProfit >= 0 ? "text-navy" : "text-red-600"}`} /></div>
          <p className="text-xs text-gray-500">صافي الربح</p>
          <p className={`text-lg font-bold tabular-nums ${result.netProfit >= 0 ? "text-navy" : "text-red-700"}`}>{formatCurrency(result.netProfit)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-gold to-gold-dark p-4 text-white shadow-lg shadow-gold/20">
          <div className="rounded-lg bg-white/20 p-2 w-fit mb-2"><PieChart className="size-4" /></div>
          <p className="text-xs text-white/80">نصيبك</p>
          <p className="text-lg font-bold tabular-nums">
            {currentPartner
              ? formatCurrency(result.distributions.find((d) => d.partner.id === currentPartner.id)?.amount || 0)
              : "—"}
          </p>
        </div>
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="size-4 text-blue-600" />
            <p className="text-xs text-gray-500">عدد الطلبات</p>
          </div>
          <p className="text-xl font-bold text-navy tabular-nums">{orders.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-4 text-purple-600" />
            <p className="text-xs text-gray-500">عدد العملاء</p>
          </div>
          <p className="text-xl font-bold text-navy tabular-nums">{customers.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Package className="size-4 text-amber-600" />
            <p className="text-xs text-gray-500">عدد المصروفات</p>
          </div>
          <p className="text-xl font-bold text-navy tabular-nums">{expenses.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-4 text-emerald-600" />
            <p className="text-xs text-gray-500">هامش الربح</p>
          </div>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">
            {totalRevenue > 0 ? ((result.netProfit / totalRevenue) * 100).toFixed(1) : "0"}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4">حركة المبيعات</h3>
        <SalesChart />
      </div>

      {/* Distribution */}
      <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
          <PieChart className="size-4" /> توزيع الأرباح على الشركاء
        </h3>
        <div className="space-y-2">
          {result.distributions.map((d) => (
            <div key={d.partner.id} className={`flex items-center justify-between rounded-xl p-3 border ${
              currentPartner?.id === d.partner.id ? "bg-gold/10 border-gold" : "bg-cream/40 border-gray-100"
            }`}>
              <div>
                <p className="text-sm font-bold text-navy">
                  {d.partner.partnerName}
                  {currentPartner?.id === d.partner.id && <span className="ms-2 text-[10px] rounded-full bg-gold px-2 py-0.5 text-white">أنت</span>}
                </p>
                <p className="text-[10px] text-gray-500">{d.partner.percentage}% من الأرباح</p>
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-emerald-600 tabular-nums">{formatCurrency(d.amount)}</p>
                <p className="text-[10px] text-gray-500 tabular-nums">{formatCurrency(d.amount, "SAR")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
        <Lock className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          <b>وضع القراءة فقط:</b> هذه اللوحة مخصصة لعرض الأرقام والتحليلات فقط.
          لا يمكنك تعديل أو حذف أو إضافة أي بيانات — تواصل مع المالك للتعديلات.
        </p>
      </div>
    </div>
  );
}
