import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, User, Clock, MapPin, Activity, LogIn, LogOut, MousePointerClick, FileText, Loader2, Calendar, Filter, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/formatters";

interface ActivityRow {
  id: string;
  user_email: string;
  user_id: string | null;
  action_type: string;
  action_name: string;
  page_path: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Activity> = {
  login: LogIn,
  logout: LogOut,
  page_visit: MousePointerClick,
  action: FileText,
};

const TYPE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  login: { bg: "bg-emerald-500", text: "text-emerald-700", ring: "ring-emerald-200" },
  logout: { bg: "bg-gray-500", text: "text-gray-700", ring: "ring-gray-200" },
  page_visit: { bg: "bg-blue-500", text: "text-blue-700", ring: "ring-blue-200" },
  action: { bg: "bg-purple-500", text: "text-purple-700", ring: "ring-purple-200" },
};

const TYPE_LABELS: Record<string, string> = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  page_visit: "زيارة صفحة",
  action: "إجراء",
};

export default function UserActivity() {
  const { email } = useParams<{ email: string }>();
  const decodedEmail = email ? decodeURIComponent(email) : "";
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [daysFilter, setDaysFilter] = useState<number>(30);

  const loadLogs = async () => {
    if (!decodedEmail) return;
    setLoading(true);
    const cutoff = new Date(Date.now() - daysFilter * 86400000).toISOString();
    const { data, error } = await supabase
      .from("user_activity_logs")
      .select("*")
      .eq("user_email", decodedEmail)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Failed to load activity:", error);
    } else {
      setLogs((data || []) as ActivityRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, [decodedEmail, daysFilter]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return logs;
    return logs.filter((l) => l.action_type === typeFilter);
  }, [logs, typeFilter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const logins = logs.filter((l) => l.action_type === "login").length;
    const pageVisits = logs.filter((l) => l.action_type === "page_visit").length;
    const actions = logs.filter((l) => l.action_type === "action").length;
    const lastLogin = logs.find((l) => l.action_type === "login")?.created_at;
    const lastActivity = logs[0]?.created_at;
    const uniquePages = new Set(logs.filter((l) => l.page_path).map((l) => l.page_path)).size;
    return { total, logins, pageVisits, actions, lastLogin, lastActivity, uniquePages };
  }, [logs]);

  // Group by date for timeline
  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityRow[]> = {};
    filtered.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <Link to="/roles" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy mb-2">
          <ArrowLeft className="size-4" /> العودة لإدارة الصلاحيات
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-bl from-navy to-navy-light text-white font-bold text-xl shrink-0">
            {decodedEmail.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
              <Activity className="size-5 text-gold" /> سجل نشاط المستخدم
            </h1>
            <p className="text-xs text-gray-500 sm:text-sm" dir="ltr">{decodedEmail}</p>
          </div>
          <button onClick={loadLogs}
            className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-xs font-bold text-navy hover:bg-cream/50">
            <RefreshCw className="size-3.5" /> تحديث
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-500/20">
          <LogIn className="size-5 mb-2" />
          <p className="text-xs text-white/80">مرات الدخول</p>
          <p className="text-2xl font-bold tabular-nums">{stats.logins}</p>
          {stats.lastLogin && (
            <p className="text-[10px] text-white/70 mt-1">آخر: {formatDate(stats.lastLogin)}</p>
          )}
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-blue-500 to-blue-600 p-4 text-white shadow-lg shadow-blue-500/20">
          <MousePointerClick className="size-5 mb-2" />
          <p className="text-xs text-white/80">زيارات صفحات</p>
          <p className="text-2xl font-bold tabular-nums">{stats.pageVisits}</p>
          <p className="text-[10px] text-white/70 mt-1">{stats.uniquePages} صفحة فريدة</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-purple-500 to-purple-600 p-4 text-white shadow-lg shadow-purple-500/20">
          <FileText className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجراءات</p>
          <p className="text-2xl font-bold tabular-nums">{stats.actions}</p>
          <p className="text-[10px] text-white/70 mt-1">مسجّل: {stats.total}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <Clock className="size-5 text-gold-dark mb-2" />
          <p className="text-xs text-gray-500">آخر نشاط</p>
          {stats.lastActivity ? (
            <>
              <p className="text-sm font-bold text-navy">{formatDate(stats.lastActivity)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {(() => {
                  const diff = Date.now() - new Date(stats.lastActivity).getTime();
                  const days = Math.floor(diff / 86400000);
                  const hours = Math.floor((diff % 86400000) / 3600000);
                  if (days === 0 && hours === 0) return "قبل دقائق";
                  if (days === 0) return `قبل ${hours} ساعة`;
                  return `قبل ${days} يوم`;
                })()}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">لا يوجد</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 border border-gray-100 shadow-sm sm:flex-row">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter className="size-4 text-gray-400" />
          <span className="text-[11px] text-gray-500 shrink-0">نوع النشاط:</span>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setTypeFilter("all")}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                typeFilter === "all" ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              الكل ({logs.length})
            </button>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                  typeFilter === type ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {label} ({logs.filter((l) => l.action_type === type).length})
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-gray-400" />
          <select value={daysFilter} onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-gold focus:outline-none">
            <option value={1}>آخر يوم</option>
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوم</option>
            <option value={90}>آخر 90 يوم</option>
            <option value={365}>آخر سنة</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-navy" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 rounded-2xl bg-white border border-gray-100">
          <div className="rounded-full bg-gray-100 p-6"><Activity className="size-10 text-gray-300" /></div>
          <h3 className="text-lg font-bold text-navy">لا يوجد نشاط</h3>
          <p className="text-sm text-gray-400">لم يقم المستخدم بأي نشاط في هذه الفترة</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, entries]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm py-2 mb-3 rounded-lg px-3 border border-gold/20">
                <p className="text-xs font-bold text-navy flex items-center gap-2">
                  <Calendar className="size-3.5" /> {date} <span className="text-gray-400 font-normal">— {entries.length} نشاط</span>
                </p>
              </div>
              <div className="relative">
                <div className="absolute right-[19px] top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-2">
                  {entries.map((log, idx) => {
                    const Icon = TYPE_ICONS[log.action_type] || Activity;
                    const colors = TYPE_COLORS[log.action_type] || TYPE_COLORS.action;
                    return (
                      <div key={log.id} className="relative flex gap-3 animate-fade-in opacity-0"
                        style={{ animationDelay: `${Math.min(idx, 20) * 30}ms` }}>
                        <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${colors.bg} text-white ring-4 ring-white shadow-md`}>
                          <Icon className="size-4" />
                        </div>
                        <div className={`flex-1 rounded-xl bg-white p-3 ring-1 ${colors.ring} border border-gray-100`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${colors.text}`}>{log.action_name || TYPE_LABELS[log.action_type]}</span>
                                <span className={`rounded-md bg-cream/60 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500`}>
                                  {TYPE_LABELS[log.action_type] || log.action_type}
                                </span>
                              </div>
                              {log.details && <p className="text-[11px] text-gray-500 mt-1">{log.details}</p>}
                              {log.page_path && log.action_type === "page_visit" && (
                                <p className="text-[10px] text-gray-400 mt-1" dir="ltr">{log.page_path}</p>
                              )}
                              {log.user_agent && (
                                <p className="text-[9px] text-gray-300 mt-1 line-clamp-1" title={log.user_agent}>
                                  {log.user_agent.substring(0, 60)}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                              {new Date(log.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
