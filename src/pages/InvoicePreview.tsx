import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Ruler, Palette, FileText, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore, type InvoicePageSize, type InvoiceTemplate } from "@/stores/settingsStore";
import { formatCurrency, formatDate, formatPhone } from "@/lib/formatters";
import brandLogo from "@/assets/brand-logo.png";

const PAGE_DIMENSIONS = {
  A4: { width: "210mm", minHeight: "297mm", label: "A4 (210×297مم)" },
  A5: { width: "148mm", minHeight: "210mm", label: "A5 (148×210مم)" },
  thermal80: { width: "80mm", minHeight: "auto", label: "حراري 80مم" },
  thermal58: { width: "58mm", minHeight: "auto", label: "حراري 58مم" },
} as const;

// Sample data for preview
const SAMPLE_ORDER = {
  orderNumber: "ORD-PREVIEW-001",
  createdAt: new Date().toISOString(),
  customerName: "أميرة محمد الحضرمي",
  customerPhone: "967771234567",
  status: "confirmed",
  paymentStatus: "partial",
  dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  repName: "سارة عبدالله",
  subtotal: 24000,
  discount: 2000,
  total: 22000,
  paid: 15000,
  remaining: 7000,
  notes: "التسليم في المنزل — الاتصال قبل الوصول",
  items: [
    { id: "1", productCode: "AB-001", productName: "عباية سوداء كلاسيكية بتطريز يدوي", quantity: 1, unitPrice: 12000, total: 12000 },
    { id: "2", productCode: "AB-045", productName: "طرحة حرير فاخرة", quantity: 2, unitPrice: 3000, total: 6000 },
    { id: "3", productCode: "AC-102", productName: "بروش ذهبي مطلي", quantity: 1, unitPrice: 6000, total: 6000 },
  ],
};

const SAMPLE_CUSTOMER = {
  address: "حي السلام، شارع الزبيري",
  city: "صنعاء",
};

export default function InvoicePreview() {
  const { user } = useAuth();
  const { settings, initializeSettings, refreshSettings } = useSettingsStore();
  const [previewSize, setPreviewSize] = useState<InvoicePageSize>(settings.invoicePageSize);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate>(settings.invoiceTemplate);

  useEffect(() => { if (user?.id) initializeSettings(user.id); }, [user?.id, initializeSettings]);
  useEffect(() => {
    setPreviewSize(settings.invoicePageSize);
    setPreviewTemplate(settings.invoiceTemplate);
  }, [settings.invoicePageSize, settings.invoiceTemplate]);

  const dims = PAGE_DIMENSIONS[previewSize];
  const isThermal = previewSize === "thermal80" || previewSize === "thermal58";
  const isCompact = previewSize === "thermal58";
  const primary = settings.invoicePrimaryColor || "#1B2A4A";
  const businessName = settings.businessName || "رداء";
  const displayLogo = settings.invoiceLogoUrl || settings.logoUrl || brandLogo;

  const generateBarcode = (text: string) => {
    const bars: string[] = [];
    let x = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const w1 = (code % 3) + 1;
      const w2 = ((code >> 2) % 2) + 1;
      bars.push(`<rect x="${x}" y="0" width="${w1}" height="40" fill="${primary}"/>`);
      x += w1 + w2;
      bars.push(`<rect x="${x}" y="0" width="${w2}" height="40" fill="${primary}"/>`);
      x += w2 + 1;
    }
    return `<svg viewBox="0 0 ${x + 10} 50" xmlns="http://www.w3.org/2000/svg">${bars.join("")}<text x="${(x + 10) / 2}" y="48" text-anchor="middle" font-size="7" font-family="monospace" fill="${primary}">${text}</text></svg>`;
  };

  const barcodeHtml = useMemo(() => generateBarcode(SAMPLE_ORDER.orderNumber), [primary]);

  const isModern = previewTemplate === "modern";
  const headerStyle = previewTemplate === "modern"
    ? { background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`, color: "white" }
    : previewTemplate === "classic"
    ? { borderBottom: `4px double ${primary}`, paddingBottom: isThermal ? "0.5rem" : "1.5rem" }
    : { borderBottom: `1px solid ${primary}33`, paddingBottom: isThermal ? "0.4rem" : "1rem" };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/settings" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy mb-2">
            <ArrowLeft className="size-4" /> العودة للإعدادات
          </Link>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
            <Sparkles className="size-5 text-gold" /> معاينة مباشرة للفاتورة
          </h1>
          <p className="text-xs text-gray-500 sm:text-sm">أي تعديل في الإعدادات يظهر هنا فورياً — بيانات تجريبية للاختبار</p>
        </div>
        <button onClick={() => user?.id && refreshSettings(user.id)}
          className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-light shadow-md">
          <RefreshCw className="size-3.5" /> تحديث من الإعدادات
        </button>
      </div>

      {/* Live control bar */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="size-4 text-gold" />
          <h3 className="text-sm font-bold text-navy">عناصر التحكم السريعة</h3>
          <span className="text-[10px] text-gray-400 mr-auto">للتعديل الدائم، اذهب لصفحة الإعدادات</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Page size */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5">
              <Ruler className="inline size-3 me-1" /> مقاس الورقة
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(PAGE_DIMENSIONS) as [InvoicePageSize, typeof PAGE_DIMENSIONS[InvoicePageSize]][]).map(([key, val]) => (
                <button key={key} onClick={() => setPreviewSize(key)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    previewSize === key ? "bg-navy text-white shadow-md" : "bg-cream/60 text-gray-600 hover:bg-cream"
                  }`}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1.5">
              <FileText className="inline size-3 me-1" /> قالب التصميم
            </label>
            <div className="flex gap-1.5">
              {(["modern", "classic", "minimal"] as InvoiceTemplate[]).map((t) => (
                <button key={t} onClick={() => setPreviewTemplate(t)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    previewTemplate === t ? "bg-navy text-white shadow-md" : "bg-cream/60 text-gray-600 hover:bg-cream"
                  }`}>
                  {t === "modern" ? "حديث" : t === "classic" ? "كلاسيكي" : "بسيط"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current settings display */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-[10px] flex-wrap">
          <span className="flex items-center gap-1">
            <Palette className="size-3 text-gray-400" />
            <span className="text-gray-500">اللون:</span>
            <span className="size-4 rounded" style={{ background: primary }} />
            <span className="font-mono text-gray-600">{primary}</span>
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">الشعار: {settings.invoiceLogoUrl ? "شعار مخصص" : "شعار المتجر"}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">الباركود: {settings.invoiceShowBarcode ? "مفعّل" : "معطّل"}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">التوقيع: {settings.invoiceShowSignature ? "مفعّل" : "معطّل"}</span>
        </div>
      </div>

      {/* Preview area */}
      <div className="rounded-2xl bg-gray-100 p-4 sm:p-6 border-2 border-dashed border-gray-300 overflow-auto">
        <div className="text-center mb-3">
          <span className="inline-block rounded-full bg-yellow-100 border border-yellow-300 px-3 py-1 text-[10px] font-bold text-yellow-800">
            📄 معاينة — {dims.label} — البيانات تجريبية
          </span>
        </div>

        <div className="mx-auto bg-white shadow-2xl border border-gray-200"
          style={{
            width: dims.width,
            minHeight: dims.minHeight,
            maxWidth: "100%",
            padding: isThermal ? "8px" : "32px",
            fontSize: isCompact ? "10px" : isThermal ? "11px" : "14px",
          }}>
          {/* Header */}
          <div className={`${isModern ? "rounded-2xl mb-4" : "mb-4"}`}
            style={{ ...(isModern ? { ...headerStyle, padding: isThermal ? "8px" : "24px" } : headerStyle) }}>
            {isThermal ? (
              <div className="text-center">
                <img src={displayLogo} alt={businessName} className="mx-auto mb-1 size-12 rounded object-cover bg-white" />
                <h1 className={`font-bold ${isModern ? "text-white" : ""}`} style={{ color: isModern ? "white" : primary, fontSize: isCompact ? "13px" : "16px" }}>
                  {businessName}
                </h1>
                {settings.businessPhone && (
                  <p className={`${isModern ? "text-white/80" : "text-gray-500"}`} dir="ltr" style={{ fontSize: isCompact ? "8px" : "9px" }}>
                    {formatPhone(settings.businessPhone)}
                  </p>
                )}
                {settings.invoiceTaxNumber && (
                  <p className={isModern ? "text-white/60" : "text-gray-400"} style={{ fontSize: isCompact ? "7px" : "8px" }}>
                    ر.ض: {settings.invoiceTaxNumber}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img src={displayLogo} alt={businessName}
                    className={`size-16 rounded-xl object-cover bg-white ${isModern ? "ring-2 ring-white/30" : ""}`} />
                  <div>
                    <h1 className={`text-2xl font-bold ${isModern ? "text-white" : ""}`} style={isModern ? {} : { color: primary }}>{businessName}</h1>
                    <p className={`text-sm ${isModern ? "text-white/80" : "text-gray-500"}`}>{settings.invoiceHeaderText || "نظام إدارة المبيعات"}</p>
                    {settings.businessAddress && (
                      <p className={`text-xs mt-0.5 ${isModern ? "text-white/60" : "text-gray-400"}`}>{settings.businessAddress}</p>
                    )}
                    {settings.businessPhone && (
                      <p className={`text-xs ${isModern ? "text-white/60" : "text-gray-400"}`} dir="ltr">{formatPhone(settings.businessPhone)}</p>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  {settings.invoiceCopyLabel && (
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold mb-1 ${isModern ? "bg-white/20 text-white" : "bg-cream text-gray-600"}`}>
                      {settings.invoiceCopyLabel}
                    </span>
                  )}
                  <h2 className={`text-lg font-bold ${isModern ? "text-white" : ""}`} style={isModern ? {} : { color: primary }}>فاتورة مبيعات</h2>
                  <p className={`text-sm ${isModern ? "text-white/80" : "text-gray-500"}`} dir="ltr">{SAMPLE_ORDER.orderNumber}</p>
                  <p className={`text-xs mt-1 ${isModern ? "text-white/60" : "text-gray-400"}`}>{formatDate(SAMPLE_ORDER.createdAt)}</p>
                  {settings.invoiceTaxNumber && (
                    <p className={`text-[10px] mt-1 ${isModern ? "text-white/60" : "text-gray-400"}`}>الرقم الضريبي: {settings.invoiceTaxNumber}</p>
                  )}
                  {settings.invoiceShowBarcode && (
                    <div className="mt-3 w-36 bg-white rounded p-1" dangerouslySetInnerHTML={{ __html: barcodeHtml }} />
                  )}
                </div>
              </div>
            )}
          </div>

          {isThermal ? (
            <>
              <div className="text-center mb-2 py-1" style={{ borderTop: `1px dashed ${primary}`, borderBottom: `1px dashed ${primary}` }}>
                <p className="font-bold" style={{ color: primary, fontSize: isCompact ? "10px" : "11px" }}>فاتورة #{SAMPLE_ORDER.orderNumber}</p>
                <p className="text-gray-500" style={{ fontSize: isCompact ? "8px" : "9px" }}>{formatDate(SAMPLE_ORDER.createdAt)}</p>
              </div>
              <div className="mb-2" style={{ fontSize: isCompact ? "9px" : "10px" }}>
                <p><b>العميل:</b> {SAMPLE_ORDER.customerName}</p>
                <p dir="ltr">{formatPhone(SAMPLE_ORDER.customerPhone)}</p>
              </div>
              <table className="w-full mb-2" style={{ fontSize: isCompact ? "9px" : "10px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px dashed ${primary}` }}>
                    <th className="text-right py-1">صنف</th>
                    <th className="text-center">كم</th>
                    <th className="text-left">إجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ORDER.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-0.5">{item.productName.substring(0, isCompact ? 15 : 22)}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-left tabular-nums">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: `1px dashed ${primary}`, paddingTop: "4px", fontSize: isCompact ? "9px" : "10px" }}>
                <div className="flex justify-between"><span>الفرعي</span><span className="tabular-nums">{SAMPLE_ORDER.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-red-600"><span>خصم</span><span className="tabular-nums">-{SAMPLE_ORDER.discount.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold" style={{ color: primary, fontSize: isCompact ? "11px" : "12px" }}>
                  <span>الإجمالي</span><span className="tabular-nums">{SAMPLE_ORDER.total.toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-emerald-700"><span>مدفوع</span><span className="tabular-nums">{SAMPLE_ORDER.paid.toLocaleString()}</span></div>
                <div className="flex justify-between text-red-600 font-bold"><span>متبقي</span><span className="tabular-nums">{SAMPLE_ORDER.remaining.toLocaleString()}</span></div>
              </div>
              {settings.invoiceShowBarcode && (
                <div className="mt-2 flex justify-center">
                  <div className="w-full max-w-full" dangerouslySetInnerHTML={{ __html: barcodeHtml }} />
                </div>
              )}
              <p className="text-center mt-2 pt-1" style={{ color: primary, borderTop: `1px dashed ${primary}`, fontSize: isCompact ? "8px" : "9px" }}>
                {settings.invoiceFooterText || `شكراً لتعاملكم مع ${businessName}`}
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl bg-cream/60 p-4" style={{ borderInlineStart: `4px solid ${primary}` }}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">بيانات العميل</h3>
                  <p className="text-sm font-bold" style={{ color: primary }}>{SAMPLE_ORDER.customerName}</p>
                  <p className="text-xs text-gray-500 mt-1" dir="ltr">{formatPhone(SAMPLE_ORDER.customerPhone)}</p>
                  <p className="text-xs text-gray-500">{SAMPLE_CUSTOMER.address}</p>
                  <p className="text-xs text-gray-500">المحافظة: {SAMPLE_CUSTOMER.city}</p>
                </div>
                <div className="rounded-xl bg-cream/60 p-4" style={{ borderInlineStart: `4px solid ${primary}` }}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">تفاصيل الطلب</h3>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <p>حالة الطلب: <span className="font-semibold" style={{ color: primary }}>مؤكد</span></p>
                    <p>حالة الدفع: <span className="font-semibold" style={{ color: primary }}>مدفوع جزئياً</span></p>
                    <p>تاريخ التسليم: <span className="font-semibold">{formatDate(SAMPLE_ORDER.dueDate)}</span></p>
                    <p>المندوب: <span className="font-semibold">{SAMPLE_ORDER.repName}</span></p>
                  </div>
                </div>
              </div>

              <table className="w-full mb-6">
                <thead>
                  <tr className="text-right" style={{ borderBottom: `2px solid ${primary}33` }}>
                    <th className="pb-3 text-xs font-bold" style={{ color: primary }}>#</th>
                    <th className="pb-3 text-xs font-bold" style={{ color: primary }}>المنتج</th>
                    <th className="pb-3 text-xs font-bold text-center" style={{ color: primary }}>الكمية</th>
                    <th className="pb-3 text-xs font-bold text-center" style={{ color: primary }}>سعر الوحدة</th>
                    <th className="pb-3 text-xs font-bold text-left" style={{ color: primary }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {SAMPLE_ORDER.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="py-3 text-sm font-semibold text-gray-800">
                        {item.productName}
                        <span className="text-xs text-gray-400 ms-2" dir="ltr">({item.productCode})</span>
                      </td>
                      <td className="py-3 text-sm text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-sm text-center text-gray-600 tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-sm font-bold text-left tabular-nums" style={{ color: primary }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-start">
                <div className="w-72 space-y-2 rounded-xl bg-cream/60 p-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>المجموع الفرعي</span>
                    <span className="tabular-nums">{formatCurrency(SAMPLE_ORDER.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>الخصم</span>
                    <span className="tabular-nums">- {formatCurrency(SAMPLE_ORDER.discount)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-base font-bold" style={{ color: primary }}>
                    <span>الإجمالي</span>
                    <span className="tabular-nums">{formatCurrency(SAMPLE_ORDER.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>المدفوع</span>
                    <span className="tabular-nums">{formatCurrency(SAMPLE_ORDER.paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-red-600">
                    <span>المتبقي</span>
                    <span className="tabular-nums">{formatCurrency(SAMPLE_ORDER.remaining)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-cream/40 p-4">
                <p className="text-xs font-bold text-gray-500 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{SAMPLE_ORDER.notes}</p>
              </div>

              {settings.invoiceTerms && (
                <div className="mt-4 rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">الشروط والأحكام</p>
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{settings.invoiceTerms}</p>
                </div>
              )}

              {settings.invoiceShowSignature && (
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="border-t-2 border-gray-300 pt-2 mt-12">
                      <p className="text-xs font-semibold text-gray-500">توقيع المستلم</p>
                      <p className="text-[10px] text-gray-400">{SAMPLE_ORDER.customerName}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t-2 border-gray-300 pt-2 mt-12">
                      <p className="text-xs font-semibold text-gray-500">ختم وتوقيع {businessName}</p>
                      <p className="text-[10px] text-gray-400">المدير المسؤول</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 border-t pt-6 text-center">
                <p className="text-xs font-semibold" style={{ color: primary }}>{settings.invoiceFooterText || "شكراً لتعاملكم مع رداء"}</p>
                <p className="text-[10px] text-gray-400 mt-1">تم إنشاء هذه الفاتورة إلكترونياً عبر نظام {businessName}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
