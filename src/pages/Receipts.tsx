import { useState, useEffect, useMemo } from "react";
import { Image as ImageIcon, Search, X, Calendar, User, Download, ExternalLink, FileImage, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface ReceiptRecord {
  id: string;
  customerName: string;
  amount: number;
  method: string;
  date: string;
  receiptUrl: string;
  notes: string;
  orderId: string;
  recordedById: string;
  recordedByName: string;
}

interface RepStats {
  name: string;
  count: number;
  total: number;
}

export default function Receipts() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [showRepReport, setShowRepReport] = useState(false);

  useEffect(() => {
    if (user?.id) loadReceipts();
  }, [user?.id]);

  const loadReceipts = async () => {
    setLoading(true);
    const { data } = await supabase.from("payments")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false });

    if (data) {
      setReceipts(data
        .filter((p: { receipt_url?: string; notes?: string }) => p.receipt_url || (p.notes && p.notes.includes("إيصال:")))
        .map((p: { id: string; customer_name: string; amount: number; method: string; date: string; receipt_url?: string; notes?: string; order_id?: string; recorded_by_id?: string; recorded_by_name?: string }) => ({
          id: p.id,
          customerName: p.customer_name,
          amount: Number(p.amount),
          method: p.method,
          date: p.date,
          receiptUrl: p.receipt_url || "",
          notes: p.notes || "",
          orderId: p.order_id || "",
          recordedById: p.recorded_by_id || "",
          recordedByName: p.recorded_by_name || "",
        })));
    }
    setLoading(false);
  };

  // Extract receipt URL — fallback to notes parsing
  const getReceiptUrl = (receipt: ReceiptRecord) => {
    if (receipt.receiptUrl && receipt.receiptUrl.startsWith("http")) return receipt.receiptUrl;
    const match = receipt.notes.match(/إيصال: (https?:\/\/[^\s\n]+)/);
    return match?.[1] || "";
  };

  const uniqueReps = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach(r => {
      if (r.recordedByName) set.add(r.recordedByName);
    });
    return Array.from(set).sort();
  }, [receipts]);

  const repStats = useMemo<RepStats[]>(() => {
    const map = new Map<string, { count: number; total: number }>();
    receipts.forEach(r => {
      const name = r.recordedByName || "غير معروف";
      const e = map.get(name) || { count: 0, total: 0 };
      e.count++;
      e.total += r.amount;
      map.set(name, e);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      const matchSearch = !search || r.customerName.includes(search) || r.notes.includes(search);
      const matchDate = !dateFilter || r.date.startsWith(dateFilter);
      const matchRep = repFilter === "all" || r.recordedByName === repFilter || (repFilter === "unknown" && !r.recordedByName);
      return matchSearch && matchDate && matchRep;
    });
  }, [receipts, search, dateFilter, repFilter]);

  const methodLabels: Record<string, string> = { cash: "نقداً", transfer: "تحويل", card: "بطاقة" };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">معرض الإيصالات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{receipts.length} إيصال مرفق — يمكنك التصفية بالعميل أو التاريخ أو المندوب</p>
        </div>
        <button onClick={() => setShowRepReport(!showRepReport)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            showRepReport ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}>
          <BarChart3 className="size-3.5" />
          {showRepReport ? "إخفاء التقرير" : "تقرير المناديب"}
        </button>
      </div>

      {/* Rep Stats Report */}
      {showRepReport && repStats.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-50 to-white p-5 border border-emerald-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="size-5 text-emerald-700" />
            <h2 className="text-sm font-bold text-emerald-900">تقرير الإيصالات لكل مندوب</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {repStats.map((rep, idx) => (
              <div key={rep.name} className="rounded-xl bg-white p-4 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${
                    idx === 0 ? "bg-yellow-100 text-yellow-700" :
                    idx === 1 ? "bg-gray-100 text-gray-700" :
                    idx === 2 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {rep.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-navy truncate">{rep.name}</p>
                    <p className="text-[10px] text-gray-500">{idx === 0 ? "🥇 الأول" : idx === 1 ? "🥈 الثاني" : idx === 2 ? "🥉 الثالث" : `الترتيب #${idx + 1}`}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-[9px] text-gray-500">عدد الإيصالات</p>
                    <p className="text-base font-bold text-emerald-600 tabular-nums">{rep.count}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500">المبلغ الإجمالي</p>
                    <p className="text-sm font-bold text-gold-dark tabular-nums">{formatCurrency(rep.total)}</p>
                  </div>
                </div>
                <button onClick={() => setRepFilter(rep.name)}
                  className="mt-3 w-full rounded-lg bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                  عرض إيصالاته فقط
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none"
            placeholder="بحث بالعميل..." />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-gray-400" />
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          {dateFilter && (
            <button onClick={() => setDateFilter("")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <User className="size-4 text-gray-400" />
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none">
            <option value="all">كل المناديب ({receipts.length})</option>
            {uniqueReps.map(name => {
              const count = receipts.filter(r => r.recordedByName === name).length;
              return <option key={name} value={name}>{name} ({count})</option>;
            })}
            {receipts.some(r => !r.recordedByName) && (
              <option value="unknown">غير معروف ({receipts.filter(r => !r.recordedByName).length})</option>
            )}
          </select>
          {repFilter !== "all" && (
            <button onClick={() => setRepFilter("all")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active filters indicator */}
      {(repFilter !== "all" || dateFilter || search) && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>عرض {filtered.length} من {receipts.length}</span>
          {repFilter !== "all" && (
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-700 font-semibold">
              المندوب: {repFilter}
            </span>
          )}
        </div>
      )}

      {/* Receipt Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-navy/20 border-t-navy" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((receipt, idx) => {
            const url = getReceiptUrl(receipt);
            return (
              <div key={receipt.id}
                className="group rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all animate-fade-in opacity-0"
                style={{ animationDelay: `${Math.min(idx, 20) * 40}ms` }}
                onClick={() => setSelectedReceipt(receipt)}>
                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                  {url ? (
                    <img src={url} alt={`إيصال ${receipt.customerName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileImage className="size-12 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                    <span className="text-[10px] font-bold text-white">{formatCurrency(receipt.amount)}</span>
                  </div>
                  {receipt.recordedByName && (
                    <div className="absolute bottom-2 right-2 rounded-lg bg-emerald-500/90 px-2 py-1 backdrop-blur-sm flex items-center gap-1">
                      <User className="size-3 text-white" />
                      <span className="text-[9px] font-bold text-white truncate max-w-[100px]">{receipt.recordedByName}</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-navy truncate">{receipt.customerName}</p>
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">
                      {methodLabels[receipt.method] || receipt.method}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">{formatDate(receipt.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16">
          <ImageIcon className="size-12 text-gray-300" />
          <p className="text-sm text-gray-400">لا توجد إيصالات مطابقة</p>
        </div>
      )}

      {/* Lightbox / Full-size viewer */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReceipt(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedReceipt(null)}
              className="absolute -top-3 -left-3 z-10 rounded-full bg-white p-2 shadow-lg hover:bg-gray-100">
              <X className="size-5 text-gray-700" />
            </button>

            <div className="rounded-2xl overflow-hidden bg-white shadow-2xl">
              <div className="max-h-[60vh] overflow-hidden">
                <img src={getReceiptUrl(selectedReceipt) || ""} alt="الإيصال"
                  className="w-full object-contain max-h-[60vh]" />
              </div>
              <div className="p-5 space-y-3 border-t">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-bold text-navy">{selectedReceipt.customerName}</h3>
                    <p className="text-xs text-gray-400">{formatDate(selectedReceipt.date)} · {methodLabels[selectedReceipt.method] || selectedReceipt.method}</p>
                    {selectedReceipt.recordedByName && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                        <User className="size-3" /> سجلها: {selectedReceipt.recordedByName}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-gold tabular-nums">{formatCurrency(selectedReceipt.amount)}</p>
                  </div>
                </div>
                {selectedReceipt.notes && (
                  <p className="text-xs text-gray-500 bg-cream/60 rounded-lg p-3 whitespace-pre-wrap">{selectedReceipt.notes.replace(/\n📎.*$/, "").trim()}</p>
                )}
                <div className="flex gap-2">
                  <a href={getReceiptUrl(selectedReceipt) || ""} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-light">
                    <ExternalLink className="size-3.5" /> فتح بحجم كامل
                  </a>
                  <a href={getReceiptUrl(selectedReceipt) || ""} download
                    className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                    <Download className="size-3.5" /> تحميل
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
