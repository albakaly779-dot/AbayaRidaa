import { useState, useEffect, useMemo } from "react";
import { UserPlus, Package, Calendar, CheckCircle, Loader2, ImagePlus, X, Send, MessageSquare, BarChart3, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/lib/supabase";
import { GOVERNORATES } from "@/constants/config";
import { validateYemeniPhone, formatDate } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SOURCES = [
  { value: "whatsapp", label: "واتساب", icon: "💬" },
  { value: "instagram", label: "إنستقرام", icon: "📸" },
  { value: "facebook", label: "فيسبوك", icon: "📘" },
  { value: "direct", label: "مباشر", icon: "🏪" },
  { value: "referral", label: "توصية", icon: "🤝" },
  { value: "other", label: "أخرى", icon: "📋" },
];

interface RepEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  city: string;
  productCode: string;
  source: string;
  date: string;
  paidAmount: number;
  receiptUrl: string;
  createdAt: string;
}

export default function RepDashboard() {
  const { user, logout } = useAuth();
  const { initializeData } = useDataStore();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [city, setCity] = useState("");
  const [productCode, setProductCode] = useState("");
  const [source, setSource] = useState("whatsapp");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<RepEntry[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "stats">("form");

  // Stats
  const [stats, setStats] = useState({ thisMonth: 0, total: 0, commissions: 0 });

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      loadEntries();
      loadStats();
    }
  }, [user?.id]);

  const loadEntries = async () => {
    const { data } = await supabase.from("customers")
      .select("*")
      .eq("added_by_id", user?.id || "")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) {
      setEntries(data.map((c: any) => ({
        id: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        city: c.city,
        productCode: c.notes?.match(/رمز المنتج: ([^\n]+)/)?.[1] || "",
        source: c.source || "",
        date: c.created_at?.split("T")[0] || "",
        paidAmount: 0,
        receiptUrl: "",
        createdAt: c.created_at,
      })));
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [allRes, monthRes, commRes] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact" }).eq("added_by_id", user.id),
      supabase.from("customers").select("id", { count: "exact" }).eq("added_by_id", user.id).gte("created_at", firstOfMonth),
      supabase.from("rep_commissions").select("net_commission, is_paid").eq("rep_name", user.username || ""),
    ]);

    const total = allRes.count || 0;
    const thisMonth = monthRes.count || 0;
    const commissions = (commRes.data || []).filter((c: any) => !c.is_paid).reduce((s: number, c: any) => s + Number(c.net_commission), 0);

    setStats({ thisMonth, total, commissions });
  };

  // Weekly chart data
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = 0;
    }
    entries.forEach((e) => {
      const key = e.createdAt?.split("T")[0] || e.date;
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      day: new Date(date).toLocaleDateString("ar-SA", { weekday: "short" }),
      عملاء: count,
    }));
  }, [entries]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("حجم الصورة أكبر من 5MB"); return; }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error("يرجى إدخال اسم العميل"); return; }
    if (!customerPhone.trim()) { toast.error("يرجى إدخال رقم الهاتف"); return; }
    if (!validateYemeniPhone(customerPhone)) { toast.error("صيغة رقم الهاتف غير صحيحة"); return; }
    if (!productCode.trim()) { toast.error("يرجى إدخال رمز المنتج"); return; }
    if (!source) { toast.error("يرجى تحديد مصدر العميل"); return; }
    if (paidAmount > 0 && !receiptFile) { toast.error("يرجى إرفاق صورة الإيصال عند وجود دفعة"); return; }
    if (!user?.id) return;

    setLoading(true);

    let receiptUrl = "";
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (uploadError) { toast.error("فشل رفع صورة الإيصال"); setLoading(false); return; }
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      receiptUrl = urlData.publicUrl;
    }

    const notesContent = `رمز المنتج: ${productCode}\nالمصدر: ${SOURCES.find(s => s.value === source)?.label || source}\nالتاريخ: ${date}${paidAmount > 0 ? `\nمبلغ مدفوع: ${paidAmount}` : ""}${receiptUrl ? `\nإيصال: ${receiptUrl}` : ""}`;

    const { data: row, error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: customerName,
      phone: customerPhone.replace(/\D/g, ""),
      email: "",
      city,
      address: "",
      notes: notesContent,
      source,
      added_by_id: user.id,
      added_by_name: user.username || user.email,
    }).select().single();

    if (error) { toast.error("فشل حفظ البيانات: " + error.message); setLoading(false); return; }

    // Save payment with receipt if paid
    if (paidAmount > 0 && receiptUrl) {
      await supabase.from("payments").insert({
        user_id: user.id,
        customer_id: row.id,
        customer_name: customerName,
        amount: paidAmount,
        method: "transfer",
        date,
        notes: `دفعة من المندوب ${user.username || user.email}`,
        receipt_url: receiptUrl,
      });
    }

    // Send notification to admin (internal)
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "custom",
      recipient_name: "المدير",
      recipient_phone: "",
      message: `المندوب ${user.username || user.email} أضاف عميل جديد: ${customerName} (${customerPhone}) من ${SOURCES.find(s => s.value === source)?.label || source} — رمز المنتج: ${productCode}${paidAmount > 0 ? ` — مبلغ مدفوع: ${paidAmount}` : ""}`,
      status: "sent",
    });

    // Call Edge Function to send email to admin
    supabase.functions.invoke("notify-admin", {
      body: {
        customerName,
        customerPhone: customerPhone.replace(/\D/g, ""),
        source,
        repName: user.username || user.email,
        repEmail: user.email,
      },
    }).catch((err) => console.error("Edge function error:", err));

    toast.success("تم حفظ بيانات العميل وإبلاغ المدير بنجاح");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);

    // Reset form
    setCustomerName(""); setCustomerPhone(""); setCity(""); setProductCode("");
    setSource("whatsapp"); setDate(new Date().toISOString().split("T")[0]);
    setPaidAmount(0); setReceiptFile(null); setReceiptPreview(null);
    setLoading(false);
    loadEntries();
    loadStats();
  };

  return (
    <div className="min-h-screen bg-cream/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-light">
              {user?.username?.charAt(0) || "م"}
            </div>
            <div>
              <p className="text-sm font-bold">{user?.username || "المندوب"}</p>
              <p className="text-[10px] text-white/50">مندوب مبيعات</p>
            </div>
          </div>
          <button onClick={logout}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition-colors">
            خروج
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          <button onClick={() => setActiveTab("form")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${activeTab === "form" ? "bg-navy text-white" : "text-gray-500 hover:text-navy"}`}>
            <UserPlus className="size-4" /> إدخال بيانات
          </button>
          <button onClick={() => setActiveTab("stats")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${activeTab === "stats" ? "bg-navy text-white" : "text-gray-500 hover:text-navy"}`}>
            <BarChart3 className="size-4" /> إحصائياتي
          </button>
        </div>

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="space-y-4 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center">
                <div className="flex size-10 mx-auto items-center justify-center rounded-xl bg-blue-50 mb-2">
                  <Users className="size-5 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-navy tabular-nums">{stats.thisMonth}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">هذا الشهر</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center">
                <div className="flex size-10 mx-auto items-center justify-center rounded-xl bg-emerald-50 mb-2">
                  <TrendingUp className="size-5 text-emerald-600" />
                </div>
                <p className="text-xl font-bold text-navy tabular-nums">{stats.total}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">الإجمالي</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center">
                <div className="flex size-10 mx-auto items-center justify-center rounded-xl bg-gold/10 mb-2">
                  <Package className="size-5 text-gold-dark" />
                </div>
                <p className="text-lg font-bold text-navy tabular-nums">{stats.commissions > 0 ? stats.commissions.toLocaleString("ar-SA") : "0"}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">عمولات معلقة</p>
              </div>
            </div>

            {/* Weekly Chart */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-4">العملاء المضافين هذا الأسبوع</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      labelStyle={{ fontWeight: 600 }} />
                    <Bar dataKey="عملاء" fill="#1B2A4A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Entries in Stats */}
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="border-b px-5 py-4">
                <h3 className="text-sm font-bold text-navy">آخر الإدخالات ({entries.length})</h3>
              </div>
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {entries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                      {entry.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{entry.customerName}</p>
                      <p className="text-[10px] text-gray-400">{entry.city || "—"} · {entry.productCode}</p>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                        {SOURCES.find(s => s.value === entry.source)?.label || entry.source}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="py-12 text-center">
                    <MessageSquare className="size-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">لم تقم بإدخال أي عميل بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Tab */}
        {activeTab === "form" && (
          <div className="space-y-4 animate-fade-in">
            {/* Success banner */}
            {showSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                <CheckCircle className="size-6 text-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">تم الحفظ بنجاح!</p>
                  <p className="text-xs text-emerald-600">تم إبلاغ المدير تلقائياً عبر البريد والنظام</p>
                </div>
              </div>
            )}

            {/* Entry Form */}
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-bold text-navy flex items-center gap-2">
                  <UserPlus className="size-5 text-gold" /> إدخال بيانات عميل جديد
                </h2>
                <p className="text-xs text-gray-400 mt-1">أدخل بيانات العميل وسيتم إبلاغ المدير تلقائياً عبر البريد الإلكتروني</p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">اسم العميل *</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="الاسم الكامل" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">رقم الهاتف *</label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="+967 7xx xxx xxx" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">المحافظة</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
                    <option value="">اختر المحافظة</option>
                    {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">رمز المنتج *</label>
                  <input value={productCode} onChange={(e) => setProductCode(e.target.value)} dir="ltr"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="مثال: RM-812" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">مصدر العميل * (إلزامي)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SOURCES.map((s) => (
                      <button key={s.value} onClick={() => setSource(s.value)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${
                          source === s.value ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gray-300"
                        }`}>
                        <span className="text-lg">{s.icon}</span>
                        <span className={`text-xs font-semibold ${source === s.value ? "text-navy" : "text-gray-500"}`}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">التاريخ *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">المبلغ المدفوع (اختياري)</label>
                  <input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="0" />
                </div>

                {paidAmount > 0 && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      صورة الإيصال / سند الحوالة * <span className="text-red-500">(إلزامي)</span>
                    </label>
                    {receiptPreview ? (
                      <div className="relative rounded-xl border border-gray-200 overflow-hidden">
                        <img src={receiptPreview} alt="الإيصال" className="w-full h-48 object-cover" />
                        <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                          className="absolute top-2 left-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg hover:bg-red-600">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 cursor-pointer hover:border-gold hover:bg-gold/5 transition-colors">
                        <ImagePlus className="size-10 text-gray-400" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-600">اضغط لرفع صورة الإيصال</p>
                          <p className="text-xs text-gray-400">JPG, PNG — حد أقصى 5MB</p>
                        </div>
                        <input type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t bg-gray-50 px-5 py-4 rounded-b-2xl">
                <button onClick={handleSubmit} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-navy to-navy-light py-3.5 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all hover:shadow-xl disabled:opacity-60 active:scale-[0.98]">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> جاري الحفظ...
                    </span>
                  ) : (
                    <>
                      <Send className="size-4" /> حفظ وإبلاغ المدير
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
