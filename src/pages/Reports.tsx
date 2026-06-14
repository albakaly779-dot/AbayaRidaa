
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Calendar, UserCheck, Download, Printer, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useReturnStore } from "@/stores/returnStore";
import { useSupplierStore } from "@/stores/supplierStore";
import { useRepStore } from "@/stores/repStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatCurrency, formatDual, getExpenseCategoryLabel, exportToJSON } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import { APP_CONFIG } from "@/constants/config";
import { toast } from "sonner";

const COLORS = ["hsl(222 40% 20%)", "hsl(40 52% 55%)", "hsl(160 60% 42%)", "hsl(0 84% 60%)", "hsl(217 71% 53%)", "hsl(38 92% 50%)", "hsl(280 60% 50%)", "hsl(180 50% 45%)"];
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function Reports() {
  const { user } = useAuth();
  const { orders, getTotalSales, getTotalDebt, initializeData } = useDataStore();
  const { expenses, getTotalExpenses, getExpensesByCategory, getFixedExpenses, getVariableExpenses, initializeData: initExp } = useExpenseStore();
  const { getTotalCustomerReturns, getTotalSupplierReturns, initializeData: initRet } = useReturnStore();
  const { getTotalSupplierDebt, initializeData: initSup } = useSupplierStore();
  const { getTotalCommissions, getTotalPendingCommissions, initializeData: initRep } = useRepStore();
  const { settings, initializeSettings } = useSettingsStore();

  useEffect(() => {
    if (user?.id) { initializeData(user.id); initExp(user.id); initRet(user.id); initSup(user.id); initRep(user.id); initializeSettings(user.id); }
  }, [user?.id, initializeData, initExp, initRet, initSup, initRep, initializeSettings]);

  const fixedExpensesList = settings.fixedExpenses;
  const totalFixedFromSettings = fixedExpensesList.reduce((s, f) => s + f.amount, 0);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthly, setShowMonthly] = useState<number | null>(null);

  const totalSales = getTotalSales();
  const totalExpenses = getTotalExpenses();
  const totalCommissions = getTotalCommissions();
  const totalCustomerReturns = getTotalCustomerReturns();
  const customerDebt = getTotalDebt();
  const supplierDebt = getTotalSupplierDebt();
  const fixedExpensesTotal = getFixedExpenses();
  const variableExpenses = getVariableExpenses();

  const productionCosts = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + ((item.buyPrice || 0) * item.quantity), 0), 0);
  }, [orders]);

  const netIncome = totalSales - productionCosts - totalCommissions - totalExpenses;

  const monthlySalesData = useMemo(() => {
    return months.map((month, idx) => {
      const monthOrders = orders.filter((o) => { const d = new Date(o.createdAt); return d.getFullYear() === selectedYear && d.getMonth() === idx; });
      const monthExpenses = expenses.filter((e) => { const d = new Date(e.date); return d.getFullYear() === selectedYear && d.getMonth() === idx; });
      const sales = monthOrders.reduce((s, o) => s + o.total, 0);
      const exp = monthExpenses.reduce((s, e) => s + e.amount, 0);
      const prodCost = monthOrders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + ((item.buyPrice || 0) * item.quantity), 0), 0);
      return { month, monthIdx: idx, sales, expenses: exp, orders: monthOrders.length, profit: sales - exp - prodCost, productionCosts: prodCost };
    });
  }, [orders, expenses, selectedYear]);

  const expenseBreakdown = useMemo(() => {
    const byCategory = getExpensesByCategory();
    return Object.entries(byCategory).map(([cat, amount]) => ({ name: getExpenseCategoryLabel(cat), value: amount }))
      .filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const topProducts = useMemo(() => {
    const productCount: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => o.items.forEach((item) => {
      if (!productCount[item.productName]) productCount[item.productName] = { count: 0, revenue: 0 };
      productCount[item.productName].count += item.quantity;
      productCount[item.productName].revenue += item.total;
    }));
    return Object.entries(productCount).map(([name, data]) => ({ name: name.length > 20 ? name.substring(0, 20) + "..." : name, ...data }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [orders]);

  const handlePrintMonthlyReport = (monthIdx: number) => {
    const m = monthlySalesData[monthIdx];
    const fixedTotal = totalFixedFromSettings;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير ${m.month} ${selectedYear} - رداء</title>
      <style>body{font-family:Cairo,sans-serif;padding:40px;color:#1a2332;max-width:800px;margin:auto}
      h1{font-size:24px;color:#1a2332;border-bottom:3px solid #c9a84c;padding-bottom:10px}
      h2{font-size:18px;color:#1a2332;margin-top:30px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
      .card{background:#f8f6f0;border-radius:12px;padding:16px;text-align:center}
      .card .label{font-size:12px;color:#666}
      .card .value{font-size:20px;font-weight:bold;margin-top:4px}
      .green{color:#22c55e}.red{color:#ef4444}.gold{color:#c9a84c}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th,td{padding:10px;text-align:right;border-bottom:1px solid #eee}
      th{background:#f8f6f0;font-size:13px;color:#666}
      .footer{margin-top:40px;text-align:center;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:20px}
      @media print{body{padding:20px}}</style></head><body>
      <h1>📊 تقرير شهر ${m.month} ${selectedYear}</h1><p style="color:#666">رداء — نظام إدارة المبيعات</p>
      <div class="grid">
        <div class="card"><div class="label">إجمالي المبيعات</div><div class="value gold">${m.sales.toLocaleString("ar-YE")} ر.ي</div></div>
        <div class="card"><div class="label">عدد الطلبات</div><div class="value">${m.orders}</div></div>
        <div class="card"><div class="label">تكاليف الإنتاج</div><div class="value red">${m.productionCosts.toLocaleString("ar-YE")} ر.ي</div></div>
        <div class="card"><div class="label">المصروفات</div><div class="value red">${m.expenses.toLocaleString("ar-YE")} ر.ي</div></div>
      </div>
      <h2>حساب صافي الربح</h2>
      <table><tr><td>إجمالي المبيعات</td><td class="gold" style="font-weight:bold">${m.sales.toLocaleString("ar-YE")} ر.ي</td></tr>
      <tr><td>(-) تكاليف الإنتاج</td><td class="red">${m.productionCosts.toLocaleString("ar-YE")} ر.ي</td></tr>
      <tr><td>(-) المصروفات المتغيرة</td><td class="red">${m.expenses.toLocaleString("ar-YE")} ر.ي</td></tr>
      <tr><td>(-) المصاريف الثابتة (رواتب+إيجار+كهرباء+إعلانات)</td><td class="red">${fixedTotal.toLocaleString("ar-YE")} ر.ي</td></tr>
      <tr style="border-top:3px solid #1a2332"><td style="font-weight:bold;font-size:16px">= صافي الربح</td>
      <td style="font-weight:bold;font-size:18px" class="${m.profit - fixedTotal >= 0 ? 'green' : 'red'}">${(m.profit - fixedTotal).toLocaleString("ar-YE")} ر.ي</td></tr>
      <tr><td>بالريال السعودي</td><td style="font-weight:bold">${((m.profit - fixedTotal) / APP_CONFIG.sarToYer).toLocaleString("ar-SA", {maximumFractionDigits:0})} ر.س</td></tr></table>
      <div class="footer">تم إنشاء هذا التقرير تلقائياً من نظام رداء · ${new Date().toLocaleDateString("ar-SA")}</div>
      </body></html>`);
    reportWindow.document.close();
    setTimeout(() => reportWindow.print(), 500);
  };

  const handleExportMonthlyPDF = (monthIdx: number) => {
    handlePrintMonthlyReport(monthIdx);
    toast.success("تم فتح التقرير للطباعة/حفظ PDF");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy lg:text-2xl">التقارير والتحليلات</h1>
          <p className="text-sm text-gray-500">صافي الربح = المبيعات - تكاليف الإنتاج - العمولات - المصاريف</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-gray-400" />
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold focus:border-gold focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي المبيعات" value={formatCurrency(totalSales)} icon={DollarSign} trend={formatCurrency(totalSales, "SAR")} trendUp delay={0} />
        <StatCard title="إجمالي المصروفات" value={formatCurrency(totalExpenses)} icon={TrendingDown} trend={`ثابت: ${formatCurrency(fixedExpensesTotal)} · متغير: ${formatCurrency(variableExpenses)}`} delay={1} />
        <StatCard title="صافي الربح" value={formatCurrency(netIncome)} icon={TrendingUp} trend={`${formatCurrency(netIncome, "SAR")}`} trendUp={netIncome > 0} delay={2} />
        <StatCard title="العمولات" value={formatCurrency(totalCommissions)} icon={UserCheck} trend={`معلقة: ${formatCurrency(getTotalPendingCommissions())}`} delay={3} />
      </div>

      {/* Fixed Expenses */}
      <div className="rounded-2xl bg-gradient-to-l from-navy/5 to-white p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-navy">المصاريف الثابتة الشهرية</h3>
          <a href="/settings" className="text-[10px] font-semibold text-gold hover:text-gold-dark">تعديل في الإعدادات ←</a>
        </div>
        {fixedExpensesList.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">لا توجد مصاريف ثابتة — أضفها من الإعدادات</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {fixedExpensesList.map((fe) => (
              <div key={fe.key} className="rounded-xl bg-white p-3 border border-gray-100 text-center">
                <p className="text-xs text-gray-500">{fe.label}</p>
                <p className="text-sm font-bold text-navy tabular-nums mt-1">{formatCurrency(fe.amount)}</p>
                <p className="text-[10px] text-gray-400">{formatCurrency(fe.amount, "SAR")}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          الإجمالي الشهري: <span className="font-bold text-red-600">{formatDual(totalFixedFromSettings)}</span>
        </p>
      </div>

      {/* Monthly Chart */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-base font-bold text-navy">المبيعات والمصروفات الشهرية — {selectedYear}</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySalesData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 92%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11, fontFamily: "Cairo" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid hsl(220 14% 88%)", borderRadius: "10px", fontFamily: "Cairo", direction: "rtl" }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === "sales" ? "المبيعات" : name === "expenses" ? "المصروفات" : "الربح"]} />
              <Bar dataKey="sales" fill="hsl(40 52% 55%)" radius={[4, 4, 0, 0]} name="sales" />
              <Bar dataKey="expenses" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} name="expenses" />
              <Bar dataKey="profit" fill="hsl(160 60% 42%)" radius={[4, 4, 0, 0]} name="profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-base font-bold text-navy">توزيع المصروفات</h2>
          {expenseBreakdown.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10, fontFamily: "Cairo" }}>
                    {expenseBreakdown.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontFamily: "Cairo", direction: "rtl", borderRadius: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-12 text-center text-sm text-gray-400">لا توجد مصروفات مسجلة</p>}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy">أفضل المنتجات مبيعاً</h2>
            <Link to="/product-profitability" className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <BarChart3 className="size-3.5" /> تقرير الربحية الكامل ←
            </Link>
          </div>
          {topProducts.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 92%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontFamily: "Cairo", fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontFamily: "Cairo", direction: "rtl", borderRadius: "10px" }} />
                  <Bar dataKey="revenue" fill="hsl(222 40% 20%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-12 text-center text-sm text-gray-400">لا توجد بيانات كافية</p>}
        </div>
      </div>

      {/* Monthly Summary with PDF export */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-base font-bold text-navy">الملخص الشهري — {selectedYear}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">الشهر</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">المبيعات (ر.ي)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">المبيعات (ر.س)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">المصروفات</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">الربح</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">الطلبات</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">تقرير</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlySalesData.filter((m) => m.sales > 0 || m.expenses > 0).map((m) => (
                <tr key={m.month} className="hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-navy">{m.month}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gold tabular-nums">{formatCurrency(m.sales)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{formatCurrency(m.sales, "SAR")}</td>
                  <td className="px-4 py-3 text-sm text-red-600 tabular-nums">{formatCurrency(m.expenses)}</td>
                  <td className={`px-4 py-3 text-sm font-bold tabular-nums ${m.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(m.profit)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.orders}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleExportMonthlyPDF(m.monthIdx)}
                      className="flex items-center gap-1 rounded-lg bg-navy/10 px-2 py-1 text-[10px] font-semibold text-navy hover:bg-navy/20">
                      <Printer className="size-3" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/20">
                <td className="px-4 py-3 text-sm font-bold text-navy">الإجمالي</td>
                <td className="px-4 py-3 text-sm font-bold text-gold tabular-nums">{formatCurrency(monthlySalesData.reduce((s, m) => s + m.sales, 0))}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-500 tabular-nums">{formatCurrency(monthlySalesData.reduce((s, m) => s + m.sales, 0), "SAR")}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-600 tabular-nums">{formatCurrency(monthlySalesData.reduce((s, m) => s + m.expenses, 0))}</td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-600 tabular-nums">{formatCurrency(monthlySalesData.reduce((s, m) => s + m.profit, 0))}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-700">{monthlySalesData.reduce((s, m) => s + m.orders, 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-bl from-amber-500 to-amber-600 p-5 text-white">
          <p className="text-sm font-medium text-white/80">مرتجعات الزبائن</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalCustomerReturns)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-blue-500 to-blue-600 p-5 text-white">
          <p className="text-sm font-medium text-white/80">مرتجعات الموردين</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(getTotalSupplierReturns())}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-red-500 to-red-600 p-5 text-white">
          <p className="text-sm font-medium text-white/80">مديونيات</p>
          <p className="mt-2 text-2xl font-bold">{formatDual(customerDebt + supplierDebt)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-600 to-emerald-700 p-5 text-white">
          <p className="text-sm font-medium text-white/80">صافي الربح (ر.س)</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(netIncome, "SAR")}</p>
        </div>
      </div>
    </div>
  );
}
