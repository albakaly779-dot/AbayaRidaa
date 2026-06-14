import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { useDataStore } from "@/stores/dataStore";
import { formatCurrency } from "@/lib/formatters";

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const COLORS = ["#c9a14e", "#1a2744", "#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b"];

type ChartView = "sales" | "governorate" | "debt";

export default function SalesChart({ view: externalView }: { view?: ChartView } = {}) {
  const { orders, customers } = useDataStore();
  const [internalView, setInternalView] = useState<ChartView>("sales");
  const view = externalView || internalView;

  const salesData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return months.map((month, idx) => {
      const monthOrders = orders.filter((o) => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      });
      return {
        month,
        sales: monthOrders.reduce((s, o) => s + o.total, 0),
        orders: monthOrders.length,
      };
    });
  }, [orders]);

  const governorateData = useMemo(() => {
    const govMap = new Map<string, number>();
    orders.forEach((o) => {
      const customer = customers.find((c) => c.id === o.customerId);
      const city = customer?.city || "غير محدد";
      govMap.set(city, (govMap.get(city) || 0) + o.total);
    });
    return Array.from(govMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [orders, customers]);

  const debtTrendData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return months.map((month, idx) => {
      const monthOrders = orders.filter((o) => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      });
      const debt = monthOrders.reduce((s, o) => s + o.remaining, 0);
      const paid = monthOrders.reduce((s, o) => s + o.paid, 0);
      return { month, debt, paid };
    });
  }, [orders]);

  return (
    <div>
      {!externalView && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          {([
            { key: "sales", label: "المبيعات" },
            { key: "governorate", label: "المحافظات" },
            { key: "debt", label: "المديونيات" },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setInternalView(tab.key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === tab.key ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="h-[300px] w-full">
        {view === "sales" && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(40 52% 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(40 52% 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(222 40% 20%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(222 40% 20%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 12, fontFamily: "Cairo" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid hsl(220 14% 88%)", borderRadius: "10px", fontFamily: "Cairo", direction: "rtl" }}
                formatter={(value: number, name: string) => [name === "sales" ? formatCurrency(value) : `${value} طلب`, name === "sales" ? "المبيعات" : "الطلبات"]} />
              <Area type="monotone" dataKey="sales" stroke="hsl(40 52% 55%)" strokeWidth={2.5} fill="url(#salesGrad)" />
              <Area type="monotone" dataKey="orders" stroke="hsl(222 40% 20%)" strokeWidth={2} fill="url(#ordersGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {view === "governorate" && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={governorateData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                paddingAngle={3} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}>
                {governorateData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid hsl(220 14% 88%)", borderRadius: "10px", fontFamily: "Cairo", direction: "rtl" }}
                formatter={(value: number) => [formatCurrency(value), "المبيعات"]} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {view === "debt" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={debtTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 12, fontFamily: "Cairo" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid hsl(220 14% 88%)", borderRadius: "10px", fontFamily: "Cairo", direction: "rtl" }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === "debt" ? "المديونيات" : "المدفوعات"]} />
              <Line type="monotone" dataKey="debt" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: "#ef4444" }} name="debt" />
              <Line type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} name="paid" />
              <Legend formatter={(value) => value === "debt" ? "المديونيات" : "المدفوعات"} wrapperStyle={{ fontFamily: "Cairo", fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {view === "governorate" && governorateData.length === 0 && (
        <p className="text-center text-xs text-gray-400 mt-4">لا توجد بيانات كافية — أضف طلبات مع تحديد محافظة العميل</p>
      )}
    </div>
  );
}
