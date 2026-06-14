import { useEffect, useState } from "react";
import { ClipboardList, Search, Filter, Clock, User, Edit, Trash2, CreditCard, LogIn, Send, Settings, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { getAuditActionLabel, getEntityTypeLabel, formatDate } from "@/lib/formatters";

const ACTION_ICONS: Record<string, typeof Edit> = {
  create: Edit, update: Edit, delete: Trash2, status_change: RefreshCw,
  payment: CreditCard, login: LogIn, export: Send, settings_update: Settings, bulk_whatsapp: Send,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-600", update: "bg-blue-50 text-blue-600",
  delete: "bg-red-50 text-red-600", status_change: "bg-amber-50 text-amber-600",
  payment: "bg-indigo-50 text-indigo-600", login: "bg-gray-50 text-gray-600",
  export: "bg-purple-50 text-purple-600", settings_update: "bg-cyan-50 text-cyan-600",
  bulk_whatsapp: "bg-emerald-50 text-emerald-600",
};

export default function AuditLogs() {
  const { user } = useAuth();
  const { logs, loading, initializeLogs } = useAuditStore();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => { if (user?.id) initializeLogs(user.id); }, [user?.id]);

  const filtered = logs.filter((log) => {
    const matchSearch = !search || log.details.includes(search) || log.entityType.includes(search) || log.action.includes(search);
    const matchAction = actionFilter === "all" || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">سجل الأحداث</h1>
        <p className="text-xs text-gray-500 sm:text-sm">تتبع جميع العمليات والتغييرات في النظام</p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm border border-gray-100 sm:flex-row sm:gap-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            placeholder="بحث في السجل..." />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs focus:border-gold focus:outline-none sm:text-sm">
          <option value="all">كل العمليات</option>
          <option value="create">إنشاء</option>
          <option value="update">تعديل</option>
          <option value="delete">حذف</option>
          <option value="status_change">تغيير حالة</option>
          <option value="payment">دفعة</option>
          <option value="export">تصدير</option>
          <option value="settings_update">إعدادات</option>
          <option value="bulk_whatsapp">واتساب جماعي</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((log, idx) => {
          const Icon = ACTION_ICONS[log.action] || ClipboardList;
          const color = ACTION_COLORS[log.action] || "bg-gray-50 text-gray-600";
          return (
            <div key={log.id} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 animate-fade-in opacity-0"
              style={{ animationDelay: `${idx * 30}ms` }}>
              <div className={`rounded-xl p-2.5 shrink-0 ${color}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-navy">{getAuditActionLabel(log.action)}</span>
                  <span className="rounded-lg bg-cream px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    {getEntityTypeLabel(log.entityType)}
                  </span>
                  {log.entityId && <span className="text-[10px] text-gray-400" dir="ltr">{log.entityId.slice(0, 8)}...</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{log.details}</p>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(log.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                </p>
                <p className="text-[10px] text-gray-300">
                  {new Date(log.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="rounded-full bg-gray-50 p-6"><ClipboardList className="size-10 text-gray-300" /></div>
          <h3 className="text-lg font-bold text-navy">لا توجد سجلات</h3>
          <p className="text-sm text-gray-400">سيتم تسجيل جميع العمليات هنا تلقائياً</p>
        </div>
      )}
    </div>
  );
}
