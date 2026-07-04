import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Printer, ArrowRight, MessageCircle, FileDown, Ruler } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/dataStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, formatPhone, getStatusLabel, getPaymentStatusLabel } from "@/lib/formatters";
import brandLogo from "@/assets/brand-logo.png";

// Page dimensions in millimeters (standard sizes)
const PAGE_DIMENSIONS = {
  A4: { width: "210mm", minHeight: "297mm", label: "A4 (210×297مم)", printSize: "A4 portrait", margin: "10mm" },
  A5: { width: "148mm", minHeight: "210mm", label: "A5 (148×210مم)", printSize: "A5 portrait", margin: "8mm" },
  thermal80: { width: "80mm", minHeight: "auto", label: "طابعة حرارية 80مم", printSize: "80mm auto", margin: "2mm" },
  thermal58: { width: "58mm", minHeight: "auto", label: "طابعة حرارية 58مم", printSize: "58mm auto", margin: "1mm" },
} as const;

export default function Invoice() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, customers } = useDataStore();
  const { settings, initializeSettings } = useSettingsStore();

  useEffect(() => { if (user?.id) initializeSettings(user.id); }, [user?.id, initializeSettings]);

  const order = orders.find((o) => o.id === orderId);
  const customer = order ? customers.find((c) => c.id === order.customerId) : null;

  const pageSize = settings.invoicePageSize || "A4";
  const dims = PAGE_DIMENSIONS[pageSize];
  const isThermal = pageSize === "thermal80" || pageSize === "thermal58";
  const isCompact = pageSize === "thermal58";

  const primary = settings.invoicePrimaryColor || "#1B2A4A";
  const businessName = settings.businessName || "رداء";
  const template = settings.invoiceTemplate || "modern";

  // Print CSS with proper @page directive per page size
  const printCSS = useMemo(() => `
    @media print {
      @page {
        size: ${dims.printSize};
        margin: ${dims.margin};
      }
      body { margin: 0; padding: 0; background: white !important; }
      .no-print { display: none !important; }
      .invoice-paper {
        width: ${dims.width} !important;
        min-height: ${dims.minHeight === "auto" ? "auto" : dims.minHeight} !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: ${isThermal ? "2mm" : "8mm"} !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
      }
      ${isThermal ? `
        .invoice-paper { font-size: 10px !important; }
        .invoice-paper h1 { font-size: 14px !important; }
        .invoice-paper h2 { font-size: 12px !important; }
        .invoice-paper .totals-block { width: 100% !important; }
      ` : ""}
    }
  `, [dims, isThermal]);

  if (!order) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-sm text-gray-500">لم يتم العثور على الطلب</p>
        <button onClick={() => navigate("/orders")} className="text-sm text-gold font-semibold hover:underline">العودة للطلبات</button>
      </div>
    );
  }

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

  const barcodeHtml = generateBarcode(order.orderNumber);
  const displayLogo = settings.invoiceLogoUrl || settings.logoUrl || brandLogo;

  // Template-specific styles
  const headerStyle = template === "modern"
    ? { background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`, color: "white" }
    : template === "classic"
    ? { borderBottom: `4px double ${primary}`, paddingBottom: isThermal ? "0.5rem" : "1.5rem" }
    : { borderBottom: `1px solid ${primary}33`, paddingBottom: isThermal ? "0.4rem" : "1rem" };

  const isModern = template === "modern";

  const handleDownloadPdf = () => {
    toast.info("اختر 'حفظ كـ PDF' من نافذة الطباعة");
    setTimeout(() => window.print(), 300);
  };

  const handleSendWhatsApp = () => {
    if (!order.customerPhone) {
      toast.error("رقم هاتف العميل غير متوفر");
      return;
    }
    const itemsList = order.items.map((it, i) => `${i+1}. ${it.productName} × ${it.quantity} = ${formatCurrency(it.total)}`).join("\n");
    const message = `السلام عليكم ${order.customerName} 🌸

فاتورة رقم: ${order.orderNumber}
التاريخ: ${formatDate(order.createdAt)}

📋 المنتجات:
${itemsList}
${order.discount > 0 ? `\n💰 المجموع الفرعي: ${formatCurrency(order.subtotal)}\n🎁 الخصم: ${formatCurrency(order.discount)}` : ""}
💵 الإجمالي: ${formatCurrency(order.total)}
✅ المدفوع: ${formatCurrency(order.paid)}
${order.remaining > 0 ? `🔴 المتبقي: ${formatCurrency(order.remaining)}` : "✅ مدفوع بالكامل"}

حالة الطلب: ${getStatusLabel(order.status)}
${order.dueDate ? `موعد التسليم: ${formatDate(order.dueDate)}` : ""}

شكراً لتعاملكم مع ${businessName} 🌸`;

    const cleaned = order.customerPhone.replace(/\D/g, "");
    const phone = cleaned.startsWith("967") ? cleaned : "967" + cleaned;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    toast.success("تم فتح الواتساب");
  };

  return (
    <div className="space-y-4">
      {/* Inject dynamic print CSS */}
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <div className="no-print flex items-center justify-between print:hidden flex-wrap gap-2">
        <button onClick={() => navigate("/orders")}
          className="flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold transition-colors">
          <ArrowRight className="size-4" /> العودة للطلبات
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-blue-700">
            <Ruler className="size-3.5" /> {dims.label}
          </span>
          <button onClick={handleSendWhatsApp}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors active:scale-[0.98]">
            <MessageCircle className="size-4" /> إرسال للعميل عبر الواتساب
          </button>
          <button onClick={handleDownloadPdf}
            className="flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs font-bold transition-colors"
            style={{ borderColor: primary, color: primary }}>
            <FileDown className="size-4" /> حفظ PDF
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98]"
            style={{ background: primary, boxShadow: `0 10px 30px -10px ${primary}80` }}>
            <Printer className="size-4" /> طباعة
          </button>
        </div>
      </div>

      {/* Screen preview wrapper — shows the actual paper size */}
      <div className="mx-auto bg-gray-100 py-4 print:bg-white print:py-0 overflow-x-auto">
        <div
          className="invoice-paper mx-auto bg-white shadow-lg print:shadow-none border border-gray-200 print:border-none"
          style={{
            width: dims.width,
            minHeight: dims.minHeight,
            maxWidth: "100%",
            padding: isThermal ? "8px" : "32px",
            fontSize: isCompact ? "10px" : isThermal ? "11px" : "14px",
          }}
        >
          {/* Header */}
          <div className={`${isModern ? "rounded-2xl mb-4" : "mb-4"}`}
            style={{ ...(isModern ? { ...headerStyle, padding: isThermal ? "8px" : "24px" } : headerStyle) }}>
            {isThermal ? (
              <div className="text-center">
                <img src={displayLogo} alt={businessName}
                  className="mx-auto mb-1 size-12 rounded object-cover bg-white" />
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
                    <h1 className={`text-2xl font-bold font-kufi ${isModern ? "text-white" : ""}`} style={isModern ? {} : { color: primary }}>{businessName}</h1>
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
                  <p className={`text-sm ${isModern ? "text-white/80" : "text-gray-500"}`} dir="ltr">{order.orderNumber}</p>
                  <p className={`text-xs mt-1 ${isModern ? "text-white/60" : "text-gray-400"}`}>{formatDate(order.createdAt)}</p>
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

          {/* Thermal receipt: minimal layout */}
          {isThermal ? (
            <>
              <div className="text-center mb-2 py-1" style={{ borderTop: `1px dashed ${primary}`, borderBottom: `1px dashed ${primary}` }}>
                <p className="font-bold" style={{ color: primary, fontSize: isCompact ? "10px" : "11px" }}>فاتورة #{order.orderNumber}</p>
                <p className="text-gray-500" style={{ fontSize: isCompact ? "8px" : "9px" }}>{formatDate(order.createdAt)}</p>
              </div>
              <div className="mb-2" style={{ fontSize: isCompact ? "9px" : "10px" }}>
                <p><b>العميل:</b> {order.customerName}</p>
                <p dir="ltr">{formatPhone(order.customerPhone)}</p>
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
                  {order.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-0.5">{item.productName.substring(0, isCompact ? 15 : 22)}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-left tabular-nums">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="totals-block" style={{ borderTop: `1px dashed ${primary}`, paddingTop: "4px", fontSize: isCompact ? "9px" : "10px" }}>
                <div className="flex justify-between"><span>الفرعي</span><span className="tabular-nums">{order.subtotal.toLocaleString()}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-red-600"><span>خصم</span><span className="tabular-nums">-{order.discount.toLocaleString()}</span></div>}
                <div className="flex justify-between font-bold" style={{ color: primary, fontSize: isCompact ? "11px" : "12px" }}>
                  <span>الإجمالي</span><span className="tabular-nums">{order.total.toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-emerald-700"><span>مدفوع</span><span className="tabular-nums">{order.paid.toLocaleString()}</span></div>
                {order.remaining > 0 && <div className="flex justify-between text-red-600 font-bold"><span>متبقي</span><span className="tabular-nums">{order.remaining.toLocaleString()}</span></div>}
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
              {/* Customer & Order info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl bg-cream/60 p-4" style={{ borderInlineStart: `4px solid ${primary}` }}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">بيانات العميل</h3>
                  <p className="text-sm font-bold" style={{ color: primary }}>{order.customerName}</p>
                  <p className="text-xs text-gray-500 mt-1" dir="ltr">{formatPhone(order.customerPhone)}</p>
                  {customer?.address && <p className="text-xs text-gray-500">{customer.address}</p>}
                  {customer?.city && <p className="text-xs text-gray-500">المحافظة: {customer.city}</p>}
                </div>
                <div className="rounded-xl bg-cream/60 p-4" style={{ borderInlineStart: `4px solid ${primary}` }}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">تفاصيل الطلب</h3>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <p>حالة الطلب: <span className="font-semibold" style={{ color: primary }}>{getStatusLabel(order.status)}</span></p>
                    <p>حالة الدفع: <span className="font-semibold" style={{ color: primary }}>{getPaymentStatusLabel(order.paymentStatus)}</span></p>
                    <p>تاريخ التسليم: <span className="font-semibold">{formatDate(order.dueDate)}</span></p>
                    {order.repName && <p>المندوب: <span className="font-semibold">{order.repName}</span></p>}
                  </div>
                </div>
              </div>

              {/* Items Table */}
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
                  {order.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="py-3 text-sm font-semibold text-gray-800">
                        {item.productName}
                        {item.productCode && <span className="text-xs text-gray-400 ms-2" dir="ltr">({item.productCode})</span>}
                      </td>
                      <td className="py-3 text-sm text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-sm text-center text-gray-600 tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-sm font-bold text-left tabular-nums" style={{ color: primary }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-start">
                <div className="totals-block w-72 space-y-2 rounded-xl bg-cream/60 p-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>المجموع الفرعي</span>
                    <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>الخصم</span>
                      <span className="tabular-nums">- {formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between text-base font-bold" style={{ color: primary }}>
                    <span>الإجمالي</span>
                    <span className="tabular-nums">{formatCurrency(order.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>المدفوع</span>
                    <span className="tabular-nums">{formatCurrency(order.paid)}</span>
                  </div>
                  {order.remaining > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-600">
                      <span>المتبقي</span>
                      <span className="tabular-nums">{formatCurrency(order.remaining)}</span>
                    </div>
                  )}
                </div>
              </div>

              {order.notes && (
                <div className="mt-6 rounded-xl bg-cream/40 p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">ملاحظات</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}

              {settings.invoiceTerms && (
                <div className="mt-4 rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">الشروط والأحكام</p>
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{settings.invoiceTerms}</p>
                </div>
              )}

              {/* Signature block */}
              {settings.invoiceShowSignature && (
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="border-t-2 border-gray-300 pt-2 mt-12">
                      <p className="text-xs font-semibold text-gray-500">توقيع المستلم</p>
                      <p className="text-[10px] text-gray-400">{order.customerName}</p>
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
