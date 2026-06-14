import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Phone, AlertCircle, CheckCircle2, Search, Edit3, Save, X, ArrowLeft, Loader2, MessageCircle, Send, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { validateYemeniPhone, formatPhone } from "@/lib/formatters";

export default function PhoneValidator() {
  const { user } = useAuth();
  const { customers, initializeData, updateCustomer } = useDataStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "invalid" | "valid">("invalid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id, initializeData]);

  const validated = useMemo(() => {
    return customers.map((c) => {
      const cleaned = c.phone.replace(/\D/g, "");
      const isValid = validateYemeniPhone(c.phone);
      const issue = !c.phone.trim() ? "لا يوجد رقم" :
        cleaned.length < 9 ? `ناقص (${cleaned.length} أرقام)` :
        !isValid ? "صيغة غير صحيحة" : "";
      return { ...c, isValid, issue };
    });
  }, [customers]);

  const filtered = useMemo(() => {
    return validated.filter((c) => {
      const matchSearch = !search || c.name.includes(search) || c.phone.includes(search) || c.city.includes(search);
      const matchFilter = filter === "all" || (filter === "invalid" ? !c.isValid : c.isValid);
      return matchSearch && matchFilter;
    });
  }, [validated, search, filter]);

  const validCount = validated.filter((c) => c.isValid).length;
  const invalidCount = validated.length - validCount;

  const startEdit = (id: string, phone: string) => {
    setEditingId(id);
    setEditPhone(phone);
  };

  const sendVerificationMessage = (customer: { name: string; phone: string }, isUpdated = false) => {
    const cleaned = customer.phone.replace(/\D/g, "");
    if (cleaned.length < 9) return false;
    const phone = cleaned.startsWith("967") ? cleaned : "967" + cleaned;

    const message = isUpdated
      ? `السلام عليكم ${customer.name} 🌸\n\nنود إعلامكم بأنه تم تحديث رقم هاتفكم في نظامنا إلى:\n${formatPhone(customer.phone)}\n\nإذا كان الرقم صحيحاً، يرجى الرد بـ "نعم" لتأكيده.\nإذا كان غير صحيح، يرجى إرسال الرقم الصحيح.\n\nشكراً لتعاونكم\nرداء`
      : `السلام عليكم ${customer.name} 🌸\n\nنود التحقق من رقم هاتفكم في نظامنا.\nالرقم الحالي: ${formatPhone(customer.phone)}\n\nإذا كان الرقم صحيحاً، يرجى الرد بـ "نعم" لتأكيده.\nإذا كان غير صحيح، يرجى إرسال الرقم الصحيح.\n\nشكراً لتعاونكم\nرداء`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    return true;
  };

  const saveEdit = async (id: string) => {
    if (!validateYemeniPhone(editPhone)) {
      toast.error("الرقم الجديد غير صحيح أو ناقص");
      return;
    }
    setSaving(true);
    const newPhone = editPhone.replace(/\D/g, "");
    await updateCustomer(id, { phone: newPhone });
    const customer = customers.find(c => c.id === id);
    setEditingId(null);
    setEditPhone("");
    toast.success("تم تحديث الرقم");
    setSaving(false);

    // Offer to send verification message
    if (customer && confirm(`هل تريد إرسال رسالة تأكيد للعميل ${customer.name}؟`)) {
      sendVerificationMessage({ name: customer.name, phone: newPhone }, true);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const validInFiltered = filtered.filter(c => c.isValid && c.phone.replace(/\D/g, "").length >= 9);
    if (selectedIds.size === validInFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validInFiltered.map(c => c.id)));
    }
  };

  const handleBulkVerify = async () => {
    const selected = filtered.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) {
      toast.error("اختر عميلاً واحداً على الأقل");
      return;
    }
    setBulkSending(true);
    setShowBulkConfirm(false);

    let count = 0;
    selected.forEach((c, i) => {
      setTimeout(() => {
        const sent = sendVerificationMessage({ name: c.name, phone: c.phone });
        if (sent) count++;
      }, i * 1500);
    });

    toast.success(`جاري إرسال ${selected.length} رسالة تحقق - بفاصل 1.5 ثانية لتجنب الحظر`);

    setTimeout(() => {
      setBulkSending(false);
      setSelectedIds(new Set());
      toast.success(`تم فتح ${count} رسالة واتساب`);
    }, selected.length * 1500 + 500);
  };

  const validInFiltered = filtered.filter(c => c.isValid && c.phone.replace(/\D/g, "").length >= 9);

  return (
    <div className="space-y-4 lg:space-y-6 pb-24 lg:pb-0">
      <div>
        <Link to="/customers" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy mb-2">
          <ArrowLeft className="size-4" /> العودة للعملاء
        </Link>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">فحص أرقام العملاء</h1>
        <p className="text-xs text-gray-500 sm:text-sm">فحص جميع أرقام الهاتف وتعديل الناقصة أو إرسال تأكيد جماعي عبر الواتساب</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="size-4 text-navy" />
            <p className="text-xs text-gray-500">الإجمالي</p>
          </div>
          <p className="text-2xl font-bold text-navy tabular-nums">{validated.length}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-xs text-emerald-700">أرقام صحيحة</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{validCount}</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 border border-red-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="size-4 text-red-600" />
            <p className="text-xs text-red-700">أرقام خاطئة</p>
          </div>
          <p className="text-2xl font-bold text-red-700 tabular-nums">{invalidCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none"
            placeholder="بحث بالاسم أو الرقم..." />
        </div>
        <div className="flex gap-2">
          {(["invalid", "valid", "all"] as const).map((f) => (
            <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                filter === f ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f === "invalid" ? `الخاطئة (${invalidCount})` : f === "valid" ? `الصحيحة (${validCount})` : `الكل (${validated.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Verification Toolbar */}
      {filter !== "invalid" && validInFiltered.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-700" />
              <div>
                <p className="text-sm font-bold text-emerald-800">تحقق جماعي عبر الواتساب</p>
                <p className="text-[11px] text-emerald-700">حدد العملاء وأرسل لهم رسائل تأكيد دفعة واحدة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleSelectAll}
                className="flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                {selectedIds.size === validInFiltered.length && validInFiltered.length > 0 ? (
                  <><CheckSquare className="size-3.5" /> إلغاء الكل</>
                ) : (
                  <><Square className="size-3.5" /> تحديد الكل ({validInFiltered.length})</>
                )}
              </button>
              {selectedIds.size > 0 && (
                <button onClick={() => setShowBulkConfirm(true)} disabled={bulkSending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md">
                  {bulkSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  إرسال تحقق ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                {filter !== "invalid" && (
                  <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4 w-10">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center hover:text-emerald-600">
                      {selectedIds.size === validInFiltered.length && validInFiltered.length > 0 ? (
                        <CheckSquare className="size-4 text-emerald-600" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الحالة</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">العميل</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الهاتف الحالي</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">المشكلة</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c, idx) => {
                const canSelect = c.isValid && c.phone.replace(/\D/g, "").length >= 9;
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr key={c.id} className={`hover:bg-cream/30 animate-fade-in opacity-0 ${isSelected ? "bg-emerald-50/50" : ""}`}
                    style={{ animationDelay: `${Math.min(idx, 20) * 30}ms` }}>
                    {filter !== "invalid" && (
                      <td className="px-3 py-2.5 sm:px-4">
                        {canSelect ? (
                          <button onClick={() => toggleSelect(c.id)} className="flex items-center justify-center hover:text-emerald-600">
                            {isSelected ? <CheckSquare className="size-4 text-emerald-600" /> : <Square className="size-4 text-gray-400" />}
                          </button>
                        ) : (
                          <span className="size-4 inline-block" />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 sm:px-4">
                      {c.isValid ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> صحيح
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          <AlertCircle className="size-3" /> خاطئ
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <p className="text-xs font-bold text-navy sm:text-sm">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.city || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      {editingId === c.id ? (
                        <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr"
                          className="w-full rounded-lg border border-gold px-2 py-1 text-xs focus:outline-none" autoFocus />
                      ) : (
                        <span className="text-xs font-mono text-gray-700" dir="ltr">{c.phone ? formatPhone(c.phone) : "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[10px] text-red-600">{c.issue || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      {editingId === c.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(c.id)} disabled={saving}
                            className="rounded p-1 text-emerald-500 hover:bg-emerald-50 disabled:opacity-50">
                            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                          </button>
                          <button onClick={() => { setEditingId(null); setEditPhone(""); }}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(c.id, c.phone)}
                            className="rounded p-1.5 text-blue-500 hover:bg-blue-50" title="تعديل الرقم">
                            <Edit3 className="size-3.5" />
                          </button>
                          {canSelect && (
                            <button onClick={() => sendVerificationMessage({ name: c.name, phone: c.phone })}
                              className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" title="إرسال رسالة تحقق">
                              <MessageCircle className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-300" />
            <p className="mt-2 text-sm text-gray-400">
              {filter === "invalid" ? "🎉 جميع الأرقام صحيحة!" : "لا يوجد نتائج"}
            </p>
          </div>
        )}
      </div>

      {/* Bulk Confirm Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100">
                <MessageCircle className="size-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-navy">تأكيد الإرسال الجماعي</h2>
                <p className="text-xs text-gray-500">إرسال رسائل تحقق عبر الواتساب</p>
              </div>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-sm text-gray-700">
                سيتم إرسال رسالة تحقق إلى <span className="font-bold text-emerald-600">{selectedIds.size} عميل</span>.
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ ملاحظات هامة:</p>
                <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
                  <li>سيتم فتح نافذة واتساب لكل عميل بفاصل 1.5 ثانية</li>
                  <li>قد يُطلب منك السماح بفتح نوافذ متعددة في المتصفح</li>
                  <li>الرسائل يتم فتحها فقط — يجب الضغط على إرسال يدوياً</li>
                </ul>
              </div>
              <div className="rounded-xl bg-cream/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">معاينة الرسالة:</p>
                <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {`السلام عليكم [اسم العميل] 🌸\n\nنود التحقق من رقم هاتفكم في نظامنا.\nالرقم الحالي: [الرقم]\n\nإذا كان الرقم صحيحاً، يرجى الرد بـ "نعم"...`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
              <button onClick={() => setShowBulkConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                إلغاء
              </button>
              <button onClick={handleBulkVerify}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
                <Send className="size-3.5" /> ابدأ الإرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
