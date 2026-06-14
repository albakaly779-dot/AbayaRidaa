import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/lib/supabase";
import { GOVERNORATES } from "@/constants/config";
import { validateYemeniPhone } from "@/lib/formatters";

const SOURCES = [
  { value: "whatsapp", label: "واتساب 💬" },
  { value: "instagram", label: "إنستقرام 📸" },
  { value: "facebook", label: "فيسبوك 📘" },
  { value: "direct", label: "مباشر 🏪" },
  { value: "referral", label: "توصية 🤝" },
  { value: "other", label: "أخرى" },
];

interface Props { open: boolean; onClose: () => void; }

export default function CustomerFormDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const { addCustomer } = useDataStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);

  // Real-time phone validation
  useEffect(() => {
    if (!phone.trim()) {
      setPhoneError("");
      setPhoneValid(false);
      return;
    }
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      setPhoneError(`الرقم ناقص — أدخلت ${cleaned.length} أرقام (المطلوب 9 على الأقل)`);
      setPhoneValid(false);
    } else if (!validateYemeniPhone(phone)) {
      setPhoneError("صيغة الرقم غير صحيحة — تأكد أنه يبدأ بـ 7 أو 967");
      setPhoneValid(false);
    } else {
      setPhoneError("");
      setPhoneValid(true);
    }
  }, [phone]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("يرجى إدخال اسم العميل"); return; }
    if (!phone.trim()) { toast.error("يرجى إدخال رقم الهاتف"); return; }
    if (!validateYemeniPhone(phone)) { toast.error("صيغة رقم الهاتف اليمني غير صحيحة"); return; }
    if (!user?.id) return;

    setLoading(true);

    // Insert directly to include source and added_by fields
    const { data: row, error } = await supabase.from("customers").insert({
      user_id: user.id,
      name,
      phone: phone.replace(/\D/g, ""),
      email: "",
      city,
      address,
      notes,
      source,
      added_by_id: user.id,
      added_by_name: user.username || user.email,
    }).select().single();

    if (error) {
      toast.error("فشل إضافة العميل: " + error.message);
      setLoading(false);
      return;
    }

    // Notify admin if added by non-admin
    if (user.role && user.role !== "admin") {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "custom",
        recipient_name: "المدير",
        recipient_phone: "",
        message: `${user.username || user.email} أضاف عميل جديد: ${name} (${phone}) من ${SOURCES.find(s => s.value === source)?.label || "غير محدد"}`,
        status: "sent",
      });

      // Send email notification to admin via Edge Function
      supabase.functions.invoke("notify-admin", {
        body: {
          customerName: name,
          customerPhone: phone.replace(/\D/g, ""),
          source,
          repName: user.username || user.email,
          repEmail: user.email,
        },
      }).catch((err) => console.error("Edge function error:", err));
    }

    toast.success("تم إضافة العميل بنجاح");
    setLoading(false);
    onClose();
    setName(""); setPhone(""); setCity(""); setAddress(""); setSource(""); setNotes("");

    // Force reload customers
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-navy">عميل جديد</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="إغلاق"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">اسم العميل</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">رقم الهاتف (+967)</label>
            <div className="relative">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="967 7xx xxx xxx"
                className={`w-full rounded-xl border px-4 py-2.5 pe-10 text-sm focus:outline-none focus:ring-2 ${
                  phoneError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : 
                  phoneValid ? "border-green-300 focus:border-green-400 focus:ring-green-100" :
                  "border-gray-200 focus:border-gold focus:ring-gold/20"
                }`} />
              {phone.trim() && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  {phoneValid ? <CheckCircle2 className="size-4 text-green-500" /> : <AlertCircle className="size-4 text-red-500" />}
                </span>
              )}
            </div>
            {phoneError && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="size-3" /> {phoneError}
              </p>
            )}
            {phoneValid && (
              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> الرقم صحيح ✓
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">المحافظة</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
              <option value="">اختر المحافظة</option>
              {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">مصدر العميل</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
              <option value="">اختر المصدر</option>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">العنوان</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98] disabled:opacity-60">
            {loading ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
