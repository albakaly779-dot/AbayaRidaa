import { useEffect, useState } from "react";
import { FileSpreadsheet, Download, Send, Calendar, Clock, Plus, Trash2, Loader2, Mail, RefreshCw, Play, Info, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useReturnStore } from "@/stores/returnStore";
import { useRepStore } from "@/stores/repStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuditStore } from "@/stores/auditStore";
import { generateExcelReport, downloadExcel, prepareIncomeData, prepareExpensesData, prepareSalesData, prepareReturnsData, prepareProfitsData, prepareInventoryData, type ReportType } from "@/lib/excelExport";
import { formatCurrency } from "@/lib/formatters";
import { logActivity } from "@/hooks/useActivityLogger";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface ReportSchedule {
  id: string;
  reportType: ReportType;
  reportName: string;
  scheduleType: "daily" | "weekly" | "monthly" | "yearly" | "manual";
  scheduleDay: number;
  scheduleTime: string;
  recipients: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
}

const REPORT_TYPES: Array<{ key: ReportType; label: string; description: string; icon: string; color: string }> = [
  { key: "income", label: "تقرير الدخل", description: "جميع الدفعات والإيرادات", icon: "💰", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { key: "expenses", label: "تقرير المصروفات", description: "جميع المصروفات والتكاليف", icon: "💸", color: "bg-red-50 border-red-200 text-red-700" },
  { key: "sales", label: "تقرير المبيعات", description: "جميع الطلبات مع التفاصيل", icon: "🛍️", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { key: "returns", label: "تقرير المرتجعات", description: "المرتجعات من العملاء والموردين", icon: "🔄", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "profits", label: "الأرباح والخسائر", description: "ربحية كل طلب بالتفصيل", icon: "📊", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { key: "net_profits", label: "صافي الأرباح", description: "الربح الإجمالي بعد المصروفات", icon: "💎", color: "bg-navy/10 border-navy/30 text-navy" },
  { key: "inventory", label: "حركة المخزون", description: "المنتجات ومستوى المخزون", icon: "📦", color: "bg-cyan-50 border-cyan-200 text-cyan-700" },
];

const SCHEDULE_LABELS: Record<string, string> = {
  daily: "يومي", weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي", manual: "يدوي",
};

export default function ReportsAutomation() {
  const { user } = useAuth();
  const { orders, payments, initializeData } = useDataStore();
  const { expenses, initializeData: initExp } = useExpenseStore();
  const { returns, initializeData: initReturns } = useReturnStore();
  const { getTotalPendingCommissions, initializeData: initReps } = useRepStore();
  const { settings, initializeSettings } = useSettingsStore();
  const { logAction } = useAuditStore();

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState<{
    reportType: ReportType;
    reportName: string;
    scheduleType: ReportSchedule["scheduleType"];
    scheduleDay: number;
    scheduleTime: string;
    recipientInput: string;
    recipients: string[];
  }>({
    reportType: "sales",
    reportName: "",
    scheduleType: "monthly",
    scheduleDay: 1,
    scheduleTime: "09:00",
    recipientInput: "",
    recipients: [],
  });

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initExp(user.id);
      initReturns(user.id);
      initReps(user.id);
      initializeSettings(user.id);
      loadSchedules();
    }
  }, [user?.id]);

  const loadSchedules = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("report_schedules").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const mapped: ReportSchedule[] = (data || []).map((r: {
      id: string; report_type: string; report_name: string; schedule_type: string;
      schedule_day: number; schedule_time: string; recipients: string; is_active: boolean;
      last_run: string | null; next_run: string | null;
    }) => ({
      id: r.id,
      reportType: r.report_type as ReportType,
      reportName: r.report_name,
      scheduleType: r.schedule_type as ReportSchedule["scheduleType"],
      scheduleDay: r.schedule_day,
      scheduleTime: r.schedule_time,
      recipients: (() => { try { return JSON.parse(r.recipients); } catch { return []; } })(),
      isActive: r.is_active,
      lastRun: r.last_run || undefined,
      nextRun: r.next_run || undefined,
    }));
    setSchedules(mapped);
    setLoading(false);
  };

  const buildReport = (reportType: ReportType): { data: Record<string, unknown>[]; summary: Record<string, string | number>; title: string } => {
    switch (reportType) {
      case "income": {
        const data = prepareIncomeData(payments);
        const total = payments.reduce((s, p) => s + p.amount, 0);
        return { data, summary: { "إجمالي الدخل (ر.ي)": total, "إجمالي الدخل (ر.س)": formatCurrency(total, "SAR"), "عدد الدفعات": payments.length }, title: "تقرير الدخل" };
      }
      case "expenses": {
        const data = prepareExpensesData(expenses);
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        return { data, summary: { "إجمالي المصروفات (ر.ي)": total, "إجمالي المصروفات (ر.س)": formatCurrency(total, "SAR"), "عدد البنود": expenses.length }, title: "تقرير المصروفات" };
      }
      case "sales": {
        const data = prepareSalesData(orders);
        const total = orders.reduce((s, o) => s + o.total, 0);
        return { data, summary: { "إجمالي المبيعات (ر.ي)": total, "إجمالي المبيعات (ر.س)": formatCurrency(total, "SAR"), "عدد الطلبات": orders.length }, title: "تقرير المبيعات" };
      }
      case "returns": {
        const data = prepareReturnsData(returns);
        const total = returns.reduce((s, r) => s + r.totalAmount, 0);
        return { data, summary: { "إجمالي المرتجعات (ر.ي)": total, "عدد المرتجعات": returns.length }, title: "تقرير المرتجعات" };
      }
      case "profits": {
        const data = prepareProfitsData(orders);
        const totalProfit = data.reduce((s, r) => s + Number(r["الربح (ر.ي)"]), 0);
        const totalRev = data.reduce((s, r) => s + Number(r["الإيرادات (ر.ي)"]), 0);
        return { data, summary: { "إجمالي الأرباح (ر.ي)": totalProfit, "إجمالي الإيرادات (ر.ي)": totalRev, "متوسط الهامش %": totalRev > 0 ? Number(((totalProfit / totalRev) * 100).toFixed(2)) : 0 }, title: "تقرير الأرباح والخسائر" };
      }
      case "net_profits": {
        const totalSales = orders.reduce((s, o) => s + o.total, 0);
        const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
        const totalReturns = returns.reduce((s, r) => s + r.totalAmount, 0);
        const commissions = getTotalPendingCommissions();
        const net = totalSales - totalExp - totalReturns - commissions;
        return {
          data: [
            { "البند": "إجمالي المبيعات", "المبلغ (ر.ي)": totalSales, "المبلغ (ر.س)": formatCurrency(totalSales, "SAR") },
            { "البند": "إجمالي المصروفات", "المبلغ (ر.ي)": -totalExp, "المبلغ (ر.س)": formatCurrency(totalExp, "SAR") },
            { "البند": "إجمالي المرتجعات", "المبلغ (ر.ي)": -totalReturns, "المبلغ (ر.س)": formatCurrency(totalReturns, "SAR") },
            { "البند": "عمولات مستحقة", "المبلغ (ر.ي)": -commissions, "المبلغ (ر.س)": formatCurrency(commissions, "SAR") },
            { "البند": "صافي الربح", "المبلغ (ر.ي)": net, "المبلغ (ر.س)": formatCurrency(net, "SAR") },
          ],
          summary: { "صافي الربح النهائي (ر.ي)": net, "صافي الربح النهائي (ر.س)": formatCurrency(net, "SAR"), "الهامش %": totalSales > 0 ? Number(((net / totalSales) * 100).toFixed(2)) : 0 },
          title: "تقرير صافي الأرباح",
        };
      }
      case "inventory":
        // Loaded async - just placeholder here
        return { data: [], summary: {}, title: "تقرير المخزون" };
      default:
        return { data: [], summary: {}, title: "تقرير" };
    }
  };

  const handleGenerate = async (reportType: ReportType) => {
    setGenerating(reportType);
    try {
      let reportData = buildReport(reportType);

      // Inventory needs async loading
      if (reportType === "inventory") {
        const { data: products } = await supabase.from("products").select("code, name, category, stock_quantity, min_stock_alert, sell_price, total_cost").eq("is_active", true);
        const prepared = prepareInventoryData(products || []);
        const lowStock = (products || []).filter((p) => p.stock_quantity <= p.min_stock_alert).length;
        reportData = {
          data: prepared,
          summary: { "إجمالي المنتجات": prepared.length, "منخفض المخزون": lowStock, "قيمة المخزون (ر.ي)": (products || []).reduce((s, p) => s + Number(p.sell_price) * p.stock_quantity, 0) },
          title: "تقرير حركة المخزون",
        };
      }

      const blob = generateExcelReport(reportType, reportData.data, {
        title: reportData.title,
        subtitle: `${SCHEDULE_LABELS[reportType] || ""} - ${new Date().toLocaleDateString("ar-SA")}`,
        generatedAt: new Date().toLocaleString("ar-SA"),
        businessName: settings.businessName || "رداء",
      }, reportData.summary);

      const filename = `${reportData.title}-${new Date().toISOString().split("T")[0]}.xlsx`;
      downloadExcel(blob, filename);

      if (user?.id) {
        logAction(user.id, "export", "report", reportType, `توليد ${reportData.title} (${reportData.data.length} صف)`);
        logActivity(user.email, user.id, "action", `توليد ${reportData.title}`, { entityType: "report", details: `${reportData.data.length} صف` });
      }

      toast.success(`✅ تم توليد التقرير (${reportData.data.length} صف)`);
    } catch (err) {
      toast.error("فشل التوليد: " + (err instanceof Error ? err.message : "خطأ"));
    }
    setGenerating(null);
  };

  const handleSendReport = async (schedule: ReportSchedule) => {
    if (!settings.smtpEnabled) {
      toast.error("SMTP غير مفعّل — فعّله من الإعدادات أولاً");
      return;
    }
    if (schedule.recipients.length === 0) {
      toast.error("لا يوجد مستلمون");
      return;
    }
    setSending(schedule.id);
    try {
      const reportData = buildReport(schedule.reportType);
      const blob = generateExcelReport(schedule.reportType, reportData.data, {
        title: reportData.title,
        subtitle: `تقرير ${SCHEDULE_LABELS[schedule.scheduleType]} - ${new Date().toLocaleDateString("ar-SA")}`,
        generatedAt: new Date().toLocaleString("ar-SA"),
        businessName: settings.businessName || "رداء",
      }, reportData.summary);

      // Note: Attachments require the SMTP function to support them.
      // Here we just send a summary email with a link description.
      const summaryHtml = `<div dir="rtl" style="font-family:Cairo,Arial;padding:20px;background:#f8f6f0;border-radius:12px">
        <h2>${reportData.title}</h2>
        <p>تم توليد التقرير تلقائياً في ${new Date().toLocaleString("ar-SA")}</p>
        <div style="background:white;padding:15px;border-radius:8px;margin:15px 0">
          <p><b>عدد الصفوف:</b> ${reportData.data.length}</p>
          ${Object.entries(reportData.summary || {}).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join("")}
        </div>
        <p style="color:#999;font-size:12px">${settings.businessName || "رداء"} · نظام التقارير الآلي</p>
      </div>`;

      for (const recipient of schedule.recipients) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: recipient,
            subject: `📊 ${reportData.title} - ${new Date().toLocaleDateString("ar-SA")}`,
            html: summaryHtml,
            text: `${reportData.title}\n\n${Object.entries(reportData.summary || {}).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
          },
        }).catch((e: unknown) => {
          if (e instanceof FunctionsHttpError) {
            e.context?.text().then((t) => toast.warning(`فشل الإرسال إلى ${recipient}: ${t}`));
          }
        });
      }

      // Also download it locally as backup
      downloadExcel(blob, `${reportData.title}-${new Date().toISOString().split("T")[0]}.xlsx`);

      // Update last_run
      await supabase.from("report_schedules").update({ last_run: new Date().toISOString() }).eq("id", schedule.id);

      if (user?.id) {
        logAction(user.id, "export", "report", schedule.id, `إرسال ${reportData.title} إلى ${schedule.recipients.length} مستلم`);
      }

      toast.success(`✅ تم إرسال التقرير إلى ${schedule.recipients.length} مستلم`);
      loadSchedules();
    } catch (err) {
      toast.error("فشل: " + (err instanceof Error ? err.message : "خطأ"));
    }
    setSending(null);
  };

  const handleAddSchedule = async () => {
    if (!user?.id) return;
    if (newSchedule.recipients.length === 0) { toast.error("أضف مستلماً واحداً على الأقل"); return; }

    const { error } = await supabase.from("report_schedules").insert({
      user_id: user.id,
      report_type: newSchedule.reportType,
      report_name: newSchedule.reportName || REPORT_TYPES.find((r) => r.key === newSchedule.reportType)?.label || "",
      schedule_type: newSchedule.scheduleType,
      schedule_day: newSchedule.scheduleDay,
      schedule_time: newSchedule.scheduleTime,
      recipients: JSON.stringify(newSchedule.recipients),
      is_active: true,
    });

    if (error) { toast.error("فشل: " + error.message); return; }
    toast.success("تم إنشاء جدول الإرسال");
    setShowForm(false);
    setNewSchedule({ reportType: "sales", reportName: "", scheduleType: "monthly", scheduleDay: 1, scheduleTime: "09:00", recipientInput: "", recipients: [] });
    loadSchedules();
  };

  const handleToggleSchedule = async (id: string, current: boolean) => {
    await supabase.from("report_schedules").update({ is_active: !current }).eq("id", id);
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !current } : s));
    toast.success(!current ? "تم التفعيل" : "تم الإيقاف");
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("هل تريد حذف جدول الإرسال؟")) return;
    await supabase.from("report_schedules").delete().eq("id", id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    toast.success("تم الحذف");
  };

  const addRecipient = () => {
    const email = newSchedule.recipientInput.trim();
    if (!email || !email.includes("@")) { toast.error("بريد غير صالح"); return; }
    if (newSchedule.recipients.includes(email)) { toast.error("مضاف مسبقاً"); return; }
    setNewSchedule((prev) => ({ ...prev, recipients: [...prev.recipients, email], recipientInput: "" }));
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-emerald-600" /> التقارير الآلية (Excel)
          </h1>
          <p className="text-xs text-gray-500 sm:text-sm">توليد وإرسال التقارير يدوياً أو بشكل مجدول</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-navy-light">
          <Plus className="size-4" /> جدولة تقرير جديد
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-1">📋 كيفية الاستخدام:</p>
            <ul className="text-xs space-y-0.5 list-disc list-inside">
              <li>اضغط "تنزيل" على أي تقرير للتوليد الفوري بصيغة Excel احترافية</li>
              <li>اضغط "جدولة" لإعداد إرسال دوري (يومي/أسبوعي/شهري/سنوي) لعدة مستلمين</li>
              <li>الجداول المجدولة تتطلب تفعيل SMTP في الإعدادات</li>
              <li>يمكن الإرسال اليدوي في أي وقت من الجداول المحفوظة</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick generate cards */}
      <div>
        <h3 className="text-sm font-bold text-navy mb-3">📥 التوليد اليدوي الفوري</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REPORT_TYPES.map((r) => (
            <div key={r.key} className={`rounded-2xl border-2 p-4 ${r.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="text-sm font-bold">{r.label}</p>
                  <p className="text-[10px] opacity-80">{r.description}</p>
                </div>
              </div>
              <button onClick={() => handleGenerate(r.key)} disabled={generating === r.key}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/80 hover:bg-white px-3 py-2 text-xs font-bold shadow-sm transition-colors disabled:opacity-50">
                {generating === r.key ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                {generating === r.key ? "جاري..." : "تنزيل Excel"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* New Schedule Form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 border-2 border-navy shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy flex items-center gap-2"><Calendar className="size-4" /> جدولة تقرير جديد</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">نوع التقرير</label>
              <select value={newSchedule.reportType} onChange={(e) => setNewSchedule({ ...newSchedule, reportType: e.target.value as ReportType })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                {REPORT_TYPES.map((r) => (
                  <option key={r.key} value={r.key}>{r.icon} {r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">اسم مخصص (اختياري)</label>
              <input value={newSchedule.reportName} onChange={(e) => setNewSchedule({ ...newSchedule, reportName: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="مثال: تقرير مبيعات الفرع" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">التكرار</label>
              <select value={newSchedule.scheduleType} onChange={(e) => setNewSchedule({ ...newSchedule, scheduleType: e.target.value as ReportSchedule["scheduleType"] })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                <option value="daily">يومي</option>
                <option value="weekly">أسبوعي</option>
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
                <option value="manual">يدوي فقط</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">اليوم</label>
                <input type="number" min="1" max="31" value={newSchedule.scheduleDay}
                  onChange={(e) => setNewSchedule({ ...newSchedule, scheduleDay: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">الوقت</label>
                <input type="time" value={newSchedule.scheduleTime}
                  onChange={(e) => setNewSchedule({ ...newSchedule, scheduleTime: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 mb-1 block flex items-center gap-1"><Mail className="size-3" /> المستلمون</label>
            <div className="flex gap-2 mb-2">
              <input type="email" value={newSchedule.recipientInput}
                onChange={(e) => setNewSchedule({ ...newSchedule, recipientInput: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="email@example.com" dir="ltr" />
              <button onClick={addRecipient} className="rounded-xl bg-emerald-500 text-white px-4 py-2 text-xs font-bold hover:bg-emerald-600">
                <Plus className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {newSchedule.recipients.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 text-blue-700 px-2 py-1 text-xs">
                  <Mail className="size-3" /> <span dir="ltr">{r}</span>
                  <button onClick={() => setNewSchedule({ ...newSchedule, recipients: newSchedule.recipients.filter((_, idx) => idx !== i) })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {newSchedule.recipients.length === 0 && <p className="text-xs text-gray-400">لا يوجد مستلمون بعد</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAddSchedule}
              className="flex-1 rounded-xl bg-navy text-white py-2.5 text-sm font-bold hover:bg-navy-light">
              حفظ الجدول
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Schedules list */}
      <div>
        <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
          <Clock className="size-4" /> الجداول المحفوظة ({schedules.length})
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-navy" /></div>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Calendar className="mx-auto size-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">لا توجد جداول محفوظة — أنشئ جدولاً جديداً للإرسال التلقائي</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => {
              const type = REPORT_TYPES.find((r) => r.key === s.reportType);
              return (
                <div key={s.id} className={`rounded-2xl border p-4 bg-white ${s.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl">{type?.icon || "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy">{s.reportName || type?.label}</p>
                        <p className="text-[11px] text-gray-500">
                          {SCHEDULE_LABELS[s.scheduleType]} · اليوم {s.scheduleDay} · الساعة {s.scheduleTime}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {s.recipients.map((r, i) => (
                            <span key={i} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700" dir="ltr">{r}</span>
                          ))}
                        </div>
                        {s.lastRun && (
                          <p className="text-[10px] text-gray-400 mt-1">آخر إرسال: {new Date(s.lastRun).toLocaleString("ar-SA")}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleSendReport(s)} disabled={sending === s.id || !settings.smtpEnabled}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-600 disabled:opacity-50"
                        title={settings.smtpEnabled ? "إرسال الآن" : "SMTP غير مفعّل"}>
                        {sending === s.id ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                        إرسال الآن
                      </button>
                      <button onClick={() => handleToggleSchedule(s.id, s.isActive)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${s.isActive ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                        {s.isActive ? "إيقاف" : "تفعيل"}
                      </button>
                      <button onClick={() => handleDeleteSchedule(s.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
