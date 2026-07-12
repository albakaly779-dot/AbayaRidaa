import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Users, ShoppingBag, Package, Truck, UserCheck, FileText, Command } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { useSupplierStore } from "@/stores/supplierStore";
import { useRepStore } from "@/stores/repStore";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  id: string;
  type: "customer" | "order" | "product" | "supplier" | "rep" | "invoice";
  title: string;
  subtitle: string;
  icon: typeof Users;
  color: string;
  path: string;
}

interface Props {
  onClose?: () => void;
}

export default function GlobalSearch({ onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { customers, orders, initializeData } = useDataStore();
  const { suppliers, initializeData: initSup } = useSupplierStore();
  const { reps, initializeData: initReps } = useRepStore();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string; category: string; sell_price: number }>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      initializeData(user.id);
      initSup(user.id);
      initReps(user.id);
      supabase.from("products").select("id, code, name, category, sell_price").eq("is_active", true).then(({ data }) => {
        if (data) setProducts(data);
      });
    }
    inputRef.current?.focus();
  }, [user?.id]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all: SearchResult[] = [];

    // Customers
    customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city?.toLowerCase().includes(q))
      .slice(0, 5).forEach((c) => {
        all.push({
          id: c.id, type: "customer", title: c.name, subtitle: `${c.phone}${c.city ? ` · ${c.city}` : ""}`,
          icon: Users, color: "text-purple-600 bg-purple-50", path: `/customers/${c.id}`,
        });
      });

    // Orders
    orders.filter((o) => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
      .slice(0, 5).forEach((o) => {
        all.push({
          id: o.id, type: "order", title: `طلب ${o.orderNumber}`, subtitle: `${o.customerName} · ${o.total.toLocaleString()} ر.ي`,
          icon: ShoppingBag, color: "text-blue-600 bg-blue-50", path: `/invoice/${o.id}`,
        });
      });

    // Products
    products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .slice(0, 5).forEach((p) => {
        all.push({
          id: p.id, type: "product", title: p.name, subtitle: `${p.code} · ${p.category}`,
          icon: Package, color: "text-emerald-600 bg-emerald-50", path: "/products",
        });
      });

    // Suppliers
    suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q) || s.phone.includes(q))
      .slice(0, 3).forEach((s) => {
        all.push({
          id: s.id, type: "supplier", title: s.name, subtitle: `${s.company || s.phone}`,
          icon: Truck, color: "text-amber-600 bg-amber-50", path: "/suppliers",
        });
      });

    // Reps
    reps.filter((r) => r.name.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) || r.phone?.includes(q))
      .slice(0, 3).forEach((r) => {
        all.push({
          id: r.id, type: "rep", title: r.name, subtitle: `${r.email || r.phone || "-"} · ${r.commissionRate}%`,
          icon: UserCheck, color: "text-cyan-600 bg-cyan-50", path: "/reps",
        });
      });

    return all.slice(0, 20);
  }, [query, customers, orders, products, suppliers, reps]);

  const handleSelect = (r: SearchResult) => {
    navigate(r.path);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:pt-24 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-5 text-gray-400" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="ابحث في: العملاء، الطلبات، المنتجات، الموردين، المندوبين..."
            className="flex-1 border-0 focus:outline-none text-sm placeholder:text-gray-400" />
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5">
              <Command className="size-3" /> K
            </span>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {!query ? (
            <div className="p-6 text-center text-gray-400">
              <Search className="mx-auto size-8 text-gray-300 mb-2" />
              <p className="text-sm">ابدأ بالكتابة للبحث في جميع البيانات</p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px]">↑ ↓ للتنقل</span>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px]">Enter للاختيار</span>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px]">Esc للإغلاق</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <FileText className="mx-auto size-8 text-gray-300 mb-2" />
              <p className="text-sm">لا توجد نتائج لـ "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button key={`${r.type}-${r.id}`} onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                      activeIndex === i ? "bg-cream/60" : "hover:bg-gray-50"
                    }`}>
                    <div className={`rounded-lg p-2 ${r.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy truncate">{r.title}</p>
                      <p className="text-[11px] text-gray-500 truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                      {r.type === "customer" ? "عميل" : r.type === "order" ? "طلب" : r.type === "product" ? "منتج" : r.type === "supplier" ? "مورد" : r.type === "rep" ? "مندوب" : "فاتورة"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t px-4 py-2 bg-gray-50 text-[10px] text-gray-500 flex items-center justify-between">
            <span>{results.length} نتيجة</span>
            <span>اضغط Enter للفتح</span>
          </div>
        )}
      </div>
    </div>
  );
}
