import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Users, ShoppingBag, Receipt, Phone, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRepStore } from "@/stores/repStore";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, formatPhone } from "@/lib/formatters";

interface ReceiptInfo {
  id: string;
  amount: number;
  date: string;
  customer_name: string;
  receipt_url: string;
  method: string;
}

export default function RepActivity() {
  const { repId } = useParams<{ repId: string }>();
  const { user } = useAuth();
  const { reps, getRepCommissions, getRepTotalEarned, initializeData } = useRepStore();
  const { customers, orders, initializeData: initData } = useDataStore();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState<"customers" | "orders" | "receipts">("customers");
  const [receipts, setReceipts] = useState<ReceiptInfo[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initData(user.id);
    }
  }, [user?.id, initializeData, initData]);

  const rep = reps.find((r) => r.id === repId);

  const repCustomers = useMemo(() => {
    return customers.filter((c) => {
      const ca = c as typeof c & { addedById?: string; addedByName?: string };
      const matchRep = ca.addedById === repId || ca.addedByName === rep?.name;
      if (!matchRep) return false;
      if (dateFrom && c.createdAt < dateFrom) return false;
      if (dateTo && c.createdAt > dateTo) return false;
      return true;
    });
  }, [customers, repId, rep?.name, dateFrom, dateTo]);

  const repOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.repId !== repId && o.repName !== rep?.name) return false;
      if (dateFrom && o.createdAt < dateFrom) return false;
      if (dateTo && o.createdAt > dateTo) return false;
      return true;
    });
  }, [orders, repId, rep?.name, dateFrom, dateTo]);

  // Load receipts: payments with receipt_url for orders by this rep
  useEffect(() => {
    if (!repId || repOrders.length === 0) { setReceipts([]); return; }
    setLoadingReceipts(true);
    const orderIds = repOrders.map((o) => o.id);
    supabase.from("payments").select("id, amount, date, customer_name, receipt_url, method")
      .in("order_id", orderIds).neq("receipt_url", "").then(({ data }) => {
        setReceipts((data || []) as ReceiptInfo[]);
        setLoadingReceipts(false);
      });
  }, [repId, repOrders.length]);

  const commissions = repId ? getRepCommissions(repId) : [];
  const totalEarned = repId ? getRepTotalEarned(repId) : 0;
  const totalSales = repOrders.reduce((s, o) => s + o.total, 0);

  if (!rep) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">لم يتم العثور على المندوب</p>
        <Link to="/reps" className="text-sm text-gold font-semibold hover:underline mt-2 inline-block">العودة للمناديب</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <Link to="/reps" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy">
        <ArrowLeft className="size-4" /> العودة للمناديب
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-bl from-emerald-600 to-emerald-700 p-6 text-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex size-16 items-center justify-center rounded-full bg-white text-xl font-bold text-emerald-700 shrink-0">
            {rep.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{rep.name}</h1>
            <div className="flex items-center gap-3 text-xs text-white/80 mt-1 flex-wrap">
              {rep.email && <span className="flex items-center gap-1" dir="ltr">{rep.email}</span>}
              {rep.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" /> {formatPhone(rep.phone)}</span>}
              <span>عمولة: {rep.commissionRate}%</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rep.isActive ? "bg-white/30" : "bg-red-500/50"}`}>
                {rep.isActive ? "نشط" : "معطل"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="size-4 text-gold-dark" />
          <h3 className="text-sm font-bold text-navy">تصفية حسب التاريخ</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">من</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">إلى</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gold focus:outline-none" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="self-end rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <Users className="size-5 text-blue-500 mb-2" />
          <p className="text-xs text-gray-500">عملاء أُضيفوا</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{repCustomers.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <ShoppingBag className="size-5 text-emerald-500 mb-2" />
          <p className="text-xs text-gray-500">إجمالي الطلبات</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{repOrders.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <Receipt className="size-5 text-gold-dark mb-2" />
          <p className="text-xs text-gray-500">إجمالي المبيعات</p>
          <p className="text-base font-bold text-gold-dark tabular-nums">{formatCurrency(totalSales)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <Calendar className="size-5 text-purple-500 mb-2" />
          <p className="text-xs text-gray-500">العمولات المكتسبة</p>
          <p className="text-base font-bold text-purple-600 tabular-nums">{formatCurrency(totalEarned)}</p>
          <p className="text-[10px] text-gray-400">{commissions.length} عمولة</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b">
          {([
            { key: "customers", label: `العملاء (${repCustomers.length})`, icon: Users },
            { key: "orders", label: `الطلبات (${repOrders.length})`, icon: ShoppingBag },
            { key: "receipts", label: `الإيصالات (${receipts.length})`, icon: Receipt },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold transition-colors ${
                tab === t.key ? "border-b-2 border-gold text-navy bg-cream/30" : "text-gray-500"
              }`}>
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {tab === "customers" && (
            <div className="space-y-2">
              {repCustomers.map((c) => (
                <Link key={c.id} to={`/customers/${c.id}`}
                  className="flex items-center justify-between rounded-xl bg-cream/40 p-3 hover:bg-cream/60 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy">{c.name}</p>
                      <p className="text-[10px] text-gray-500" dir="ltr">{formatPhone(c.phone)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">{formatDate(c.createdAt)}</span>
                </Link>
              ))}
              {repCustomers.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لم يتم إضافة عملاء في هذه الفترة</p>}
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-2">
              {repOrders.map((o) => (
                <Link key={o.id} to={`/invoice/${o.id}`}
                  className="flex items-center justify-between rounded-xl bg-cream/40 p-3 hover:bg-cream/60 flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-bold text-navy" dir="ltr">{o.orderNumber}</p>
                    <p className="text-[10px] text-gray-500">{o.customerName} · {formatDate(o.createdAt)}</p>
                  </div>
                  <span className="text-sm font-bold text-gold tabular-nums">{formatCurrency(o.total)}</span>
                </Link>
              ))}
              {repOrders.length === 0 && <p className="text-center text-sm text-gray-400 py-8">لا توجد طلبات في هذه الفترة</p>}
            </div>
          )}

          {tab === "receipts" && (
            <>
              {loadingReceipts ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-6 animate-spin text-navy" /></div>
              ) : receipts.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">لم يتم رفع إيصالات لهذا المندوب</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {receipts.map((r) => (
                    <a key={r.id} href={r.receipt_url} target="_blank" rel="noreferrer"
                      className="block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      <img src={r.receipt_url} alt="" className="w-full h-32 object-cover" />
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-emerald-700 tabular-nums">{formatCurrency(r.amount)}</p>
                        <p className="text-[10px] text-gray-500 truncate">{r.customer_name}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(r.date)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
