import { useState, useMemo } from "react";
import { X, Loader2, Calculator, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";

interface DBProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  sell_price: number;
  total_cost: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  products: DBProduct[];
  categories: string[];
  onSaved: () => void;
}

type Operation = "increase" | "decrease" | "set";
type ModeType = "percentage" | "fixed";
type Field = "sell_price" | "total_cost" | "both";

export default function BulkEditDialog({ open, onClose, products, categories, onSaved }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState<Operation>("increase");
  const [mode, setMode] = useState<ModeType>("percentage");
  const [value, setValue] = useState(10);
  const [field, setField] = useState<Field>("sell_price");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      const q = search.toLowerCase().trim();
      if (q && !p.code.toLowerCase().includes(q) && !p.name.includes(search)) return false;
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      return true;
    });
  }, [products, search, filterCategory]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const calcNew = (current: number): number => {
    let result = current;
    if (mode === "percentage") {
      const pct = value / 100;
      if (operation === "increase") result = current * (1 + pct);
      else if (operation === "decrease") result = current * (1 - pct);
      else result = current;
    } else {
      if (operation === "increase") result = current + value;
      else if (operation === "decrease") result = current - value;
      else result = value;
    }
    return Math.max(0, Math.round(result));
  };

  const previewItems = useMemo(() => {
    return filtered.filter((p) => selectedIds.has(p.id)).slice(0, 5);
  }, [filtered, selectedIds]);

  const handleApply = async () => {
    if (selectedIds.size === 0) { toast.error("اختر منتج واحد على الأقل"); return; }
    if (value <= 0) { toast.error("القيمة يجب أن تكون أكبر من صفر"); return; }

    setSaving(true);
    const updates = filtered.filter((p) => selectedIds.has(p.id)).map((p) => {
      const payload: { id: string; sell_price?: number; total_cost?: number } = { id: p.id };
      if (field === "sell_price" || field === "both") payload.sell_price = calcNew(p.sell_price);
      if (field === "total_cost" || field === "both") payload.total_cost = calcNew(p.total_cost);
      return payload;
    });

    let success = 0;
    let failed = 0;
    for (const u of updates) {
      const { id, ...changes } = u;
      const { error } = await supabase.from("products").update(changes).eq("id", id);
      if (error) failed++; else success++;
    }

    if (success > 0) toast.success(`تم تحديث ${success} منتج بنجاح`);
    if (failed > 0) toast.error(`فشل ${failed} منتج`);
    onSaved();
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-cream/30">
          <div className="flex items-center gap-3">
            <Calculator className="size-5 text-navy" />
            <div>
              <h2 className="text-lg font-bold text-navy">تعديل جماعي للمنتجات</h2>
              <p className="text-xs text-gray-500">اختر منتجات وطبّق نسبة زيادة أو نقصان موحدة</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="size-5" /></button>
        </div>

        {/* Operation Settings */}
        <div className="border-b p-4 space-y-3 bg-blue-50/30">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">العملية</label>
              <select value={operation} onChange={(e) => setOperation(e.target.value as Operation)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gold focus:outline-none">
                <option value="increase">زيادة +</option>
                <option value="decrease">نقصان −</option>
                <option value="set">تعيين قيمة</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">النوع</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as ModeType)}
                disabled={operation === "set"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gold focus:outline-none disabled:bg-gray-100">
                <option value="percentage">نسبة %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">القيمة</label>
              <input type="number" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gold focus:outline-none"
                min="0" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">الحقل</label>
              <select value={field} onChange={(e) => setField(e.target.value as Field)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gold focus:outline-none">
                <option value="sell_price">سعر البيع</option>
                <option value="total_cost">التكلفة</option>
                <option value="both">كلاهما</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {previewItems.length > 0 && (
            <div className="rounded-lg bg-white p-3 border">
              <p className="text-[10px] text-gray-400 mb-2">معاينة على أول {previewItems.length} منتجات:</p>
              <div className="space-y-1">
                {previewItems.map((p) => {
                  const oldPrice = field === "total_cost" ? p.total_cost : p.sell_price;
                  const newPrice = calcNew(oldPrice);
                  return (
                    <div key={p.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600 truncate">{p.code} — {p.name.slice(0, 30)}</span>
                      <span className="tabular-nums">
                        <span className="text-gray-400 line-through">{formatCurrency(oldPrice)}</span>
                        <span className="mx-1">→</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(newPrice)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gold focus:outline-none"
            placeholder="بحث..." />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gold focus:outline-none">
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={toggleAll}
            className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white hover:bg-navy-light">
            {selectedIds.size === filtered.length && filtered.length > 0 ? "إلغاء الكل" : `تحديد الكل (${filtered.length})`}
          </button>
        </div>

        {/* Products list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.map((p) => {
            const isSelected = selectedIds.has(p.id);
            return (
              <button key={p.id} onClick={() => toggleOne(p.id)}
                className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-right transition-colors ${
                  isSelected ? "bg-emerald-50 border border-emerald-200" : "bg-cream/30 hover:bg-cream/50"
                }`}>
                <div className={`flex size-5 items-center justify-center rounded border-2 ${
                  isSelected ? "bg-emerald-500 border-emerald-500" : "border-gray-300 bg-white"
                }`}>
                  {isSelected && <Check className="size-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-navy truncate">{p.code} — {p.name}</p>
                  <p className="text-[10px] text-gray-500">{p.category} · بيع: {formatCurrency(p.sell_price)} · تكلفة: {formatCurrency(p.total_cost)}</p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لا توجد منتجات مطابقة</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-gray-50 px-6 py-4">
          <span className="text-xs font-semibold text-gray-600">{selectedIds.size} منتج محدد</span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              إلغاء
            </button>
            <button onClick={handleApply} disabled={saving || selectedIds.size === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "جاري التطبيق..." : `تطبيق على ${selectedIds.size} منتج`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
