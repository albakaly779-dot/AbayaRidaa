import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Trash2, CreditCard, Package, Printer, Bell, MessageCircle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuditStore } from "@/stores/auditStore";
import {
  formatCurrency, formatDate, getStatusLabel, getStatusColor,
  getPaymentStatusLabel, getPaymentStatusColor,
} from "@/lib/formatters";
import WhatsAppButton from "@/components/features/WhatsAppButton";
import OrderFormDialog from "@/components/features/OrderFormDialog";
import PaymentDialog from "@/components/features/PaymentDialog";
import BulkWhatsAppDialog from "@/components/features/BulkWhatsAppDialog";
import { WHATSAPP_TEMPLATES } from "@/constants/config";
import type { OrderStatus } from "@/types";

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, loading, initializeData, updateOrderStatus, deleteOrder } = useDataStore();
  const { sendStatusChangeSMS, sendDueReminderSMS } = useNotificationStore();
  const { logAction } = useAuditStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [bulkMode, setBulkMode] = useState<"debtors" | "ready" | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{
    orderId: string; customerId: string; customerName: string; remaining: number;
  } | null>(null);

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = o.customerName.includes(search) || o.orderNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      const matchPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const readyOrders = orders.filter((o) => o.status === "ready").length;
  const debtOrders = orders.filter((o) => o.remaining > 0).length;

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    updateOrderStatus(orderId, newStatus);
    toast.success("تم تحديث حالة الطلب");
    if (order && user) {
      sendStatusChangeSMS(order.customerName, order.customerPhone, order.orderNumber, newStatus, orderId, user.id);
      logAction(user.id, "status_change", "order", orderId, `تغيير حالة الطلب ${order.orderNumber} إلى ${getStatusLabel(newStatus)}`);
    }
  };

  const handleDueReminder = (order: typeof orders[0]) => {
    if (user) {
      sendDueReminderSMS(order.customerName, order.customerPhone, order.orderNumber, formatDate(order.dueDate), order.id, user.id);
      toast.success("تم إرسال تذكير موعد التسليم");
    }
  };

  const handleDelete = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (window.confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
      deleteOrder(orderId);
      toast.success("تم حذف الطلب");
      if (user && order) {
        logAction(user.id, "delete", "order", orderId, `حذف الطلب ${order.orderNumber}`);
      }
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">إدارة الطلبات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{orders.length} طلب إجمالي</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {readyOrders > 0 && (
            <button onClick={() => setBulkMode("ready")}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <MessageCircle className="size-3.5" /> إبلاغ الجاهزة ({readyOrders})
            </button>
          )}
          {debtOrders > 0 && (
            <button onClick={() => setBulkMode("debtors")}
              className="flex items-center gap-1.5 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
              <Send className="size-3.5" /> مطالبة المدينين ({debtOrders})
            </button>
          )}
          <button onClick={() => setShowOrderForm(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 transition-all hover:bg-navy-light active:scale-[0.98]">
            <Plus className="size-4" /> طلب جديد
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm border border-gray-100 sm:flex-row sm:gap-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            placeholder="بحث باسم العميل أو رقم الطلب..." />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs focus:border-gold focus:outline-none sm:flex-initial sm:text-sm">
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">قيد التنفيذ</option>
            <option value="ready">جاهز</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
            className="flex-1 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs focus:border-gold focus:outline-none sm:flex-initial sm:text-sm">
            <option value="all">كل المدفوعات</option>
            <option value="paid">مدفوع</option>
            <option value="partial">جزئي</option>
            <option value="unpaid">غير مدفوع</option>
          </select>
        </div>
      </div>

      {/* Mobile cards view */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-bold text-navy" dir="ltr">{order.orderNumber}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{order.customerName}</p>
              </div>
              <p className="text-sm font-bold text-gold tabular-nums">{formatCurrency(order.total)}</p>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                className={`rounded-lg border-0 px-2 py-1 text-[10px] font-semibold ${getStatusColor(order.status)} cursor-pointer`}>
                <option value="pending">قيد الانتظار</option>
                <option value="processing">قيد التنفيذ</option>
                <option value="ready">جاهز</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">ملغي</option>
              </select>
              <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${getPaymentStatusColor(order.paymentStatus)}`}>
                {getPaymentStatusLabel(order.paymentStatus)}
              </span>
              {order.remaining > 0 && <span className="text-[10px] font-bold text-red-600">متبقي: {formatCurrency(order.remaining)}</span>}
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t">
              <WhatsAppButton phone={order.customerPhone}
                message={order.remaining > 0 ? WHATSAPP_TEMPLATES.paymentReminder(order.customerName, order.remaining)
                  : WHATSAPP_TEMPLATES.orderReady(order.customerName, order.orderNumber)} />
              <button onClick={() => handleDueReminder(order)} className="rounded-lg p-2 text-amber-500 hover:bg-amber-50" aria-label="تذكير"><Bell className="size-4" /></button>
              <button onClick={() => navigate(`/invoice/${order.id}`)} className="rounded-lg p-2 text-navy hover:bg-navy/10" aria-label="فاتورة"><Printer className="size-4" /></button>
              {order.remaining > 0 && (
                <button onClick={() => setPaymentTarget({ orderId: order.id, customerId: order.customerId, customerName: order.customerName, remaining: order.remaining })}
                  className="rounded-lg p-2 bg-blue-500 text-white hover:bg-blue-600" aria-label="دفعة"><CreditCard className="size-4" /></button>
              )}
              <button onClick={() => handleDelete(order.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 ms-auto" aria-label="حذف"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">رقم الطلب</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">العميل</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">المنتجات</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">المبلغ</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">المتبقي</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">الحالة</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">الدفع</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">التاريخ</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-bold text-navy" dir="ltr">{order.orderNumber}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{order.customerName}</p>
                    <p className="text-xs text-gray-400" dir="ltr">+{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[140px] truncate">
                    {order.items.map((i) => i.productName).join("، ")}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-bold text-gold tabular-nums">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3.5 text-sm font-bold tabular-nums">
                    {order.remaining > 0 ? <span className="text-red-600">{formatCurrency(order.remaining)}</span> : <span className="text-green-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className={`rounded-lg border-0 px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)} cursor-pointer`}>
                      <option value="pending">{getStatusLabel("pending")}</option>
                      <option value="processing">{getStatusLabel("processing")}</option>
                      <option value="ready">{getStatusLabel("ready")}</option>
                      <option value="delivered">{getStatusLabel("delivered")}</option>
                      <option value="cancelled">{getStatusLabel("cancelled")}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <WhatsAppButton phone={order.customerPhone}
                        message={order.remaining > 0 ? WHATSAPP_TEMPLATES.paymentReminder(order.customerName, order.remaining)
                          : WHATSAPP_TEMPLATES.orderReady(order.customerName, order.orderNumber)} />
                      <button onClick={() => handleDueReminder(order)} className="inline-flex size-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50" aria-label="تذكير"><Bell className="size-3.5" /></button>
                      <button onClick={() => navigate(`/invoice/${order.id}`)} className="inline-flex size-8 items-center justify-center rounded-lg text-navy hover:bg-navy/10" aria-label="فاتورة"><Printer className="size-3.5" /></button>
                      {order.remaining > 0 && (
                        <button onClick={() => setPaymentTarget({ orderId: order.id, customerId: order.customerId, customerName: order.customerName, remaining: order.remaining })}
                          className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600" aria-label="دفعة"><CreditCard className="size-3.5" /></button>
                      )}
                      <button onClick={() => handleDelete(order.id)} className="inline-flex size-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50" aria-label="حذف"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Package className="size-12 text-gray-300" />
            <p className="text-sm text-gray-400">لا توجد طلبات مطابقة</p>
          </div>
        )}
      </div>

      <OrderFormDialog open={showOrderForm} onClose={() => setShowOrderForm(false)} />
      {paymentTarget && <PaymentDialog open onClose={() => setPaymentTarget(null)} {...paymentTarget} />}
      {bulkMode && <BulkWhatsAppDialog open={!!bulkMode} onClose={() => setBulkMode(null)} mode={bulkMode} />}
    </div>
  );
}
