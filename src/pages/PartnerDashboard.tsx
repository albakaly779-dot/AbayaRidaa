import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, FileCheck2, Lock, PieChart, Printer, ShieldCheck, ShoppingBag, Users, Package, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePartnersStore } from "@/stores/partnersStore";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useRepStore } from "@/stores/repStore";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";
import { downloadExcel, generateExcelReport } from "@/lib/excelExport";
import SalesChart from "@/components/features/SalesChart";

const CONSENT_TEXT = "أقر أنا الشريك بأنني اطلعت على تقرير المبيعات والتكاليف والأرباح والخسائر والمديونيات للفترة المحددة، وأوافق على حفظ هذا الإقرار كسجل تدقيق دون أن يسمح ذلك بتعديل البيانات الأصلية.";

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("التوقيع الرقمي يحتاج متصفحاً آمناً يدعم Web Crypto");
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { partners, initializePartners, distributeProfit, loading } = usePartnersStore();
  const { orders, customers, initializeData, getTotalSales } = useDataStore();
  const { getTotalExpenses, expenses, initializeData: initExp } = useExpenseStore();
  const { getTotalPendingCommissions, initializeData: initReps } = useRepStore();
  const { logAction } = useAuditStore();
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<{ signedAt: string; typedLegalName: string; contentHash: string } | null>(null);

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
  const reportKey = `partner-report:${user?.id || user?.email || "unknown"}:${new Date().toISOString().slice(0, 7)}`;
  const periodFrom = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const periodTo = new Date().toISOString().slice(0, 10);

  const profitRows = useMemo(() => orders.map((order) => {
    const cost = order.items.reduce((sum, item) => sum + (item.buyPrice || 0) * item.quantity, 0);
    const profit = order.total - cost;
    return {
      "رقم الطلب": order.orderNumber,
      "التاريخ": order.createdAt,
      "العميل": order.customerName,
      "المبيعات": Number(order.total),
      "التكلفة": Number(cost),
      "الربح": Number(profit),
      "الحالة": order.status,
    };
  }), [orders]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("partner_report_signatures")
      .select("signed_at, typed_legal_name, content_hash")
      .eq("partner_user_id", user.id)
      .eq("report_key", reportKey)
      .eq("status", "SIGNED")
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSignature({ signedAt: data.signed_at, typedLegalName: data.typed_legal_name, contentHash: data.content_hash });
      });
  }, [user?.id, reportKey]);

  const handleDownloadExcel = async () => {
    try {
      const blob = await generateExcelReport("profits", profitRows, {
        title: "تقرير الشريك المالي",
        subtitle: "المبيعات والتكاليف والأرباح والمديونيات",
        generatedAt: new Date().toLocaleString("ar-SA"),
        businessName: "رداء",
        from: periodFrom,
        to: periodTo,
      }, {
        "إجمالي المبيعات": totalRevenue,
        "إجمالي التكاليف": totalExpenses,
        "صافي الربح": result.netProfit,
        "المديونيات": orders.reduce((sum, order) => sum + order.remaining, 0),
      });
      downloadExcel(blob, `تقرير-الشريك-${periodTo}.xlsx`);
      if (user?.id) await logAction(user.id, "export", "partner_report", reportKey, "تصدير تقرير الشريك إلى Excel");
      toast.success("تم تجهيز تقرير Excel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تجهيز التقرير");
    }
  };

  const handleSign = async () => {
    if (!user?.id) return;
    if (!typedName.trim()) { toast.error("اكتب اسمك القانوني قبل التوقيع"); return; }
    if (!consent) { toast.error("يجب تأكيد الاطلاع والموافقة أولاً"); return; }
    setSigning(true);
    try {
      const reportSnapshot = JSON.stringify({ reportKey, periodFrom, periodTo, totalRevenue, totalExpenses, netProfit: result.netProfit, debts: orders.reduce((sum, order) => sum + order.remaining, 0), rows: profitRows });
      const contentHash = await sha256Hex(reportSnapshot);
      const { data, error } = await supabase.from("partner_report_signatures").insert({
        partner_user_id: user.id,
        report_key: reportKey,
        period_from: periodFrom,
        period_to: periodTo,
        content_hash: contentHash,
        consent_text: CONSENT_TEXT,
        typed_legal_name: typedName.trim(),
        status: "SIGNED",
        user_agent: navigator.userAgent.slice(0, 250),
      }).select("signed_at, typed_legal_name, content_hash").single();
      if (error) throw error;
      setSignature({ signedAt: data.signed_at, typedLegalName: data.typed_legal_name, contentHash: data.content_hash });
      setConsent(false);
      if (user?.id) await logAction(user.id, "create", "partner_signature", reportKey, `توقيع إقرار الاطلاع للفترة ${periodFrom} إلى ${periodTo}`);
      toast.success("تم حفظ توقيع الاطلاع وبصمة التقرير");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التوقيع");
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;

  return (
    <div className="space-y-5 lg:space-y-6" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-bl from-navy to-navy-light p-6 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-white/20 p-3"><Eye className="size-6" /></div>
          <div className="flex-1"><h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">لوحة الشريك <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold"><Lock className="size-3" /> قراءة فقط</span></h1><p className="mt-1 text-sm text-white/80">مرحباً {currentPartner?.partnerName || user?.username || user?.email} — عرض مالي موثق</p></div>
          <div className="flex flex-wrap gap-2 print:hidden"><button onClick={handleDownloadExcel} className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25"><Download className="size-4" /> Excel</button><button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25"><Printer className="size-4" /> PDF / طباعة</button></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><DollarSign className="mb-2 size-4 text-emerald-600" /><p className="text-xs text-gray-500">إجمالي المبيعات</p><p className="text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(totalRevenue)}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><TrendingDown className="mb-2 size-4 text-red-600" /><p className="text-xs text-gray-500">التكاليف والمصروفات</p><p className="text-lg font-bold text-red-700 tabular-nums">{formatCurrency(totalExpenses)}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><TrendingUp className={`mb-2 size-4 ${result.netProfit >= 0 ? "text-navy" : "text-red-600"}`} /><p className="text-xs text-gray-500">صافي الربح</p><p className={`text-lg font-bold tabular-nums ${result.netProfit >= 0 ? "text-navy" : "text-red-700"}`}>{formatCurrency(result.netProfit)}</p></div>
        <div className="rounded-2xl bg-gradient-to-bl from-gold to-gold-dark p-4 text-white shadow-lg"><PieChart className="mb-2 size-4" /><p className="text-xs text-white/80">نصيبك</p><p className="text-lg font-bold tabular-nums">{currentPartner ? formatCurrency(result.distributions.find((d) => d.partner.id === currentPartner.id)?.amount || 0) : "—"}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><ShoppingBag className="mb-2 size-4 text-blue-600" /><p className="text-xs text-gray-500">عدد الطلبات</p><p className="text-xl font-bold text-navy tabular-nums">{orders.length}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Users className="mb-2 size-4 text-purple-600" /><p className="text-xs text-gray-500">عدد العملاء</p><p className="text-xl font-bold text-navy tabular-nums">{customers.length}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Package className="mb-2 size-4 text-amber-600" /><p className="text-xs text-gray-500">المصروفات</p><p className="text-xl font-bold text-navy tabular-nums">{expenses.length}</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><DollarSign className="mb-2 size-4 text-red-600" /><p className="text-xs text-gray-500">المديونيات</p><p className="text-xl font-bold text-red-700 tabular-nums">{formatCurrency(orders.reduce((sum, order) => sum + order.remaining, 0))}</p></div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><h3 className="mb-4 text-sm font-bold text-navy">حركة المبيعات</h3><SalesChart /></div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-navy"><PieChart className="size-4" /> توزيع الأرباح</h3><div className="space-y-2">{result.distributions.map((d) => <div key={d.partner.id} className={`flex items-center justify-between rounded-xl border p-3 ${currentPartner?.id === d.partner.id ? "border-gold bg-gold/10" : "border-gray-100 bg-cream/40"}`}><div><p className="text-sm font-bold text-navy">{d.partner.partnerName}{currentPartner?.id === d.partner.id && <span className="ms-2 rounded-full bg-gold px-2 py-0.5 text-[10px] text-white">أنت</span>}</p><p className="text-[10px] text-gray-500">{d.partner.percentage}% من الأرباح</p></div><p className="text-base font-bold text-emerald-600 tabular-nums">{formatCurrency(d.amount)}</p></div>)}</div></div>

      <section className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-5 print:hidden">
        <div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-2.5"><FileCheck2 className="size-5 text-indigo-700" /></div><div><h2 className="text-sm font-bold text-indigo-950">إقرار الشريك بالاطلاع والموافقة</h2><p className="mt-1 text-xs text-indigo-800">يتم توقيع نسخة التقرير الحالية ببصمة رقمية، وأي تغيير لاحق يتطلب إصداراً جديداً وتوقيعاً جديداً.</p></div></div>
        {signature ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="size-5" /> تم التوقيع بواسطة {signature.typedLegalName}</div><p className="mt-1 text-xs text-emerald-700">وقت التوقيع: {new Date(signature.signedAt).toLocaleString("ar-SA")}</p><p className="mt-1 break-all text-[10px] text-emerald-700" dir="ltr">SHA-256: {signature.contentHash}</p></div> : <div className="space-y-3"><p className="rounded-xl bg-white p-3 text-xs leading-6 text-gray-700">{CONSENT_TEXT}</p><label className="flex items-start gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 rounded border-gray-300 text-indigo-600" /> قرأت النص أعلاه وأوافق على حفظ إقراري.</label><div className="flex flex-col gap-2 sm:flex-row"><input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" placeholder="الاسم القانوني للشريك" /><button onClick={handleSign} disabled={signing} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">{signing ? "جاري التوقيع..." : <><ShieldCheck className="size-4" /> توقيع الإقرار</>}</button></div></div>}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"><Lock className="mt-0.5 size-4 shrink-0 text-blue-600" /><p className="text-xs text-blue-800"><b>وضع القراءة فقط:</b> لا تملك هذه الصفحة أي عملية تعديل أو حذف أو اعتماد. التوقيع يثبت الاطلاع على نسخة التقرير ولا يمنح صلاحية تغيير البيانات.</p></div>
    </div>
  );
}
