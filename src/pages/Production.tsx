import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardList, Coins, Factory, Loader2, PackageCheck, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";

interface ProductionBatch {
  id: string;
  productName: string;
  productionDate: string;
  shift: string;
  goodQuantity: number;
  defectiveQuantity: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  otherCost: number;
  totalCost: number;
  unitCost: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED" | "REJECTED" | "CANCELLED";
  notes: string;
  createdAt: string;
}

const STATUS_LABELS: Record<ProductionBatch["status"], string> = {
  DRAFT: "مسودة",
  SUBMITTED: "مرسل للمراجعة",
  APPROVED: "معتمد",
  POSTED: "مرحّل للمخزون",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};

const STATUS_STYLES: Record<ProductionBatch["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  POSTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBatch(row: Record<string, unknown>): ProductionBatch {
  const materialCost = numberValue(row.material_cost);
  const laborCost = numberValue(row.labor_cost);
  const overheadCost = numberValue(row.overhead_cost);
  const otherCost = numberValue(row.other_cost);
  const goodQuantity = numberValue(row.good_quantity);
  const totalCost = numberValue(row.total_cost) || materialCost + laborCost + overheadCost + otherCost;
  return {
    id: String(row.id),
    productName: String(row.product_name || ""),
    productionDate: String(row.production_date || ""),
    shift: String(row.shift || "غير محددة"),
    goodQuantity,
    defectiveQuantity: numberValue(row.defective_quantity),
    materialCost,
    laborCost,
    overheadCost,
    otherCost,
    totalCost,
    unitCost: numberValue(row.unit_cost) || (goodQuantity > 0 ? totalCost / goodQuantity : 0),
    status: (row.status as ProductionBatch["status"]) || "DRAFT",
    notes: String(row.notes || ""),
    createdAt: String(row.created_at || ""),
  };
}

export default function Production() {
  const { user, role } = useAuth();
  const { logAction } = useAuditStore();
  const { settings, initializeSettings } = useSettingsStore();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState("صباحية");
  const [productName, setProductName] = useState("");
  const [goodQuantity, setGoodQuantity] = useState(0);
  const [defectiveQuantity, setDefectiveQuantity] = useState(0);
  const [materialCost, setMaterialCost] = useState(0);
  const [laborCost, setLaborCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user?.id) initializeSettings(user.id);
  }, [user?.id, initializeSettings]);

  const loadBatches = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("production_batches")
      .select("*")
      .order("production_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("تعذر تحميل سجل الإنتاج: " + error.message);
      setBatches([]);
    } else {
      setBatches((data || []).map((row) => mapBatch(row as Record<string, unknown>)));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const totalCost = materialCost + laborCost + overheadCost + otherCost;
  const estimatedUnitCost = goodQuantity > 0 ? totalCost / goodQuantity : 0;
  const totalProduced = goodQuantity + defectiveQuantity;

  const summary = useMemo(() => batches.reduce((acc, batch) => ({
    good: acc.good + batch.goodQuantity,
    defective: acc.defective + batch.defectiveQuantity,
    cost: acc.cost + batch.totalCost,
  }), { good: 0, defective: 0, cost: 0 }), [batches]);

  const resetForm = () => {
    setProductName("");
    setGoodQuantity(0);
    setDefectiveQuantity(0);
    setMaterialCost(0);
    setLaborCost(0);
    setOverheadCost(0);
    setOtherCost(0);
    setNotes("");
    setProductionDate(new Date().toISOString().slice(0, 10));
    setShift("صباحية");
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!productName.trim()) { toast.error("اكتب اسم الموديل أو المنتج"); return; }
    if (goodQuantity < 0 || defectiveQuantity < 0 || totalProduced <= 0) {
      toast.error("أدخل كمية إنتاج صحيحة أكبر من صفر");
      return;
    }
    if ([materialCost, laborCost, overheadCost, otherCost].some((value) => value < 0)) {
      toast.error("لا يمكن أن تكون التكاليف سالبة");
      return;
    }

    setSaving(true);
    const nextStatus = role === "admin" ? "APPROVED" : "SUBMITTED";
    const { data, error } = await supabase.from("production_batches").insert({
      created_by: user.id,
      product_name: productName.trim(),
      production_date: productionDate,
      shift,
      good_quantity: goodQuantity,
      defective_quantity: defectiveQuantity,
      material_cost: materialCost,
      labor_cost: laborCost,
      overhead_cost: overheadCost,
      other_cost: otherCost,
      status: nextStatus,
      notes: notes.trim() || null,
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      ...(role === "admin" ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}),
    }).select().single();

    if (error) {
      toast.error("فشل حفظ دفعة الإنتاج: " + error.message);
      setSaving(false);
      return;
    }

    await logAction(user.id, "create", "production_batch", data?.id, `تسجيل إنتاج ${productName.trim()} — ${goodQuantity} سليمة، تكلفة ${formatCurrency(totalCost)}`);
    toast.success(role === "admin" ? "تم تسجيل الإنتاج واعتماده" : "تم إرسال الإنتاج للمراجعة");
    resetForm();
    setShowForm(false);
    await loadBatches();
    setSaving(false);
  };

  const handleRefresh = () => { void loadBatches(); };

  return (
    <div className="space-y-5 lg:space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="size-6 text-gold-dark" />
            <h1 className="text-xl font-bold text-navy lg:text-2xl">الإنتاج اليومي</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">تسجيل عدد العبايات وحساب التكلفة قبل اعتمادها في المخزون</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50" title="تحديث">
            <RefreshCw className="size-4" />
          </button>
          <button onClick={() => setShowForm((value) => !value)} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-navy-light">
            <Plus className="size-4" /> تسجيل دفعة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <PackageCheck className="mb-2 size-5 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700">إنتاج سليم مسجل</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{summary.good.toLocaleString("ar-SA")}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <XCircle className="mb-2 size-5 text-amber-600" />
          <p className="text-xs font-semibold text-amber-700">هالك/تالف مسجل</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-800">{summary.defective.toLocaleString("ar-SA")}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <Coins className="mb-2 size-5 text-blue-600" />
          <p className="text-xs font-semibold text-blue-700">تكلفة الإنتاج المسجل</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-800">{formatCurrency(summary.cost)}</p>
        </div>
      </div>

      {showForm && (
        <section className="rounded-2xl border-2 border-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="size-5 text-navy" />
            <div>
              <h2 className="text-sm font-bold text-navy">إدخال دفعة إنتاج</h2>
              <p className="text-xs text-gray-400">راجع الكمية والتكاليف قبل الإرسال؛ لا يمكن تعديل الدفعة المرحّلة مباشرة.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-gray-700 lg:col-span-2">الموديل أو اسم المنتج
              <input value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="مثال: عباية كتان أسود" />
            </label>
            <label className="text-xs font-semibold text-gray-700">تاريخ الإنتاج
              <span className="relative mt-1 block"><CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pe-9 text-sm" /></span>
            </label>
            <label className="text-xs font-semibold text-gray-700">الوردية
              <select value={shift} onChange={(e) => setShift(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"><option>صباحية</option><option>مسائية</option><option>ليلية</option><option>غير محددة</option></select>
            </label>
            <label className="text-xs font-semibold text-gray-700">الكمية السليمة
              <input type="number" min="0" value={goodQuantity || ""} onChange={(e) => setGoodQuantity(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder="0" />
            </label>
            <label className="text-xs font-semibold text-gray-700">الهالك/التالف
              <input type="number" min="0" value={defectiveQuantity || ""} onChange={(e) => setDefectiveQuantity(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder="0" />
            </label>
            <label className="text-xs font-semibold text-gray-700">تكلفة الخامات
              <input type="number" min="0" value={materialCost || ""} onChange={(e) => setMaterialCost(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder="0" />
            </label>
            <label className="text-xs font-semibold text-gray-700">تكلفة العمالة
              <input type="number" min="0" value={laborCost || ""} onChange={(e) => setLaborCost(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder="0" />
            </label>
            <label className="text-xs font-semibold text-gray-700">التكاليف غير المباشرة
              <input type="number" min="0" value={overheadCost || ""} onChange={(e) => setOverheadCost(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder={`مثال: ${Math.round(settings.fixedExpenses.reduce((sum, item) => sum + item.amount, 0) / 30)}`} />
            </label>
            <label className="text-xs font-semibold text-gray-700">تكاليف أخرى
              <input type="number" min="0" value={otherCost || ""} onChange={(e) => setOtherCost(numberValue(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums" placeholder="0" />
            </label>
            <label className="text-xs font-semibold text-gray-700 sm:col-span-2 lg:col-span-4">ملاحظات أو سبب الهالك
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="اكتب الملاحظات التشغيلية أو سبب التالف..." />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-cream/60 p-4 sm:grid-cols-4">
            <div><p className="text-[11px] text-gray-500">إجمالي الوحدات</p><p className="text-lg font-bold text-navy tabular-nums">{totalProduced}</p></div>
            <div><p className="text-[11px] text-gray-500">إجمالي التكلفة</p><p className="text-lg font-bold text-navy tabular-nums">{formatCurrency(totalCost)}</p></div>
            <div><p className="text-[11px] text-gray-500">تكلفة العباءة السليمة</p><p className="text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(estimatedUnitCost)}</p></div>
            <div><p className="text-[11px] text-gray-500">طريقة الاعتماد</p><p className="text-sm font-bold text-amber-700">{role === "admin" ? "اعتماد المدير العام" : "إرسال للمراجعة"}</p></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {saving ? "جاري الحفظ..." : role === "admin" ? "حفظ واعتماد" : "إرسال للمراجعة"}
            </button>
            <button onClick={() => { resetForm(); setShowForm(false); }} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-bold text-navy">آخر دفعات الإنتاج</h2><p className="text-xs text-gray-400">يظهر هنا مصدر التكلفة وحالة الاعتماد لكل دفعة</p></div>
          <span className="rounded-full bg-cream px-3 py-1 text-[10px] font-bold text-gray-500">{batches.length} دفعة</span>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-navy" /></div> : batches.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center"><Factory className="mx-auto mb-2 size-8 text-gray-300" /><p className="text-sm text-gray-500">لا توجد دفعات إنتاج بعد</p></div>
        ) : (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div key={batch.id} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-6 sm:items-center">
                <div className="sm:col-span-2"><p className="text-sm font-bold text-navy">{batch.productName}</p><p className="text-[11px] text-gray-400">{batch.productionDate} · {batch.shift}</p></div>
                <div><p className="text-[10px] text-gray-400">سليم / تالف</p><p className="text-sm font-bold text-navy tabular-nums">{batch.goodQuantity} / {batch.defectiveQuantity}</p></div>
                <div><p className="text-[10px] text-gray-400">التكلفة</p><p className="text-sm font-bold text-navy tabular-nums">{formatCurrency(batch.totalCost)}</p></div>
                <div><p className="text-[10px] text-gray-400">تكلفة الوحدة</p><p className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(batch.unitCost)}</p></div>
                <div className="sm:text-left"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[batch.status]}`}>{batch.status === "POSTED" || batch.status === "APPROVED" ? <CheckCircle2 className="size-3" /> : <ClipboardList className="size-3" />}{STATUS_LABELS[batch.status]}</span></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
