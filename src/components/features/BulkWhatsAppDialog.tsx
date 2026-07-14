import { useState, useMemo, useEffect, useCallback } from "react";
import { MessageCircle, Users, Package, Send, X, CheckCircle, ExternalLink, AlertTriangle, SkipForward, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useAuditStore } from "@/stores/auditStore";
import { formatCurrency, validateYemeniPhone } from "@/lib/formatters";
import { WHATSAPP_TEMPLATES } from "@/constants/config";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "debtors" | "ready";
}

export default function BulkWhatsAppDialog({ open, onClose, mode }: Props) {
  const { user } = useAuth();
  const { orders, getDebtors } = useDataStore();
  const { logAction } = useAuditStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [currentRecipient, setCurrentRecipient] = useState<string | null>(null);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [sendQueue, setSendQueue] = useState<Array<{ id: string; name: string; phone: string; detail: string; message: string; amount: number; validPhone: boolean }>>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const recipients = useMemo(() => {
    if (mode === "debtors") {
      return getDebtors().map((d) => ({
        id: d.customer.id,
        name: d.customer.name,
        phone: d.customer.phone,
        detail: `مديونية: ${formatCurrency(d.debt)}`,
        message: WHATSAPP_TEMPLATES.paymentReminder(d.customer.name, d.debt),
        amount: d.debt,
        validPhone: validateYemeniPhone(d.customer.phone),
      }));
    }
    return orders.filter((o) => o.status === "ready").map((o) => ({
      id: o.id,
      name: o.customerName,
      phone: o.customerPhone,
      detail: `طلب: ${o.orderNumber}`,
      message: WHATSAPP_TEMPLATES.orderReady(o.customerName, o.orderNumber),
      amount: o.total,
      validPhone: validateYemeniPhone(o.customerPhone),
    }));
  }, [mode, orders, getDebtors]);

  useEffect(() => {
    if (open) {
      // Only select recipients with valid phone numbers
      setSelectedIds(new Set(recipients.filter(r => r.validPhone).map((r) => r.id)));
      setSentCount(0);
      setSending(false);
      setWaitingForUser(false);
      setSendQueue([]);
      setQueueIndex(0);
      setCurrentRecipient(null);
    }
  }, [open, recipients]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const validRecipients = recipients.filter(r => r.validPhone);
    if (selectedIds.size === validRecipients.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(validRecipients.map((r) => r.id)));
  };

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("967") ? cleanPhone : `967${cleanPhone}`;
    const encoded = encodeURIComponent(message);
    const link = document.createElement("a");
    link.href = `https://wa.me/${fullPhone}?text=${encoded}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendAll = () => {
    const selected = recipients.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) { toast.error("اختر على الأقل مستلماً واحداً"); return; }

    // Filter out invalid phones
    const validSelected = selected.filter(r => r.validPhone);
    if (validSelected.length === 0) { toast.error("لا يوجد مستلم برقم هاتف صالح"); return; }

    const invalidCount = selected.length - validSelected.length;
    if (invalidCount > 0) {
      toast.warning(`تم تخطي ${invalidCount} مستلم بسبب أرقام هاتف غير صحيحة`);
    }

    setSending(true);
    setSendQueue(validSelected);
    setQueueIndex(0);
    setSentCount(0);

    // Open first one immediately
    const first = validSelected[0];
    setCurrentRecipient(first.name);
    openWhatsApp(first.phone, first.message);
    setSentCount(1);
    setQueueIndex(1);

    if (validSelected.length === 1) {
      finishSending(1);
    } else {
      setWaitingForUser(true);
    }
  };

  const handleSendNext = () => {
    if (queueIndex >= sendQueue.length) {
      finishSending(sentCount);
      return;
    }
    const next = sendQueue[queueIndex];
    setCurrentRecipient(next.name);
    openWhatsApp(next.phone, next.message);
    setSentCount((c) => c + 1);
    setQueueIndex((i) => i + 1);

    if (queueIndex + 1 >= sendQueue.length) {
      // Last one
      setTimeout(() => finishSending(sentCount + 1), 500);
    }
  };

  const finishSending = (count: number) => {
    if (user?.id) {
      logAction(user.id, "bulk_whatsapp", "system", undefined,
        `إرسال واتساب جماعي (${mode === "debtors" ? "مدينين" : "طلبات جاهزة"}) — ${count} مستلم`);
    }
    setSending(false);
    setWaitingForUser(false);
    toast.success(`تم إرسال ${count} رسالة واتساب بنجاح ✅`);
    onClose();
  };

  const handleSkipRest = () => {
    finishSending(sentCount);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${mode === "debtors" ? "bg-red-50" : "bg-emerald-50"}`}>
              {mode === "debtors" ? <AlertTriangle className="size-5 text-red-600" /> : <Package className="size-5 text-emerald-600" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-navy">
                {mode === "debtors" ? "مطالبة المدينين جماعياً" : "إبلاغ الطلبات الجاهزة"}
              </h2>
              <p className="text-xs text-gray-400">{recipients.length} مستلم متاح</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="size-5 text-gray-400" /></button>
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between border-b px-5 py-3 bg-cream/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectedIds.size === recipients.filter(r => r.validPhone).length && recipients.length > 0}
              onChange={toggleAll} className="size-4 rounded border-gray-300 accent-navy" />
            <span className="text-sm font-semibold text-navy">تحديد الكل ({selectedIds.size}/{recipients.filter(r => r.validPhone).length})</span>
          </label>
          {sending && <span className="text-xs text-emerald-600 font-semibold animate-pulse">تم إرسال {sentCount}/{sendQueue.length}</span>}
        </div>

        {/* Invalid phones warning */}
        {recipients.filter(r => !r.validPhone).length > 0 && (
          <div className="mx-5 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 font-semibold">
              {recipients.filter(r => !r.validPhone).length} أرقام غير صالحة (ناقصة أو خاطئة) — لن يتم إرسالها
            </span>
          </div>
        )}

        {/* Recipients list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {recipients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <CheckCircle className="size-10 text-green-400" />
              <p className="text-sm text-gray-500">
                {mode === "debtors" ? "لا يوجد مدينون حالياً 🎉" : "لا توجد طلبات جاهزة للتسليم"}
              </p>
            </div>
          ) : (
            recipients.map((r) => (
              <label key={r.id}
                className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors ${!r.validPhone ? "bg-red-50 border border-red-200 opacity-70" : selectedIds.has(r.id) ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-transparent hover:bg-gray-100"}`}>
                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleId(r.id)}
                  disabled={!r.validPhone}
                  className="size-4 rounded border-gray-300 accent-emerald-600 shrink-0 disabled:opacity-40" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{r.name}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-gray-400" dir="ltr">+{r.phone.replace(/\D/g, "").replace(/^(?!967)/, "967")}</p>
                    {!r.validPhone && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1 rounded">رقم ناقص!</span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-bold tabular-nums ${!r.validPhone ? "text-red-400" : mode === "debtors" ? "text-red-600" : "text-emerald-600"}`}>
                  {r.detail}
                </span>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-5 space-y-3">
          {waitingForUser && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                ✅ تم إرسال لـ "{currentRecipient}" — اضغط "التالي" لإرسال الرسالة القادمة
              </p>
              <p className="text-[10px] text-blue-500">تم {sentCount} من {sendQueue.length}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              {sending ? "إغلاق" : "إلغاء"}
            </button>
            {waitingForUser ? (
              <>
                <button onClick={handleSkipRest}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                  <SkipForward className="size-4" /> إنهاء
                </button>
                <button onClick={handleSendNext}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-colors">
                  <Send className="size-4" /> التالي ({queueIndex + 1}/{sendQueue.length})
                </button>
              </>
            ) : (
              <button onClick={handleSendAll} disabled={sending || selectedIds.size === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <MessageCircle className="size-4" />
                إرسال لـ {selectedIds.size} شخص
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
