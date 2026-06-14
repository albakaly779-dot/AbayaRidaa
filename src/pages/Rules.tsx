import { useState, useEffect } from "react";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, AlertOctagon, MapPin,
  DollarSign, Shield, Edit3, Save, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRulesStore, type DiscountRule } from "@/stores/rulesStore";
import { useAuditStore } from "@/stores/auditStore";
import { GOVERNORATES } from "@/constants/config";
import { formatCurrency } from "@/lib/formatters";

const RULE_TYPES = [
  { value: "governorate_discount", label: "خصم حسب المحافظة", icon: MapPin, desc: "خصم شحن للعملاء من محافظة معينة" },
  { value: "amount_discount", label: "خصم حسب المبلغ", icon: DollarSign, desc: "خصم تلقائي عندما يتجاوز الطلب مبلغ محدد" },
];

export default function Rules() {
  const { user } = useAuth();
  const { rules, initializeRules, addRule, toggleRule, deleteRule, killAllRules, updateRule } = useRulesStore();
  const { logAction } = useAuditStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", type: "governorate_discount" as DiscountRule["type"],
    conditionField: "governorate", conditionValue: "",
    discountType: "fixed" as "fixed" | "percentage",
    discountValue: 0, priority: 0,
  });

  useEffect(() => { if (user?.id) initializeRules(user.id); }, [user?.id]);

  const resetForm = () => {
    setForm({ name: "", type: "governorate_discount", conditionField: "governorate", conditionValue: "", discountType: "fixed", discountValue: 0, priority: 0 });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!form.name.trim()) { toast.error("اسم القاعدة مطلوب"); return; }
    if (!form.conditionValue.trim()) { toast.error("حدد شرط القاعدة"); return; }
    if (form.discountValue <= 0) { toast.error("قيمة الخصم يجب أن تكون أكبر من 0"); return; }

    if (editingId) {
      await updateRule(editingId, {
        name: form.name, conditionValue: form.conditionValue,
        discountType: form.discountType, discountValue: form.discountValue, priority: form.priority,
      });
      logAction(user.id, "update", "rule", editingId, `تعديل قاعدة: ${form.name}`);
    } else {
      await addRule({
        name: form.name, type: form.type,
        conditionField: form.type === "governorate_discount" ? "governorate" : "total",
        conditionValue: form.conditionValue, discountType: form.discountType,
        discountValue: form.discountValue, isActive: true, priority: form.priority,
      }, user.id);
      logAction(user.id, "create", "rule", undefined, `إنشاء قاعدة: ${form.name}`);
    }
    resetForm();
  };

  const startEdit = (rule: DiscountRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name, type: rule.type,
      conditionField: rule.conditionField, conditionValue: rule.conditionValue,
      discountType: rule.discountType, discountValue: rule.discountValue, priority: rule.priority,
    });
    setShowForm(true);
  };

  const handleKillAll = () => {
    if (window.confirm("هل تريد تعطيل جميع القواعد فوراً؟ (إيقاف طارئ)")) {
      killAllRules();
      if (user?.id) logAction(user.id, "update", "rule", undefined, "إيقاف طارئ: تعطيل جميع القواعد");
    }
  };

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy lg:text-2xl">محرك القواعد الذكي</h1>
          <p className="text-sm text-gray-500">{rules.length} قاعدة · {activeCount} نشطة</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeCount > 0 && (
            <button onClick={handleKillAll}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-[0.98]">
              <AlertOctagon className="size-4" /> إيقاف طارئ
            </button>
          )}
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all active:scale-[0.98]">
            <Plus className="size-4" /> قاعدة جديدة
          </button>
        </div>
      </div>

      {/* Kill switch info */}
      <div className="rounded-2xl bg-gradient-to-l from-red-50 to-white p-4 border border-red-200">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-100 p-2.5"><AlertOctagon className="size-5 text-red-600" /></div>
          <div>
            <p className="text-sm font-bold text-red-800">زر الإيقاف الطارئ</p>
            <p className="text-xs text-red-600">يعطل جميع القواعد النشطة فوراً — مفيد إذا بدأت القواعد تعمل بشكل خاطئ</p>
          </div>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">{editingId ? "تعديل القاعدة" : "إنشاء قاعدة جديدة"}</h3>
            <button onClick={resetForm} className="rounded-lg p-2 hover:bg-gray-100"><X className="size-4 text-gray-400" /></button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">اسم القاعدة</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                placeholder="مثال: خصم شحن صنعاء" />
            </div>
            {!editingId && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">نوع القاعدة</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DiscountRule["type"] })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                {form.type === "governorate_discount" ? "المحافظات (اختر واحدة أو أكثر مفصولة بفاصلة)" : "الحد الأدنى للمبلغ (ر.ي)"}
              </label>
              {form.type === "governorate_discount" ? (
                <div>
                  <input value={form.conditionValue} onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="صنعاء, عدن, تعز" />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {GOVERNORATES.slice(0, 8).map((g) => (
                      <button key={g} type="button" onClick={() => {
                        const current = form.conditionValue.split(",").map((v) => v.trim()).filter(Boolean);
                        if (current.includes(g)) setForm({ ...form, conditionValue: current.filter((v) => v !== g).join(", ") });
                        else setForm({ ...form, conditionValue: [...current, g].join(", ") });
                      }}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                          form.conditionValue.includes(g) ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>{g}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <input type="number" value={form.conditionValue} onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  placeholder="50000" dir="ltr" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">نوع الخصم</label>
                <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "fixed" | "percentage" })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gold focus:outline-none">
                  <option value="fixed">مبلغ ثابت (ر.ي)</option>
                  <option value="percentage">نسبة مئوية (%)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">القيمة</label>
                <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  dir="ltr" placeholder={form.discountType === "fixed" ? "1000" : "5"} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={resetForm} className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all active:scale-[0.98]">
              <Save className="size-4" /> {editingId ? "تحديث" : "إنشاء"} القاعدة
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="rounded-full bg-gold/10 p-6"><Zap className="size-10 text-gold" /></div>
            <h3 className="text-lg font-bold text-navy">لا توجد قواعد بعد</h3>
            <p className="text-sm text-gray-400">أنشئ أول قاعدة لتفعيل الخصومات التلقائية</p>
          </div>
        ) : (
          rules.map((rule, idx) => {
            const TypeIcon = rule.type === "governorate_discount" ? MapPin : DollarSign;
            return (
              <div key={rule.id}
                className={`rounded-2xl bg-white p-5 border shadow-sm transition-all animate-fade-in opacity-0 ${rule.isActive ? "border-emerald-200" : "border-gray-200 opacity-60"}`}
                style={{ animationDelay: `${idx * 60}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${rule.isActive ? "bg-emerald-50" : "bg-gray-100"}`}>
                      <TypeIcon className={`size-5 ${rule.isActive ? "text-emerald-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy">{rule.name}</h3>
                      <p className="text-[10px] text-gray-400">
                        {rule.type === "governorate_discount" ? "خصم حسب المحافظة" : "خصم حسب المبلغ"}
                        {" · "}أولوية: {rule.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => startEdit(rule)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50"><Edit3 className="size-4" /></button>
                    <button onClick={() => toggleRule(rule.id)} className="rounded-lg p-2 hover:bg-gray-100">
                      {rule.isActive ? <ToggleRight className="size-6 text-emerald-500" /> : <ToggleLeft className="size-6 text-gray-300" />}
                    </button>
                    <button onClick={() => { if (confirm("حذف هذه القاعدة؟")) deleteRule(rule.id); }}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg bg-cream/80 px-3 py-1 text-xs text-gray-600">
                    الشرط: <span className="font-semibold text-navy">
                      {rule.type === "governorate_discount" ? `محافظة: ${rule.conditionValue}` : `الطلب ≥ ${formatCurrency(parseFloat(rule.conditionValue))}`}
                    </span>
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    الخصم: {rule.discountType === "fixed" ? formatCurrency(rule.discountValue) : `${rule.discountValue}%`}
                  </span>
                  <span className={`rounded-lg px-3 py-1 text-xs font-semibold ${rule.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {rule.isActive ? "نشطة" : "معطلة"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
