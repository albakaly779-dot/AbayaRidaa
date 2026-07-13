import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Clock, Loader2, Filter, AlertCircle, Plus, DollarSign, Package, RotateCcw, Receipt, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useAuditStore } from "@/stores/auditStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { logActivity } from "@/hooks/useActivityLogger";

interface ApprovalRequest {
  id: string;
  requesterEmail: string;
  requestType: "invoice" | "discount" | "return" | "expense" | "transfer";
  entityId: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string;
  reviewedAt?: string;
  createdAt: string;
}

const REQUEST_TYPE_META: Record<string, { label: string; icon: typeof Receipt; color: string }> = {
  invoice: { label: "اعتماد فاتورة", icon: Receipt, color: "bg-blue-50 text-blue-700 border-blue-200" },
  discount: { label: "اعتماد خصم", icon: DollarSign, color: "bg-amber-50 text-amber-700 border-amber-200" },
  return: { label: "اعتماد مرتجع", icon: RotateCcw, color: "bg-red-50 text-red-700 border-red-200" },
  expense: { label: "اعتماد مصروف", icon: Receipt, color: "bg-purple-50 text-purple-700 border-purple-200" },
  transfer: { label: "اعتماد تحويل", icon: ArrowRight, color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "معتمد", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function Approvals() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // New request form
  const [reqType, setReqType] = useState<ApprovalRequest["requestType"]>("discount");
  const [reqAmount, setReqAmount] = useState(0);
  const [reqReason, setReqReason] = useState("");
  const [reqEntityId, setReqEntityId] = useState("");

  useEffect(() => { loadRequests(); }, [user?.id, filter]);

  const loadRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    let query = supabase.from("approval_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    const mapped: ApprovalRequest[] = (data || []).map((r: {
      id: string; requester_email: string; request_type: string; entity_id: string;
      amount: string; reason: string; status: string; reviewed_by: string;
      reviewed_at: string | null; created_at: string;
    }) => ({
      id: r.id,
      requesterEmail: r.requester_email,
      requestType: r.request_type as ApprovalRequest["requestType"],
      entityId: r.entity_id,
      amount: Number(r.amount),
      reason: r.reason,
      status: r.status as ApprovalRequest["status"],
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at || undefined,
      createdAt: r.created_at,
    }));
    setRequests(mapped);
    setLoading(false);
  };

  const handleCreateRequest = async () => {
    if (!user?.id) return;
    if (!reqReason.trim()) { toast.error("أدخل سبب الطلب"); return; }
    if (reqAmount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }

    const { error } = await supabase.from("approval_requests").insert({
      user_id: user.id,
      requester_email: user.email,
      request_type: reqType,
      entity_id: reqEntityId,
      amount: reqAmount,
      reason: reqReason,
      status: "pending",
    });

    if (error) { toast.error("فشل: " + error.message); return; }
    logAction(user.id, "create", "approval", undefined, `طلب ${REQUEST_TYPE_META[reqType].label}: ${formatCurrency(reqAmount)}`);
    logActivity(user.email, user.id, "action", `إنشاء طلب اعتماد: ${REQUEST_TYPE_META[reqType].label}`, { entityType: "approval" });
    toast.success("تم إنشاء طلب الاعتماد");
    setShowForm(false);
    setReqAmount(0); setReqReason(""); setReqEntityId("");
    loadRequests();
  };

  const handleDecision = async (req: ApprovalRequest, decision: "approved" | "rejected") => {
    if (!user?.id) return;
    if (!confirm(`${decision === "approved" ? "اعتماد" : "رفض"} هذا الطلب؟`)) return;
    setProcessing(req.id);
    const { error } = await supabase.from("approval_requests").update({
      status: decision,
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.id);

    if (error) { toast.error("فشل: " + error.message); setProcessing(null); return; }
    logAction(user.id, "status_change", "approval", req.id, `${decision === "approved" ? "اعتماد" : "رفض"} طلب ${REQUEST_TYPE_META[req.requestType].label} من ${req.requesterEmail}`);
    logActivity(user.email, user.id, "action", `${decision === "approved" ? "اعتماد" : "رفض"} طلب`, { entityType: "approval", entityId: req.id });
    toast.success(decision === "approved" ? "✅ تم الاعتماد" : "❌ تم الرفض");
    loadRequests();
    setProcessing(null);
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
            <ShieldCheck className="size-5 text-indigo-600" /> نظام الموافقات (Approval Workflow)
          </h1>
          <p className="text-xs text-gray-500 sm:text-sm">اعتماد العمليات الحساسة قبل تنفيذها</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-light shadow-lg">
          <Plus className="size-4" /> طلب اعتماد جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <Clock className="size-4 text-amber-600 mb-1" />
          <p className="text-xs text-amber-700 font-semibold">قيد المراجعة</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <CheckCircle2 className="size-4 text-emerald-600 mb-1" />
          <p className="text-xs text-emerald-700 font-semibold">معتمد</p>
          <p className="text-2xl font-bold text-emerald-800 tabular-nums">{approvedCount}</p>
        </div>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <XCircle className="size-4 text-red-600 mb-1" />
          <p className="text-xs text-red-700 font-semibold">مرفوض</p>
          <p className="text-2xl font-bold text-red-800 tabular-nums">{rejectedCount}</p>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-900">
            <p className="font-bold mb-1">💡 آلية الاعتماد:</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              <li>أي عملية حساسة (خصم، مرتجع، مصروف كبير) تُرسل للاعتماد قبل التنفيذ</li>
              <li>المسؤول يستعرض التفاصيل ويوافق أو يرفض مع تسجيل قراره</li>
              <li>جميع القرارات مسجّلة في سجل التدقيق</li>
              <li>لا يتم تنفيذ العملية تلقائياً بعد الاعتماد - يتم يدوياً من الصفحة المعنية</li>
            </ul>
          </div>
        </div>
      </div>

      {/* New request form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 border-2 border-navy shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-navy">📝 طلب اعتماد جديد</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">نوع الطلب</label>
              <select value={reqType} onChange={(e) => setReqType(e.target.value as ApprovalRequest["requestType"])}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                {Object.entries(REQUEST_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">المبلغ (ر.ي)</label>
              <input type="number" value={reqAmount || ""} onChange={(e) => setReqAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none tabular-nums"
                placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">رقم المرجع (اختياري)</label>
              <input value={reqEntityId} onChange={(e) => setReqEntityId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="ORD-001" dir="ltr" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-1 block">السبب/التبرير</label>
              <textarea value={reqReason} onChange={(e) => setReqReason(e.target.value)} rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none resize-none"
                placeholder="اشرح سبب الطلب..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateRequest}
              className="flex-1 rounded-xl bg-navy text-white py-2.5 text-sm font-bold hover:bg-navy-light">
              إرسال الطلب
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-4 text-gray-500" />
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f ? "bg-navy text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-cream/50"
            }`}>
            {f === "all" ? "الكل" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-navy" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <ShieldCheck className="mx-auto size-10 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">لا توجد طلبات اعتماد {filter !== "all" ? `بحالة "${STATUS_META[filter].label}"` : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const typeMeta = REQUEST_TYPE_META[req.requestType];
            const statusMeta = STATUS_META[req.status];
            const TypeIcon = typeMeta.icon;
            const StatusIcon = statusMeta.icon;
            return (
              <div key={req.id} className={`rounded-2xl border p-4 bg-white shadow-sm ${req.status === "pending" ? "border-amber-200" : "border-gray-100"}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`rounded-xl p-2.5 border ${typeMeta.color}`}>
                      <TypeIcon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-navy">{typeMeta.label}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusMeta.color}`}>
                          <StatusIcon className="size-3" /> {statusMeta.label}
                        </span>
                        {req.entityId && (
                          <span className="text-[10px] font-mono bg-gray-100 rounded px-1.5 py-0.5" dir="ltr">{req.entityId}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{req.reason}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 flex-wrap">
                        <span>مقدّم من: <b dir="ltr">{req.requesterEmail}</b></span>
                        <span>·</span>
                        <span>{formatDate(req.createdAt)}</span>
                        {req.reviewedBy && (
                          <>
                            <span>·</span>
                            <span>راجعه: <b dir="ltr">{req.reviewedBy}</b></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-bold text-navy tabular-nums">{formatCurrency(req.amount)}</p>
                    {req.status === "pending" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleDecision(req, "approved")} disabled={processing === req.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">
                          {processing === req.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} اعتماد
                        </button>
                        <button onClick={() => handleDecision(req, "rejected")} disabled={processing === req.id}
                          className="flex items-center gap-1 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-600 disabled:opacity-50">
                          <XCircle className="size-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
