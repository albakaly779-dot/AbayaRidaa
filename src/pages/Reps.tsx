import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, UserCheck, DollarSign, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Mail, Calendar, Edit2, Trash2, AlertCircle, CheckCircle2, X, Power, Loader2, Activity, Key, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRepStore } from "@/stores/repStore";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { formatCurrency, formatDate, validateYemeniPhone } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import { GOVERNORATES } from "@/constants/config";
import type { SalesRep } from "@/types";

interface ConfirmAction {
  type: "delete" | "toggle";
  rep: SalesRep;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

export default function Reps() {
  const { user } = useAuth();
  const { reps, initializeData, addRep, updateRep, deleteRep, markCommissionPaid,
    getRepCommissions, getRepTotalEarned, getRepTotalPaid, getRepTotalPending,
    getTotalCommissions, getTotalPendingCommissions } = useRepStore();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddRep, setShowAddRep] = useState(false);
  const [editingRep, setEditingRep] = useState<string | null>(null);
  const [rf, setRf] = useState({ name: "", phone: "", email: "", city: "", commissionRate: 10, notes: "", isActive: true });
  const [phoneError, setPhoneError] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; name: string } | null>(null);

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id, initializeData]);

  useEffect(() => {
    if (!rf.phone.trim()) {
      setPhoneError("");
      setPhoneValid(false);
      return;
    }
    const cleaned = rf.phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      setPhoneError(`الرقم ناقص — ${cleaned.length} أرقام (المطلوب 9+)`);
      setPhoneValid(false);
    } else if (!validateYemeniPhone(rf.phone)) {
      setPhoneError("صيغة غير صحيحة");
      setPhoneValid(false);
    } else {
      setPhoneError("");
      setPhoneValid(true);
    }
  }, [rf.phone]);

  const totalCommissions = getTotalCommissions();
  const totalPending = getTotalPendingCommissions();
  const filtered = useMemo(() =>
    reps.filter((r) => r.name.includes(search) || r.phone.includes(search) || r.city.includes(search) || r.email.includes(search)),
    [reps, search]);

  const handleAddRep = async () => {
    if (!rf.name.trim()) { toast.error("يرجى إدخال الاسم"); return; }
    if (!rf.email.trim()) { toast.error("يرجى إدخال البريد الإلكتروني للمندوب"); return; }
    if (!rf.email.includes("@")) { toast.error("صيغة البريد غير صحيحة"); return; }
    if (rf.phone.trim() && !validateYemeniPhone(rf.phone)) { toast.error("رقم الهاتف غير صحيح أو ناقص"); return; }
    if (!user?.id) return;

    setCreating(true);
    const password = generatePassword();

    try {
      // 1. Add rep to sales_reps table
      await addRep(rf, user.id);

      // 2. Save role mapping
      await supabase.from("user_roles").upsert({
        user_id: user.id,
        assigned_user_email: rf.email,
        role: "rep",
        permissions: JSON.stringify({ canAddCustomer: true, canViewOrders: false, canViewFinance: false }),
        is_active: true,
      }, { onConflict: "user_id,assigned_user_email" });

      // 3. Create user account via edge function (bypasses disabled signups)
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
        body: { email: rf.email, password, role: "rep", fullName: rf.name },
      });

      if (inviteError) {
        let errorMsg = inviteError.message;
        if (inviteError instanceof FunctionsHttpError) {
          try {
            const text = await inviteError.context?.text();
            errorMsg = text || errorMsg;
          } catch { /* ignore */ }
        }
        toast.error("فشل إنشاء حساب الدخول: " + errorMsg);
      } else if (!inviteData?.success) {
        toast.error("فشل إنشاء الحساب: " + (inviteData?.error || "خطأ"));
      } else {
        // Show credentials
        setCredentials({ email: rf.email, password, name: rf.name });
        toast.success("تم إضافة المندوب وإنشاء حساب الدخول — اعرض البيانات للمندوب");
      }

      setRf({ name: "", phone: "", email: "", city: "", commissionRate: 10, notes: "", isActive: true });
      setShowAddRep(false);
      setEditingRep(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير معروف";
      toast.error("فشل العملية: " + msg);
    }
    setCreating(false);
  };

  const handleUpdateRep = async () => {
    if (!editingRep) return;
    if (!rf.name.trim()) { toast.error("يرجى إدخال الاسم"); return; }
    if (rf.phone.trim() && !validateYemeniPhone(rf.phone)) { toast.error("رقم الهاتف غير صحيح أو ناقص"); return; }

    await updateRep(editingRep, {
      name: rf.name,
      isActive: rf.isActive,
      commissionRate: rf.commissionRate,
    });

    await supabase.from("sales_reps").update({
      phone: rf.phone, city: rf.city, notes: rf.notes,
    }).eq("id", editingRep);

    toast.success("تم تعديل بيانات المندوب");
    setRf({ name: "", phone: "", email: "", city: "", commissionRate: 10, notes: "", isActive: true });
    setShowAddRep(false);
    setEditingRep(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirming(true);

    if (confirmAction.type === "delete") {
      await deleteRep(confirmAction.rep.id);
      if (confirmAction.rep.email) {
        await supabase.from("user_roles").delete()
          .eq("assigned_user_email", confirmAction.rep.email);
      }
      toast.success(`تم حذف المندوب "${confirmAction.rep.name}" نهائياً`);
    } else {
      const newActive = !confirmAction.rep.isActive;
      await updateRep(confirmAction.rep.id, { isActive: newActive });
      if (confirmAction.rep.email) {
        await supabase.from("user_roles").update({ is_active: newActive })
          .eq("assigned_user_email", confirmAction.rep.email);
      }
      toast.success(newActive ? `تم تفعيل المندوب "${confirmAction.rep.name}"` : `تم تعطيل المندوب "${confirmAction.rep.name}"`);
    }

    setConfirmAction(null);
    setConfirming(false);
  };

  const getRepStats = (repId: string) => {
    const repCommissions = getRepCommissions(repId);
    const totalEarned = getRepTotalEarned(repId);
    const totalPaid = getRepTotalPaid(repId);
    const pendingCount = repCommissions.filter((c) => !c.isPaid).length;
    const pendingAmount = getRepTotalPending(repId);
    return { repCommissions, totalEarned, totalPaid, pendingCount, pendingAmount };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">المناديب والمسوقات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{reps.length} مندوب/مسوقة</p>
        </div>
        <button onClick={() => setShowAddRep(true)} className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light active:scale-[0.98]">
          <Plus className="size-4" /> مندوب/مسوقة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="إجمالي العمولات" value={formatCurrency(totalCommissions)} icon={DollarSign} delay={0} />
        <StatCard title="عمولات معلقة" value={formatCurrency(totalPending)} icon={AlertTriangle} delay={1} />
        <StatCard title="المناديب النشطين" value={`${reps.filter((r) => r.isActive).length}`} icon={UserCheck} delay={2} />
      </div>

      {/* Generated credentials */}
      {credentials && (
        <div className="rounded-2xl bg-gradient-to-l from-emerald-50 to-white p-5 border-2 border-emerald-300 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="size-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-navy">✅ تم إنشاء حساب المندوب</h3>
              <p className="text-xs text-gray-500">احفظ هذه البيانات وأرسلها للمندوب</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-[10px] text-gray-400">الاسم</p>
              <p className="text-sm font-bold text-navy">{credentials.name}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">البريد</p>
                <p className="text-sm font-bold text-navy truncate" dir="ltr">{credentials.email}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.email)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 shrink-0"><Copy className="size-3.5" /></button>
            </div>
            <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-amber-700 font-semibold">🔑 كلمة المرور</p>
                <p className="text-sm font-bold text-navy font-mono" dir="ltr">{credentials.password}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.password)} className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-100 shrink-0"><Copy className="size-3.5" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => {
              const msg = `مرحباً ${credentials.name} 👋\n\nتم إنشاء حسابك في نظام رداء.\n\n📧 ${credentials.email}\n🔑 ${credentials.password}\n\nسجل دخولك من تطبيق رداء.`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
            }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
              واتساب للمندوب
            </button>
            <button onClick={() => {
              const subject = encodeURIComponent("بيانات الدخول - نظام رداء");
              const body = encodeURIComponent(`مرحباً ${credentials.name}،\n\nتم إنشاء حسابك في نظام رداء.\n\nالبريد: ${credentials.email}\nكلمة المرور: ${credentials.password}\n\nيمكنك الدخول مباشرة باستخدام البيانات أعلاه.\n\nرداء 🌸`);
              window.open(`mailto:${credentials.email}?subject=${subject}&body=${body}`, "_blank");
            }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
              إيميل للمندوب
            </button>
            <button onClick={() => setCredentials(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 ms-auto">
              إغلاق
            </button>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none" placeholder="بحث بالاسم أو الهاتف أو البريد..." />
      </div>

      <div className="space-y-3">
        {filtered.map((rep, idx) => {
          const isExpanded = expandedId === rep.id;
          const { repCommissions, totalEarned, totalPaid, pendingAmount } = getRepStats(rep.id);
          return (
            <div key={rep.id} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-cream/30 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-5" onClick={() => setExpandedId(isExpanded ? null : rep.id)}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex size-10 items-center justify-center rounded-full text-xs font-bold text-white ${rep.isActive ? "bg-gradient-to-bl from-emerald-500 to-emerald-600" : "bg-gray-400"}`}>{rep.name.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-navy">{rep.name}</h3>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${rep.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{rep.isActive ? "نشط" : "معطل"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 sm:text-xs">
                      <span>{rep.city}</span>
                      <span>·</span>
                      <span>عمولة {rep.commissionRate}%</span>
                      {rep.email && <span className="flex items-center gap-0.5"><Mail className="size-3" /> {rep.email}</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Calendar className="size-3" /> انضم: {formatDate(rep.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:gap-4">
                  <div className="grid grid-cols-3 gap-3 text-center sm:gap-4">
                    <div><p className="text-[10px] text-gray-400">الإجمالي</p><p className="text-xs font-bold text-navy tabular-nums">{formatCurrency(totalEarned)}</p></div>
                    <div><p className="text-[10px] text-gray-400">المدفوع</p><p className="text-xs font-bold text-green-600 tabular-nums">{formatCurrency(totalPaid)}</p></div>
                    <div><p className="text-[10px] text-gray-400">المتبقي</p><p className={`text-sm font-bold tabular-nums ${pendingAmount > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(pendingAmount)}</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/rep-activity/${rep.id}`} onClick={(e) => e.stopPropagation()}
                      className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50" aria-label="نشاط" title="سجل النشاط">
                      <Activity className="size-4" />
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); setEditingRep(rep.id); setRf({ name: rep.name, phone: rep.phone || "", email: rep.email || "", city: rep.city || "", commissionRate: rep.commissionRate, notes: rep.notes || "", isActive: rep.isActive }); setShowAddRep(true); }}
                      className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-50" aria-label="تعديل" title="تعديل">
                      <Edit2 className="size-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "toggle", rep }); }}
                      className={`rounded-lg p-1.5 ${rep.isActive ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}
                      aria-label={rep.isActive ? "تعطيل" : "تفعيل"} title={rep.isActive ? "تعطيل" : "تفعيل"}>
                      <Power className="size-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "delete", rep }); }}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" aria-label="حذف" title="حذف">
                      <Trash2 className="size-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="size-5 text-gray-400 hidden sm:block" /> : <ChevronDown className="size-5 text-gray-400 hidden sm:block" />}
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t bg-cream/20 p-4 space-y-3 sm:p-5">
                  <h4 className="text-sm font-bold text-navy">سجل العمولات ({repCommissions.length})</h4>
                  {repCommissions.map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 border border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${c.isPaid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{c.isPaid ? "مدفوعة" : "معلقة"}</span>
                        <div>
                          <p className="text-sm font-semibold text-navy" dir="ltr">{c.orderNumber}</p>
                          <p className="text-xs text-gray-400">طلب: {formatCurrency(c.orderTotal)} · عمولة: {formatCurrency(c.commissionAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy tabular-nums">{formatCurrency(c.netCommission)}</span>
                        {!c.isPaid && (
                          <button onClick={(e) => { e.stopPropagation(); markCommissionPaid(c.id); toast.success("تم تسديد العمولة"); }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                            <CheckCircle className="size-3" /> سداد
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {repCommissions.length === 0 && <p className="text-center text-xs text-gray-400 py-4">لا توجد عمولات لهذا المندوب</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (() => {
        const { repCommissions, totalEarned, pendingAmount, pendingCount } = getRepStats(confirmAction.rep.id);
        const isDelete = confirmAction.type === "delete";
        const isActiveToggle = !isDelete && confirmAction.rep.isActive;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className={`px-6 py-5 ${isDelete ? "bg-red-50 border-b border-red-100" : isActiveToggle ? "bg-amber-50 border-b border-amber-100" : "bg-emerald-50 border-b border-emerald-100"}`}>
                <div className="flex items-start gap-4">
                  <div className={`rounded-full p-3 ${isDelete ? "bg-red-100" : isActiveToggle ? "bg-amber-100" : "bg-emerald-100"}`}>
                    {isDelete ? <AlertTriangle className="size-6 text-red-600" /> :
                      isActiveToggle ? <Power className="size-6 text-amber-600" /> :
                      <CheckCircle className="size-6 text-emerald-600" />}
                  </div>
                  <div className="flex-1">
                    <h2 className={`text-base font-bold ${isDelete ? "text-red-900" : isActiveToggle ? "text-amber-900" : "text-emerald-900"}`}>
                      {isDelete ? "تأكيد حذف المندوب" : isActiveToggle ? "تأكيد تعطيل المندوب" : "تأكيد تفعيل المندوب"}
                    </h2>
                    <p className={`text-xs mt-1 ${isDelete ? "text-red-700" : isActiveToggle ? "text-amber-700" : "text-emerald-700"}`}>
                      {isDelete ? "هذا الإجراء لا يمكن التراجع عنه" : isActiveToggle ? "سيتم منع المندوب من تسجيل الدخول" : "سيتمكن المندوب من تسجيل الدخول مجدداً"}
                    </p>
                  </div>
                  <button onClick={() => setConfirmAction(null)}
                    className="rounded-lg p-1.5 hover:bg-white/50">
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 rounded-xl bg-cream/60 p-4">
                  <div className={`flex size-12 items-center justify-center rounded-full text-sm font-bold text-white ${confirmAction.rep.isActive ? "bg-gradient-to-bl from-emerald-500 to-emerald-600" : "bg-gray-400"}`}>
                    {confirmAction.rep.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">{confirmAction.rep.name}</p>
                    {confirmAction.rep.email && <p className="text-xs text-gray-500" dir="ltr">{confirmAction.rep.email}</p>}
                    {confirmAction.rep.phone && <p className="text-xs text-gray-500" dir="ltr">{confirmAction.rep.phone}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700">البيانات المرتبطة:</p>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <span className="text-xs text-gray-600">عدد العمولات المسجلة</span>
                    <span className={`text-sm font-bold tabular-nums ${repCommissions.length > 0 ? "text-navy" : "text-gray-400"}`}>
                      {repCommissions.length} عمولة
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <span className="text-xs text-gray-600">إجمالي الأرباح</span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">
                      {formatCurrency(totalEarned)}
                    </span>
                  </div>
                  {pendingCount > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <span className="text-xs text-amber-700 font-semibold">⚠️ عمولات معلقة</span>
                      <div className="text-left">
                        <span className="text-sm font-bold text-amber-700 tabular-nums">{formatCurrency(pendingAmount)}</span>
                        <p className="text-[10px] text-amber-600">{pendingCount} غير مدفوعة</p>
                      </div>
                    </div>
                  )}
                </div>

                {isDelete && (
                  <div className="rounded-xl bg-red-50 border-2 border-red-200 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="size-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-red-800">
                        <p className="font-bold mb-1">⚠️ سيتم حذف نهائياً:</p>
                        <ul className="space-y-0.5 list-disc list-inside text-red-700">
                          <li>بيانات المندوب الشخصية</li>
                          {repCommissions.length > 0 && <li>{repCommissions.length} سجل عمولة</li>}
                          {confirmAction.rep.email && <li>صلاحيات تسجيل الدخول</li>}
                        </ul>
                        {pendingCount > 0 && (
                          <p className="mt-2 font-bold text-red-900">⛔ يوجد عمولات معلقة بقيمة {formatCurrency(pendingAmount)} — يُنصح بسدادها أولاً</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isActiveToggle && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs text-amber-800">
                      💡 سيتم الاحتفاظ بكل البيانات، يمكن إعادة تفعيله لاحقاً. لن يستطيع المندوب الدخول للنظام.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t bg-gray-50 px-6 py-4">
                <button onClick={() => setConfirmAction(null)} disabled={confirming}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  إلغاء
                </button>
                <button onClick={handleConfirmAction} disabled={confirming}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 ${
                    isDelete ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" :
                    isActiveToggle ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30" :
                    "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                  }`}>
                  {confirming ? <Loader2 className="size-4 animate-spin" /> : isDelete ? <Trash2 className="size-4" /> : <Power className="size-4" />}
                  {confirming ? "جاري التنفيذ..." : isDelete ? "حذف نهائياً" : isActiveToggle ? "تعطيل المندوب" : "تفعيل المندوب"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Rep Dialog */}
      {showAddRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold text-navy">{editingRep ? "تعديل المندوب" : "إضافة مندوب/مسوقة"}</h2>
              <button onClick={() => { setShowAddRep(false); setEditingRep(null); setRf({ name: "", phone: "", email: "", city: "", commissionRate: 10, notes: "", isActive: true }); }} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4 p-6">
              {!editingRep && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs text-emerald-700">🔐 سيتم إنشاء حساب الدخول تلقائياً وعرض كلمة المرور لك لإرسالها للمندوب</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">الاسم الكامل *</label>
                  <input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="الاسم الكامل" /></div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">البريد الإلكتروني *</label>
                  <input type="email" value={rf.email} onChange={(e) => setRf({ ...rf, email: e.target.value })} dir="ltr" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="rep@example.com" disabled={!!editingRep} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">الهاتف</label>
                  <div className="relative">
                    <input value={rf.phone} onChange={(e) => setRf({ ...rf, phone: e.target.value })} dir="ltr"
                      className={`w-full rounded-xl border px-4 py-2.5 pe-9 text-sm focus:outline-none focus:ring-2 ${
                        phoneError ? "border-red-300 focus:border-red-400 focus:ring-red-100" :
                        phoneValid ? "border-green-300 focus:border-green-400 focus:ring-green-100" :
                        "border-gray-200 focus:border-gold focus:ring-gold/20"
                      }`} placeholder="+967 7xx" />
                    {rf.phone.trim() && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2">
                        {phoneValid ? <CheckCircle2 className="size-4 text-green-500" /> : <AlertCircle className="size-4 text-red-500" />}
                      </span>
                    )}
                  </div>
                  {phoneError && <p className="mt-1 text-[10px] text-red-500">{phoneError}</p>}
                </div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">المحافظة</label>
                  <select value={rf.city} onChange={(e) => setRf({ ...rf, city: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                    <option value="">اختر</option>
                    {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">نسبة العمولة %</label>
                  <input type="number" min="0" max="100" value={rf.commissionRate} onChange={(e) => setRf({ ...rf, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rf.isActive} onChange={(e) => setRf({ ...rf, isActive: e.target.checked })} className="size-4 rounded accent-emerald-600" />
                    <span className="text-sm font-semibold text-gray-700">نشط</span>
                  </label>
                </div>
              </div>
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">ملاحظات</label>
                <textarea value={rf.notes} onChange={(e) => setRf({ ...rf, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
              <button onClick={editingRep ? handleUpdateRep : handleAddRep} disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98] disabled:opacity-60">
                {creating ? <Loader2 className="size-4 animate-spin" /> : editingRep ? <Edit2 className="size-4" /> : <Key className="size-4" />}
                {creating ? "جاري الإنشاء..." : editingRep ? "حفظ التعديلات" : "إنشاء وتوليد كلمة مرور"}
              </button>
              <button onClick={() => { setShowAddRep(false); setEditingRep(null); setRf({ name: "", phone: "", email: "", city: "", commissionRate: 10, notes: "", isActive: true }); }} disabled={creating} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
