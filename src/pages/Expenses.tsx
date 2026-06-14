import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Filter, ChevronDown, Trash2, Receipt, TrendingDown, Megaphone, Truck as TruckIcon, Tag, Home, Users, Wrench, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseStore } from "@/stores/expenseStore";
import { formatCurrency, formatDate, getExpenseCategoryLabel, getExpenseCategoryColor } from "@/lib/formatters";
import StatCard from "@/components/features/StatCard";
import type { ExpenseCategory } from "@/types";

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["advertising", "shipping", "promotions", "discounts", "rent", "salaries", "materials", "maintenance", "electricity", "commissions", "other"];

export default function Expenses() {
  const { user } = useAuth();
  const { expenses, initializeData, addExpense, deleteExpense, getTotalExpenses, getExpensesByCategory } = useExpenseStore();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [fc, setFc] = useState<ExpenseCategory>("advertising");
  const [fd, setFd] = useState("");
  const [fa, setFa] = useState(0);
  const [fdate, setFdate] = useState("");
  const [fn, setFn] = useState("");

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  const totalExpenses = getTotalExpenses();
  const byCategory = getExpensesByCategory();

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch = !search || e.description.includes(search);
      const matchCat = catFilter === "all" || e.category === catFilter;
      return matchSearch && matchCat;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, search, catFilter]);

  const handleAdd = async () => {
    if (!fd.trim()) { toast.error("يرجى إدخال وصف المصروف"); return; }
    if (fa <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    if (!user?.id) return;
    await addExpense({ category: fc, description: fd, amount: fa, date: fdate || new Date().toISOString().split("T")[0], notes: fn, isFixed: false }, user.id);
    toast.success("تم تسجيل المصروف");
    setShowForm(false); setFd(""); setFa(0); setFdate(""); setFn("");
  };

  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">المصروفات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{expenses.length} مصروف مسجل</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light active:scale-[0.98]">
          <Plus className="size-4" /> مصروف جديد
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <StatCard title="إجمالي المصروفات" value={formatCurrency(totalExpenses)} icon={TrendingDown} delay={3} />
        {topCats.map(([cat, amount], idx) => (
          <StatCard key={cat} title={getExpenseCategoryLabel(cat)} value={formatCurrency(amount)} icon={Receipt} trend={`${((amount / totalExpenses) * 100).toFixed(0)}%`} delay={idx} />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm border border-gray-100 sm:flex-row sm:gap-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-gray-200 py-2.5 pe-4 ps-10 text-sm focus:border-gold focus:outline-none" placeholder="بحث في المصروفات..." />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm focus:border-gold focus:outline-none">
          <option value="all">كل التصنيفات</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{getExpenseCategoryLabel(c)}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-cream/50 text-right">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">التاريخ</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">التصنيف</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">الوصف</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">المبلغ</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((expense, idx) => (
                <tr key={expense.id} className="hover:bg-cream/30 transition-colors animate-fade-in opacity-0" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(expense.date)}</td>
                  <td className="px-4 py-3"><span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${getExpenseCategoryColor(expense.category)}`}>{getExpenseCategoryLabel(expense.category)}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[250px] truncate">{expense.description}</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 tabular-nums">{formatCurrency(expense.amount)}</td>
                  <td className="px-4 py-3"><button onClick={() => { deleteExpense(expense.id); toast.success("تم حذف المصروف"); }} className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-16 text-center"><Receipt className="mx-auto size-12 text-gray-300" /><p className="mt-3 text-sm text-gray-400">لا توجد مصروفات</p></div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold text-navy">مصروف جديد</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">التصنيف</label>
                <select value={fc} onChange={(e) => setFc(e.target.value as ExpenseCategory)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{getExpenseCategoryLabel(c)}</option>)}
                </select></div>
              <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">الوصف</label>
                <input value={fd} onChange={(e) => setFd(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" placeholder="وصف المصروف..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">المبلغ</label>
                  <input type="number" min="0" value={fa || ""} onChange={(e) => setFa(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
                <div><label className="mb-1.5 block text-sm font-semibold text-gray-700">التاريخ</label>
                  <input type="date" value={fdate} onChange={(e) => setFdate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none" /></div>
              </div>
            </div>
            <div className="flex gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
              <button onClick={handleAdd} className="flex-1 rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-light active:scale-[0.98]">حفظ المصروف</button>
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
