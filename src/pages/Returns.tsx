import { useEffect, useState, useMemo } from "react";
import { Plus, RotateCcw, Package, Truck, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useReturnStore } from "@/stores/returnStore";
import { useDataStore } from "@/stores/dataStore";
import { useSupplierStore } from "@/stores/supplierStore";
import { formatCurrency, formatDate, getReturnStatusLabel, getReturnStatusColor } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import { generateId } from "@/lib/utils";
import type { ReturnStatus } from "@/types";

export default function Returns() {
  const { user } = useAuth();
  const { returns, initializeData, addReturn, updateReturnStatus, deleteReturn, getTotalCustomerReturns, getTotalSupplierReturns } = useReturnStore();
  const { orders, customers } = useDataStore();
  const { suppliers } = useSupplierStore();
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"customer" | "supplier">("customer");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formProductName, setFormProductName] = useState("");
  const [formQuantity, setFormQuantity] = useState(1);
  const [formUnitPrice, setFormUnitPrice] = useState(0);
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  const customerReturns = useMemo(() => returns.filter((r) => r.type === "customer"), [returns]);
  const supplierReturns = useMemo(() => returns.filter((r) => r.type === "supplier"), [returns]);
  const displayed = tab === "customer" ? customerReturns : supplierReturns;

  const handleAddReturn = async () => {
    if (formType === "customer" && !formCustomerId) { toast.error("يرجى اختيار العميل"); return; }
    if (formType === "supplier" && !formSupplierId) { toast.error("يرجى اختيار المورد"); return; }
    if (!formProductName) { toast.error("يرجى إدخال اسم المنتج"); return; }
    if (!user?.id) return;

    const total = formQuantity * formUnitPrice;
    const customer = customers.find((c) => c.id === formCustomerId);
    const supplier = suppliers.find((s) => s.id === formSupplierId);

    await addReturn({
      type: formType, customerName: customer?.name, supplierName: supplier?.name,
      customerId: formCustomerId || undefined, supplierId: formSupplierId || undefined,
      items: [{ id: generateId(), productName: formProductName, quantity: formQuantity, unitPrice: formUnitPrice, total }],
      reason: formReason, totalAmount: total, status: "pending" as ReturnStatus,
      date: new Date().toISOString().split("T")[0], notes: formNotes,
    }, user.id);
    toast.success("تم تسجيل المرتجع");
    setShowForm(false);
    setFormCustomerId(""); setFormSupplierId(""); setFormProductName(""); setFormQuantity(1); setFormUnitPrice(0); setFormReason(""); setFormNotes("");
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">المرتجعات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{returns.length} مرتجع مسجل</p>
        </div>
        <button onClick={() => { setFormType(tab); setShowForm(true); }}
          className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light active:scale-[0.98]">
          <Plus className="size-4" /> مرتجع جديد
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="مرتجعات الزبائن" value={formatCurrency(getTotalCustomerReturns())} icon={RotateCcw} delay={0} />
        <StatCard title="مرتجعات الموردين" value={formatCurrency(getTotalSupplierReturns())} icon={Truck} delay={1} />
        <StatCard title="الإجمالي" value={formatCurrency(getTotalCustomerReturns() + getTotalSupplierReturns())} icon={Package} delay={2} />
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button onClick={() => setTab("customer")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:px-4 sm:py-2.5 sm:text-sm ${tab === "customer" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>
          <Package className="size-3.5 sm:size-4" /> الزبائن ({customerReturns.length})
        </button>
        <button onClick={() => setTab("supplier")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:px-4 sm:py-2.5 sm:text-sm ${tab === "supplier" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>
          <Truck className="size-3.5 sm:size-4" /> الموردين ({supplierReturns.length})
        </button>
      </div>

      <div className="space-y-3">
        {displayed.map((ret, idx) => (
          <div key={ret.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 animate-fade-in opacity-0 sm:p-5" style={{ animationDelay: `${idx * 40}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-full text-white ${ret.type === "customer" ? "bg-gradient-to-bl from-amber-500 to-amber-600" : "bg-gradient-to-bl from-blue-500 to-blue-600"}`}>
                  {ret.type === "customer" ? <RotateCcw className="size-5" /> : <Truck className="size-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">{ret.type === "customer" ? ret.customerName : ret.supplierName}</h3>
                  <p className="text-xs text-gray-400">{formatDate(ret.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${getReturnStatusColor(ret.status)}`}>{getReturnStatusLabel(ret.status)}</span>
                <span className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(ret.totalAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2"><span className="font-semibold">السبب:</span> {ret.reason}</p>
            <div className="flex items-center gap-2">
              {ret.status === "pending" && (
                <>
                  <button onClick={() => { updateReturnStatus(ret.id, "completed"); toast.success("تم اعتماد المرتجع"); }}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"><CheckCircle className="size-3.5" />اعتماد</button>
                  <button onClick={() => { updateReturnStatus(ret.id, "rejected"); toast.success("تم رفض المرتجع"); }}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"><XCircle className="size-3.5" />رفض</button>
                </>
              )}
              <button onClick={() => { deleteReturn(ret.id); toast.success("تم حذف المرتجع"); }} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 ms-auto"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {displayed.length === 0 && <div className="py-16 text-center"><RotateCcw className="mx-auto size-12 text-gray-300" /><p className="mt-3 text-sm text-gray-400">لا توجد مرتجعات</p></div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-lg font-bold text-navy">مرتجع جديد</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                <button onClick={() => setFormType("customer")} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${formType === "customer" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>من زبون</button>
                <button onClick={() => setFormType("supplier")} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${formType === "supplier" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>إلى مورد</button>
              </div>
              {formType === "customer" ? (
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">العميل</label>
                  <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                    <option value="">اختر العميل</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
              ) : (
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">المورد</label>
                  <select value={formSupplierId} onChange={(e) => setFormSupplierId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                    <option value="">اختر المورد</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
              )}
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">المنتج</label>
                <input value={formProductName} onChange={(e) => setFormProductName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="اسم المنتج" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">الكمية</label>
                  <input type="number" min="1" value={formQuantity} onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">سعر القطعة</label>
                  <input type="number" min="0" value={formUnitPrice} onChange={(e) => setFormUnitPrice(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
              </div>
              <div className="rounded-xl bg-cream p-3 text-center"><p className="text-xs text-gray-500">الإجمالي</p><p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(formQuantity * formUnitPrice)}</p></div>
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">سبب الإرجاع</label>
                <input value={formReason} onChange={(e) => setFormReason(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="عيب تصنيع..." /></div>
            </div>
            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
              <button onClick={handleAddReturn} className="flex-1 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98]">حفظ المرتجع</button>
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
