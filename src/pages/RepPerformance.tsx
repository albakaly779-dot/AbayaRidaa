import { useState, useEffect, useMemo } from "react";
import { Users, TrendingUp, Award, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRepStore } from "@/stores/repStore";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "واتساب",
  instagram: "إنستقرام",
  facebook: "فيسبوك",
  direct: "مباشر",
  referral: "توصية",
  other: "أخرى",
};

const COLORS = ["#1B2A4A", "#D4A853", "#10b981", "#6366f1", "#f59e0b", "#ec4899"];

interface RepStats {
  name: string;
  email: string;
  customers: number;
  thisMonth: number;
  sources: Record<string, number>;
}

export default function RepPerformance() {
  const { user } = useAuth();
  const { reps, initializeData: initReps } = useRepStore();
  const { customers, orders, initializeData: initData } = useDataStore();
  const [repStats, setRepStats] = useState<RepStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      initReps(user.id);
      initData(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadRepStats();
  }, [user?.id, customers]);

  const loadRepStats = async () => {
    setLoading(true);
    const { data: allCustomers } = await supabase.from("customers")
      .select("added_by_id, added_by_name, source, created_at")
      .eq("user_id", user!.id);

    if (!allCustomers) { setLoading(false); return; }

    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const statsMap = new Map<string, RepStats>();

    allCustomers.forEach((c: any) => {
      const repName = c.added_by_name || "المدير";
      const repId = c.added_by_id || "admin";
      if (!statsMap.has(repId)) {
        statsMap.set(repId, { name: repName, email: "", customers: 0, thisMonth: 0, sources: {} });
      }
      const stat = statsMap.get(repId)!;
      stat.customers++;
      if (c.created_at >= firstOfMonth) stat.thisMonth++;
      const src = c.source || "other";
      stat.sources[src] = (stat.sources[src] || 0) + 1;
    });

    setRepStats(Array.from(statsMap.values()).sort((a, b) => b.customers - a.customers));
    setLoading(false);
  };

  // Chart: Customers per rep
  const repChartData = useMemo(() =>
    repStats.map((r) => ({ name: r.name.split(" ")[0], عملاء: r.customers, هذا_الشهر: r.thisMonth })),
  [repStats]);

  // Chart: Sources distribution across all reps
  const sourceChartData = useMemo(() => {
    const totals: Record<string, number> = {};
    repStats.forEach((r) => {
      Object.entries(r.sources).forEach(([src, count]) => {
        totals[src] = (totals[src] || 0) + count;
      });
    });
    return Object.entries(totals)
      .map(([src, count]) => ({ name: SOURCE_LABELS[src] || src, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [repStats]);

  const totalCustomers = repStats.reduce((s, r) => s + r.customers, 0);
  const totalThisMonth = repStats.reduce((s, r) => s + r.thisMonth, 0);
  const topRep = repStats[0]?.name || "—";

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">تقرير أداء المناديب</h1>
        <p className="text-xs text-gray-500 sm:text-sm">مقارنة بيانية لأداء كل مندوب ومصادر العملاء</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="إجمالي العملاء المسجلين" value={String(totalCustomers)} icon={Users} delay={0} />
        <StatCard title="عملاء هذا الشهر" value={String(totalThisMonth)} icon={TrendingUp} delay={1} />
        <StatCard title="أفضل مندوب" value={topRep} icon={Award} delay={2} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Bar Chart: Customers per Rep */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="size-5 text-navy" />
            <h2 className="text-sm font-bold text-navy">العملاء حسب المندوب</h2>
          </div>
          <div className="h-64">
            {repChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repChartData} layout="vertical" margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#374151" }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Bar dataKey="عملاء" fill="#1B2A4A" radius={[0, 6, 6, 0]} name="الإجمالي" />
                  <Bar dataKey="هذا_الشهر" fill="#D4A853" radius={[0, 6, 6, 0]} name="هذا الشهر" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-400">لا توجد بيانات كافية</p>
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart: Sources */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="size-5 text-gold" />
            <h2 className="text-sm font-bold text-navy">مصادر العملاء</h2>
          </div>
          <div className="h-64">
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {sourceChartData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-400">لا توجد بيانات كافية</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rep Details Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-bold text-navy">تفاصيل أداء كل مندوب</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-cream/50">
                <th className="px-4 py-3 text-right font-semibold text-gray-600">المندوب</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">الإجمالي</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">هذا الشهر</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">واتساب</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">إنستقرام</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">فيسبوك</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">مباشر</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {repStats.map((rep, idx) => (
                <tr key={idx} className="hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                        {rep.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-navy">{rep.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-navy tabular-nums">{rep.customers}</td>
                  <td className="px-4 py-3 text-center font-bold text-gold tabular-nums">{rep.thisMonth}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{rep.sources.whatsapp || 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{rep.sources.instagram || 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{rep.sources.facebook || 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{rep.sources.direct || 0}</td>
                </tr>
              ))}
              {repStats.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
