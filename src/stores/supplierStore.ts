import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Supplier, SupplierTransaction } from "@/types";
import { toast } from "sonner";

interface SupplierState {
  suppliers: Supplier[];
  transactions: SupplierTransaction[];
  loading: boolean;
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addSupplier: (s: Omit<Supplier, "id" | "createdAt">, userId: string) => Promise<void>;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addTransaction: (t: Omit<SupplierTransaction, "id">) => Promise<void>;
  deleteTransaction: (id: string) => void;
  getSupplierBalance: (supplierId: string) => { totalPurchases: number; totalPayments: number; totalReturns: number; remaining: number; totalPieces: number; fabricByUnit: Record<string, number> };
  getSupplierTransactions: (supplierId: string) => SupplierTransaction[];
  getTotalSupplierDebt: () => number;
  getTotalFabricByUnit: () => Record<string, number>;
}

export const useSupplierStore = create<SupplierState>()((set, get) => ({
  suppliers: [],
  transactions: [],
  loading: true,
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) return;
    const [supRes, txRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("supplier_transactions").select("*").order("date", { ascending: false }),
    ]);
    const suppliers = (supRes.data || []).map((s: any) => ({
      id: s.id, name: s.name, phone: s.phone, email: s.email, company: s.company, city: s.city, notes: s.notes, createdAt: s.created_at?.split("T")[0] || "",
    }));
    const transactions = (txRes.data || []).map((t: any) => ({
      id: t.id, supplierId: t.supplier_id, supplierName: t.supplier_name, type: t.type,
      amount: Number(t.amount), pieces: t.pieces, fabricType: t.fabric_type,
      fabricUnit: t.fabric_unit || "متر", fabricQuantity: Number(t.fabric_quantity || 0),
      date: t.date, notes: t.notes,
    }));
    set({ suppliers, transactions, loading: false, initialized: true });
  },

  addSupplier: async (data, userId) => {
    const { data: row, error } = await supabase.from("suppliers").insert({
      user_id: userId, name: data.name, phone: data.phone, email: data.email || "",
      company: data.company || "", city: data.city || "", notes: data.notes || "",
    }).select().single();
    if (error) { toast.error("فشل إضافة المورد"); return; }
    set((s) => ({ suppliers: [{ id: row.id, ...data, createdAt: row.created_at?.split("T")[0] || "" }, ...s.suppliers] }));
  },

  updateSupplier: async (id, data) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.phone) payload.phone = data.phone;
    if (data.company) payload.company = data.company;
    if (data.city) payload.city = data.city;
    if (data.notes !== undefined) payload.notes = data.notes;
    await supabase.from("suppliers").update(payload).eq("id", id);
    set((s) => ({ suppliers: s.suppliers.map((sup) => (sup.id === id ? { ...sup, ...data } : sup)) }));
  },

  deleteSupplier: async (id) => {
    await supabase.from("suppliers").delete().eq("id", id);
    set((s) => ({ suppliers: s.suppliers.filter((sup) => sup.id !== id) }));
  },

  addTransaction: async (data) => {
    const { data: row, error } = await supabase.from("supplier_transactions").insert({
      supplier_id: data.supplierId, supplier_name: data.supplierName, type: data.type,
      amount: data.amount, pieces: data.pieces, fabric_type: data.fabricType || "",
      fabric_unit: data.fabricUnit || "متر", fabric_quantity: data.fabricQuantity || 0,
      date: data.date, notes: data.notes || "",
    }).select().single();
    if (error) { toast.error("فشل تسجيل العملية"); return; }
    set((s) => ({ transactions: [{ id: row.id, ...data }, ...s.transactions] }));
  },

  deleteTransaction: async (id) => {
    await supabase.from("supplier_transactions").delete().eq("id", id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  getSupplierBalance: (supplierId) => {
    const txs = get().transactions.filter((t) => t.supplierId === supplierId);
    const totalPurchases = txs.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0);
    const totalPayments = txs.filter((t) => t.type === "payment").reduce((s, t) => s + t.amount, 0);
    const totalReturns = txs.filter((t) => t.type === "return").reduce((s, t) => s + t.amount, 0);
    const totalPieces = txs.filter((t) => t.type === "purchase").reduce((s, t) => s + t.pieces, 0) - txs.filter((t) => t.type === "return").reduce((s, t) => s + t.pieces, 0);
    // Fabric by unit
    const fabricByUnit: Record<string, number> = {};
    txs.forEach((t) => {
      if (t.fabricQuantity > 0) {
        const unit = t.fabricUnit || "متر";
        const multiplier = t.type === "return" ? -1 : t.type === "purchase" ? 1 : 0;
        fabricByUnit[unit] = (fabricByUnit[unit] || 0) + (t.fabricQuantity * multiplier);
      }
    });
    return { totalPurchases, totalPayments, totalReturns, remaining: totalPurchases - totalPayments - totalReturns, totalPieces, fabricByUnit };
  },

  getSupplierTransactions: (supplierId) => get().transactions.filter((t) => t.supplierId === supplierId).sort((a, b) => b.date.localeCompare(a.date)),

  getTotalSupplierDebt: () => {
    const state = get();
    return state.suppliers.reduce((total, sup) => {
      const balance = get().getSupplierBalance(sup.id);
      return total + Math.max(0, balance.remaining);
    }, 0);
  },

  getTotalFabricByUnit: () => {
    const txs = get().transactions;
    const result: Record<string, number> = {};
    txs.forEach((t) => {
      if (t.fabricQuantity > 0) {
        const unit = t.fabricUnit || "متر";
        const multiplier = t.type === "return" ? -1 : t.type === "purchase" ? 1 : 0;
        result[unit] = (result[unit] || 0) + (t.fabricQuantity * multiplier);
      }
    });
    return result;
  },
}));
