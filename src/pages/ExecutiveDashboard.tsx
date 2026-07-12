import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, DollarSign, ShoppingBag, TrendingUp, TrendingDown, Users, Package, RotateCcw, Award, Calendar, Target, Zap, Sparkles, PieChart, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useRepStore } from "@/stores/repStore";
import { useReturnStore } from "@/stores/returnStore";
import { usePartnersStore } from "@/stores/partnersStore";
import { formatCurrency } from "@/lib/formatters";
import SalesChart from "@/components/features/SalesChart";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#1B2A4A", "#C9A84C", "#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const { orders, customers, initializeData, getTotalSales } = useDataStore();
  const { getTotalExpenses, expenses, initializeData: initExp } = useExpenseStore();
  const { getTotalPendingCommissions, commissions, initializeData: initReps } = useRepStore();
  const { returns, initializeData: initReturns } = useReturnStore();
  const { partners, initializePartners, distributeProfit } = usePartnersStore();

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initExp(user.id);
      initReps(user.id);
      initReturns(user.id);
      initializePartners(user.id);
    }
  }, [user?.id, initializeData, initExp, initReps, initReturns, initializePartners]);

  const totalSales = getTotalSales();
  const totalExpenses = getTotalExpenses();
  const totalCommissions = getTotalPendingCommissions();
  const totalReturns = returns.reduce((s, r) => s + r.totalAmount, 0);
  const distribution = distributeProfit(totalSales, totalExpenses + totalCommissions);
  const netProfit = distribution.netProfit;
  const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Time-based aggregations
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.substring(0, 7);
  const thisYear = today.substring(0, 4);

  const dailySales = orders.filter((o) => o.createdAt === today).reduce((s, o) => s + o.total, 0);
  const monthlySales = orders.filter((o) => o.createdAt?.startsWith(thisMonth)).reduce((s, o) => s + o.total, 0);
  const yearlySales = orders.filter((o) => o.createdAt?.startsWith(thisYear)).reduce((s, o) => s + o.total, 0);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((o) => {
      o.items?.forEach((it) => {
        const existing = map.get(it.productName);
        if (existing) {
          existing.qty += it.quantity;
          existing.revenue += it.total;
        } else {
          map.set(it.productName, { name: it.productName, qty: it.quantity, revenue: it.total });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  // Top rep
  const topRep = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    orders.forEach((o) => {
      if (!o.repName) return;
      const e = map.get(o.repName);
      if (e) { e.orders += 1; e.revenue += o.total; }
      else map.set(o.repName, { name: o.repName, orders: 1, revenue: o.total });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)[0];
  }, [orders]);

  // Expense categories
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([category, amount]) => ({ name: category, value: amount }));
  }, [expenses]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="rounded-2xl bg-gradient-to-bl from-navy via-navy-light to-navy p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-6 text-gold" /> اللوحة التنفيذية
            </h1>
            <p className="text-sm text-white/80">مؤشرات لحظية للأداء المالي والتشغيلي</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Calendar className="size-3.5" />
            {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-500/20">
          <DollarSign className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجمالي المبيعات</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalSales)}</p>
          <p className="text-[10px] text-white/60 mt-1">اليوم: {formatCurrency(dailySales)}</p>
        </div>
        <div className={`rounded-2xl p-4 text-white shadow-lg ${netProfit >= 0 ? "bg-gradient-to-bl from-navy to-navy-light shadow-navy/20" : "bg-gradient-to-bl from-red-500 to-red-600 shadow-red-500/20"}`}>
          {netProfit >= 0 ? <TrendingUp className="size-5 mb-2" /> : <TrendingDown className="size-5 mb-2" />}
          <p className="text-xs text-white/80">صافي الربح</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(netProfit)}</p>
          <p className="text-[10px] text-white/60 mt-1">الهامش: {margin.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-red-500 to-red-600 p-4 text-white shadow-lg shadow-red-500/20">
          <TrendingDown className="size-5 mb-2" />
          <p className="text-xs text-white/80">المصروفات</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalExpenses)}</p>
          <p className="text-[10px] text-white/60 mt-1">عمولات: {formatCurrency(totalCommissions)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-gold to-gold-dark p-4 text-white shadow-lg shadow-gold/20">
          <Award className="size-5 mb-2" />
          <p className="text-xs text-white/80">أعلى مندوب</p>
          <p className="text-sm font-bold truncate">{topRep?.name || "لا يوجد"}</p>
          <p className="text-[10px] text-white/70 mt-1">{topRep ? formatCurrency(topRep.revenue) : "—"}</p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <ShoppingBag className="size-4 text-blue-600 mb-1" />
          <p className="text-[10px] text-gray-500">عدد الطلبات</p>
          <p className="text-lg font-bold text-navy tabular-nums">{orders.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Users className="size-4 text-purple-600 mb-1" />
          <p className="text-[10px] text-gray-500">العملاء</p>
          <p className="text-lg font-bold text-navy tabular-nums">{customers.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <RotateCcw className="size-4 text-amber-600 mb-1" />
          <p className="text-[10px] text-gray-500">المرتجعات</p>
          <p className="text-lg font-bold text-navy tabular-nums">{returns.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Package className="size-4 text-cyan-600 mb-1" />
          <p className="text-[10px] text-gray-500">قيمة المرتجعات</p>
          <p className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(totalReturns)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Target className="size-4 text-emerald-600 mb-1" />
          <p className="text-[10px] text-gray-500">مبيعات الشهر</p>
          <p className="text-sm font-bold text-navy tabular-nums">{formatCurrency(monthlySales)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Zap className="size-4 text-gold-dark mb-1" />
          <p className="text-[10px] text-gray-500">مبيعات السنة</p>
          <p className="text-sm font-bold text-navy tabular-nums">{formatCurrency(yearlySales)}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4">📈 حركة المبيعات</h3>
          <SalesChart />
        </div>

        {expenseByCategory.length > 0 && (
          <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-navy mb-4">💸 توزيع المصروفات</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RePieChart>
                <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                  label={(entry: { name: string; percent?: number }) => `${entry.name} ${((entry.percent || 0) * 100).toFixed(0)}%`}>
                  {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4">🏆 أفضل 5 منتجات مبيعاً</h3>
        {topProducts.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">لا توجد بيانات</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="revenue" fill="#C9A84C" name="الإيرادات" radius={[8, 8, 0, 0]} />
              <Bar dataKey="qty" fill="#1B2A4A" name="الكمية" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Partner distribution */}
      {partners.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-bl from-cream to-white p-5 border border-gold/20 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-navy flex items-center gap-2">
              <PieChart className="size-4 text-gold" /> توزيع الأرباح على الشركاء
            </h3>
            <Link to="/partners" className="flex items-center gap-1 text-xs font-bold text-gold hover:text-gold-dark">
              إدارة الشركاء <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {distribution.distributions.map((d) => (
              <div key={d.partner.id} className="rounded-xl bg-white p-4 border border-gray-100">
                <p className="text-xs font-bold text-navy">{d.partner.partnerName}</p>
                <p className="text-[10px] text-gray-500">{d.partner.percentage}%</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums mt-1">{formatCurrency(d.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/reports-automation" className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-xs font-bold text-navy">تقارير Excel</p>
          <p className="text-[10px] text-gray-500">توليد وإرسال آلي</p>
        </Link>
        <Link to="/partners" className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-gold transition-all">
          <div className="text-2xl mb-2">🤝</div>
          <p className="text-xs font-bold text-navy">الشركاء</p>
          <p className="text-[10px] text-gray-500">نسب التوزيع</p>
        </Link>
        <Link to="/activity-analytics" className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
          <div className="text-2xl mb-2">📈</div>
          <p className="text-xs font-bold text-navy">تحليلات النشاط</p>
          <p className="text-[10px] text-gray-500">نشاط المستخدمين</p>
        </Link>
        <Link to="/audit" className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-300 transition-all">
          <div className="text-2xl mb-2">🔒</div>
          <p className="text-xs font-bold text-navy">سجل التدقيق</p>
          <p className="text-[10px] text-gray-500">جميع العمليات</p>
        </Link>
      </div>
    </div>
  );
}
