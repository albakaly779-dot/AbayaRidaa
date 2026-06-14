import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Truck, ChevronDown, ChevronUp, DollarSign, Package, Trash2, Ruler } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSupplierStore } from "@/stores/supplierStore";
import { formatCurrency, formatDual, formatDate, getTxTypeLabel, getTxTypeColor } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import { CITIES, FABRIC_UNITS } from "@/constants/config";

export default function Suppliers() {
  const { user } = useAuth();
  const { suppliers, transactions, initializeData, addSupplier, deleteSupplier, addTransaction, deleteTransaction, getSupplierBalance, getTotalSupplierDebt, getTotalFabricByUnit } = useSupplierStore();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddTx, setShowAddTx] = useState<string | null>(null);
  const [sf, setSf] = useState({ name: "", phone: "", email: "", company: "", city: "", notes: "" });
  const [tf, setTf] = useState({ type: "purchase" as "purchase" | "payment" | "return", amount: 0, pieces: 0, fabricType: "", fabricUnit: "متر", fabricQuantity: 0, date: "", notes: "" });

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  const totalDebt = getTotalSupplierDebt();
  const totalFabric = getTotalFabricByUnit();
  const filtered = useMemo(() => suppliers.filter((s) => s.name.includes(search) || s.company.includes(search) || s.phone.includes(search)), [suppliers, search]);

  const handleAddSupplier = async () => {
    if (!sf.name.trim()) { toast.error("يرجى إدخال اسم المورد"); return; }
    if (!user?.id) return;
    await addSupplier(sf, user.id);
    toast.success("تم إضافة المورد");
    setSf({ name: "", phone: "", email: "", company: "", city: "", notes: "" });
    setShowAddSupplier(false);
  };

  const handleAddTx = async (supplierId: string, supplierName: string) => {
    if (tf.amount <= 0 && tf.type !== "purchase") { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    if (tf.type === "purchase" && tf.amount <= 0 && tf.fabricQuantity <= 0) { toast.error("يرجى إدخال مبلغ أو كمية"); return; }
    await addTransaction({ supplierId, supplierName, ...tf, date: tf.date || new Date().toISOString().split("T")[0] });
    toast.success("تم تسجيل العملية");
    setTf({ type: "purchase", amount: 0, pieces: 0, fabricType: "", fabricUnit: "متر", fabricQuantity: 0, date: "", notes: "" });
    setShowAddTx(null);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">الموردون والتجار</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{suppliers.length} مورد مسجل</p>
        </div>
        <button onClick={() => setShowAddSupplier(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light active:scale-[0.98]">
          <Plus className="size-4" /> مورد جديد
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <StatCard title="إجمالي المستحق" value={formatCurrency(totalDebt)} icon={DollarSign} delay={3} />
        <StatCard title="عدد الموردين" value={`${suppliers.length} مورد`} icon={Truck} delay={0} />
        <StatCard title="إجمالي المعاملات" value={`${transactions.length} عملية`} icon={Package} delay={1} />
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-cyan-50 p-2"><Ruler className="size-4 text-cyan-600" /></div>
            <span className="text-xs font-semibold text-gray-500">الأقمشة المتبقية</span>
          </div>
          <div className="space-y-1">
            {Object.entries(totalFabric).length > 0 ? Object.entries(totalFabric).map(([unit, qty]) => (
              <p key={unit} className="text-sm font-bold text-navy">{qty.toLocaleString("ar-YE")} <span className="text-xs font-normal text-gray-400">{unit}</span></p>
            )) : <p className="text-xs text-gray-400">لا توجد بيانات</p>}
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pe-4 ps-10 text-sm shadow-sm focus:border-gold focus:outline-none" placeholder="بحث بالاسم أو الشركة..." />
      </div>

      <div className="space-y-3">
        {filtered.map((supplier, idx) => {
          const balance = getSupplierBalance(supplier.id);
          const isExpanded = expandedId === supplier.id;
          const supplierTxs = transactions.filter((t) => t.supplierId === supplier.id).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={supplier.id} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-cream/30 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-5" onClick={() => setExpandedId(isExpanded ? null : supplier.id)}>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-bl from-navy to-navy-light text-xs font-bold text-white sm:size-12 sm:text-sm">{supplier.name.charAt(0)}</div>
                  <div>
                    <h3 className="text-sm font-bold text-navy">{supplier.name}</h3>
                    <p className="text-[10px] text-gray-400 sm:text-xs">{supplier.company} · {supplier.city}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:gap-4">
                  <div className="grid grid-cols-3 gap-3 text-center sm:gap-4">
                    <div><p className="text-[10px] text-gray-400">المشتريات</p><p className="text-xs font-bold text-red-600 tabular-nums">{formatCurrency(balance.totalPurchases)}</p></div>
                    <div><p className="text-[10px] text-gray-400">المدفوع</p><p className="text-xs font-bold text-green-600 tabular-nums">{formatCurrency(balance.totalPayments)}</p></div>
                    <div><p className="text-[10px] text-gray-400">المتبقي</p><p className={`text-sm font-bold tabular-nums ${balance.remaining > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(Math.max(0, balance.remaining))}</p></div>
                  </div>
                  {/* Fabric summary */}
                  {Object.entries(balance.fabricByUnit).length > 0 && (
                    <div className="hidden sm:flex items-center gap-2 rounded-lg bg-cyan-50 px-3 py-1.5">
                      <Ruler className="size-3.5 text-cyan-600" />
                      {Object.entries(balance.fabricByUnit).map(([unit, qty]) => (
                        <span key={unit} className="text-xs font-bold text-cyan-700">{qty} {unit}</span>
                      ))}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="size-5 text-gray-400 hidden sm:block" /> : <ChevronDown className="size-5 text-gray-400 hidden sm:block" />}
                </div>
              </div>
              {isExpanded && (
                <div className="border-t bg-cream/20 p-4 space-y-3 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-navy">سجل العمليات</h4>
                    <button onClick={(e) => { e.stopPropagation(); setShowAddTx(supplier.id); }}
                      className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light">
                      <Plus className="size-3.5" /> عملية جديدة
                    </button>
                  </div>
                  {showAddTx === supplier.id && (
                    <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {(["purchase", "payment", "return"] as const).map((t) => (
                          <button key={t} onClick={() => setTf({ ...tf, type: t })}
                            className={`rounded-lg py-2 text-xs font-semibold ${tf.type === t ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            {getTxTypeLabel(t)}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">المبلغ</label>
                          <input type="number" min="0" value={tf.amount || ""} onChange={(e) => setTf({ ...tf, amount: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">عدد القطع</label>
                          <input type="number" min="0" value={tf.pieces || ""} onChange={(e) => setTf({ ...tf, pieces: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">نوع القماش</label>
                          <input value={tf.fabricType} onChange={(e) => setTf({ ...tf, fabricType: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">التاريخ</label>
                          <input type="date" value={tf.date} onChange={(e) => setTf({ ...tf, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">كمية القماش</label>
                          <input type="number" min="0" step="0.5" value={tf.fabricQuantity || ""} onChange={(e) => setTf({ ...tf, fabricQuantity: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                        <div><label className="mb-1 block text-xs font-semibold text-gray-600">وحدة القياس</label>
                          <select value={tf.fabricUnit} onChange={(e) => setTf({ ...tf, fabricUnit: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none">
                            {FABRIC_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select></div>
                      </div>
                      <div><label className="mb-1 block text-xs font-semibold text-gray-600">ملاحظات</label>
                        <input value={tf.notes} onChange={(e) => setTf({ ...tf, notes: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" /></div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddTx(supplier.id, supplier.name)} className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700">حفظ</button>
                        <button onClick={() => setShowAddTx(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">إلغاء</button>
                      </div>
                    </div>
                  )}
                  {supplierTxs.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl bg-white p-3 border border-gray-100 sm:p-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${getTxTypeColor(tx.type)}`}>{getTxTypeLabel(tx.type)}</span>
                        <div>
                          <p className="text-sm font-semibold text-navy">{formatCurrency(tx.amount)}</p>
                          <p className="text-xs text-gray-400">
                            {formatDate(tx.date)}
                            {tx.pieces > 0 && ` · ${tx.pieces} قطعة`}
                            {tx.fabricQuantity > 0 && ` · ${tx.fabricQuantity} ${tx.fabricUnit}`}
                            {tx.fabricType && ` (${tx.fabricType})`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => { deleteTransaction(tx.id); toast.success("تم حذف العملية"); }} className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                  {supplierTxs.length === 0 && <p className="text-center text-xs text-gray-400 py-4">لا توجد عمليات مسجلة</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg animate-scale-in rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold text-navy">مورد جديد</h2>
              <button onClick={() => setShowAddSupplier(false)} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">اسم المورد</label>
                  <input value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">الشركة</label>
                  <input value={sf.company} onChange={(e) => setSf({ ...sf, company: e.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">الهاتف</label>
                  <input value={sf.phone} onChange={(e) => setSf({ ...sf, phone: e.target.value })} dir="ltr" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">المدينة</label>
                  <select value={sf.city} onChange={(e) => setSf({ ...sf, city: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                    <option value="">اختر المدينة</option>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">ملاحظات</label>
                <textarea value={sf.notes} onChange={(e) => setSf({ ...sf, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
              <button onClick={handleAddSupplier} className="flex-1 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98]">حفظ المورد</button>
              <button onClick={() => setShowAddSupplier(false)} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
