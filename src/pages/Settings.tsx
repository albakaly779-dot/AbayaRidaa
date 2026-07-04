import { useState, useEffect, useRef } from "react";
import {
  Save, MessageCircle, Building, Shield, DollarSign,
  ToggleLeft, ToggleRight, ArrowLeftRight, Palette, Edit3, Plus, Trash2,
  Upload, Loader2, Check, FileText, Receipt as ReceiptIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore, type FixedExpense, type InvoiceTemplate, type InvoicePageSize } from "@/stores/settingsStore";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import brandLogo from "@/assets/brand-logo.png";
import { formatCurrency } from "@/lib/formatters";

export default function Settings() {
  const { user } = useAuth();
  const { settings, initializeSettings, refreshSettings, updateSettings } = useSettingsStore();
  const { logAction } = useAuditStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user?.id) initializeSettings(user.id); }, [user?.id, initializeSettings]);

  // Business
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [phone, setPhone] = useState(settings.businessPhone);
  const [address, setAddress] = useState(settings.businessAddress);
  const [sarToYer, setSarToYer] = useState(String(settings.sarToYer));
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Invoice template
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplate>(settings.invoiceTemplate);
  const [invoicePrimaryColor, setInvoicePrimaryColor] = useState(settings.invoicePrimaryColor);
  const [invoiceHeaderText, setInvoiceHeaderText] = useState(settings.invoiceHeaderText);
  const [invoiceFooterText, setInvoiceFooterText] = useState(settings.invoiceFooterText);
  const [invoiceTaxNumber, setInvoiceTaxNumber] = useState(settings.invoiceTaxNumber);
  const [invoiceTerms, setInvoiceTerms] = useState(settings.invoiceTerms);
  const [invoiceShowBarcode, setInvoiceShowBarcode] = useState(settings.invoiceShowBarcode);
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState(settings.invoiceLogoUrl);
  const [invoicePageSize, setInvoicePageSize] = useState<InvoicePageSize>(settings.invoicePageSize);
  const [invoiceShowSignature, setInvoiceShowSignature] = useState(settings.invoiceShowSignature);
  const [invoiceCopyLabel, setInvoiceCopyLabel] = useState(settings.invoiceCopyLabel);
  const [uploadingInvoiceLogo, setUploadingInvoiceLogo] = useState(false);

  // Features
  const [featureWhatsapp, setFeatureWhatsapp] = useState(settings.featureWhatsapp);
  const [featureSmsAlerts, setFeatureSmsAlerts] = useState(settings.featureSmsAlerts);
  const [featureStockAlerts, setFeatureStockAlerts] = useState(settings.featureStockAlerts);
  const [featureCommissions, setFeatureCommissions] = useState(settings.featureCommissions);
  const [featureReturns, setFeatureReturns] = useState(settings.featureReturns);
  const [featureExpenses, setFeatureExpenses] = useState(settings.featureExpenses);
  const [featureExport, setFeatureExport] = useState(settings.featureExport);

  const [saving, setSaving] = useState(false);

  // Fixed expenses
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(settings.fixedExpenses);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [newExpenseLabel, setNewExpenseLabel] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // WhatsApp templates
  const [paymentMsg, setPaymentMsg] = useState(
    "السلام عليكم {name}،\n\nنود تذكيركم بالمبلغ المستحق وقدره {amount} ر.ي.\n\nنرجو التكرم بالسداد في أقرب وقت.\n\nشكراً لكم 🌸\nرداء"
  );
  const [readyMsg, setReadyMsg] = useState(
    "السلام عليكم {name}،\n\nيسعدنا إبلاغكم أن طلبكم رقم {order} أصبح جاهزاً للتسليم.\n\nنتطلع لخدمتكم 🌸\nرداء"
  );

  useEffect(() => {
    setBusinessName(settings.businessName);
    setPhone(settings.businessPhone);
    setAddress(settings.businessAddress);
    setSarToYer(String(settings.sarToYer));
    setLogoUrl(settings.logoUrl);
    setInvoiceTemplate(settings.invoiceTemplate);
    setInvoicePrimaryColor(settings.invoicePrimaryColor);
    setInvoiceHeaderText(settings.invoiceHeaderText);
    setInvoiceFooterText(settings.invoiceFooterText);
    setInvoiceTaxNumber(settings.invoiceTaxNumber);
    setInvoiceTerms(settings.invoiceTerms);
    setInvoiceShowBarcode(settings.invoiceShowBarcode);
    setInvoiceLogoUrl(settings.invoiceLogoUrl);
    setInvoicePageSize(settings.invoicePageSize);
    setInvoiceShowSignature(settings.invoiceShowSignature);
    setInvoiceCopyLabel(settings.invoiceCopyLabel);
    setFeatureWhatsapp(settings.featureWhatsapp);
    setFeatureSmsAlerts(settings.featureSmsAlerts);
    setFeatureStockAlerts(settings.featureStockAlerts);
    setFeatureCommissions(settings.featureCommissions);
    setFeatureReturns(settings.featureReturns);
    setFeatureExpenses(settings.featureExpenses);
    setFeatureExport(settings.featureExport);
    if (settings.fixedExpenses && settings.fixedExpenses.length > 0) {
      setFixedExpenses(settings.fixedExpenses);
    }
  }, [settings]);

  const handleImageUpload = async (file: File, type: "logo" | "invoice"): Promise<string | null> => {
    if (!user?.id) return null;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2MB");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("يجب أن يكون الملف صورة (PNG/JPG)");
      return null;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/${type}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });

    if (uploadError) {
      console.error(`${type} upload error:`, uploadError);
      toast.error("فشل رفع الصورة: " + uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
    return urlData.publicUrl + `?t=${Date.now()}`; // Cache-bust query param
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const url = await handleImageUpload(file, "logo");
    if (url) {
      setLogoUrl(url);
      toast.success("تم رفع الشعار — اضغط حفظ للتأكيد");
    }
    setUploadingLogo(false);
  };

  const handleInvoiceLogoUpload = async (file: File) => {
    setUploadingInvoiceLogo(true);
    const url = await handleImageUpload(file, "invoice");
    if (url) {
      setInvoiceLogoUrl(url);
      toast.success("تم رفع شعار الفاتورة — اضغط حفظ للتأكيد");
    }
    setUploadingInvoiceLogo(false);
  };

  const handleUpdateExpense = (key: string, field: "label" | "amount", value: string | number) => {
    setFixedExpenses((prev) => prev.map((e) => e.key === key ? { ...e, [field]: value } : e));
  };

  const handleDeleteExpense = (key: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف الثابت؟")) return;
    setFixedExpenses((prev) => prev.filter((e) => e.key !== key));
    toast.info("سيتم الحذف عند الحفظ");
  };

  const handleAddExpense = () => {
    if (!newExpenseLabel.trim()) { toast.error("يرجى إدخال اسم المصروف"); return; }
    if (newExpenseAmount <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    const key = `custom_${Date.now()}`;
    setFixedExpenses((prev) => [...prev, { key, label: newExpenseLabel, amount: newExpenseAmount }]);
    setNewExpenseLabel("");
    setNewExpenseAmount(0);
    setShowAddExpense(false);
    toast.info("سيتم الحفظ عند الضغط على زر حفظ");
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const rate = parseFloat(sarToYer);
    if (!rate || rate <= 0) { toast.error("سعر الصرف غير صالح"); return; }

    setSaving(true);

    try {
      await updateSettings(user.id, {
        businessName, businessPhone: phone, businessAddress: address,
        sarToYer: rate,
        logoUrl,
        invoiceTemplate, invoicePrimaryColor, invoiceHeaderText, invoiceFooterText,
        invoiceTaxNumber, invoiceTerms, invoiceShowBarcode, invoiceLogoUrl,
        invoicePageSize, invoiceShowSignature, invoiceCopyLabel,
        featureWhatsapp, featureSmsAlerts, featureStockAlerts,
        featureCommissions, featureReturns, featureExpenses, featureExport,
        fixedExpenses,
      });
      // Force refresh from DB to ensure all components use latest values
      await refreshSettings(user.id);
      logAction(user.id, "settings_update", "settings", undefined,
        `تحديث الإعدادات: شعار + قالب فاتورة "${invoiceTemplate}" + ${fixedExpenses.length} مصروف ثابت`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير معروف";
      toast.error("فشل الحفظ: " + msg);
    }
    setSaving(false);
  };

  const totalFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const displayLogo = logoUrl || brandLogo;
  const displayInvoiceLogo = invoiceLogoUrl || logoUrl || brandLogo;

  const FeatureToggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between rounded-xl bg-cream/60 p-4 cursor-pointer hover:bg-cream/80 transition-colors"
      onClick={() => onChange(!value)}>
      <div className="flex-1 min-w-0 pe-3">
        <p className="text-sm font-semibold text-navy">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      {value ? <ToggleRight className="size-7 text-emerald-500 shrink-0" /> : <ToggleLeft className="size-7 text-gray-300 shrink-0" />}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy lg:text-2xl">الإعدادات والتحكم</h1>
        <p className="text-sm text-gray-500">التحكم الشامل في جميع ميزات النظام وتخصيص الفواتير والمصاريف</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5 space-y-6">
          {/* Business Info with Logo Upload */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-navy/10 p-2.5"><Building className="size-5 text-navy" /></div>
              <h2 className="text-base font-bold text-navy">معلومات المتجر</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">شعار المتجر</label>
                <div className="flex items-center gap-4 rounded-xl bg-cream/40 p-4">
                  <div className="relative">
                    <img src={displayLogo} alt="الشعار"
                      className="size-20 rounded-xl object-cover border-2 border-gold/30 bg-white" />
                    {uploadingLogo && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                        <Loader2 className="size-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                      className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                      className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
                      <Upload className="size-3.5" /> {uploadingLogo ? "جاري الرفع..." : logoUrl ? "تغيير الشعار" : "رفع شعار"}
                    </button>
                    <p className="mt-2 text-[10px] text-gray-500">PNG/JPG/WEBP، حد أقصى 2MB</p>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl("")}
                        className="mt-1 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700">
                        <Trash2 className="size-3" /> استعادة الشعار الافتراضي
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">اسم المتجر</label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">رقم الهاتف (+967)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  dir="ltr" placeholder="+967 7xx xxx xxx" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">العنوان</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
              </div>
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="rounded-2xl bg-gradient-to-bl from-gold/5 to-white p-6 shadow-sm border border-gold/20">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-gold/10 p-2.5"><ArrowLeftRight className="size-5 text-gold-dark" /></div>
              <h2 className="text-base font-bold text-navy">سعر الصرف</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">1 ريال سعودي = ؟ ريال يمني</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={sarToYer} onChange={(e) => setSarToYer(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-lg font-bold text-navy text-center focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 tabular-nums"
                    dir="ltr" min="1" step="1" />
                  <span className="text-sm font-semibold text-gray-500">ر.ي</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-navy/10 p-2.5"><Shield className="size-5 text-navy" /></div>
              <h2 className="text-base font-bold text-navy">الأمان</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">البريد الإلكتروني</label>
                <input value={user?.email || ""} disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500" dir="ltr" />
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          {/* Invoice Customization */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5"><FileText className="size-5 text-blue-600" /></div>
              <div>
                <h2 className="text-base font-bold text-navy">تخصيص الفواتير</h2>
                <p className="text-xs text-gray-400">قالب الفاتورة الرسمي وألوانها وشعارها وبيانات الضريبة</p>
              </div>
            </div>

            {/* Template Selector */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">قالب الفاتورة</label>
              <div className="grid grid-cols-3 gap-2">
                {(["modern", "classic", "minimal"] as InvoiceTemplate[]).map((t) => (
                  <button key={t} onClick={() => setInvoiceTemplate(t)}
                    className={`rounded-xl p-3 text-center transition-all ${
                      invoiceTemplate === t
                        ? "bg-navy text-white ring-2 ring-navy/30"
                        : "bg-cream/60 text-gray-600 hover:bg-cream"
                    }`}>
                    <div className={`mx-auto mb-2 h-12 w-full rounded ${
                      t === "modern" ? "bg-gradient-to-bl from-blue-500 to-purple-500" :
                      t === "classic" ? "bg-white border-2 border-double border-gray-700" :
                      "bg-white border border-gray-200"
                    }`} />
                    <span className="text-xs font-bold">
                      {t === "modern" ? "حديث" : t === "classic" ? "كلاسيكي" : "بسيط"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Size Selector */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">مقاس الورقة (يؤثر على الطباعة وحفظ PDF)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: "A4", label: "A4", desc: "210×297مم", w: "h-14 w-10" },
                  { value: "A5", label: "A5", desc: "148×210مم", w: "h-12 w-9" },
                  { value: "thermal80", label: "حراري 80مم", desc: "إيصالات", w: "h-14 w-6" },
                  { value: "thermal58", label: "حراري 58مم", desc: "POS", w: "h-14 w-4" },
                ] as { value: InvoicePageSize; label: string; desc: string; w: string }[]).map((s) => (
                  <button key={s.value} onClick={() => setInvoicePageSize(s.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                      invoicePageSize === s.value
                        ? "bg-navy text-white ring-2 ring-navy/30"
                        : "bg-cream/60 text-gray-600 hover:bg-cream"
                    }`}>
                    <div className={`${s.w} rounded border-2 ${invoicePageSize === s.value ? "bg-white/20 border-white" : "bg-white border-gray-300"}`} />
                    <span className="text-[11px] font-bold">{s.label}</span>
                    <span className={`text-[9px] ${invoicePageSize === s.value ? "text-white/70" : "text-gray-400"}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-gray-500">
                💡 A4 للفواتير الرسمية • A5 للفواتير المختصرة • حراري للطابعات الحرارية (POS)
              </p>
            </div>

            {/* Color & Toggles */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">اللون الرئيسي</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={invoicePrimaryColor}
                    onChange={(e) => setInvoicePrimaryColor(e.target.value)}
                    className="size-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <input value={invoicePrimaryColor} onChange={(e) => setInvoicePrimaryColor(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-gold focus:outline-none"
                    dir="ltr" placeholder="#1B2A4A" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">إظهار الباركود</label>
                <button onClick={() => setInvoiceShowBarcode(!invoiceShowBarcode)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors ${
                    invoiceShowBarcode ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                  <span className="font-semibold">{invoiceShowBarcode ? "مفعّل" : "معطّل"}</span>
                  {invoiceShowBarcode ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                </button>
              </div>
            </div>

            {/* Invoice Logo */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">شعار الفاتورة (اختياري - منفصل عن شعار المتجر)</label>
              <div className="flex items-center gap-4 rounded-xl bg-cream/40 p-4">
                <div className="relative">
                  <img src={displayInvoiceLogo} alt="شعار الفاتورة"
                    className="size-16 rounded-lg object-cover border border-gray-200 bg-white" />
                  {uploadingInvoiceLogo && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                      <Loader2 className="size-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input ref={invoiceLogoRef} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceLogoUpload(f); }}
                    className="hidden" />
                  <button onClick={() => invoiceLogoRef.current?.click()} disabled={uploadingInvoiceLogo}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Upload className="size-3.5" /> {invoiceLogoUrl ? "تغيير شعار الفاتورة" : "رفع شعار للفاتورة"}
                  </button>
                  <p className="mt-1 text-[10px] text-gray-500">إن لم يتم تحديد شعار للفاتورة، يُستخدم شعار المتجر تلقائياً</p>
                  {invoiceLogoUrl && (
                    <button onClick={() => setInvoiceLogoUrl("")}
                      className="mt-1 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700">
                      <Trash2 className="size-3" /> إزالة شعار الفاتورة
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Header/Footer Texts */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">نص الرأس (تحت اسم المتجر)</label>
                <input value={invoiceHeaderText} onChange={(e) => setInvoiceHeaderText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  placeholder="نظام إدارة المبيعات" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">نص التذييل</label>
                <input value={invoiceFooterText} onChange={(e) => setInvoiceFooterText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  placeholder="شكراً لتعاملكم معنا" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">الرقم الضريبي / السجل التجاري</label>
                <input value={invoiceTaxNumber} onChange={(e) => setInvoiceTaxNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  placeholder="مثال: 12345678 - اختياري" dir="ltr" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">تسمية النسخة (تظهر في الرأس)</label>
                  <input value={invoiceCopyLabel} onChange={(e) => setInvoiceCopyLabel(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                    placeholder="مثال: نسخة العميل / الأصل" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">توقيع المستلم</label>
                  <button onClick={() => setInvoiceShowSignature(!invoiceShowSignature)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors ${
                      invoiceShowSignature ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                    <span className="font-semibold">{invoiceShowSignature ? "يظهر في الفاتورة" : "مخفي"}</span>
                    {invoiceShowSignature ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">الشروط والأحكام (تظهر أسفل الفاتورة)</label>
                <textarea value={invoiceTerms} onChange={(e) => setInvoiceTerms(e.target.value)} rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none resize-none"
                  placeholder="مثال: لا يوجد إرجاع بعد 7 أيام من الاستلام..." />
              </div>
            </div>

            {/* Live Preview */}
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 bg-cream/20">
              <p className="mb-2 text-[10px] font-bold text-gray-500">
                معاينة مباشرة — <span className="text-emerald-600">{invoicePageSize === "A4" ? "ورقة A4 (210×297مم)" : invoicePageSize === "A5" ? "ورقة A5 (148×210مم)" : invoicePageSize === "thermal80" ? "طابعة حرارية 80مم" : "طابعة حرارية 58مم"}</span>
              </p>
              <div className="rounded-lg bg-white p-3 shadow-sm" style={{ borderInlineStart: `4px solid ${invoicePrimaryColor}` }}>
                <div className="flex items-center gap-2">
                  <img src={displayInvoiceLogo} alt="" className="size-8 rounded object-cover" />
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: invoicePrimaryColor }}>{businessName}</p>
                    <p className="text-[9px] text-gray-400">{invoiceHeaderText}</p>
                  </div>
                  {invoiceCopyLabel && (
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[8px] font-bold" style={{ color: invoicePrimaryColor }}>{invoiceCopyLabel}</span>
                  )}
                </div>
              </div>
              <a href="/invoice/preview" onClick={(e) => { e.preventDefault(); window.open("/invoice/preview", "_blank"); }}
                className="mt-2 inline-block text-[10px] font-semibold text-gold hover:text-gold-dark">
                جرّب فاتورة من صفحة الطلبات ←
              </a>
            </div>
          </div>

          {/* Editable Fixed Expenses */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-2.5"><DollarSign className="size-5 text-red-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-navy">المصاريف الثابتة الشهرية</h2>
                  <p className="text-xs text-gray-400">الرواتب والإيجار والكهرباء والإعلانات وغيرها</p>
                </div>
              </div>
              <button onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light transition-colors">
                <Plus className="size-3.5" /> إضافة
              </button>
            </div>
            <div className="space-y-2.5">
              {fixedExpenses.map((expense) => (
                <div key={expense.key} className="flex items-center gap-3 rounded-xl bg-cream/60 p-3">
                  {editingExpense === expense.key ? (
                    <>
                      <input value={expense.label} onChange={(e) => handleUpdateExpense(expense.key, "label", e.target.value)}
                        className="flex-1 rounded-lg border border-gold px-3 py-1.5 text-sm focus:border-gold-dark focus:outline-none" />
                      <input type="number" value={expense.amount}
                        onChange={(e) => handleUpdateExpense(expense.key, "amount", parseFloat(e.target.value) || 0)}
                        className="w-28 rounded-lg border border-gold px-3 py-1.5 text-sm text-left focus:border-gold-dark focus:outline-none" />
                      <button onClick={() => { setEditingExpense(null); toast.info("سيتم الحفظ عند الضغط على حفظ"); }}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                        <Check className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-gray-700">{expense.label}</span>
                      <div className="text-left">
                        <span className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(expense.amount)}</span>
                        <p className="text-[10px] text-gray-400">{formatCurrency(expense.amount, "SAR")}</p>
                      </div>
                      <button onClick={() => setEditingExpense(expense.key)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-navy transition-colors" title="تعديل">
                        <Edit3 className="size-3.5" />
                      </button>
                      <button onClick={() => handleDeleteExpense(expense.key)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="حذف">
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {showAddExpense && (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 p-3">
                  <input value={newExpenseLabel} onChange={(e) => setNewExpenseLabel(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gold focus:outline-none"
                    placeholder="اسم المصروف (مثال: إنترنت)" autoFocus />
                  <input type="number" value={newExpenseAmount || ""}
                    onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-left focus:border-gold focus:outline-none"
                    placeholder="المبلغ" />
                  <button onClick={handleAddExpense}
                    className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">
                    <Check className="size-3.5" />
                  </button>
                  <button onClick={() => { setShowAddExpense(false); setNewExpenseLabel(""); setNewExpenseAmount(0); }}
                    className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-300">
                    ✕
                  </button>
                </div>
              )}

              {fixedExpenses.length === 0 && !showAddExpense && (
                <p className="text-center text-xs text-gray-400 py-4">لا توجد مصاريف ثابتة — أضف أول مصروف</p>
              )}

              <div className="flex items-center justify-between rounded-xl bg-navy/5 p-3 border border-navy/10 mt-2">
                <span className="text-sm font-bold text-navy">الإجمالي الشهري</span>
                <div className="text-left">
                  <span className="text-sm font-bold text-navy tabular-nums">{formatCurrency(totalFixedExpenses)}</span>
                  <p className="text-[10px] text-gray-400">{formatCurrency(totalFixedExpenses, "SAR")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-purple-50 p-2.5"><Palette className="size-5 text-purple-600" /></div>
              <h2 className="text-base font-bold text-navy">التحكم في الميزات</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">تفعيل أو تعطيل ميزات النظام حسب احتياجك</p>
            <div className="space-y-2.5">
              <FeatureToggle label="رسائل الواتساب" desc="إظهار أزرار الواتساب بجانب الطلبات والعملاء" value={featureWhatsapp} onChange={setFeatureWhatsapp} />
              <FeatureToggle label="تنبيهات SMS التلقائية" desc="إرسال إشعارات تلقائية عند تغيير الحالة أو الدفع" value={featureSmsAlerts} onChange={setFeatureSmsAlerts} />
              <FeatureToggle label="تنبيهات المخزون" desc="عرض تنبيهات انخفاض المخزون في لوحة التحكم" value={featureStockAlerts} onChange={setFeatureStockAlerts} />
              <FeatureToggle label="نظام العمولات" desc="تفعيل تتبع عمولات المناديب والمسوقات" value={featureCommissions} onChange={setFeatureCommissions} />
              <FeatureToggle label="نظام المرتجعات" desc="تفعيل إدارة مرتجعات الزبائن والموردين" value={featureReturns} onChange={setFeatureReturns} />
              <FeatureToggle label="تتبع المصروفات" desc="تفعيل تسجيل ومتابعة المصروفات التشغيلية" value={featureExpenses} onChange={setFeatureExpenses} />
              <FeatureToggle label="التصدير والنسخ الاحتياطي" desc="إمكانية تصدير البيانات CSV/JSON" value={featureExport} onChange={setFeatureExport} />
            </div>
          </div>

          {/* WhatsApp Templates */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5"><MessageCircle className="size-5 text-emerald-600" /></div>
              <h2 className="text-base font-bold text-navy">قوالب رسائل الواتساب</h2>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              استخدم المتغيرات: {"{name}"} لاسم العميل، {"{amount}"} للمبلغ، {"{order}"} لرقم الطلب
            </p>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">📌 رسالة المطالبة بالسداد</label>
                <textarea value={paymentMsg} onChange={(e) => setPaymentMsg(e.target.value)} rows={5}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 resize-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">✅ رسالة جاهزية الطلب</label>
                <textarea value={readyMsg} onChange={(e) => setReadyMsg(e.target.value)} rows={5}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 resize-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Button */}
      <div className="sticky bottom-4 flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-navy px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-navy/30 transition-all hover:bg-navy-light active:scale-[0.98] disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "جاري الحفظ..." : "حفظ جميع التغييرات"}
        </button>
      </div>
    </div>
  );
}
