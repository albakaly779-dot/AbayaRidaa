import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Printer, ArrowRight, MessageCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/dataStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, formatPhone, getStatusLabel, getPaymentStatusLabel } from "@/lib/formatters";
import brandLogo from "@/assets/brand-logo.png";

export default function Invoice() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, customers } = useDataStore();
  const { settings, initializeSettings } = useSettingsStore();

  useEffect(() => { if (user?.id) initializeSettings(user.id); }, [user?.id, initializeSettings]);

  const order = orders.find((o) => o.id === orderId);
  const customer = order ? customers.find((c) => c.id === order.customerId) : null;

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
      bars.push(`<rect x="${x}" y="0" width="${w1}" height="40" fill="${settings.invoicePrimaryColor}"/>`);
      x += w1 + w2;
      bars.push(`<rect x="${x}" y="0" width="${w2}" height="40" fill="${settings.invoicePrimaryColor}"/>`);
      x += w2 + 1;
    }
    return `<svg viewBox="0 0 ${x + 10} 50" xmlns="http://www.w3.org/2000/svg">${bars.join("")}<text x="${(x + 10) / 2}" y="48" text-anchor="middle" font-size="7" font-family="monospace" fill="${settings.invoicePrimaryColor}">${text}</text></svg>`;
  };

  const barcodeHtml = generateBarcode(order.orderNumber);
  const displayLogo = settings.invoiceLogoUrl || settings.logoUrl || brandLogo;
  const businessName = settings.businessName || "رداء";
  const primary = settings.invoicePrimaryColor || "#1B2A4A";
  const template = settings.invoiceTemplate || "modern";

  // Template-specific styles
  const headerStyle = template === "modern"
    ? { background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`, color: "white" }
    : template === "classic"
    ? { borderBottom: `4px double ${primary}`, paddingBottom: "1.5rem" }
    : { borderBottom: `1px solid ${primary}33`, paddingBottom: "1rem" };

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
      <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
        <button onClick={() => navigate("/orders")}
          className="flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold transition-colors">
          <ArrowRight className="size-4" /> العودة للطلبات
        </button>
        <div className="flex items-center gap-2 flex-wrap">
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

      <div className="mx-auto max-w-[800px] rounded-2xl bg-white p-8 shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0 print:max-w-none">
        {/* Header */}
        <div className={`${isModern ? "rounded-2xl p-6 mb-6" : "mb-6"}`} style={isModern ? headerStyle : headerStyle}>
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
        </div>

        {/* Customer & Order info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
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
          <div className="w-72 space-y-2 rounded-xl bg-cream/60 p-4">
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

        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-xs font-semibold" style={{ color: primary }}>{settings.invoiceFooterText || "شكراً لتعاملكم مع رداء"}</p>
          <p className="text-[10px] text-gray-400 mt-1">تم إنشاء هذه الفاتورة إلكترونياً عبر نظام {businessName}</p>
        </div>
      </div>
    </div>
  );
}
