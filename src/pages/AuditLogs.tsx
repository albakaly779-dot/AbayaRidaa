import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, ClipboardList, Clock, Filter, Hash, RefreshCw, Search, ShieldAlert, XCircle } from "lucide-react";
import { useAuditStore, type AuditLog } from "@/stores/auditStore";
import { getAuditActionLabel, getEntityTypeLabel } from "@/lib/formatters";

const RESULT_META: Record<NonNullable<AuditLog["result"]>, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  SUCCESS: { label: "نجحت", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  DENIED: { label: "مرفوضة", className: "bg-amber-100 text-amber-800", icon: ShieldAlert },
  FAILED: { label: "فشلت", className: "bg-red-100 text-red-800", icon: XCircle },
  ROLLED_BACK: { label: "تم التراجع", className: "bg-gray-100 text-gray-700", icon: RefreshCw },
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-600", update: "bg-blue-50 text-blue-600", delete: "bg-red-50 text-red-600",
  status_change: "bg-amber-50 text-amber-600", payment: "bg-indigo-50 text-indigo-600", export: "bg-purple-50 text-purple-600",
  settings_update: "bg-cyan-50 text-cyan-600", production_batch: "bg-orange-50 text-orange-600", partner_signature: "bg-indigo-50 text-indigo-600",
};

export default function AuditLogs() {
  const { logs, loading, initializeLogs } = useAuditStore();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  const filtered = useMemo(() => logs.filter((log) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [log.details, log.entityType, log.action, log.entityId, log.requestId].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesResult = resultFilter === "all" || log.result === resultFilter;
    return matchesSearch && matchesAction && matchesResult;
  }), [logs, search, actionFilter, resultFilter]);

  const verifiedCount = logs.filter((log) => log.verified).length;
  const failedCount = logs.filter((log) => log.result === "FAILED" || log.result === "ROLLED_BACK").length;

  return (
    <div className="space-y-4 lg:space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-bold text-navy sm:text-xl lg:text-2xl"><ClipboardList className="size-5 text-gold-dark" /> سجل المراجعة الآمن</h1><p className="text-xs text-gray-500 sm:text-sm">سجل Append-Only للعمليات المالية والمخزنية والصلاحيات</p></div>
        <button onClick={() => { useAuditStore.setState({ initialized: false }); void initializeLogs(""); }} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"><RefreshCw className="size-4" /> تحديث السجل</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><ClipboardCheck className="mb-2 size-4 text-emerald-600" /><p className="text-xs text-gray-500">الأحداث المعروضة</p><p className="text-xl font-bold text-navy tabular-nums">{logs.length}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Hash className="mb-2 size-4 text-blue-600" /><p className="text-xs text-gray-500">مرتبطة بسلسلة هاش</p><p className="text-xl font-bold text-blue-700 tabular-nums">{verifiedCount}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><ShieldAlert className="mb-2 size-4 text-amber-600" /><p className="text-xs text-gray-500">مرفوضة</p><p className="text-xl font-bold text-amber-700 tabular-nums">{logs.filter((log) => log.result === "DENIED").length}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><XCircle className="mb-2 size-4 text-red-600" /><p className="text-xs text-gray-500">فشل/تراجع</p><p className="text-xl font-bold text-red-700 tabular-nums">{failedCount}</p></div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:gap-3 sm:p-4">
        <div className="relative flex-1"><Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="بحث بالطلب أو الكيان أو التفاصيل..." /></div>
        <div className="flex gap-2"><Filter className="mt-2.5 size-4 shrink-0 text-gray-500" /><select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs"><option value="all">كل العمليات</option>{Array.from(new Set(logs.map((log) => log.action))).map((action) => <option key={action} value={action}>{getAuditActionLabel(action)}</option>)}</select><select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs"><option value="all">كل النتائج</option><option value="SUCCESS">نجحت</option><option value="DENIED">مرفوضة</option><option value="FAILED">فشلت</option><option value="ROLLED_BACK">تم التراجع</option></select></div>
      </div>

      <div className="space-y-2">
        {loading ? <div className="flex justify-center py-16"><RefreshCw className="size-6 animate-spin text-navy" /></div> : filtered.map((log, index) => {
          const result = RESULT_META[log.result || "SUCCESS"];
          const ResultIcon = result.icon;
          return <div key={log.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ animationDelay: `${index * 25}ms` }}>
            <div className="flex items-start gap-3"><div className={`rounded-xl p-2.5 ${ACTION_COLORS[log.action] || "bg-gray-50 text-gray-600"}`}><ClipboardList className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-navy">{getAuditActionLabel(log.action)}</span><span className="rounded-lg bg-cream px-2 py-0.5 text-[10px] font-semibold text-gray-600">{getEntityTypeLabel(log.entityType)}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${result.className}`}><ResultIcon className="size-3" /> {result.label}</span>{log.verified && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700"><Hash className="size-3" /> متحقق</span>}</div><p className="mt-1 text-xs text-gray-500">{log.details}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-400"><span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(log.createdAt).toLocaleString("ar-SA")}</span>{log.entityId && <span dir="ltr">الكيان: {log.entityId.slice(0, 12)}...</span>}{log.requestId && <span dir="ltr">الطلب: {log.requestId.slice(0, 12)}...</span>}</div>{log.entryHash && <p className="mt-2 break-all rounded-lg bg-gray-50 px-2 py-1 font-mono text-[9px] text-gray-400" dir="ltr">hash: {log.entryHash}</p>}</div></div>
          </div>;
        })}
      </div>

      {!loading && filtered.length === 0 && <div className="flex flex-col items-center gap-4 py-20"><div className="rounded-full bg-gray-50 p-6"><ClipboardList className="size-10 text-gray-300" /></div><h3 className="text-lg font-bold text-navy">لا توجد سجلات مطابقة</h3><p className="text-sm text-gray-400">سيتم تسجيل العمليات عبر الخدمة الآمنة عند توفر الترحيل</p></div>}
    </div>
  );
}
