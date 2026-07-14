import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Expense, ExpenseCategory } from "@/types";
import { toast } from "sonner";

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">, userId: string) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  getTotalExpenses: () => number;
  getFixedExpenses: () => number;
  getVariableExpenses: () => number;
  getExpensesByCategory: () => Record<ExpenseCategory, number>;
  getMonthlyExpenses: (year: number, month: number) => Expense[];
  getTotalExpensesForMonth: (year: number, month: number) => number;
}

export const useExpenseStore = create<ExpenseState>()((set, get) => ({
  expenses: [],
  loading: true,
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) return;
    const { data } = await supabase.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: false });
    const expenses = (data || []).map((e: Expense) => ({
      id: e.id, category: e.category as ExpenseCategory, description: e.description,
      amount: Number(e.amount), date: e.date, notes: e.notes, isFixed: e.is_fixed,
    }));
    set({ expenses, loading: false, initialized: true });
  },

  addExpense: async (data, userId) => {
    const { data: row, error } = await supabase.from("expenses").insert({
      user_id: userId, category: data.category, description: data.description,
      amount: data.amount, date: data.date, notes: data.notes || "", is_fixed: data.isFixed || false,
    }).select().single();
    if (error) { toast.error("فشل تسجيل المصروف"); return; }
    set((s) => ({ expenses: [{ id: row.id, ...data }, ...s.expenses] }));
  },

  updateExpense: async (id, data) => {
    const payload: Partial<Expense> = {};
    if (data.amount !== undefined) payload.amount = data.amount;
    if (data.description !== undefined) payload.description = data.description;
    if (data.category !== undefined) payload.category = data.category;
    await supabase.from("expenses").update(payload).eq("id", id);
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)) }));
  },

  deleteExpense: async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
  },

  getTotalExpenses: () => get().expenses.reduce((s, e) => s + e.amount, 0),
  getFixedExpenses: () => get().expenses.filter((e) => e.isFixed).reduce((s, e) => s + e.amount, 0),
  getVariableExpenses: () => get().expenses.filter((e) => !e.isFixed).reduce((s, e) => s + e.amount, 0),

  getExpensesByCategory: () => {
    const result = {} as Record<ExpenseCategory, number>;
    get().expenses.forEach((e) => { result[e.category] = (result[e.category] || 0) + e.amount; });
    return result;
  },

  getMonthlyExpenses: (year, month) => get().expenses.filter((e) => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() === month; }),
  getTotalExpensesForMonth: (year, month) => get().getMonthlyExpenses(year, month).reduce((s, e) => s + e.amount, 0),
}));
