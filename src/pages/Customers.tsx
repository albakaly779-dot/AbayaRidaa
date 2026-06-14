import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Phone, MapPin, Trash2, UserCircle, MessageCircle, Clock, User2, Filter, X, ExternalLink, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { formatCurrency } from "@/lib/formatters";
import CustomerFormDialog from "@/components/features/CustomerFormDialog";
import WhatsAppButton from "@/components/features/WhatsAppButton";
import CustomerWhatsAppHistory from "@/components/features/CustomerWhatsAppHistory";
import { WHATSAPP_TEMPLATES } from "@/constants/config";

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "واتساب 💬",
  instagram: "إنستقرام 📸",
  facebook: "فيسبوك 📘",
  direct: "مباشر 🏪",
  referral: "توصية 🤝",
  other: "أخرى",
};

const SOURCE_OPTIONS = [
  { value: "", label: "الكل" },
  { value: "whatsapp", label: "واتساب" },
  { value: "instagram", label: "إنستقرام" },
  { value: "facebook", label: "فيسبوك" },
  { value: "direct", label: "مباشر" },
  { value: "referral", label: "توصية" },
  { value: "other", label: "أخرى" },
];

export default function Customers() {
  const { user, role } = useAuth();
  const { customers, orders, initializeData, deleteCustomer, getCustomerDebt } = useDataStore();
  const { notifications, initializeData: initNotifications } = useNotificationStore();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ name: string; phone: string } | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initNotifications(user.id);
    }
  }, [user?.id]);

  // Get unique rep names for filter
  const repNames = useMemo(() => {
    const names = new Set<string>();
    customers.forEach((c) => {
      if ((c as any).addedByName) names.add((c as any).addedByName);
    });
    return Array.from(names);
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch = !search || c.name.includes(search) || c.phone.includes(search) || c.city.includes(search);
      const matchSource = !sourceFilter || (c as any).source === sourceFilter;
      const matchRep = !repFilter || (c as any).addedByName === repFilter;
      return matchSearch && matchSource && matchRep;
    });
  }, [customers, search, sourceFilter, repFilter]);

  const getOrderCount = (customerId: string) => orders.filter((o) => o.customerId === customerId).length;
  const getTotalSpent = (customerId: string) => orders.filter((o) => o.customerId === customerId).reduce((s, o) => s + o.total, 0);

  const getLastContact = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const msg = notifications.find((n) => {
      const nPhone = n.recipientPhone.replace(/\D/g, "");
      return nPhone === cleaned || nPhone.endsWith(cleaned.slice(-9)) || cleaned.endsWith(nPhone.slice(-9));
    });
    if (!msg) return null;
    const d = new Date(msg.sentAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "اليوم";
    if (diffDays === 1) return "أمس";
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
  };

  const getMessageCount = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    return notifications.filter((n) => {
      const nPhone = n.recipientPhone.replace(/\D/g, "");
      return nPhone === cleaned || nPhone.endsWith(cleaned.slice(-9)) || cleaned.endsWith(nPhone.slice(-9));
    }).length;
  };

  const handleDelete = (id: string, name: string) => {
    if (role !== "admin") { toast.error("ليس لديك صلاحية الحذف"); return; }
    if (window.confirm(`هل أنت متأكد من حذف العميل "${name}"؟`)) { deleteCustomer(id); toast.success("تم حذف العميل"); }
  };

  const isReadOnly = role === "support";
  const hasActiveFilters = sourceFilter || repFilter;
  const invalidPhones = customers.filter((c) => {
    const cleaned = c.phone.replace(/\D/g, "");
    return cleaned.length < 9;
  }).length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">إدارة العملاء</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{filtered.length} من {customers.length} عميل</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {role === "admin" && invalidPhones > 0 && (
            <Link to="/phone-validator"
              className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">
              <PhoneCall className="size-3.5" /> فحص {invalidPhones} رقم خاطئ
            </Link>
          )}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${hasActiveFilters ? "border-gold bg-gold/10 text-gold-dark" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <Filter className="size-4" /> تصفية
            {hasActiveFilters && <span className="flex size-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white">{(sourceFilter ? 1 : 0) + (repFilter ? 1 : 0)}</span>}
          </button>
          {!isReadOnly && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 transition-all hover:bg-navy-light active:scale-[0.98]">
              <Plus className="size-4" /> عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">تصفية العملاء</h3>
            {hasActiveFilters && (
              <button onClick={() => { setSourceFilter(""); setRepFilter(""); }}
                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700">
                <X className="size-3" /> مسح الفلاتر
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">المصدر (Lead Source)</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">المندوب</label>
              <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                <option value="">جميع المناديب</option>
                {repNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pe-4 ps-10 text-sm shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          placeholder="بحث بالاسم أو الهاتف أو المدينة..." />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
        {filtered.map((customer, idx) => {
          const debt = getCustomerDebt(customer.id);
          const orderCount = getOrderCount(customer.id);
          const totalSpent = getTotalSpent(customer.id);
          const lastContact = getLastContact(customer.phone);
          const msgCount = getMessageCount(customer.phone);
          return (
            <div key={customer.id}
              className="group rounded-2xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow animate-fade-in opacity-0 sm:p-5"
              style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <Link to={`/customers/${customer.id}`} className="flex items-center gap-2.5 flex-1 min-w-0 hover:text-gold transition-colors">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-bl from-navy to-navy-light text-xs font-bold text-white shrink-0">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-navy flex items-center gap-1 truncate">{customer.name} <ExternalLink className="size-3 text-gray-300" /></h3>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <MapPin className="size-3" /> {customer.city || "—"}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <WhatsAppButton phone={customer.phone} message={WHATSAPP_TEMPLATES.thankYou(customer.name)} />
                  {role === "admin" && (
                    <button onClick={() => handleDelete(customer.id, customer.name)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="حذف">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <Phone className="size-3" /> <span dir="ltr">{customer.phone}</span>
              </div>

              {/* Source & Added by info */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {(customer as any).source && (
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                    {SOURCE_LABELS[(customer as any).source] || (customer as any).source}
                  </span>
                )}
                {(customer as any).addedByName && (
                  <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                    <User2 className="size-2.5" /> {(customer as any).addedByName}
                  </span>
                )}
              </div>

              {/* WhatsApp history summary */}
              <div className="flex items-center justify-between mb-3 rounded-lg bg-emerald-50/60 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="size-3 text-emerald-600" />
                  <span className="text-[10px] font-semibold text-emerald-700">{msgCount} رسالة</span>
                  {lastContact && (
                    <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                      <Clock className="size-2.5" /> {lastContact}
                    </span>
                  )}
                </div>
                {msgCount > 0 && (
                  <button onClick={() => setHistoryTarget({ name: customer.name, phone: customer.phone })}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                    عرض السجل
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-cream/60 p-2.5 sm:p-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">الطلبات</p>
                  <p className="text-xs font-bold text-navy tabular-nums sm:text-sm">{orderCount}</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-[10px] text-gray-400">الإنفاق</p>
                  <p className="text-[10px] font-bold text-gold tabular-nums sm:text-xs">
                    {role === "admin" ? (totalSpent > 0 ? formatCurrency(totalSpent) : "—") : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">المديونية</p>
                  <p className={`text-xs font-bold tabular-nums sm:text-sm ${debt > 0 ? "text-red-600" : "text-green-600"}`}>
                    {role === "admin" ? (debt > 0 ? formatCurrency(debt) : "لا يوجد") : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <UserCircle className="size-12 text-gray-300" />
          <p className="text-sm text-gray-400">
            {hasActiveFilters ? "لا يوجد عملاء مطابقون لهذه الفلاتر" : "لا يوجد عملاء — أضف أول عميل"}
          </p>
        </div>
      )}

      <CustomerFormDialog open={showForm} onClose={() => setShowForm(false)} />
      {historyTarget && (
        <CustomerWhatsAppHistory open onClose={() => setHistoryTarget(null)}
          customerName={historyTarget.name} customerPhone={historyTarget.phone} />
      )}
    </div>
  );
}
