import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { SalesRep, RepCommission } from "@/types";
import { toast } from "sonner";

interface RepState {
  reps: SalesRep[];
  commissions: RepCommission[];
  loading: boolean;
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addRep: (r: Omit<SalesRep, "id" | "createdAt">, userId: string) => Promise<void>;
  updateRep: (id: string, data: Partial<SalesRep>) => void;
  deleteRep: (id: string) => void;
  addCommission: (c: Omit<RepCommission, "id">) => Promise<void>;
  markCommissionPaid: (id: string) => void;
  deleteCommission: (id: string) => void;
  getRepCommissions: (repId: string) => RepCommission[];
  getRepTotalEarned: (repId: string) => number;
  getRepTotalPaid: (repId: string) => number;
  getRepTotalPending: (repId: string) => number;
  getTotalCommissions: () => number;
  getTotalPendingCommissions: () => number;
}

export const useRepStore = create<RepState>()((set, get) => ({
  reps: [],
  commissions: [],
  loading: true,
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) return;
    const [repRes, comRes] = await Promise.all([
      supabase.from("sales_reps").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("rep_commissions").select("*").order("date", { ascending: false }),
    ]);
    const reps = (repRes.data || []).map((r: any) => ({
      id: r.id, name: r.name, phone: r.phone, email: r.email, city: r.city,
      commissionRate: Number(r.commission_rate), notes: r.notes, isActive: r.is_active, createdAt: r.created_at?.split("T")[0] || "",
    }));
    const commissions = (comRes.data || []).map((c: any) => ({
      id: c.id, repId: c.rep_id, repName: c.rep_name, orderId: c.order_id, orderNumber: c.order_number,
      orderTotal: Number(c.order_total), commissionAmount: Number(c.commission_amount),
      shippingDeduction: Number(c.shipping_deduction), netCommission: Number(c.net_commission),
      isPaid: c.is_paid, date: c.date, notes: c.notes,
    }));
    set({ reps, commissions, loading: false, initialized: true });
  },

  addRep: async (data, userId) => {
    const { data: row, error } = await supabase.from("sales_reps").insert({
      user_id: userId, name: data.name, phone: data.phone, email: data.email || "",
      city: data.city || "", commission_rate: data.commissionRate, notes: data.notes || "", is_active: data.isActive !== false,
    }).select().single();
    if (error) { toast.error("فشل إضافة المندوب"); return; }
    set((s) => ({ reps: [{ id: row.id, ...data, createdAt: row.created_at?.split("T")[0] || "" }, ...s.reps] }));
  },

  updateRep: async (id, data) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.commissionRate !== undefined) payload.commission_rate = data.commissionRate;
    await supabase.from("sales_reps").update(payload).eq("id", id);
    set((s) => ({ reps: s.reps.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },

  deleteRep: async (id) => {
    await supabase.from("sales_reps").delete().eq("id", id);
    set((s) => ({ reps: s.reps.filter((r) => r.id !== id) }));
  },

  addCommission: async (data) => {
    const { data: row, error } = await supabase.from("rep_commissions").insert({
      rep_id: data.repId, rep_name: data.repName, order_id: data.orderId, order_number: data.orderNumber,
      order_total: data.orderTotal, commission_amount: data.commissionAmount,
      shipping_deduction: data.shippingDeduction, net_commission: data.netCommission,
      is_paid: data.isPaid, date: data.date, notes: data.notes || "",
    }).select().single();
    if (error) { console.error(error); return; }
    set((s) => ({ commissions: [{ id: row.id, ...data }, ...s.commissions] }));
  },

  markCommissionPaid: async (id) => {
    await supabase.from("rep_commissions").update({ is_paid: true }).eq("id", id);
    set((s) => ({ commissions: s.commissions.map((c) => (c.id === id ? { ...c, isPaid: true } : c)) }));
  },

  deleteCommission: async (id) => {
    await supabase.from("rep_commissions").delete().eq("id", id);
    set((s) => ({ commissions: s.commissions.filter((c) => c.id !== id) }));
  },

  getRepCommissions: (repId) => get().commissions.filter((c) => c.repId === repId).sort((a, b) => b.date.localeCompare(a.date)),
  getRepTotalEarned: (repId) => get().commissions.filter((c) => c.repId === repId).reduce((s, c) => s + c.netCommission, 0),
  getRepTotalPaid: (repId) => get().commissions.filter((c) => c.repId === repId && c.isPaid).reduce((s, c) => s + c.netCommission, 0),
  getRepTotalPending: (repId) => get().commissions.filter((c) => c.repId === repId && !c.isPaid).reduce((s, c) => s + c.netCommission, 0),
  getTotalCommissions: () => get().commissions.reduce((s, c) => s + c.netCommission, 0),
  getTotalPendingCommissions: () => get().commissions.filter((c) => !c.isPaid).reduce((s, c) => s + c.netCommission, 0),
}));
