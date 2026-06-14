import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, ShoppingBag, CreditCard, MessageCircle, Loader2, User2, DollarSign, AlertTriangle, Activity, UserPlus, Target, Repeat, TrendingUp, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { formatCurrency, formatDate, formatPhone, getStatusLabel, getStatusColor, getPaymentStatusLabel, getPaymentStatusColor } from "@/lib/formatters";
import WhatsAppButton from "@/components/features/WhatsAppButton";
import { WHATSAPP_TEMPLATES } from "@/constants/config";

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "واتساب 💬", instagram: "إنستقرام 📸", facebook: "فيسبوك 📘",
  direct: "مباشر 🏪", referral: "توصية 🤝", other: "أخرى",
};

type TimelineEventType = "order" | "payment" | "message" | "customer_added";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description: string;
  amount?: number;
  link?: string;
  meta?: string;
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { customers, orders, payments, loading, initializeData } = useDataStore();
  const { notifications, initializeData: initNotif } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<"timeline" | "orders" | "payments" | "messages">("timeline");

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initNotif(user.id);
    }
  }, [user?.id, initializeData, initNotif]);

  const customer = customers.find((c) => c.id === id);
  const customerOrders = useMemo(() => orders.filter((o) => o.customerId === id), [orders, id]);
  const customerPayments = useMemo(() => payments.filter((p) => p.customerId === id), [payments, id]);
  const customerMessages = useMemo(() => {
    if (!customer) return [];
    const cleaned = customer.phone.replace(/\D/g, "");
    return notifications.filter((n) => {
      const nPhone = n.recipientPhone.replace(/\D/g, "");
      return nPhone === cleaned || nPhone.endsWith(cleaned.slice(-9));
    }).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [notifications, customer]);

  const customerAny = customer as (typeof customer & { source?: string; addedByName?: string }) | undefined;

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!customer) return [];
    const events: TimelineEvent[] = [];

    events.push({
      id: `customer-${customer.id}`,
      type: "customer_added",
      date: customer.createdAt,
      title: "تم تسجيل العميل في النظام",
      description: customerAny?.addedByName ? `أضيف بواسطة ${customerAny.addedByName}` : "بداية العلاقة مع العميل",
      meta: customerAny?.source ? SOURCE_LABELS[customerAny.source] || customerAny.source : "",
    });

    customerOrders.forEach(o => {
      events.push({
        id: `order-${o.id}`,
        type: "order",
        date: o.createdAt,
        title: `طلب ${o.orderNumber}`,
        description: `${o.items.length} منتج · الحالة: ${getStatusLabel(o.status)}`,
        amount: o.total,
        link: `/invoice/${o.id}`,
        meta: getPaymentStatusLabel(o.paymentStatus),
      });
    });

    customerPayments.forEach(p => {
      events.push({
        id: `payment-${p.id}`,
        type: "payment",
        date: p.date,
        title: "دفعة مالية مستلمة",
        description: p.method === "cash" ? "نقدي" : p.method === "transfer" ? "تحويل بنكي" : "بطاقة",
        amount: p.amount,
      });
    });

    customerMessages.forEach(m => {
      events.push({
        id: `msg-${m.id}`,
        type: "message",
        date: m.sentAt,
        title: m.type === "payment" ? "📩 رسالة دفعة" : m.type === "status_change" ? "📦 رسالة حالة" : m.type === "due_reminder" ? "⏰ رسالة تذكير" : "💬 رسالة واتساب",
        description: m.message.length > 120 ? m.message.substring(0, 120) + "..." : m.message,
      });
    });

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [customer, customerOrders, customerPayments, customerMessages, customerAny?.addedByName, customerAny?.source]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">لم يتم العثور على العميل</p>
        <Link to="/customers" className="text-sm text-gold font-semibold hover:underline mt-2 inline-block">العودة للعملاء</Link>
      </div>
    );
  }

  const totalSpent = customerOrders.reduce((s, o) => s + o.total, 0);
  const totalPaid = customerOrders.reduce((s, o) => s + o.paid, 0);
  const totalDebt = customerOrders.reduce((s, o) => s + o.remaining, 0);

  // Customer Lifetime Value (CLV) calculation
  const orderCount = customerOrders.length;
  const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
  const sortedTimes = customerOrders.map(o => new Date(o.createdAt).getTime()).sort((a, b) => a - b);
  const firstOrderTime = sortedTimes[0] || 0;
  const lastOrderTime = sortedTimes[sortedTimes.length - 1] || 0;
  const daysSinceFirst = firstOrderTime ? Math.max(1, Math.floor((Date.now() - firstOrderTime) / 86400000)) : 0;
  const ordersPerMonth = daysSinceFirst > 0 ? (orderCount / daysSinceFirst) * 30 : 0;
  const avgDaysBetween = orderCount > 1 ? Math.max(1, Math.floor((lastOrderTime - firstOrderTime) / 86400000 / (orderCount - 1))) : 0;
  const daysSinceLast = lastOrderTime ? Math.floor((Date.now() - lastOrderTime) / 86400000) : 0;

  // Tier classification
  const tier = (() => {
    if (totalSpent >= 100000 || orderCount >= 10) return {
      key: "vip", label: "VIP - عميل ذهبي", icon: "👑",
      bg: "from-yellow-400 via-amber-500 to-yellow-600",
      ring: "ring-yellow-300/60", shadow: "shadow-yellow-500/30",
      description: "من أهم عملائنا — عناية خاصة وعروض حصرية",
    };
    if (totalSpent >= 50000 || orderCount >= 5) return {
      key: "premium", label: "عميل مميز", icon: "💎",
      bg: "from-purple-500 via-fuchsia-500 to-indigo-600",
      ring: "ring-purple-300/60", shadow: "shadow-purple-500/30",
      description: "عميل مخلص — يستحق المتابعة الدورية",
    };
    if (totalSpent >= 20000 || orderCount >= 3) return {
      key: "regular", label: "عميل منتظم", icon: "⭐",
      bg: "from-blue-500 via-cyan-500 to-blue-600",
      ring: "ring-blue-300/60", shadow: "shadow-blue-500/30",
      description: "يشتري بانتظام — حافظ على رضاه",
    };
    if (orderCount >= 1) return {
      key: "average", label: "عميل عادي", icon: "🌱",
      bg: "from-emerald-500 via-teal-500 to-emerald-600",
      ring: "ring-emerald-300/60", shadow: "shadow-emerald-500/30",
      description: "عميل جديد — فرصة لتطوير العلاقة",
    };
    return {
      key: "new", label: "عميل جديد", icon: "🆕",
      bg: "from-gray-500 via-slate-500 to-gray-600",
      ring: "ring-gray-300/60", shadow: "shadow-gray-500/30",
      description: "لم يقم بأي طلب بعد — تواصل أول",
    };
  })();

  // Engagement state badge
  const engagement = orderCount === 0 ? null :
    daysSinceLast <= 30 ? { label: "نشط", color: "bg-emerald-400 text-emerald-950" } :
    daysSinceLast <= 90 ? { label: "شبه نشط", color: "bg-amber-400 text-amber-950" } :
    { label: "خامل", color: "bg-red-400 text-red-950" };

  const eventStyles: Record<TimelineEventType, { bg: string; text: string; ring: string; iconBg: string; icon: typeof ShoppingBag }> = {
    order: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", iconBg: "bg-blue-500", icon: ShoppingBag },
    payment: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", iconBg: "bg-emerald-500", icon: CreditCard },
    message: { bg: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200", iconBg: "bg-purple-500", icon: MessageCircle },
    customer_added: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", iconBg: "bg-amber-500", icon: UserPlus },
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <Link to="/customers" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy">
        <ArrowLeft className="size-4" /> العودة للعملاء
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-bl from-navy to-navy-light p-6 text-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex size-20 items-center justify-center rounded-full bg-gold text-2xl font-bold text-navy shrink-0">
            {customer.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <div className="flex items-center gap-3 text-sm text-white/80 mt-1 flex-wrap">
              <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3.5" /> {formatPhone(customer.phone)}</span>
              {customer.email && <span className="flex items-center gap-1"><Mail className="size-3.5" /> {customer.email}</span>}
              {customer.city && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {customer.city}</span>}
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {customerAny?.source && (
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs">{SOURCE_LABELS[customerAny.source] || customerAny.source}</span>
              )}
              {customerAny?.addedByName && (
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs flex items-center gap-1">
                  <User2 className="size-3" /> {customerAny.addedByName}
                </span>
              )}
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs flex items-center gap-1">
                <Calendar className="size-3" /> منذ {formatDate(customer.createdAt)}
              </span>
            </div>
          </div>
          <WhatsAppButton phone={customer.phone} message={WHATSAPP_TEMPLATES.thankYou(customer.name)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <ShoppingBag className="size-5 text-blue-500 mb-2" />
          <p className="text-xs text-gray-500">عدد الطلبات</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{customerOrders.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <DollarSign className="size-5 text-emerald-500 mb-2" />
          <p className="text-xs text-gray-500">إجمالي الإنفاق</p>
          <p className="text-base font-bold text-emerald-600 tabular-nums">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <CreditCard className="size-5 text-gold-dark mb-2" />
          <p className="text-xs text-gray-500">المدفوع</p>
          <p className="text-base font-bold text-navy tabular-nums">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <AlertTriangle className={`size-5 mb-2 ${totalDebt > 0 ? "text-red-500" : "text-gray-300"}`} />
          <p className="text-xs text-gray-500">المتبقي</p>
          <p className={`text-base font-bold tabular-nums ${totalDebt > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {totalDebt > 0 ? formatCurrency(totalDebt) : "لا يوجد"}
          </p>
        </div>
      </div>

      {/* Customer Lifetime Value (CLV) */}
      <div className={`rounded-2xl bg-gradient-to-bl ${tier.bg} p-5 sm:p-6 text-white shadow-xl ${tier.shadow} ring-4 ${tier.ring} relative overflow-hidden`}>
        {/* Decorative pattern */}
        <div className="absolute -top-12 -left-12 size-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 size-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-3">
            <div className="size-14 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-3xl ring-2 ring-white/30 shrink-0">
              {tier.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Sparkles className="size-3 text-white/70" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">القيمة الدائمة للعميل (CLV)</p>
              </div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight">{tier.label}</h2>
              <p className="text-xs text-white/80 mt-0.5">{tier.description}</p>
              {engagement && (
                <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${engagement.color}`}>
                  ● {engagement.label} — آخر طلب منذ {daysSinceLast} يوم
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 ring-1 ring-white/20 text-left shrink-0">
            <p className="text-[9px] text-white/70 mb-0.5">الإجمالي التراكمي</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(totalSpent)}</p>
            <p className="text-[9px] text-white/70 tabular-nums">{formatCurrency(totalSpent, "SAR")}</p>
          </div>
        </div>

        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-white/20">
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="size-3.5 text-white/80" />
              <p className="text-[10px] font-semibold text-white/80">إجمالي الإنفاق</p>
            </div>
            <p className="text-sm sm:text-base font-bold tabular-nums leading-tight">{formatCurrency(totalSpent)}</p>
            <p className="text-[9px] text-white/70 mt-0.5">عبر {orderCount} طلب</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="size-3.5 text-white/80" />
              <p className="text-[10px] font-semibold text-white/80">متوسط الطلب</p>
            </div>
            <p className="text-sm sm:text-base font-bold tabular-nums leading-tight">{formatCurrency(avgOrderValue)}</p>
            <p className="text-[9px] text-white/70 mt-0.5">{avgOrderValue >= 10000 ? "قيمة عالية" : avgOrderValue >= 5000 ? "قيمة متوسطة" : "قيمة بسيطة"}</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Repeat className="size-3.5 text-white/80" />
              <p className="text-[10px] font-semibold text-white/80">تكرار الشراء</p>
            </div>
            <p className="text-sm sm:text-base font-bold tabular-nums leading-tight">{ordersPerMonth.toFixed(1)}</p>
            <p className="text-[9px] text-white/70 mt-0.5">طلب / شهر</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="size-3.5 text-white/80" />
              <p className="text-[10px] font-semibold text-white/80">{orderCount > 1 ? "بين الطلبات" : "العضوية"}</p>
            </div>
            <p className="text-sm sm:text-base font-bold tabular-nums leading-tight">
              {orderCount > 1 ? `${avgDaysBetween} يوم` : `${daysSinceFirst} يوم`}
            </p>
            <p className="text-[9px] text-white/70 mt-0.5">{orderCount > 1 ? "متوسط الفاصل" : "منذ التسجيل"}</p>
          </div>
        </div>

        {/* Progress to next tier */}
        {tier.key !== "vip" && orderCount > 0 && (
          <div className="relative mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/80">
                التقدم إلى {tier.key === "premium" ? "VIP 👑" : tier.key === "regular" ? "مميز 💎" : tier.key === "average" ? "منتظم ⭐" : "عادي 🌱"}
              </p>
              <p className="text-[10px] font-bold tabular-nums text-white/90">
                {(() => {
                  const target = tier.key === "premium" ? 100000 : tier.key === "regular" ? 50000 : tier.key === "average" ? 20000 : 5000;
                  const pct = Math.min(100, (totalSpent / target) * 100);
                  return `${pct.toFixed(0)}%`;
                })()}
              </p>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500"
                style={{
                  width: `${(() => {
                    const target = tier.key === "premium" ? 100000 : tier.key === "regular" ? 50000 : tier.key === "average" ? 20000 : 5000;
                    return Math.min(100, (totalSpent / target) * 100);
                  })()}%`
                }} />
            </div>
            <p className="text-[9px] text-white/70 mt-1.5">
              {(() => {
                const target = tier.key === "premium" ? 100000 : tier.key === "regular" ? 50000 : tier.key === "average" ? 20000 : 5000;
                const remaining = Math.max(0, target - totalSpent);
                return remaining > 0 ? `يحتاج ${formatCurrency(remaining)} للترقية` : "مؤهل للترقية! 🎉";
              })()}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {([
            { key: "timeline", label: `الخط الزمني (${timeline.length})`, icon: Activity },
            { key: "orders", label: `الطلبات (${customerOrders.length})`, icon: ShoppingBag },
            { key: "payments", label: `المدفوعات (${customerPayments.length})`, icon: CreditCard },
            { key: "messages", label: `الرسائل (${customerMessages.length})`, icon: MessageCircle },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === t.key ? "border-b-2 border-gold text-navy bg-cream/30" : "text-gray-500 hover:text-navy"
              }`}>
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "timeline" && (
            <div className="relative">
              {timeline.length > 0 ? (
                <>
                  {/* Vertical line */}
                  <div className="absolute right-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-gold/50 via-gray-200 to-transparent" />

                  <div className="space-y-4">
                    {timeline.map((event, idx) => {
                      const styles = eventStyles[event.type];
                      const Icon = styles.icon;
                      const isLink = event.link;
                      const Wrapper = isLink ? Link : "div";
                      const wrapperProps = isLink ? { to: event.link! } : {};

                      return (
                        <Wrapper
                          key={event.id}
                          {...wrapperProps}
                          className={`relative flex gap-4 ${isLink ? "cursor-pointer hover:translate-x-[-2px] transition-transform" : ""}`}
                        >
                          {/* Icon circle */}
                          <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg} text-white ring-4 ring-white shadow-lg`}>
                            <Icon className="size-5" />
                          </div>

                          {/* Content */}
                          <div className={`flex-1 rounded-xl ${styles.bg} p-4 ring-1 ${styles.ring} animate-fade-in opacity-0`}
                            style={{ animationDelay: `${Math.min(idx, 15) * 50}ms` }}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <h4 className={`text-sm font-bold ${styles.text}`}>{event.title}</h4>
                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{event.description}</p>
                                {event.meta && (
                                  <span className={`mt-2 inline-block rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold ${styles.text}`}>
                                    {event.meta}
                                  </span>
                                )}
                              </div>
                              <div className="text-left shrink-0">
                                {event.amount !== undefined && (
                                  <p className={`text-base font-bold tabular-nums ${styles.text}`}>{formatCurrency(event.amount)}</p>
                                )}
                                <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(event.date)}</p>
                              </div>
                            </div>
                          </div>
                        </Wrapper>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-gray-400 py-8">لا توجد أحداث مسجلة</p>
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-3">
              {customerOrders.map((o) => (
                <Link key={o.id} to={`/invoice/${o.id}`}
                  className="flex items-center justify-between rounded-xl bg-cream/40 p-4 hover:bg-cream/60 transition-colors flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-bold text-navy" dir="ltr">{o.orderNumber}</p>
                    <p className="text-xs text-gray-500">{formatDate(o.createdAt)} · {o.items.length} منتج</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${getPaymentStatusColor(o.paymentStatus)}`}>{getPaymentStatusLabel(o.paymentStatus)}</span>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gold tabular-nums">{formatCurrency(o.total)}</p>
                      {o.remaining > 0 && <p className="text-[10px] text-red-600">متبقي: {formatCurrency(o.remaining)}</p>}
                    </div>
                  </div>
                </Link>
              ))}
              {customerOrders.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لا توجد طلبات لهذا العميل</p>}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-3">
              {customerPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-cream/40 p-4 flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.date)} · {p.method === "cash" ? "نقدي" : p.method === "transfer" ? "تحويل" : "بطاقة"}</p>
                    {p.recordedByName && <p className="text-[10px] text-gray-400">سجلها: {p.recordedByName}</p>}
                  </div>
                  {p.receiptUrl && (
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer"
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      عرض الإيصال
                    </a>
                  )}
                </div>
              ))}
              {customerPayments.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لا توجد مدفوعات</p>}
            </div>
          )}

          {activeTab === "messages" && (
            <div className="space-y-3">
              {customerMessages.map((m) => (
                <div key={m.id} className="rounded-xl bg-emerald-50/40 p-4 border border-emerald-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-emerald-700">{m.type === "payment" ? "💰 دفعة" : m.type === "status_change" ? "📦 حالة" : m.type === "due_reminder" ? "⏰ تذكير" : "📨 رسالة"}</span>
                    <span className="text-[10px] text-gray-400">{formatDate(m.sentAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                </div>
              ))}
              {customerMessages.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لم يتم إرسال أي رسالة لهذا العميل</p>}
            </div>
          )}
        </div>
      </div>

      {customer.notes && (
        <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
          <p className="text-xs font-bold text-amber-800 mb-1">ملاحظات</p>
          <p className="text-xs text-amber-700 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}
