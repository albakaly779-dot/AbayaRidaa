import { useState, useMemo, useEffect } from "react";
import {
  Search, Package, Filter, ChevronDown, Calculator, AlertTriangle,
  Plus, Minus, Loader2, BarChart3, Edit3, Trash2, Save, X, Bell, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PRODUCT_CATALOG, getCategories } from "@/constants/productCatalog";
import { formatCurrency } from "@/lib/formatters";
import BulkEditDialog from "@/components/features/BulkEditDialog";
import type { StockAlert } from "@/types";

interface DBProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  sell_price: number;
  total_cost: number;
  fabric_meters: number;
  fabric_price_per_meter: number;
  tarha_cost: number;
  extras_cost: number;
  stock_quantity: number;
  min_stock_alert: number;
  color: string | null;
  is_active: boolean;
}

interface EditFormData {
  name: string;
  category: string;
  sell_price: number;
  fabric_meters: number;
  fabric_price_per_meter: number;
  tarha_cost: number;
  extras_cost: number;
  total_cost: number;
  min_stock_alert: number;
  color: string;
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DBProduct | null>(null);
  const [editData, setEditData] = useState<EditFormData>({
    name: "", category: "", sell_price: 0, fabric_meters: 2.25,
    fabric_price_per_meter: 1000, tarha_cost: 300, extras_cost: 200,
    total_cost: 0, min_stock_alert: 2, color: "",
  });
  const [showAlerts, setShowAlerts] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const categories = getCategories();

  const loadProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("code", { ascending: true });
    if (error) {
      console.error("Failed to load products:", error);
      toast.error("فشل تحميل المنتجات: " + error.message);
      setLoading(false);
      return;
    }
    if (data && data.length > 0) {
      setDbProducts(data as DBProduct[]);
    } else {
      const batch = PRODUCT_CATALOG.map((p) => ({
        code: p.code, name: p.name, category: p.category,
        fabric_meters: p.fabricMeters, fabric_price_per_meter: p.fabricPricePerMeter,
        tarha_cost: p.tarhaCost, extras_cost: p.extrasCost, total_cost: p.totalCost,
        sell_price: p.sellPrice, stock_quantity: 0, min_stock_alert: 2, color: p.color || null,
      }));
      for (let i = 0; i < batch.length; i += 50) {
        await supabase.from("products").upsert(batch.slice(i, i + 50), { onConflict: "code" });
      }
      const { data: seeded } = await supabase.from("products").select("*").order("code", { ascending: true });
      setDbProducts((seeded || []) as DBProduct[]);
      toast.success("تم تحميل كتالوج المنتجات");
    }
    setLoading(false);
  };

  useEffect(() => { loadProducts(); }, []);

  // Auto-calculate total cost when fabric/tarha/extras change
  useEffect(() => {
    const newTotal = (editData.fabric_meters * editData.fabric_price_per_meter) + editData.tarha_cost + editData.extras_cost;
    if (Math.abs(newTotal - editData.total_cost) > 0.01) {
      setEditData((prev) => ({ ...prev, total_cost: Math.round(newTotal) }));
    }
  }, [editData.fabric_meters, editData.fabric_price_per_meter, editData.tarha_cost, editData.extras_cost]);

  const updateStock = async (id: string, code: string, delta: number) => {
    const product = dbProducts.find((p) => p.id === id);
    if (!product) return;
    const newStock = Math.max(0, product.stock_quantity + delta);
    const { error } = await supabase.from("products").update({ stock_quantity: newStock }).eq("id", id);
    if (error) { toast.error("فشل تحديث المخزون: " + error.message); return; }
    setDbProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock_quantity: newStock } : p));
    toast.success(`تم تحديث المخزون: ${code} → ${newStock}`);
  };

  const startEdit = (p: DBProduct) => {
    setEditingProduct(p);
    setEditData({
      name: p.name,
      category: p.category,
      sell_price: p.sell_price,
      fabric_meters: p.fabric_meters,
      fabric_price_per_meter: p.fabric_price_per_meter,
      tarha_cost: p.tarha_cost,
      extras_cost: p.extras_cost,
      total_cost: p.total_cost,
      min_stock_alert: p.min_stock_alert,
      color: p.color || "",
    });
  };

  const saveEdit = async () => {
    if (!editingProduct) return;
    if (!editData.name.trim()) { toast.error("اسم المنتج مطلوب"); return; }
    setSavingEdit(true);

    const { error } = await supabase.from("products").update({
      name: editData.name,
      category: editData.category,
      sell_price: editData.sell_price,
      fabric_meters: editData.fabric_meters,
      fabric_price_per_meter: editData.fabric_price_per_meter,
      tarha_cost: editData.tarha_cost,
      extras_cost: editData.extras_cost,
      total_cost: editData.total_cost,
      min_stock_alert: editData.min_stock_alert,
      color: editData.color || null,
    }).eq("id", editingProduct.id);

    if (error) {
      toast.error("فشل التحديث: " + error.message);
      setSavingEdit(false);
      return;
    }

    setDbProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...editData, color: editData.color || null } : p));
    setEditingProduct(null);
    toast.success(`تم تحديث ${editingProduct.code}`);
    setSavingEdit(false);
  };

  const deleteProduct = async (id: string, code: string) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج ${code}؟`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    setDbProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("تم حذف المنتج");
  };

  const filtered = useMemo(() => {
    return dbProducts.filter((p) => {
      if (!p.is_active) return false;
      const q = search.toLowerCase().trim();
      const matchSearch = !q || p.code.toLowerCase().includes(q) || p.name.includes(search) || p.category.includes(search);
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [search, categoryFilter, dbProducts]);

  const stockAlerts: StockAlert[] = useMemo(() => {
    return dbProducts.filter((p) => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert)
      .map((p) => ({ code: p.code, name: p.name, stock: p.stock_quantity, minAlert: p.min_stock_alert, category: p.category }));
  }, [dbProducts]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">المنتجات والمخزون</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{dbProducts.filter(p => p.is_active).length} موديل · التكلفة قابلة للتعديل</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stockAlerts.length > 0 && (
            <button onClick={() => setShowAlerts(!showAlerts)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors animate-pulse">
              <Bell className="size-3.5" /> {stockAlerts.length} تنبيه مخزون
            </button>
          )}
          <button onClick={() => setShowBulkEdit(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors">
            <Layers className="size-3.5" /> تعديل جماعي
          </button>
          <button onClick={() => setShowInventory(!showInventory)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${showInventory ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            <BarChart3 className="size-3.5" /> {showInventory ? "إخفاء المخزون" : "إظهار المخزون"}
          </button>
        </div>
      </div>

      {showAlerts && stockAlerts.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2"><AlertTriangle className="size-4" /> تنبيهات انخفاض المخزون</h3>
            <button onClick={() => setShowAlerts(false)} className="text-amber-600 hover:text-amber-800"><X className="size-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stockAlerts.map((alert) => (
              <div key={alert.code} className="flex items-center justify-between rounded-xl bg-white p-3 border border-amber-200">
                <div>
                  <p className="text-xs font-bold text-navy" dir="ltr">{alert.code}</p>
                  <p className="text-[10px] text-gray-500">{alert.name}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-amber-600">{alert.stock} متبقي</p>
                  <p className="text-[10px] text-gray-400">الحد الأدنى: {alert.minAlert}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm border border-gray-100 sm:flex-row sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            placeholder="بحث بالرمز أو الاسم أو التصنيف..." />
        </div>
        <div className="relative">
          <Filter className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pe-8 ps-9 text-sm focus:border-gold focus:outline-none sm:w-auto">
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button onClick={() => setCategoryFilter("all")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${categoryFilter === "all" ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          الكل ({dbProducts.filter(p => p.is_active).length})
        </button>
        {categories.map((cat) => {
          const count = dbProducts.filter((p) => p.is_active && p.category === cat).length;
          return (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${categoryFilter === cat ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {cat} ({count})
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-gradient-to-l from-gold/20 to-gold/5 p-3 border border-gold/20 sm:p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Calculator className="size-4 text-gold-dark" />
          <span className="text-xs font-bold text-navy sm:text-sm">محرك حساب التكاليف</span>
        </div>
        <p className="text-[11px] text-gray-600 sm:text-xs">
          الافتراضي: <span className="font-semibold">2.25م × 1,000 ر.ي = 2,250</span> + <span className="font-semibold">300</span> طرحة + <span className="font-semibold">200</span> إضافات = <span className="font-bold text-navy">2,750 ر.ي</span>
          <span className="text-gray-400 ms-2">(قابل للتعديل لكل منتج)</span>
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الرمز</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الموديل</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">التصنيف</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">التكلفة</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">سعر البيع</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الربح</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">هامش</th>
                {showInventory && <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">المخزون</th>}
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">تحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((product, idx) => {
                const profit = product.sell_price - product.total_cost;
                const margin = product.sell_price > 0 ? ((profit / product.sell_price) * 100).toFixed(0) : "0";
                const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.min_stock_alert;

                return (
                  <tr key={product.id} className="hover:bg-cream/30 transition-colors animate-fade-in opacity-0"
                    style={{ animationDelay: `${Math.min(idx, 20) * 20}ms` }}>
                    <td className="px-3 py-2.5 text-xs font-bold text-navy sm:px-4 sm:text-sm" dir="ltr">{product.code}</td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-xs font-semibold text-gray-800 sm:text-sm">{product.name}</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="rounded-lg bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy sm:text-xs">{product.category}</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-xs text-red-600 font-semibold tabular-nums sm:text-sm">{formatCurrency(product.total_cost)}</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-xs font-bold text-gold tabular-nums sm:text-sm">{formatCurrency(product.sell_price)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-emerald-600 tabular-nums sm:px-4 sm:text-sm">{formatCurrency(profit)}</td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold sm:text-xs ${
                        Number(margin) >= 50 ? "bg-emerald-100 text-emerald-700" : Number(margin) >= 30 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{margin}%</span>
                    </td>
                    {showInventory && (
                      <td className="px-3 py-2.5 sm:px-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateStock(product.id, product.code, -1)} disabled={product.stock_quantity <= 0}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-30" aria-label="إنقاص">
                            <Minus className="size-3.5" />
                          </button>
                          <span className={`min-w-[2rem] text-center text-xs font-bold tabular-nums ${product.stock_quantity === 0 ? "text-gray-300" : isLow ? "text-amber-600" : "text-navy"}`}>
                            {product.stock_quantity}
                          </span>
                          <button onClick={() => updateStock(product.id, product.code, 1)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-emerald-500" aria-label="زيادة">
                            <Plus className="size-3.5" />
                          </button>
                          {isLow && <AlertTriangle className="size-3.5 text-amber-500" />}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 sm:px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(product)} className="rounded p-1.5 text-blue-500 hover:bg-blue-50" title="تعديل كامل">
                          <Edit3 className="size-3.5" />
                        </button>
                        <button onClick={() => deleteProduct(product.id, product.code)} className="rounded p-1.5 text-red-400 hover:bg-red-50" title="حذف">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Package className="size-12 text-gray-300" />
            <p className="text-sm text-gray-400">لا توجد منتجات مطابقة</p>
          </div>
        )}
      </div>

      <BulkEditDialog
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        products={dbProducts}
        categories={categories}
        onSaved={loadProducts}
      />

      {/* Full Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4 z-10">
              <div>
                <h2 className="text-lg font-bold text-navy">تعديل المنتج</h2>
                <p className="text-xs text-gray-500" dir="ltr">{editingProduct.code}</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-navy">المعلومات الأساسية</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">اسم الموديل</label>
                    <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">التصنيف</label>
                    <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">اللون</label>
                    <input value={editData.color} onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="مثال: أسود، أزرق" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">الحد الأدنى للتنبيه</label>
                    <input type="number" min="0" value={editData.min_stock_alert}
                      onChange={(e) => setEditData({ ...editData, min_stock_alert: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Cost Engine */}
              <div className="rounded-2xl bg-cream/40 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Calculator className="size-5 text-gold-dark" />
                  <h3 className="text-sm font-bold text-navy">محرك حساب التكاليف</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">عدد أمتار القماش</label>
                    <input type="number" step="0.01" min="0" value={editData.fabric_meters}
                      onChange={(e) => setEditData({ ...editData, fabric_meters: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">سعر المتر (ر.ي)</label>
                    <input type="number" min="0" value={editData.fabric_price_per_meter}
                      onChange={(e) => setEditData({ ...editData, fabric_price_per_meter: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">تكلفة الطرحة</label>
                    <input type="number" min="0" value={editData.tarha_cost}
                      onChange={(e) => setEditData({ ...editData, tarha_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">إضافات أخرى</label>
                    <input type="number" min="0" value={editData.extras_cost}
                      onChange={(e) => setEditData({ ...editData, extras_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3 border border-gold/30">
                  <p className="text-xs text-gray-500">معادلة الحساب:</p>
                  <p className="text-sm font-mono mt-1" dir="ltr">
                    ({editData.fabric_meters} × {editData.fabric_price_per_meter}) + {editData.tarha_cost} + {editData.extras_cost}
                  </p>
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-semibold text-gray-700">إجمالي التكلفة (محسوب تلقائياً)</span>
                    <span className="text-base font-bold text-red-600 tabular-nums">{formatCurrency(editData.total_cost)}</span>
                  </div>
                </div>
              </div>

              {/* Selling Price & Profit */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-navy">السعر والربح</h3>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">سعر البيع (ر.ي)</label>
                  <input type="number" min="0" value={editData.sell_price}
                    onChange={(e) => setEditData({ ...editData, sell_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-base font-bold text-gold-dark focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 tabular-nums" dir="ltr" />
                </div>

                {/* Profit calculation */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-[10px] text-emerald-700">الربح</p>
                    <p className="text-lg font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(editData.sell_price - editData.total_cost)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <p className="text-[10px] text-blue-700">هامش الربح</p>
                    <p className="text-lg font-bold text-blue-700 tabular-nums">
                      {editData.sell_price > 0 ? (((editData.sell_price - editData.total_cost) / editData.sell_price) * 100).toFixed(1) : "0"}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t bg-white px-6 py-4">
              <button onClick={() => setEditingProduct(null)} disabled={savingEdit}
                className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                إلغاء
              </button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light disabled:opacity-60 active:scale-[0.98]">
                {savingEdit ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {savingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
