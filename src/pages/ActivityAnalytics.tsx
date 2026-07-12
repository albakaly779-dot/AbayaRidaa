import { useEffect, useMemo, useState } from "react";
import { Activity, TrendingUp, Users, Calendar, Award, Loader2, Download, MousePointerClick, LogIn, FileText, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/formatters";
import { exportToCSV } from "@/lib/formatters";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

interface ActivityRow {
  id: string;
  user_email: string;
  user_id: string;
  action_type: string;
  action_name: string;
  page_path: string;
  created_at: string;
}

const COLORS = ["#1B2A4A", "#C9A84C", "#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];

export default function ActivityAnalytics() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(30);

  const loadAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    const cutoff = new Date(Date.now() - daysFilter * 86400000).toISOString();
    const { data } = await supabase.from("user_activity_logs")
      .select("*")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(5000);
    setLogs((data || []) as ActivityRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user?.id, daysFilter]);

  // Aggregations
  const stats = useMemo(() => {
    const uniqueUsers = new Set(logs.map((l) => l.user_email)).size;
    const uniquePages = new Set(logs.filter((l) => l.page_path).map((l) => l.page_path)).size;
    const totalLogins = logs.filter((l) => l.action_type === "login").length;
    const totalActions = logs.filter((l) => l.action_type === "action").length;
    const totalVisits = logs.filter((l) => l.action_type === "page_visit").length;
    return { total: logs.length, uniqueUsers, uniquePages, totalLogins, totalActions, totalVisits };
  }, [logs]);

  // Most active users
  const topUsers = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => map.set(l.user_email, (map.get(l.user_email) || 0) + 1));
    return Array.from(map.entries()).map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  }, [logs]);

  // Most visited pages
  const topPages = useMemo(() => {
    const map = new Map<string, number>();
    logs.filter((l) => l.action_type === "page_visit" && l.page_path).forEach((l) => {
      map.set(l.page_path, (map.get(l.page_path) || 0) + 1);
    });
    return Array.from(map.entries()).map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  }, [logs]);

  // Peak hours (24h)
  const hourlyDistribution = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
    logs.forEach((l) => {
      const h = new Date(l.created_at).getHours();
      hours[h].count += 1;
    });
    return hours;
  }, [logs]);

  // Daily distribution (last 30 days)
  const dailyDistribution = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      const date = l.created_at.split("T")[0];
      map.set(date, (map.get(date) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: date.substring(5), count }));
  }, [logs]);

  // Weekly distribution (day of week)
  const weeklyDistribution = useMemo(() => {
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const counts = new Array(7).fill(0);
    logs.forEach((l) => {
      const day = new Date(l.created_at).getDay();
      counts[day] += 1;
    });
    return days.map((day, i) => ({ day, count: counts[i] }));
  }, [logs]);

  // Action type breakdown
  const actionBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => map.set(l.action_type, (map.get(l.action_type) || 0) + 1));
    return Array.from(map.entries()).map(([type, count]) => ({
      name: type === "login" ? "تسجيل دخول" : type === "logout" ? "خروج" : type === "page_visit" ? "زيارة صفحة" : "إجراء",
      value: count,
    }));
  }, [logs]);

  const handleExport = () => {
    const rows = logs.map((l) => ({
      "البريد": l.user_email,
      "النوع": l.action_type,
      "الإجراء": l.action_name,
      "الصفحة": l.page_path,
      "التاريخ": formatDate(l.created_at),
      "الوقت": new Date(l.created_at).toLocaleTimeString("ar-SA"),
    }));
    exportToCSV(rows, `activity-analytics-${daysFilter}days`);
    toast.success("تم تصدير النتائج");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
            <Activity className="size-5 text-gold" /> تحليلات نشاط المستخدمين
          </h1>
          <p className="text-xs text-gray-500 sm:text-sm">لوحة تحليل متقدمة لجميع المستخدمين والصفحات</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={daysFilter} onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gold focus:outline-none">
            <option value={1}>آخر يوم</option>
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوم</option>
            <option value={90}>آخر 90 يوم</option>
          </select>
          <button onClick={loadAll} className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-2 text-xs font-bold hover:bg-cream/50">
            <RefreshCw className="size-3.5" /> تحديث
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 text-white px-3 py-2 text-xs font-bold hover:bg-emerald-600">
            <Download className="size-3.5" /> تصدير CSV
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Activity className="size-4 text-navy mb-1" />
          <p className="text-[10px] text-gray-500">إجمالي النشاط</p>
          <p className="text-lg font-bold text-navy tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <Users className="size-4 text-purple-600 mb-1" />
          <p className="text-[10px] text-gray-500">مستخدمون نشطون</p>
          <p className="text-lg font-bold text-purple-700 tabular-nums">{stats.uniqueUsers}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <LogIn className="size-4 text-emerald-600 mb-1" />
          <p className="text-[10px] text-gray-500">تسجيلات دخول</p>
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{stats.totalLogins}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <MousePointerClick className="size-4 text-blue-600 mb-1" />
          <p className="text-[10px] text-gray-500">زيارات صفحات</p>
          <p className="text-lg font-bold text-blue-700 tabular-nums">{stats.totalVisits}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <FileText className="size-4 text-amber-600 mb-1" />
          <p className="text-[10px] text-gray-500">إجراءات</p>
          <p className="text-lg font-bold text-amber-700 tabular-nums">{stats.totalActions}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm">
          <TrendingUp className="size-4 text-cyan-600 mb-1" />
          <p className="text-[10px] text-gray-500">صفحات فريدة</p>
          <p className="text-lg font-bold text-cyan-700 tabular-nums">{stats.uniquePages}</p>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top users */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
            <Award className="size-4 text-gold" /> أنشط 10 مستخدمين
          </h3>
          {topUsers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topUsers} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="email" tick={{ fontSize: 10 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#C9A84C" name="عدد الأنشطة" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top pages */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
            <MousePointerClick className="size-4 text-blue-600" /> أكثر الصفحات زيارة
          </h3>
          {topPages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topPages} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#1B2A4A" name="عدد الزيارات" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hourly peak */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-purple-600" /> ذروة النشاط اليومية (24 ساعة)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourlyDistribution}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} name="النشاط" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-emerald-600" /> ذروة النشاط الأسبوعية
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyDistribution}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} name="النشاط" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily trend */}
        <div className="xl:col-span-2 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-navy" /> النشاط اليومي ({daysFilter} يوم)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyDistribution}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#1B2A4A" strokeWidth={2} name="عدد الأنشطة" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Action types pie */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4">📊 توزيع أنواع النشاط</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={actionBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                {actionBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* User activity summary table */}
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-navy mb-4">👥 ملخص كل مستخدم</h3>
          <div className="overflow-y-auto max-h-[240px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="pb-2 text-right text-[10px] font-bold text-gray-500">المستخدم</th>
                  <th className="pb-2 text-right text-[10px] font-bold text-gray-500">الأنشطة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topUsers.slice(0, 10).map((u, i) => (
                  <tr key={u.email}>
                    <td className="py-2 text-xs">
                      <span className="inline-flex items-center gap-2">
                        <span className="rounded-full bg-gold/10 text-gold-dark text-[9px] font-bold size-4 flex items-center justify-center">{i + 1}</span>
                        <span dir="ltr" className="text-[11px] truncate max-w-[180px]">{u.email}</span>
                      </span>
                    </td>
                    <td className="py-2 text-xs font-bold text-navy tabular-nums">{u.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
