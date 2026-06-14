import { useEffect } from "react";
import { useState } from "react";
import { AlertTriangle, DollarSign, Users, CreditCard, ChevronDown, ChevronUp, Landmark, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import WhatsAppButton from "@/components/features/WhatsAppButton";
import PaymentDialog from "@/components/features/PaymentDialog";
import BulkWhatsAppDialog from "@/components/features/BulkWhatsAppDialog";
import { WHATSAPP_TEMPLATES } from "@/constants/config";

export default function Debts() {
  const { user } = useAuth();
  const { getDebtors, getTotalDebt, orders, initializeData } = useDataStore();
  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  const debtors = getDebtors();
  const totalDebt = getTotalDebt();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{ orderId: string; customerId: string; customerName: string; remaining: number } | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid").length;
  const partialOrders = orders.filter((o) => o.paymentStatus === "partial").length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">تتبع المديونيات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">إجمالي بالسعودي: {formatCurrency(totalDebt, "SAR")}</p>
        </div>
        {debtors.length > 0 && (
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-[0.98]">
            <MessageCircle className="size-4" /> مطالبة الكل بالواتساب ({debtors.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="إجمالي المديونيات" value={formatCurrency(totalDebt)} icon={AlertTriangle} trend={formatCurrency(totalDebt, "SAR")} delay={3} />
        <StatCard title="عدد المدينين" value={`${debtors.length} عميل`} icon={Users} delay={0} />
        <StatCard title="طلبات غير مدفوعة" value={`${unpaidOrders + partialOrders} طلب`} icon={DollarSign} trend={`${unpaidOrders} غير مدفوع · ${partialOrders} جزئي`} delay={1} />
      </div>
      <div className="space-y-3">
        {debtors.map((debtor, idx) => {
          const isExpanded = expandedId === debtor.customer.id;
          return (
            <div key={debtor.customer.id} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-cream/30 transition-colors sm:p-5" onClick={() => setExpandedId(isExpanded ? null : debtor.customer.id)}>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600 sm:size-12 sm:text-lg">{debtor.customer.name.charAt(0)}</div>
                  <div>
                    <h3 className="text-sm font-bold text-navy">{debtor.customer.name}</h3>
                    <p className="text-[10px] text-gray-400 sm:text-xs">{debtor.customer.city} · {debtor.orders.length} طلبات</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-left">
                    <p className="text-sm font-bold text-red-600 tabular-nums sm:text-lg">{formatCurrency(debtor.debt)}</p>
                    <p className="text-[10px] text-gray-400">{formatCurrency(debtor.debt, "SAR")}</p>
                  </div>
                  <WhatsAppButton phone={debtor.customer.phone} message={WHATSAPP_TEMPLATES.paymentReminder(debtor.customer.name, debtor.debt)} />
                  {isExpanded ? <ChevronUp className="size-5 text-gray-400" /> : <ChevronDown className="size-5 text-gray-400" />}
                </div>
              </div>
              {isExpanded && (
                <div className="border-t bg-cream/20 p-4 space-y-3 sm:p-5">
                  {debtor.orders.map((order) => (
                    <div key={order.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 border border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-navy/5 p-2"><Landmark className="size-4 text-navy" /></div>
                        <div>
                          <p className="text-sm font-semibold text-navy" dir="ltr">{order.orderNumber}</p>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:gap-3">
                        <div className="text-left">
                          <p className="text-xs text-gray-400">الإجمالي: {formatCurrency(order.total)}</p>
                          <p className="text-sm font-bold text-red-600 tabular-nums">متبقي: {formatCurrency(order.remaining)}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setPaymentTarget({ orderId: order.id, customerId: debtor.customer.id, customerName: debtor.customer.name, remaining: order.remaining }); }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                          <CreditCard className="size-3.5" /> تسجيل دفعة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {debtors.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="rounded-full bg-green-50 p-6"><DollarSign className="size-10 text-green-500" /></div>
          <h3 className="text-lg font-bold text-navy">لا توجد مديونيات</h3>
          <p className="text-sm text-gray-400">جميع المبالغ مسددة 🎉</p>
        </div>
      )}
      {paymentTarget && <PaymentDialog open onClose={() => setPaymentTarget(null)} {...paymentTarget} />}
      {showBulk && <BulkWhatsAppDialog open onClose={() => setShowBulk(false)} mode="debtors" />}
    </div>
  );
}
