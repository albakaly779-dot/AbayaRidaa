import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Return } from "@/types";
import { toast } from "sonner";

interface ReturnState {
  returns: Return[];
  loading: boolean;
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addReturn: (r: Omit<Return, "id">, userId: string) => Promise<void>;
  updateReturnStatus: (id: string, status: Return["status"]) => void;
  deleteReturn: (id: string) => void;
  getCustomerReturns: () => Return[];
  getSupplierReturns: () => Return[];
  getTotalCustomerReturns: () => number;
  getTotalSupplierReturns: () => number;
}

export const useReturnStore = create<ReturnState>()((set, get) => ({
  returns: [],
  loading: true,
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) return;
    const [retRes, itemsRes] = await Promise.all([
      supabase.from("returns").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabase.from("return_items").select("*"),
    ]);
    const itemsByReturn = new Map<string, any[]>();
    (itemsRes.data || []).forEach((item: any) => {
      const list = itemsByReturn.get(item.return_id) || [];
      list.push({ id: item.id, productCode: item.product_code, productName: item.product_name, quantity: item.quantity, unitPrice: Number(item.unit_price), total: Number(item.total) });
      itemsByReturn.set(item.return_id, list);
    });
    const returns = (retRes.data || []).map((r: any) => ({
      id: r.id, type: r.type, orderId: r.order_id, orderNumber: r.order_number,
      customerId: r.customer_id, customerName: r.customer_name,
      supplierId: r.supplier_id, supplierName: r.supplier_name,
      items: itemsByReturn.get(r.id) || [], reason: r.reason,
      totalAmount: Number(r.total_amount), status: r.status, date: r.date, notes: r.notes,
    }));
    set({ returns, loading: false, initialized: true });
  },

  addReturn: async (data, userId) => {
    const { data: row, error } = await supabase.from("returns").insert({
      user_id: userId, type: data.type, order_id: data.orderId, order_number: data.orderNumber,
      customer_id: data.customerId, customer_name: data.customerName || "",
      supplier_id: data.supplierId, supplier_name: data.supplierName || "",
      reason: data.reason, total_amount: data.totalAmount, status: data.status, date: data.date, notes: data.notes || "",
    }).select().single();
    if (error) { toast.error("فشل تسجيل المرتجع"); return; }

    if (data.items.length > 0) {
      await supabase.from("return_items").insert(
        data.items.map((i) => ({ return_id: row.id, product_code: i.productCode || "", product_name: i.productName, quantity: i.quantity, unit_price: i.unitPrice, total: i.total }))
      );
    }
    set((s) => ({ returns: [{ id: row.id, ...data }, ...s.returns] }));
  },

  updateReturnStatus: async (id, status) => {
    await supabase.from("returns").update({ status }).eq("id", id);
    set((s) => ({ returns: s.returns.map((r) => (r.id === id ? { ...r, status } : r)) }));
  },

  deleteReturn: async (id) => {
    await supabase.from("return_items").delete().eq("return_id", id);
    await supabase.from("returns").delete().eq("id", id);
    set((s) => ({ returns: s.returns.filter((r) => r.id !== id) }));
  },

  getCustomerReturns: () => get().returns.filter((r) => r.type === "customer"),
  getSupplierReturns: () => get().returns.filter((r) => r.type === "supplier"),
  getTotalCustomerReturns: () => get().returns.filter((r) => r.type === "customer").reduce((s, r) => s + r.totalAmount, 0),
  getTotalSupplierReturns: () => get().returns.filter((r) => r.type === "supplier").reduce((s, r) => s + r.totalAmount, 0),
}));
