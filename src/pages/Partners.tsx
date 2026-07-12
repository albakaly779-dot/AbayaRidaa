import { useEffect, useState } from "react";
import { Users, Percent, ToggleLeft, ToggleRight, Save, Loader2, Info, Sparkles, Briefcase, Wrench, Mail, DollarSign, PieChart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePartnersStore, type Partner } from "@/stores/partnersStore";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useRepStore } from "@/stores/repStore";
import { useAuditStore } from "@/stores/auditStore";
import { formatCurrency } from "@/lib/formatters";
import { logActivity } from "@/hooks/useActivityLogger";

const KEY_META: Record<Partner["partnerKey"], { icon: typeof Briefcase; color: string; bg: string; label: string }> = {
  first: { icon: Briefcase, color: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "الطرف الأول" },
  second: { icon: Sparkles, color: "text-purple-700", bg: "bg-purple-50 border-purple-200", label: "الطرف الثاني" },
  worker: { icon: Wrench, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "الطرف الثالث (العامل)" },
};

export default function Partners() {
  const { user } = useAuth();
  const { partners, loading, initializePartners, updatePartner, toggleActive, distributeProfit } = usePartnersStore();
  const { getTotalSales, initializeData } = useDataStore();
  const { getTotalExpenses, initializeData: initExp } = useExpenseStore();
  const { getTotalPendingCommissions, initializeData: initReps } = useRepStore();
  const { logAction } = useAuditStore();
  const [edits, setEdits] = useState<Record<string, Partial<Partner>>>({});
  const [saving, setSaving] = useState<string | null>(null);

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
  const totalActivePercent = partners.filter((p) => p.isActive).reduce((s, p) => s + (edits[p.id]?.percentage ?? p.percentage), 0);

  const handleFieldChange = (id: string, field: keyof Partner, value: unknown) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSave = async (partner: Partner) => {
    const edit = edits[partner.id];
    if (!edit) { toast.info("لا توجد تغييرات"); return; }
    setSaving(partner.id);
    await updatePartner(partner.id, edit);
    setEdits((prev) => { const cp = { ...prev }; delete cp[partner.id]; return cp; });
    if (user?.id) {
      logAction(user.id, "update", "partner", partner.id, `تحديث ${KEY_META[partner.partnerKey].label}: ${JSON.stringify(edit)}`);
      logActivity(user.email, user.id, "action", `تحديث نسب ${KEY_META[partner.partnerKey].label}`, { entityType: "partner", entityId: partner.id, details: JSON.stringify(edit) });
    }
    toast.success("تم الحفظ");
    setSaving(null);
  };

  const handleToggle = async (partner: Partner) => {
    await toggleActive(partner.id);
    if (user?.id) {
      logAction(user.id, "status_change", "partner", partner.id, `${!partner.isActive ? "تفعيل" : "تعطيل"} ${KEY_META[partner.partnerKey].label}`);
    }
    toast.success(!partner.isActive ? "تم تفعيل النسبة" : "تم إيقاف النسبة");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <Users className="size-5 text-gold" /> نظام احتساب الشركاء
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">إدارة نسب الأرباح وتوزيعها تلقائياً بعد خصم المصروفات</p>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-1">📊 آلية التوزيع الآلي:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>يتم حساب صافي الربح = إجمالي الإيرادات − جميع المصروفات (مصاريف + عمولات)</li>
              <li>ثم يوزّع صافي الربح على الشركاء المفعّلين حسب النسب المحددة</li>
              <li>خانة العامل (الطرف الثالث) يمكن تشغيلها/إيقافها بضغطة زر</li>
              <li>مجموع النسب المفعّلة يفضّل أن يكون 100% لتوزيع كامل</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-500/20">
          <DollarSign className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجمالي الإيرادات</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-red-500 to-red-600 p-4 text-white shadow-lg shadow-red-500/20">
          <AlertCircle className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجمالي المصروفات</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={`rounded-2xl p-4 text-white shadow-lg ${result.netProfit >= 0 ? "bg-gradient-to-bl from-navy to-navy-light shadow-navy/20" : "bg-gradient-to-bl from-red-700 to-red-800"}`}>
          <PieChart className="size-5 mb-2" />
          <p className="text-xs text-white/80">صافي الربح للتوزيع</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(result.netProfit)}</p>
        </div>
      </div>

      {/* Percentage warning */}
      {totalActivePercent !== 100 && (
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${
          totalActivePercent > 100 ? "bg-red-50 border-2 border-red-300 text-red-800"
          : totalActivePercent === 0 ? "bg-gray-50 border-2 border-gray-300 text-gray-600"
          : "bg-amber-50 border-2 border-amber-300 text-amber-800"
        }`}>
          <AlertCircle className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">
              مجموع النسب المفعّلة: {totalActivePercent}%
              {totalActivePercent > 100 ? " — تجاوز الحد!" : totalActivePercent < 100 ? ` — سيتبقّى ${100 - totalActivePercent}% غير موزّع` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Partner cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {partners.map((partner) => {
          const meta = KEY_META[partner.partnerKey];
          const Icon = meta.icon;
          const isEditing = !!edits[partner.id];
          const currentPercent = edits[partner.id]?.percentage ?? partner.percentage;
          const currentName = edits[partner.id]?.partnerName ?? partner.partnerName;
          const currentEmail = edits[partner.id]?.partnerEmail ?? partner.partnerEmail;
          const currentNotes = edits[partner.id]?.notes ?? partner.notes;
          const distribution = result.distributions.find((d) => d.partner.id === partner.id);

          return (
            <div key={partner.id} className={`rounded-2xl border-2 p-5 ${meta.bg} ${!partner.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl bg-white p-2.5 ${meta.color}`}><Icon className="size-5" /></div>
                  <div>
                    <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                    <p className="text-[10px] text-gray-500">{partner.isActive ? "مفعّل — يدخل في التوزيع" : "معطّل — لا يدخل في التوزيع"}</p>
                  </div>
                </div>
                <button onClick={() => handleToggle(partner)} className={`transition-colors ${partner.isActive ? "text-emerald-600" : "text-gray-400"}`}
                  title={partner.isActive ? "إيقاف" : "تفعيل"}>
                  {partner.isActive ? <ToggleRight className="size-8" /> : <ToggleLeft className="size-8" />}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-1 block">الاسم</label>
                  <input value={currentName} onChange={(e) => handleFieldChange(partner.id, "partnerName", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-gold focus:outline-none"
                    placeholder="اسم الشريك" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-1 block flex items-center gap-1"><Mail className="size-3" /> البريد (اختياري)</label>
                  <input type="email" value={currentEmail} onChange={(e) => handleFieldChange(partner.id, "partnerEmail", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-gold focus:outline-none"
                    placeholder="email@example.com" dir="ltr" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-1 block flex items-center gap-1"><Percent className="size-3" /> نسبة التوزيع</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.5" value={currentPercent}
                      onChange={(e) => handleFieldChange(partner.id, "percentage", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 pe-9 text-lg font-bold tabular-nums focus:border-gold focus:outline-none"
                      placeholder="0" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-1 block">ملاحظات</label>
                  <textarea value={currentNotes} onChange={(e) => handleFieldChange(partner.id, "notes", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-gold focus:outline-none resize-none"
                    rows={2} placeholder="ملاحظات اختيارية" />
                </div>

                {distribution && (
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <p className="text-[10px] text-gray-500 mb-1">نصيبه من الأرباح الحالية:</p>
                    <p className="text-base font-bold text-emerald-600 tabular-nums">
                      {distribution.amount > 0 ? formatCurrency(distribution.amount) : "—"}
                    </p>
                  </div>
                )}

                {isEditing && (
                  <button onClick={() => handleSave(partner)} disabled={saving === partner.id}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy text-white py-2.5 text-xs font-bold hover:bg-navy-light shadow-md disabled:opacity-50">
                    {saving === partner.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {saving === partner.id ? "جاري..." : "حفظ التغييرات"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribution table */}
      <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
          <PieChart className="size-4" /> تقرير التوزيع الفعلي
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b text-right bg-cream/50">
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500">الشريك</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500">النسبة</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500">النصيب (ر.ي)</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500">النصيب (ر.س)</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-emerald-50/50">
                <td className="px-3 py-2 text-xs font-bold">إجمالي الإيرادات</td>
                <td className="px-3 py-2 text-xs">—</td>
                <td className="px-3 py-2 text-xs font-bold text-emerald-700 tabular-nums">{formatCurrency(totalRevenue)}</td>
                <td className="px-3 py-2 text-xs text-emerald-600 tabular-nums">{formatCurrency(totalRevenue, "SAR")}</td>
                <td className="px-3 py-2"></td>
              </tr>
              <tr className="bg-red-50/50">
                <td className="px-3 py-2 text-xs font-bold">إجمالي المصروفات</td>
                <td className="px-3 py-2 text-xs">—</td>
                <td className="px-3 py-2 text-xs font-bold text-red-700 tabular-nums">−{formatCurrency(totalExpenses)}</td>
                <td className="px-3 py-2 text-xs text-red-600 tabular-nums">−{formatCurrency(totalExpenses, "SAR")}</td>
                <td className="px-3 py-2"></td>
              </tr>
              <tr className="bg-navy/5 border-y-2 border-navy">
                <td className="px-3 py-2 text-xs font-bold text-navy">💰 صافي الربح</td>
                <td className="px-3 py-2 text-xs">100%</td>
                <td className="px-3 py-2 text-sm font-bold text-navy tabular-nums">{formatCurrency(result.netProfit)}</td>
                <td className="px-3 py-2 text-xs text-navy tabular-nums">{formatCurrency(result.netProfit, "SAR")}</td>
                <td className="px-3 py-2"></td>
              </tr>
              {result.distributions.map((d) => (
                <tr key={d.partner.id}>
                  <td className="px-3 py-2 text-xs font-semibold">{d.partner.partnerName}</td>
                  <td className="px-3 py-2 text-xs">{d.partner.percentage}%</td>
                  <td className="px-3 py-2 text-xs font-bold tabular-nums">{formatCurrency(d.amount)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 tabular-nums">{formatCurrency(d.amount, "SAR")}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${d.partner.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {d.partner.isActive ? "مفعّل" : "معطّل"}
                    </span>
                  </td>
                </tr>
              ))}
              {result.undistributed !== 0 && (
                <tr className="bg-amber-50/50">
                  <td className="px-3 py-2 text-xs font-bold text-amber-700">غير موزّع</td>
                  <td className="px-3 py-2 text-xs">{(100 - totalActivePercent).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-xs font-bold text-amber-700 tabular-nums">{formatCurrency(result.undistributed)}</td>
                  <td className="px-3 py-2 text-xs text-amber-600 tabular-nums">{formatCurrency(result.undistributed, "SAR")}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
