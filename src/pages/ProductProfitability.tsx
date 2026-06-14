import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, Package, DollarSign, BarChart3, Loader2, Search, Award, Crown, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/formatters";

interface DBProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  sell_price: number;
  total_cost: number;
  stock_quantity: number;
}

type SortBy = "revenue" | "profit" | "units" | "margin";

export default function ProductProfitability() {
  const { user } = useAuth();
  const { orders, loading: ordersLoading, initializeData } = useDataStore();
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showOnlySold, setShowOnlySold] = useState(true);

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id, initializeData]);
  useEffect(() => {
    supabase.from("products").select("id, code, name, category, sell_price, total_cost, stock_quantity").then(({ data }) => {
      setProducts((data || []) as DBProduct[]);
      setLoadingProducts(false);
    });
  }, []);

  const productStats = useMemo(() => {
    const map = new Map<string, { code: string; name: string; category: string; units: number; revenue: number; cost: number; orders: number; stock: number }>();

    products.forEach(p => {
      map.set(p.code, {
        code: p.code,
        name: p.name,
        category: p.category,
        units: 0,
        revenue: 0,
        cost: 0,
        orders: 0,
        stock: p.stock_quantity,
      });
    });

    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.productCode || item.productName;
        const existing = map.get(key) || {
          code: item.productCode || "—",
          name: item.productName,
          category: "—",
          units: 0,
          revenue: 0,
          cost: 0,
          orders: 0,
          stock: 0,
        };
        existing.units += item.quantity;
        existing.revenue += item.total;
        existing.cost += (item.buyPrice || 0) * item.quantity;
        existing.orders += 1;
        map.set(key, existing);
      });
    });

    return Array.from(map.values()).map(s => ({
      ...s,
      profit: s.revenue - s.cost,
      margin: s.revenue > 0 ? ((s.revenue - s.cost) / s.revenue) * 100 : 0,
      avgPrice: s.units > 0 ? s.revenue / s.units : 0,
    }));
  }, [orders, products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    productStats.forEach(p => p.category && p.category !== "—" && set.add(p.category));
    return Array.from(set).sort();
  }, [productStats]);

  const filtered = useMemo(() => {
    return productStats.filter(p => {
      if (showOnlySold && p.units === 0) return false;
      if (search && !p.code.toLowerCase().includes(search.toLowerCase()) && !p.name.includes(search)) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "revenue") return b.revenue - a.revenue;
      if (sortBy === "profit") return b.profit - a.profit;
      if (sortBy === "units") return b.units - a.units;
      return b.margin - a.margin;
    });
  }, [productStats, search, categoryFilter, sortBy, showOnlySold]);

  const sold = filtered.filter(p => p.units > 0);
  const top10 = sold.slice(0, 10).map(p => ({
    name: p.name.length > 18 ? p.name.substring(0, 18) + "..." : p.name,
    revenue: p.revenue,
    profit: p.profit,
    units: p.units,
  }));

  const totals = useMemo(() => ({
    revenue: sold.reduce((s, p) => s + p.revenue, 0),
    cost: sold.reduce((s, p) => s + p.cost, 0),
    profit: sold.reduce((s, p) => s + p.profit, 0),
    units: sold.reduce((s, p) => s + p.units, 0),
    productCount: sold.length,
  }), [sold]);

  if (ordersLoading || loadingProducts) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <Link to="/reports" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy mb-2">
          <ArrowLeft className="size-4" /> العودة للتقارير
        </Link>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">تقرير ربحية المنتجات</h1>
        <p className="text-xs text-gray-500 sm:text-sm">أكثر المنتجات مبيعاً وربحاً مع نسبة الهامش وعدد الوحدات</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-bl from-gold to-gold-dark p-4 text-white shadow-lg shadow-gold/20">
          <DollarSign className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجمالي الإيرادات</p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(totals.revenue)}</p>
          <p className="text-[10px] text-white/60">{formatCurrency(totals.revenue, "SAR")}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald/20">
          <TrendingUp className="size-5 mb-2" />
          <p className="text-xs text-white/80">إجمالي الأرباح</p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(totals.profit)}</p>
          <p className="text-[10px] text-white/60">هامش: {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0"}%</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <Package className="size-5 text-blue-500 mb-2" />
          <p className="text-xs text-gray-500">الوحدات المباعة</p>
          <p className="text-base font-bold text-navy tabular-nums">{totals.units}</p>
          <p className="text-[10px] text-gray-400">من {orders.length} طلب</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
          <BarChart3 className="size-5 text-purple-500 mb-2" />
          <p className="text-xs text-gray-500">منتج تم بيعه</p>
          <p className="text-base font-bold text-navy tabular-nums">{totals.productCount}</p>
          <p className="text-[10px] text-gray-400">من أصل {productStats.length}</p>
        </div>
      </div>

      {/* Top 3 Highlight Cards */}
      {sold.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sold.slice(0, 3).map((p, i) => (
            <div key={p.code} className={`rounded-2xl p-4 border-2 ${
              i === 0 ? "bg-gradient-to-bl from-yellow-50 to-amber-50 border-yellow-300" :
              i === 1 ? "bg-gradient-to-bl from-gray-50 to-gray-100 border-gray-300" :
              "bg-gradient-to-bl from-orange-50 to-amber-50 border-orange-300"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {i === 0 ? <Crown className="size-5 text-yellow-600" /> : i === 1 ? <Award className="size-5 text-gray-500" /> : <Star className="size-5 text-orange-500" />}
                <span className="text-xs font-bold">{i === 0 ? "الأول" : i === 1 ? "الثاني" : "الثالث"}</span>
              </div>
              <p className="text-sm font-bold text-navy" dir="ltr">{p.code}</p>
              <p className="text-[11px] text-gray-600 truncate">{p.name}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                <div>
                  <p className="text-[9px] text-gray-500">الوحدات</p>
                  <p className="text-sm font-bold text-blue-600 tabular-nums">{p.units}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">الربح</p>
                  <p className="text-sm font-bold text-emerald-600 tabular-nums">{formatCurrency(p.profit)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top 10 Chart */}
      {top10.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-base font-bold text-navy">أفضل 10 منتجات إيراداً</h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 92%)" />
                <XAxis type="number" tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontFamily: "Cairo", fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} width={120} />
                <Tooltip formatter={(value: number, name: string) => {
                  if (name === "revenue") return [formatCurrency(value), "الإيرادات"];
                  if (name === "profit") return [formatCurrency(value), "الربح"];
                  return [value, "الوحدات"];
                }} contentStyle={{ fontFamily: "Cairo", direction: "rtl", borderRadius: "10px" }} />
                <Bar dataKey="revenue" fill="hsl(40 52% 55%)" radius={[0, 4, 4, 0]} name="revenue" />
                <Bar dataKey="profit" fill="hsl(160 60% 42%)" radius={[0, 4, 4, 0]} name="profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none"
              placeholder="بحث بالرمز أو الاسم..." />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
            <option value="all">كل التصنيفات</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showOnlySold} onChange={(e) => setShowOnlySold(e.target.checked)}
              className="size-4 rounded border-gray-300 text-gold focus:ring-gold" />
            <span className="text-xs font-semibold text-gray-700">المباعة فقط</span>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <span className="self-center text-[10px] text-gray-400 shrink-0">رتب حسب:</span>
          {([
            { value: "revenue", label: "الإيرادات" },
            { value: "profit", label: "الربح" },
            { value: "units", label: "الوحدات" },
            { value: "margin", label: "الهامش %" },
          ] as const).map(s => (
            <button key={s.value} onClick={() => setSortBy(s.value)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                sortBy === s.value ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">#</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">المنتج</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">التصنيف</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الوحدات</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الإيرادات</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">التكلفة</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الربح</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الهامش</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">المخزون</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p, idx) => (
                <tr key={p.code} className="hover:bg-cream/30 transition-colors animate-fade-in opacity-0"
                  style={{ animationDelay: `${Math.min(idx, 20) * 20}ms` }}>
                  <td className="px-3 py-2.5 text-xs sm:px-4">
                    {idx < 3 ? (
                      <span className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        idx === 0 ? "bg-yellow-100 text-yellow-700" :
                        idx === 1 ? "bg-gray-100 text-gray-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {idx + 1}
                      </span>
                    ) : (
                      <span className="text-gray-400">{idx + 1}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <p className="text-xs font-bold text-navy" dir="ltr">{p.code}</p>
                    <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{p.name}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <span className="rounded-lg bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy">{p.category}</span>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 text-xs font-semibold text-blue-600 tabular-nums">{p.units}</td>
                  <td className="px-3 py-2.5 sm:px-4 text-xs font-bold text-gold tabular-nums">{formatCurrency(p.revenue)}</td>
                  <td className="px-3 py-2.5 sm:px-4 text-xs text-red-600 tabular-nums">{formatCurrency(p.cost)}</td>
                  <td className="px-3 py-2.5 sm:px-4 text-xs font-bold text-emerald-600 tabular-nums">{formatCurrency(p.profit)}</td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                      p.margin >= 50 ? "bg-emerald-100 text-emerald-700" :
                      p.margin >= 30 ? "bg-amber-100 text-amber-700" :
                      p.margin >= 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 text-xs text-gray-500 tabular-nums">{p.stock || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Package className="mx-auto size-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">لا توجد منتجات مطابقة</p>
          </div>
        )}
      </div>
    </div>
  );
}
