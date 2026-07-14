import { useState, useEffect } from "react";
import { X, Plus, Trash2, Search, Calculator, AlertCircle, CheckCircle2, Phone, Edit3, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useRepStore } from "@/stores/repStore";
import { findProductByCode, searchProducts, PRODUCT_CATALOG } from "@/constants/productCatalog";
import { generateId } from "@/lib/utils";
import { formatCurrency, validateYemeniPhone, formatPhone } from "@/lib/formatters";
import type { OrderItem, OrderStatus, PaymentStatus } from "@/types";

interface Props { open: boolean; onClose: () => void; }

export default function OrderFormDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const { customers, addOrder, updateCustomer } = useDataStore();
  const { reps } = useRepStore();
  const [customerId, setCustomerId] = useState("");
  const [repId, setRepId] = useState("");
  const [items, setItems] = useState<(OrderItem & { codeInput?: string })[]>([
    { id: generateId(), productCode: "", productName: "", quantity: 1, unitPrice: 0, buyPrice: 0, total: 0, codeInput: "" },
  ]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<typeof PRODUCT_CATALOG>([]);

  // Phone validation widget state
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [editingPhone, setEditingPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerPhoneValid = selectedCustomer ? validateYemeniPhone(selectedCustomer.phone) : true;

  useEffect(() => {
    if (selectedCustomer) {
      setEditingPhone(selectedCustomer.phone);
      setShowPhoneEdit(false);
    }
  }, [customerId, selectedCustomer]);

  if (!open) return null;

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total = subtotal - discount;
  const remaining = total - paid;

  const addItem = () => {
    setItems([...items, { id: generateId(), productCode: "", productName: "", quantity: 1, unitPrice: 0, buyPrice: 0, total: 0, codeInput: "" }]);
  };

  const removeItem = (id: string) => { if (items.length > 1) setItems(items.filter((i) => i.id !== id)); };

  const handleCodeInput = (itemId: string, code: string) => {
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, codeInput: code };
      const product = findProductByCode(code);
      if (product) {
        updated.productCode = product.code;
        updated.productName = product.name;
        updated.unitPrice = product.sellPrice;
        updated.buyPrice = product.totalCost;
        updated.total = product.sellPrice * updated.quantity;
        setActiveSearch(null);
        setSearchResults([]);
      } else if (code.length >= 2) {
        setActiveSearch(itemId);
        setSearchResults(searchProducts(code).slice(0, 8));
      }
      return updated;
    }));
  };

  const selectProduct = (itemId: string, product: typeof PRODUCT_CATALOG[0]) => {
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, codeInput: product.code, productCode: product.code, productName: product.name,
        unitPrice: product.sellPrice, buyPrice: product.totalCost, total: product.sellPrice * item.quantity };
    }));
    setActiveSearch(null); setSearchResults([]);
  };

  const updateItemField = (id: string, field: string, value: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const handleSavePhone = async () => {
    if (!selectedCustomer) return;
    if (!editingPhone.trim()) { toast.error("الرقم لا يمكن أن يكون فارغاً"); return; }
    if (!validateYemeniPhone(editingPhone)) { toast.error("الرقم غير صحيح"); return; }
    setSavingPhone(true);
    const cleanPhone = editingPhone.replace(/\D/g, "");
    await updateCustomer(selectedCustomer.id, { phone: cleanPhone });
    toast.success("تم تحديث رقم العميل");
    setSavingPhone(false);
    setShowPhoneEdit(false);
  };

  const handleSubmit = async () => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) { toast.error("يرجى اختيار العميل"); return; }
    if (!validateYemeniPhone(customer.phone)) {
      toast.error("رقم هاتف العميل غير صحيح — قم بتحديثه أولاً");
      return;
    }
    if (items.some((i) => !i.productName)) { toast.error("يرجى اختيار المنتج لجميع العناصر"); return; }
    if (!user?.id) return;

    let paymentStatus: PaymentStatus = "unpaid";
    if (paid >= total) paymentStatus = "paid";
    else if (paid > 0) paymentStatus = "partial";

    const rep = reps.find((r) => r.id === repId);

    await addOrder({
      customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
      repId: rep?.id, repName: rep?.name,
      items: items.map(({ codeInput, ...rest }) => rest),
      subtotal, discount, total, paid, remaining: Math.max(0, remaining),
      status: "pending" as OrderStatus, paymentStatus, notes,
      createdAt: new Date().toISOString().split("T")[0],
      dueDate: dueDate || new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    }, user.id);

    if (rep) {
      const commissionAmount = total * (rep.commissionRate / 100);
      useRepStore.getState().addCommission({
        repId: rep.id, repName: rep.name, orderId: "", orderNumber: "",
        orderTotal: total, commissionAmount, shippingDeduction: 0, netCommission: commissionAmount,
        isPaid: false, date: new Date().toISOString().split("T")[0], notes: "",
      });
    }

    toast.success("تم إنشاء الطلب بنجاح");
    onClose();
    setCustomerId(""); setRepId(""); setDiscount(0); setPaid(0); setNotes(""); setDueDate("");
    setItems([{ id: generateId(), productCode: "", productName: "", quantity: 1, unitPrice: 0, buyPrice: 0, total: 0, codeInput: "" }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="w-full max-w-3xl animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[95vh] overflow-y-auto scrollbar-thin">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 rounded-t-2xl sm:px-6 sm:py-4">
          <h2 className="text-base font-bold text-navy sm:text-lg">طلب جديد</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="إغلاق"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">العميل</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                <option value="">اختر العميل...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">المندوب/المسوقة</label>
              <select value={repId} onChange={(e) => setRepId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                <option value="">بدون مندوب</option>
                {reps.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name} ({r.commissionRate}%)</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">تاريخ التسليم</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>

          {/* Phone Validation Widget */}
          {selectedCustomer && (
            <div className={`rounded-xl border-2 p-3 ${
              customerPhoneValid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-300"
            }`}>
              {!showPhoneEdit ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${customerPhoneValid ? "bg-emerald-100" : "bg-red-100"}`}>
                      {customerPhoneValid ?
                        <CheckCircle2 className="size-4 text-emerald-600" /> :
                        <AlertCircle className="size-4 text-red-600" />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${customerPhoneValid ? "text-emerald-800" : "text-red-800"}`}>
                        {customerPhoneValid ? "رقم هاتف العميل صحيح" : "⚠️ تنبيه: رقم العميل ناقص أو غير صحيح"}
                      </p>
                      <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5">
                        <Phone className="size-3" />
                        <span dir="ltr">{selectedCustomer.phone || "(فارغ)"}</span>
                        {!customerPhoneValid && (
                          <span className="text-red-500 text-[10px]">— لن يصل واتساب أو SMS لهذا الرقم</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowPhoneEdit(true)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      customerPhoneValid ?
                        "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
                        "bg-red-600 text-white hover:bg-red-700"
                    }`}>
                    <Edit3 className="size-3" /> {customerPhoneValid ? "تعديل" : "تحديث الرقم الآن"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-navy">تحديث رقم {selectedCustomer.name}</p>
                  <div className="flex gap-2">
                    <input value={editingPhone} onChange={(e) => setEditingPhone(e.target.value)} dir="ltr"
                      className="flex-1 rounded-lg border-2 border-gold/30 bg-white px-4 py-2 text-sm focus:border-gold focus:outline-none"
                      placeholder="967 7xx xxx xxx" autoFocus />
                    <button onClick={handleSavePhone} disabled={savingPhone}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      <Save className="size-3.5" /> حفظ
                    </button>
                    <button onClick={() => { setShowPhoneEdit(false); setEditingPhone(selectedCustomer.phone); }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                      إلغاء
                    </button>
                  </div>
                  {editingPhone && !validateYemeniPhone(editingPhone) && (
                    <p className="text-[10px] text-red-500">⚠️ الرقم غير صحيح — يجب أن يكون 9+ أرقام يبدأ بـ 7 أو 967</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">المنتجات</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-lg bg-navy/10 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/20">
                <Plus className="size-3.5" /> إضافة
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-2 text-[11px] text-gold-dark sm:text-xs">
              <Search className="size-3.5 shrink-0" /> أدخل رمز المنتج (مثل RM-812) وسيظهر السعر تلقائياً
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-100 bg-cream/30 p-3">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 sm:col-span-4 relative">
                      <label className="mb-1 block text-[10px] font-medium text-gray-400">رمز المنتج</label>
                      <input value={item.codeInput || ""} onChange={(e) => handleCodeInput(item.id, e.target.value)}
                        onFocus={() => { if ((item.codeInput?.length || 0) >= 2) { setActiveSearch(item.id); setSearchResults(searchProducts(item.codeInput || "").slice(0, 8)); } }}
                        onBlur={() => setTimeout(() => setActiveSearch(null), 200)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none" placeholder="RM-812" dir="ltr" />
                      {activeSearch === item.id && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">
                          {searchResults.map((p) => (
                            <button key={p.code} type="button" onMouseDown={() => selectProduct(item.id, p)}
                              className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-cream text-right">
                              <span className="font-bold text-navy" dir="ltr">{p.code}</span>
                              <span className="font-bold text-gold tabular-nums">{p.sellPrice.toLocaleString("ar-YE")} ر.ي</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-7 sm:col-span-3">
                      <label className="mb-1 block text-[10px] font-medium text-gray-400">المنتج</label>
                      <input value={item.productName} readOnly className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600" placeholder="سيظهر تلقائياً" />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <label className="mb-1 block text-[10px] font-medium text-gray-400">الكمية</label>
                      <input type="number" min="1" value={item.quantity}
                        onChange={(e) => updateItemField(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:border-gold focus:outline-none" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="mb-1 block text-[10px] font-medium text-gray-400">سعر البيع</label>
                      <input type="number" value={item.unitPrice}
                        onChange={(e) => updateItemField(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:border-gold focus:outline-none" />
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-center text-xs font-bold text-gold tabular-nums pt-5">
                      {item.total.toLocaleString("ar-YE")}
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-center pt-5">
                      <button type="button" onClick={() => removeItem(item.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" aria-label="حذف"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  {item.buyPrice ? (
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400">
                      <Calculator className="size-3" /> تكلفة: {formatCurrency(item.buyPrice)} · ربح: <span className="text-emerald-600 font-semibold">{formatCurrency(item.unitPrice - item.buyPrice)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">الخصم</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">المدفوع</label>
              <input type="number" min="0" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-xl bg-navy/5 p-2.5 text-center">
                <p className="text-[10px] text-gray-500">الإجمالي</p>
                <p className="text-base font-bold text-navy tabular-nums">{total.toLocaleString("ar-YE")} ر.ي</p>
                {remaining > 0 && <p className="text-[10px] text-red-500">متبقي: {remaining.toLocaleString("ar-YE")}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none resize-none" />
          </div>
        </div>
        <div className="sticky bottom-0 flex gap-3 border-t bg-gray-50 px-4 py-3 rounded-b-2xl sm:px-6 sm:py-4">
          <button onClick={handleSubmit} className="flex-1 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98]">حفظ الطلب</button>
          <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
