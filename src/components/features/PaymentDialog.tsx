import { useState } from "react";
import { X, CreditCard, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";
import type { PaymentMethod } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerId: string;
  customerName: string;
  remaining: number;
}

export default function PaymentDialog({ open, onClose, orderId, customerId, customerName, remaining }: Props) {
  const { user } = useAuth();
  const { addPayment, orders } = useDataStore();
  const { sendPaymentSMS } = useNotificationStore();
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("حجم الصورة أكبر من 5MB"); return; }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (amount <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    if (amount > remaining) { toast.error("المبلغ أكبر من المتبقي"); return; }
    if (!receiptFile) { toast.error("يرجى إرفاق صورة الإيصال أو سند الحوالة"); return; }
    if (!user?.id) return;

    setUploading(true);

    // Upload receipt
    let receiptUrl = "";
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${orderId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile);
      
      if (uploadError) {
        toast.error("فشل رفع صورة الإيصال");
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      receiptUrl = urlData.publicUrl;
    }

    addPayment({
      orderId, customerId, customerName, amount, method,
      date: new Date().toISOString().split("T")[0],
      notes,
      receiptUrl,
      recordedById: user.id,
      recordedByName: user.username || user.email?.split("@")[0] || "المستخدم",
    }, user.id);

    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const newRemaining = remaining - amount;
      sendPaymentSMS(customerName, order.customerPhone, amount, newRemaining, orderId, user.id);
    }

    toast.success(`تم تسجيل دفعة ${formatCurrency(amount)} بنجاح`);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-navy">تسجيل دفعة</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="إغلاق"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-xl bg-cream/60 p-4 text-center">
            <p className="text-xs text-gray-500">العميل</p>
            <p className="text-sm font-bold text-navy">{customerName}</p>
            <p className="mt-2 text-xs text-gray-500">المبلغ المتبقي</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">{formatCurrency(remaining)}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">المبلغ المدفوع</label>
            <input type="number" min="0" max={remaining} value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "transfer", "card"] as PaymentMethod[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${method === m ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {m === "cash" ? "نقداً" : m === "transfer" ? "تحويل" : "بطاقة"}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt Upload - Required */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              صورة الإيصال / سند الحوالة <span className="text-red-500">*</span>
            </label>
            {receiptPreview ? (
              <div className="relative rounded-xl border border-gray-200 overflow-hidden">
                <img src={receiptPreview} alt="الإيصال" className="w-full h-40 object-cover" />
                <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                  className="absolute top-2 left-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 cursor-pointer hover:border-gold hover:bg-gold/5 transition-colors">
                <ImagePlus className="size-8 text-gray-400" />
                <p className="text-xs font-semibold text-gray-600">اضغط لرفع صورة الإيصال</p>
                <p className="text-[10px] text-gray-400">JPG, PNG — حد أقصى 5MB</p>
                <input type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">ملاحظات</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="اختياري" />
          </div>
          {amount > 0 && amount <= remaining && (
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-600">
                بعد الدفعة: المتبقي = <span className="font-bold">{formatCurrency(remaining - amount)}</span>
                {remaining - amount === 0 && " ✅ سداد كامل"}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
          <button onClick={handleSubmit} disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {uploading ? "جاري الرفع..." : "تسجيل الدفعة"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
