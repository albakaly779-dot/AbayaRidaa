import { useState, useEffect, useRef } from "react";
import {
  Save, Building, Shield, DollarSign,
  ToggleLeft, ToggleRight, ArrowLeftRight, Palette, Edit3, Plus, Trash2,
  Upload, Loader2, Check, FileText, Eye, Mail, Server, TestTube2, AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore, type FixedExpense, type InvoiceTemplate, type InvoicePageSize, type SmtpProvider, SMTP_PRESETS } from "@/stores/settingsStore";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
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

  // SMTP
  const [smtpEnabled, setSmtpEnabled] = useState(settings.smtpEnabled);
  const [smtpProvider, setSmtpProvider] = useState<SmtpProvider>(settings.smtpProvider);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost);
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser);
  const [smtpPassword, setSmtpPassword] = useState(settings.smtpPassword);
  const [smtpFromEmail, setSmtpFromEmail] = useState(settings.smtpFromEmail);
  const [smtpFromName, setSmtpFromName] = useState(settings.smtpFromName);
  const [smtpUseTls, setSmtpUseTls] = useState(settings.smtpUseTls);
  const [testEmail, setTestEmail] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

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
    setSmtpEnabled(settings.smtpEnabled);
    setSmtpProvider(settings.smtpProvider);
    setSmtpHost(settings.smtpHost);
    setSmtpPort(settings.smtpPort);
    setSmtpUser(settings.smtpUser);
    setSmtpPassword(settings.smtpPassword);
    setSmtpFromEmail(settings.smtpFromEmail);
    setSmtpFromName(settings.smtpFromName);
    setSmtpUseTls(settings.smtpUseTls);
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

  const handleProviderChange = (provider: SmtpProvider) => {
    setSmtpProvider(provider);
    if (provider !== "custom") {
      const preset = SMTP_PRESETS[provider];
      setSmtpHost(preset.host);
      setSmtpPort(preset.port);
      setSmtpUseTls(preset.useTls);
      toast.info(`تم تحميل إعدادات ${preset.label}`);
    }
  };

  const handleImageUpload = async (file: File, type: "logo" | "invoice"): Promise<string | null> => {
    if (!user?.id) return null;
    if (file.size > 2 * 1024 * 1024) { toast.error("حجم الصورة يجب أن يكون أقل من 2MB"); return null; }
    if (!file.type.startsWith("image/")) { toast.error("يجب أن يكون الملف صورة"); return null; }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/${type}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("branding").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });

    if (uploadError) { toast.error("فشل رفع الصورة: " + uploadError.message); return null; }

    const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
    return urlData.publicUrl + `?t=${Date.now()}`;
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const url = await handleImageUpload(file, "logo");
    if (url) { setLogoUrl(url); toast.success("تم رفع الشعار — اضغط حفظ للتأكيد"); }
    setUploadingLogo(false);
  };

  const handleInvoiceLogoUpload = async (file: File) => {
    setUploadingInvoiceLogo(true);
    const url = await handleImageUpload(file, "invoice");
    if (url) { setInvoiceLogoUrl(url); toast.success("تم رفع شعار الفاتورة"); }
    setUploadingInvoiceLogo(false);
  };

  const handleTestSmtp = async () => {
    if (!testEmail || !testEmail.includes("@")) { toast.error("أدخل إيميل صحيح للاختبار"); return; }
    if (!smtpHost || !smtpUser) { toast.error("أكمل بيانات SMTP أولاً"); return; }

    setTestingSmtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: "🧪 اختبار SMTP - نظام رداء",
          html: `<div dir="rtl" style="font-family:Cairo,Arial;padding:20px;background:#f8f6f0;border-radius:10px">
            <h2 style="color:#1a2332">✅ نجح اختبار SMTP</h2>
            <p>هذا إيميل اختبار من نظام رداء لإدارة المبيعات.</p>
            <p>إذا وصلك هذا الإيميل، فإن إعدادات SMTP تعمل بشكل صحيح ويمكن الآن إرسال بيانات دخول المستخدمين تلقائياً.</p>
            <p style="color:#c9a84c;font-weight:bold">🌸 رداء</p>
          </div>`,
          text: "اختبار SMTP - إذا وصلك هذا الإيميل، فإن إعدادات SMTP تعمل بشكل صحيح.",
          testMode: true,
          smtpConfig: {
            host: smtpHost, port: smtpPort, user: smtpUser, password: smtpPassword,
            fromEmail: smtpFromEmail || smtpUser, fromName: smtpFromName, useTls: smtpUseTls,
          },
        },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errMsg = await error.context?.text() || errMsg; } catch { /* ignore */ }
        }
        toast.error("فشل الاختبار: " + errMsg);
      } else if (data?.success) {
        toast.success(`✅ تم إرسال الإيميل الاختباري إلى ${testEmail}`);
      } else {
        toast.error("فشل: " + (data?.error || "خطأ غير معروف"));
      }
    } catch (err) {
      toast.error("خطأ: " + (err instanceof Error ? err.message : "غير معروف"));
    }
    setTestingSmtp(false);
  };

  const handleUpdateExpense = (key: string, field: "label" | "amount", value: string | number) => {
    setFixedExpenses((prev) => prev.map((e) => e.key === key ? { ...e, [field]: value } : e));
  };

  const handleDeleteExpense = (key: string) => {
    if (!confirm("حذف هذا المصروف؟")) return;
    setFixedExpenses((prev) => prev.filter((e) => e.key !== key));
    toast.info("سيتم الحذف عند الحفظ");
  };

  const handleAddExpense = () => {
    if (!newExpenseLabel.trim()) { toast.error("أدخل اسم المصروف"); return; }
    if (newExpenseAmount <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    setFixedExpenses((prev) => [...prev, { key: `custom_${Date.now()}`, label: newExpenseLabel, amount: newExpenseAmount }]);
    setNewExpenseLabel(""); setNewExpenseAmount(0); setShowAddExpense(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const rate = parseFloat(sarToYer);
    if (!rate || rate <= 0) { toast.error("سعر الصرف غير صالح"); return; }

    setSaving(true);
    try {
      await updateSettings(user.id, {
        businessName, businessPhone: phone, businessAddress: address, sarToYer: rate, logoUrl,
        invoiceTemplate, invoicePrimaryColor, invoiceHeaderText, invoiceFooterText,
        invoiceTaxNumber, invoiceTerms, invoiceShowBarcode, invoiceLogoUrl,
        invoicePageSize, invoiceShowSignature, invoiceCopyLabel,
        smtpEnabled, smtpProvider, smtpHost, smtpPort, smtpUser, smtpPassword,
        smtpFromEmail, smtpFromName, smtpUseTls,
        featureWhatsapp, featureSmsAlerts, featureStockAlerts, featureCommissions,
        featureReturns, featureExpenses, featureExport, fixedExpenses,
      });
      await refreshSettings(user.id);
      logAction(user.id, "settings_update", "settings", undefined, `تحديث شامل: SMTP=${smtpEnabled ? "مفعل" : "معطل"} · فاتورة "${invoiceTemplate}"`);
    } catch (err) {
      toast.error("فشل الحفظ: " + (err instanceof Error ? err.message : "خطأ"));
    }
    setSaving(false);
  };

  const totalFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const displayLogo = logoUrl || brandLogo;
  const displayInvoiceLogo = invoiceLogoUrl || logoUrl || brandLogo;

  const FeatureToggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between rounded-xl bg-cream/60 p-4 cursor-pointer hover:bg-cream/80" onClick={() => onChange(!value)}>
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
        <p className="text-sm text-gray-500">التحكم الشامل في جميع ميزات النظام: الفواتير، البريد، المصاريف، والصلاحيات</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5 space-y-6">
          {/* Business Info */}
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
                    <img src={displayLogo} alt="الشعار" className="size-20 rounded-xl object-cover border-2 border-gold/30 bg-white" />
                    {uploadingLogo && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                        <Loader2 className="size-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                      className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-light disabled:opacity-50">
                      <Upload className="size-3.5" /> {uploadingLogo ? "جاري الرفع..." : logoUrl ? "تغيير الشعار" : "رفع شعار"}
                    </button>
                    <p className="mt-2 text-[10px] text-gray-500">PNG/JPG/WEBP، حد أقصى 2MB</p>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl("")} className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">العنوان</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="rounded-2xl bg-gradient-to-bl from-gold/5 to-white p-6 shadow-sm border border-gold/20">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-gold/10 p-2.5"><ArrowLeftRight className="size-5 text-gold-dark" /></div>
              <h2 className="text-base font-bold text-navy">سعر الصرف</h2>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">1 ريال سعودي = ؟ ريال يمني</label>
              <div className="flex items-center gap-3">
                <input type="number" value={sarToYer} onChange={(e) => setSarToYer(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-lg font-bold text-navy text-center focus:border-gold tabular-nums"
                  dir="ltr" min="1" step="1" />
                <span className="text-sm font-semibold text-gray-500">ر.ي</span>
              </div>
            </div>
          </div>

          {/* SMTP Settings */}
          <div className="rounded-2xl bg-gradient-to-bl from-blue-50 to-white p-6 shadow-sm border-2 border-blue-200">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2.5"><Server className="size-5 text-blue-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-navy">إعدادات SMTP للبريد</h2>
                  <p className="text-xs text-gray-400">لإرسال بيانات دخول المستخدمين تلقائياً</p>
                </div>
              </div>
              <button onClick={() => setSmtpEnabled(!smtpEnabled)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  smtpEnabled ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                {smtpEnabled ? "✓ مفعّل" : "معطّل"}
              </button>
            </div>

            {smtpEnabled && (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-bold text-gray-700">مزوّد البريد</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(SMTP_PRESETS) as [SmtpProvider, typeof SMTP_PRESETS[SmtpProvider]][]).map(([key, preset]) => (
                      <button key={key} onClick={() => handleProviderChange(key)}
                        className={`rounded-lg p-2 text-[11px] font-bold transition-colors ${
                          smtpProvider === key ? "bg-navy text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-cream/50"
                        }`}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {smtpProvider !== "custom" && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                      <p className="text-[10px] text-amber-800 flex items-start gap-1.5">
                        <AlertCircle className="size-3 shrink-0 mt-0.5" />
                        {SMTP_PRESETS[smtpProvider].note}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">SMTP Host</label>
                    <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      placeholder="smtp.gmail.com" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">Port</label>
                    <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none tabular-nums"
                      dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">المستخدم (Username)</label>
                    <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      placeholder="your@email.com" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">
                      كلمة المرور / API Key
                      <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="ms-2 text-blue-500 hover:underline text-[9px]">
                        {showSmtpPass ? "إخفاء" : "إظهار"}
                      </button>
                    </label>
                    <input type={showSmtpPass ? "text" : "password"} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">من (البريد الظاهر)</label>
                    <input value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      placeholder="اتركه فارغاً لاستخدام Username" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-gray-700">اسم المرسل</label>
                    <input value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      placeholder="رداء" />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={smtpUseTls} onChange={(e) => setSmtpUseTls(e.target.checked)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                  <span className="text-xs text-gray-700 font-semibold">استخدام TLS/SSL (موصى به)</span>
                </label>

                <div className="mt-4 rounded-xl bg-white p-3 border border-gray-200">
                  <label className="mb-2 block text-[11px] font-bold text-gray-700">اختبار الإعدادات — أرسل إيميل تجريبي</label>
                  <div className="flex gap-2">
                    <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      placeholder="أدخل إيميل للاختبار" dir="ltr" />
                    <button onClick={handleTestSmtp} disabled={testingSmtp || !smtpHost}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {testingSmtp ? <Loader2 className="size-3.5 animate-spin" /> : <TestTube2 className="size-3.5" />}
                      اختبار
                    </button>
                  </div>
                  <p className="mt-1.5 text-[9px] text-gray-500">
                    💡 يستخدم الاختبار البيانات الحالية في النموذج (حتى قبل الحفظ)
                  </p>
                </div>
              </>
            )}

            {!smtpEnabled && (
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <Mail className="mx-auto size-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-semibold">فعّل SMTP لإرسال إيميلات فعلية للمستخدمين</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  عند التفعيل، ستصل بيانات الدخول للمستخدمين الجدد تلقائياً عبر البريد
                </p>
              </div>
            )}
          </div>

          {/* Security */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-navy/10 p-2.5"><Shield className="size-5 text-navy" /></div>
              <h2 className="text-base font-bold text-navy">الأمان</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">البريد الإلكتروني</label>
                <input value={user?.email || ""} disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500" dir="ltr" />
              </div>
              <Link to="/change-password"
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors">
                🔑 تغيير كلمة المرور
              </Link>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          {/* Invoice Customization */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5"><FileText className="size-5 text-blue-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-navy">تخصيص الفواتير</h2>
                  <p className="text-xs text-gray-400">قالب، ألوان، شعار، مقاس، وبيانات الضريبة</p>
                </div>
              </div>
              <Link to="/invoice-preview" target="_blank"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-600 shadow-md">
                <Eye className="size-3.5" /> معاينة مباشرة
              </Link>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">قالب الفاتورة</label>
              <div className="grid grid-cols-3 gap-2">
                {(["modern", "classic", "minimal"] as InvoiceTemplate[]).map((t) => (
                  <button key={t} onClick={() => setInvoiceTemplate(t)}
                    className={`rounded-xl p-3 text-center transition-all ${
                      invoiceTemplate === t ? "bg-navy text-white ring-2 ring-navy/30" : "bg-cream/60 text-gray-600 hover:bg-cream"
                    }`}>
                    <div className={`mx-auto mb-2 h-12 w-full rounded ${
                      t === "modern" ? "bg-gradient-to-bl from-blue-500 to-purple-500" :
                      t === "classic" ? "bg-white border-2 border-double border-gray-700" :
                      "bg-white border border-gray-200"
                    }`} />
                    <span className="text-xs font-bold">{t === "modern" ? "حديث" : t === "classic" ? "كلاسيكي" : "بسيط"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">مقاس الورقة</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: "A4", label: "A4", desc: "210×297مم", w: "h-14 w-10" },
                  { value: "A5", label: "A5", desc: "148×210مم", w: "h-12 w-9" },
                  { value: "thermal80", label: "حراري 80مم", desc: "إيصالات", w: "h-14 w-6" },
                  { value: "thermal58", label: "حراري 58مم", desc: "POS", w: "h-14 w-4" },
                ] as { value: InvoicePageSize; label: string; desc: string; w: string }[]).map((s) => (
                  <button key={s.value} onClick={() => setInvoicePageSize(s.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                      invoicePageSize === s.value ? "bg-navy text-white ring-2 ring-navy/30" : "bg-cream/60 text-gray-600 hover:bg-cream"
                    }`}>
                    <div className={`${s.w} rounded border-2 ${invoicePageSize === s.value ? "bg-white/20 border-white" : "bg-white border-gray-300"}`} />
                    <span className="text-[11px] font-bold">{s.label}</span>
                    <span className={`text-[9px] ${invoicePageSize === s.value ? "text-white/70" : "text-gray-400"}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">اللون الرئيسي</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={invoicePrimaryColor} onChange={(e) => setInvoicePrimaryColor(e.target.value)}
                    className="size-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <input value={invoicePrimaryColor} onChange={(e) => setInvoicePrimaryColor(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">إظهار الباركود</label>
                <button onClick={() => setInvoiceShowBarcode(!invoiceShowBarcode)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                    invoiceShowBarcode ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                  <span className="font-semibold">{invoiceShowBarcode ? "مفعّل" : "معطّل"}</span>
                  {invoiceShowBarcode ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">شعار الفاتورة (اختياري)</label>
              <div className="flex items-center gap-4 rounded-xl bg-cream/40 p-4">
                <div className="relative">
                  <img src={displayInvoiceLogo} alt="شعار الفاتورة" className="size-16 rounded-lg object-cover border border-gray-200 bg-white" />
                  {uploadingInvoiceLogo && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                      <Loader2 className="size-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input ref={invoiceLogoRef} type="file" accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceLogoUpload(f); }} className="hidden" />
                  <button onClick={() => invoiceLogoRef.current?.click()} disabled={uploadingInvoiceLogo}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Upload className="size-3.5" /> {invoiceLogoUrl ? "تغيير شعار الفاتورة" : "رفع شعار للفاتورة"}
                  </button>
                  {invoiceLogoUrl && (
                    <button onClick={() => setInvoiceLogoUrl("")} className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
                      <Trash2 className="size-3" /> إزالة
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">نص الرأس</label>
                <input value={invoiceHeaderText} onChange={(e) => setInvoiceHeaderText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">نص التذييل</label>
                <input value={invoiceFooterText} onChange={(e) => setInvoiceFooterText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">الرقم الضريبي</label>
                <input value={invoiceTaxNumber} onChange={(e) => setInvoiceTaxNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" dir="ltr" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">تسمية النسخة</label>
                  <input value={invoiceCopyLabel} onChange={(e) => setInvoiceCopyLabel(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">توقيع المستلم</label>
                  <button onClick={() => setInvoiceShowSignature(!invoiceShowSignature)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                      invoiceShowSignature ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                    <span className="font-semibold">{invoiceShowSignature ? "يظهر" : "مخفي"}</span>
                    {invoiceShowSignature ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">الشروط والأحكام</label>
                <textarea value={invoiceTerms} onChange={(e) => setInvoiceTerms(e.target.value)} rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none" />
              </div>
            </div>

            <Link to="/invoice-preview" target="_blank"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 p-3 text-white font-bold shadow-md hover:shadow-lg transition-shadow">
              <Eye className="size-4" />
              <span className="text-sm">افتح المعاينة المباشرة للفاتورة</span>
            </Link>
          </div>

          {/* Fixed Expenses */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-2.5"><DollarSign className="size-5 text-red-600" /></div>
                <h2 className="text-base font-bold text-navy">المصاريف الثابتة الشهرية</h2>
              </div>
              <button onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-light">
                <Plus className="size-3.5" /> إضافة
              </button>
            </div>
            <div className="space-y-2.5">
              {fixedExpenses.map((expense) => (
                <div key={expense.key} className="flex items-center gap-3 rounded-xl bg-cream/60 p-3">
                  {editingExpense === expense.key ? (
                    <>
                      <input value={expense.label} onChange={(e) => handleUpdateExpense(expense.key, "label", e.target.value)}
                        className="flex-1 rounded-lg border border-gold px-3 py-1.5 text-sm" />
                      <input type="number" value={expense.amount}
                        onChange={(e) => handleUpdateExpense(expense.key, "amount", parseFloat(e.target.value) || 0)}
                        className="w-28 rounded-lg border border-gold px-3 py-1.5 text-sm text-left" />
                      <button onClick={() => setEditingExpense(null)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
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
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200"><Edit3 className="size-3.5" /></button>
                      <button onClick={() => handleDeleteExpense(expense.key)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
              {showAddExpense && (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 p-3">
                  <input value={newExpenseLabel} onChange={(e) => setNewExpenseLabel(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" placeholder="اسم المصروف" autoFocus />
                  <input type="number" value={newExpenseAmount || ""} onChange={(e) => setNewExpenseAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-left" placeholder="المبلغ" />
                  <button onClick={handleAddExpense}
                    className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white"><Check className="size-3.5" /></button>
                  <button onClick={() => { setShowAddExpense(false); setNewExpenseLabel(""); setNewExpenseAmount(0); }}
                    className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-navy/5 p-3 border border-navy/10 mt-2">
                <span className="text-sm font-bold text-navy">الإجمالي الشهري</span>
                <span className="text-sm font-bold text-navy tabular-nums">{formatCurrency(totalFixedExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-purple-50 p-2.5"><Palette className="size-5 text-purple-600" /></div>
              <h2 className="text-base font-bold text-navy">التحكم في الميزات</h2>
            </div>
            <div className="space-y-2.5">
              <FeatureToggle label="رسائل الواتساب" desc="إظهار أزرار الواتساب" value={featureWhatsapp} onChange={setFeatureWhatsapp} />
              <FeatureToggle label="تنبيهات SMS التلقائية" desc="إرسال إشعارات تلقائية" value={featureSmsAlerts} onChange={setFeatureSmsAlerts} />
              <FeatureToggle label="تنبيهات المخزون" desc="تنبيهات انخفاض المخزون" value={featureStockAlerts} onChange={setFeatureStockAlerts} />
              <FeatureToggle label="نظام العمولات" desc="تتبع عمولات المناديب" value={featureCommissions} onChange={setFeatureCommissions} />
              <FeatureToggle label="نظام المرتجعات" desc="إدارة المرتجعات" value={featureReturns} onChange={setFeatureReturns} />
              <FeatureToggle label="تتبع المصروفات" desc="تسجيل ومتابعة المصروفات" value={featureExpenses} onChange={setFeatureExpenses} />
              <FeatureToggle label="التصدير" desc="تصدير البيانات CSV/JSON" value={featureExport} onChange={setFeatureExport} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Button */}
      <div className="sticky bottom-4 flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-navy px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-navy/30 hover:bg-navy-light active:scale-[0.98] disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "جاري الحفظ..." : "حفظ جميع التغييرات"}
        </button>
      </div>
    </div>
  );
}
