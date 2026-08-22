import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Filter, Loader2, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";

interface ReturnApproval {
  id: string;
  requesterId: string;
  requestType: "CUSTOMER_RETURN" | "SUPPLIER_RETURN";
  referenceId: string;
  referenceNumber: string;
  counterpartyName: string;
  amount: number;
  reasonCode: string;
  reasonDetails: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED" | "CANCELLED";
  decisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

const REASONS = [
  ["QUALITY", "عيب أو جودة غير مطابقة"],
  ["SIZE", "مقاس غير مناسب"],
  ["WRONG_ITEM", "صنف غير صحيح"],
  ["DAMAGE", "تلف أثناء الشحن"],
  ["DUPLICATE", "تكرار أو خطأ بالفاتورة"],
  ["OTHER", "سبب آخر"],
] as const;

const STATUS_META: Record<ReturnApproval["status"], { label: string; className: string }> = {
  SUBMITTED: { label: "مرسل للمراجعة", className: "bg-amber-100 text-amber-800" },
  UNDER_REVIEW: { label: "قيد المراجعة", className: "bg-blue-100 text-blue-800" },
  APPROVED: { label: "معتمد — بانتظار التنفيذ", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "مرفوض", className: "bg-red-100 text-red-800" },
  EXECUTED: { label: "منفذ", className: "bg-indigo-100 text-indigo-800" },
  CANCELLED: { label: "ملغى", className: "bg-gray-100 text-gray-600" },
};

function mapRow(row: Record<string, unknown>): ReturnApproval {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    requestType: row.request_type as ReturnApproval["requestType"],
    referenceId: String(row.reference_id || ""),
    referenceNumber: String(row.reference_number || ""),
    counterpartyName: String(row.counterparty_name || ""),
    amount: Number(row.amount || 0),
    reasonCode: String(row.reason_code || "OTHER"),
    reasonDetails: String(row.reason_details || ""),
    status: row.status as ReturnApproval["status"],
    decisionReason: row.decision_reason ? String(row.decision_reason) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    createdAt: String(row.created_at),
  };
}

export default function Approvals() {
  const { user, role } = useAuth();
  const { logAction } = useAuditStore();
  const [requests, setRequests] = useState<ReturnApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ReturnApproval["status"]>("SUBMITTED");
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<ReturnApproval["requestType"]>("CUSTOMER_RETURN");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [amount, setAmount] = useState(0);
  const [reasonCode, setReasonCode] = useState("QUALITY");
  const [reasonDetails, setReasonDetails] = useState("");
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("return_approval_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) {
      toast.error("تعذر تحميل موافقات المرتجعات: " + error.message);
      setRequests([]);
    } else setRequests((data || []).map((row) => mapRow(row as Record<string, unknown>)));
    setLoading(false);
  }, [filter]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const handleCreate = async () => {
    if (!user?.id) return;
    if (!reasonDetails.trim() || reasonDetails.trim().length < 5) { toast.error("اكتب سبباً واضحاً لا يقل عن 5 أحرف"); return; }
    if (amount < 0) { toast.error("المبلغ غير صالح"); return; }
    const idempotencyKey = crypto.randomUUID();
    const { data, error } = await supabase.from("return_approval_requests").insert({
      requester_id: user.id,
      request_type: requestType,
      reference_number: referenceNumber.trim() || null,
      counterparty_name: counterpartyName.trim() || null,
      amount,
      reason_code: reasonCode,
      reason_details: reasonDetails.trim(),
      status: "SUBMITTED",
      idempotency_key: idempotencyKey,
    }).select().single();
    if (error) { toast.error("فشل إرسال الطلب: " + error.message); return; }
    await supabase.from("return_approval_events").insert({ request_id: data.id, actor_id: user.id, action: "SUBMIT", comment: reasonDetails.trim() });
    await supabase.functions.invoke("notify-admin", { body: { type: "return_approval", requestId: data.id, message: `طلب ${requestType === "CUSTOMER_RETURN" ? "مرتجع عميل" : "مرتجع مورد"} يحتاج مراجعة` } });
    await logAction(user.id, "create", "return_approval", data.id, `إرسال طلب ${requestType === "CUSTOMER_RETURN" ? "مرتجع عميل" : "مرتجع مورد"}: ${reasonDetails.trim()}`);
    toast.success("تم إرسال طلب المرتجع وتنبيه المدير العام");
    setShowForm(false); setReferenceNumber(""); setCounterpartyName(""); setAmount(0); setReasonDetails("");
    await loadRequests();
  };

  const handleDecision = async (request: ReturnApproval, decision: "APPROVED" | "REJECTED") => {
    if (role !== "admin") { toast.error("اعتماد أو رفض المرتجعات من اختصاص المدير العام فقط"); return; }
    if (!user?.id) return;
    const reason = decisionReason[request.id]?.trim() || "";
    if (decision === "REJECTED" && reason.length < 5) { toast.error("اكتب سبب الرفض بالتفصيل"); return; }
    if (!confirm(decision === "APPROVED" ? "اعتماد الطلب؟ سيبقى بانتظار تنفيذ الحركة." : "رفض الطلب؟")) return;
    setProcessing(request.id);
    const { error } = await supabase.from("return_approval_requests").update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString(), decision_reason: reason || "تمت المراجعة والموافقة" }).eq("id", request.id).eq("status", "SUBMITTED");
    if (error) toast.error("فشل تسجيل القرار: " + error.message);
    else {
      await supabase.from("return_approval_events").insert({ request_id: request.id, actor_id: user.id, action: decision === "APPROVED" ? "APPROVE" : "REJECT", comment: reason || "تمت الموافقة" });
      await logAction(user.id, "status_change", "return_approval", request.id, `${decision === "APPROVED" ? "اعتماد" : "رفض"} طلب مرتجع`);
      toast.success(decision === "APPROVED" ? "تم الاعتماد وبقي التنفيذ منفصلاً" : "تم رفض الطلب");
      await loadRequests();
    }
    setProcessing(null);
  };

  const counts = useMemo(() => requests.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {} as Record<string, number>), [requests]);

  return (
    <div className="space-y-5 lg:space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="flex items-center gap-2 text-lg font-bold text-navy sm:text-xl lg:text-2xl"><ShieldCheck className="size-5 text-indigo-600" /> موافقات المرتجعات</h1><p className="text-xs text-gray-500 sm:text-sm">طلب مرتجع العميل أو المورد مع السبب قبل تنفيذ الأثر المالي والمخزني</p></div><button onClick={() => setShowForm((value) => !value)} className="flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-light"><Send className="size-4" /> طلب مرتجع</button></div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><Clock className="mb-2 size-4 text-amber-600" /><p className="text-xs text-amber-700">بانتظار المراجعة</p><p className="text-2xl font-bold text-amber-800">{counts.SUBMITTED || 0}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><CheckCircle2 className="mb-2 size-4 text-emerald-600" /><p className="text-xs text-emerald-700">معتمد</p><p className="text-2xl font-bold text-emerald-800">{counts.APPROVED || 0}</p></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><XCircle className="mb-2 size-4 text-red-600" /><p className="text-xs text-red-700">مرفوض</p><p className="text-2xl font-bold text-red-800">{counts.REJECTED || 0}</p></div><div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><RotateCcw className="mb-2 size-4 text-indigo-600" /><p className="text-xs text-indigo-700">منفذ</p><p className="text-2xl font-bold text-indigo-800">{counts.EXECUTED || 0}</p></div></div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900"><AlertCircle className="mt-0.5 size-4 shrink-0 text-indigo-600" /><p><b>قاعدة العمل:</b> الاعتماد لا ينفذ حركة المخزون أو القيد المالي مباشرة. التنفيذ خطوة منفصلة من خدمة خادمية، مع منع مقدم الطلب من اعتماد طلبه وتسجيل كل قرار في سجل المراجعة.</p></div>

      {showForm && <section className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-bold text-navy">طلب مرتجع جديد</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-700">النوع<select value={requestType} onChange={(e) => setRequestType(e.target.value as ReturnApproval["requestType"])} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="CUSTOMER_RETURN">مرتجع من عميل</option><option value="SUPPLIER_RETURN">مرتجع إلى مورد</option></select></label><label className="text-xs font-semibold text-gray-700">رقم الفاتورة/المرجع<input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="ORD-001" dir="ltr" /></label><label className="text-xs font-semibold text-gray-700">اسم الطرف<input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="اسم العميل أو المورد" /></label><label className="text-xs font-semibold text-gray-700">القيمة التقديرية<input type="number" min="0" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" /></label><label className="text-xs font-semibold text-gray-700 sm:col-span-2">سبب مختصر<select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold text-gray-700 sm:col-span-2">تفاصيل السبب<textarea value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} rows={3} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="اذكر المنتج والكمية والسبب والإجراء المقترح..." /></label></div><div className="mt-4 flex gap-2"><button onClick={handleCreate} className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white"><Send className="size-4" /> إرسال للمراجعة</button><button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600">إلغاء</button></div></section>}

      <div className="flex flex-wrap items-center gap-2"><Filter className="size-4 text-gray-500" />{(["all", "SUBMITTED", "APPROVED", "REJECTED", "EXECUTED"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-navy text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{value === "all" ? "الكل" : STATUS_META[value].label}</button>)}</div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-navy" /></div> : requests.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center"><RotateCcw className="mx-auto mb-2 size-8 text-gray-300" /><p className="text-sm text-gray-500">لا توجد طلبات في هذا التصفية</p></div> : <div className="space-y-3">{requests.map((request) => { const meta = STATUS_META[request.status]; return <article key={request.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 p-2.5 text-red-600"><RotateCcw className="size-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-navy">{request.requestType === "CUSTOMER_RETURN" ? "مرتجع من عميل" : "مرتجع إلى مورد"}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</span></div><p className="mt-1 text-xs text-gray-500">{request.counterpartyName || "طرف غير محدد"} · {request.referenceNumber || "بدون مرجع"} · {formatCurrency(request.amount)}</p></div></div><p className="text-[10px] text-gray-400">{new Date(request.createdAt).toLocaleString("ar-SA")}</p></div><div className="mt-3 rounded-xl bg-cream/50 p-3 text-xs leading-6 text-gray-700"><b>السبب:</b> {request.reasonDetails}</div>{request.decisionReason && <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600"><b>قرار المراجع:</b> {request.decisionReason}</div>}{request.status === "SUBMITTED" && role === "admin" && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={decisionReason[request.id] || ""} onChange={(e) => setDecisionReason((current) => ({ ...current, [request.id]: e.target.value }))} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs" placeholder="سبب الرفض أو ملاحظة الاعتماد" /><button disabled={processing === request.id} onClick={() => void handleDecision(request, "APPROVED")} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="size-4" /> اعتماد</button><button disabled={processing === request.id} onClick={() => void handleDecision(request, "REJECTED")} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><XCircle className="size-4" /> رفض</button></div>}</article>; })}</div>}
    </div>
  );
}
