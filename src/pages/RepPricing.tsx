import { useEffect, useState } from "react";
import { UserCheck, DollarSign, EyeOff, Eye, Save, Loader2, Info, Search, Trash2, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRepStore } from "@/stores/repStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";
import { useAuditStore } from "@/stores/auditStore";
import { logActivity } from "@/hooks/useActivityLogger";

interface RepPrice {
  id: string;
  repEmail: string;
  productCode: string;
  productName: string;
  customPrice: number;
  hideCost: boolean;
  hideProfit: boolean;
}

interface Product {
  id: string;
  code: string;
  name: string;
  sell_price: number;
  total_cost: number;
}

export default function RepPricing() {
  const { user } = useAuth();
  const { reps, initializeData } = useRepStore();
  const { logAction } = useAuditStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<RepPrice[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, { price?: number; hideCost?: boolean; hideProfit?: boolean }>>({});

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      loadProducts();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedRep) loadPricing();
  }, [selectedRep, user?.id]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, code, name, sell_price, total_cost").eq("is_active", true).order("name");
    setProducts(data || []);
    setLoading(false);
  };

  const loadPricing = async () => {
    if (!user?.id || !selectedRep) return;
    const { data } = await supabase.from("rep_pricing").select("*").eq("user_id", user.id).eq("rep_email", selectedRep);
    const mapped: RepPrice[] = (data || []).map((r: { id: string; rep_email: string; product_code: string; custom_price: string; hide_cost: boolean; hide_profit: boolean }) => {
      const prod = products.find((p) => p.code === r.product_code);
      return {
        id: r.id,
        repEmail: r.rep_email,
        productCode: r.product_code,
        productName: prod?.name || r.product_code,
        customPrice: Number(r.custom_price),
        hideCost: r.hide_cost,
        hideProfit: r.hide_profit,
      };
    });
    setPricing(mapped);
    setEdits({});
  };

  const handleSetPrice = async (product: Product, price: number) => {
    if (!user?.id || !selectedRep) return;
    if (!price || price <= 0) { toast.error("سعر غير صالح"); return; }

    setSaving(true);
    const existing = pricing.find((p) => p.productCode === product.code);

    const { error } = await supabase.from("rep_pricing").upsert({
      user_id: user.id,
      rep_email: selectedRep,
      product_code: product.code,
      custom_price: price,
      hide_cost: existing?.hideCost ?? true,
      hide_profit: existing?.hideProfit ?? true,
    }, { onConflict: "user_id,rep_email,product_code" });

    if (error) { toast.error("فشل الحفظ: " + error.message); setSaving(false); return; }

    logAction(user.id, "update", "rep_pricing", product.code, `تسعير ${product.name} للمندوب ${selectedRep} بـ ${price} ر.ي`);
    logActivity(user.email, user.id, "action", `تسعير مندوب: ${product.name}`, { entityType: "rep_pricing" });
    toast.success("تم الحفظ");
    loadPricing();
    setSaving(false);
  };

  const handleTogglePrivacy = async (item: RepPrice, field: "hideCost" | "hideProfit") => {
    if (!user?.id) return;
    const newValue = !item[field];
    const payload = field === "hideCost" ? { hide_cost: newValue } : { hide_profit: newValue };
    await supabase.from("rep_pricing").update(payload).eq("id", item.id);
    setPricing((prev) => prev.map((p) => p.id === item.id ? { ...p, [field]: newValue } : p));
  };

  const handleDeletePricing = async (id: string) => {
    if (!confirm("حذف السعر المخصص؟")) return;
    await supabase.from("rep_pricing").delete().eq("id", id);
    setPricing((prev) => prev.filter((p) => p.id !== id));
    toast.success("تم الحذف");
  };

  const filteredProducts = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  const getRepPricing = (code: string) => pricing.find((p) => p.productCode === code);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <UserCheck className="size-5 text-cyan-600" /> تسعير خاص للمندوبين
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">حدد أسعار مختلفة لكل مندوب مع إخفاء التكلفة والأرباح</p>
      </div>

      {/* Info */}
      <div className="rounded-2xl bg-cyan-50 border-2 border-cyan-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-cyan-600 shrink-0 mt-0.5" />
          <div className="text-sm text-cyan-900">
            <p className="font-bold mb-1">💰 كيف يعمل التسعير المخصص؟</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              <li>حدد سعراً خاصاً لكل منتج لكل مندوب (يختلف عن السعر العام)</li>
              <li>اختر إخفاء تكلفة المنتج عن المندوب (مخفي افتراضياً)</li>
              <li>اختر إخفاء الأرباح والهامش (مخفي افتراضياً)</li>
              <li>يظهر للمندوب السعر المخصص فقط في لوحته</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rep selector */}
      <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
        <label className="text-xs font-bold text-gray-700 mb-2 block flex items-center gap-1">
          <Filter className="size-3.5" /> اختر المندوب
        </label>
        <select value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
          <option value="">— اختر مندوب —</option>
          {reps.map((r) => (
            <option key={r.id} value={r.email || ""}>{r.name} {r.email ? `(${r.email})` : ""}</option>
          ))}
        </select>
        {selectedRep && (
          <p className="text-[10px] text-emerald-600 font-semibold mt-2">
            ✅ {pricing.length} منتج مسعّر خصيصاً لهذا المندوب
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-navy" /></div>
      ) : !selectedRep ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <UserCheck className="mx-auto size-10 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">اختر مندوباً من القائمة أعلاه للبدء</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الكود..."
              className="w-full rounded-xl border border-gray-200 bg-white px-10 py-2.5 text-sm focus:border-gold focus:outline-none" />
          </div>

          {/* Products table */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b bg-cream/50 text-right">
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">الكود</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">المنتج</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">السعر الأصلي</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">التكلفة</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">السعر الخاص</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">خصوصية</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((p) => {
                    const rp = getRepPricing(p.code);
                    const editPrice = edits[p.code]?.price;
                    return (
                      <tr key={p.id} className={rp ? "bg-cyan-50/30" : ""}>
                        <td className="px-3 py-2.5 text-xs font-mono" dir="ltr">{p.code}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-navy">{p.name}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 tabular-nums">{formatCurrency(p.sell_price)}</td>
                        <td className="px-3 py-2.5 text-xs text-red-600 tabular-nums">{formatCurrency(p.total_cost)}</td>
                        <td className="px-3 py-2.5">
                          <input type="number" min="0" step="100"
                            value={editPrice ?? rp?.customPrice ?? ""}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [p.code]: { ...prev[p.code], price: parseFloat(e.target.value) || 0 } }))}
                            className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:border-gold focus:outline-none tabular-nums"
                            placeholder={p.sell_price.toString()} />
                        </td>
                        <td className="px-3 py-2.5">
                          {rp ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleTogglePrivacy(rp, "hideCost")}
                                title={rp.hideCost ? "التكلفة مخفية" : "التكلفة مرئية"}
                                className={`rounded p-1 ${rp.hideCost ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {rp.hideCost ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              </button>
                              <button onClick={() => handleTogglePrivacy(rp, "hideProfit")}
                                title={rp.hideProfit ? "الربح مخفي" : "الربح مرئي"}
                                className={`rounded p-1 ${rp.hideProfit ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {rp.hideProfit ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => handleSetPrice(p, editPrice ?? rp?.customPrice ?? 0)}
                              disabled={saving || (!editPrice && !rp)}
                              className="rounded-lg bg-emerald-500 text-white p-1.5 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="حفظ">
                              {saving ? <Loader2 className="size-3 animate-spin" /> : rp ? <Save className="size-3" /> : <Plus className="size-3" />}
                            </button>
                            {rp && (
                              <button onClick={() => handleDeletePricing(rp.id)}
                                className="rounded-lg bg-red-50 text-red-600 p-1.5 hover:bg-red-100" title="حذف">
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد منتجات مطابقة للبحث</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
