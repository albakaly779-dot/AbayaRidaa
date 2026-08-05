import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Return, ReturnItem } from "@/types";
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
    const itemsByReturn = new Map<string, ReturnItem[]>();
    (itemsRes.data || []).forEach((item: Record<string, unknown>) => {
      const returnId = item.return_id as string;
      const list = itemsByReturn.get(returnId) || [];
      list.push({
        id: item.id as string,
        productCode: item.product_code as string,
        productName: item.product_name as string,
        quantity: item.quantity as number,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
      });
      itemsByReturn.set(returnId, list);
    });
    const returns = (retRes.data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      type: r.type as Return["type"],
      orderId: r.order_id as string | undefined,
      orderNumber: r.order_number as string | undefined,
      customerId: r.customer_id as string | undefined,
      customerName: r.customer_name as string | undefined,
      supplierId: r.supplier_id as string | undefined,
      supplierName: r.supplier_name as string | undefined,
      items: itemsByReturn.get(r.id as string) || [],
      reason: r.reason as string,
      totalAmount: Number(r.total_amount),
      status: r.status as Return["status"],
      date: r.date as string,
      notes: r.notes as string,
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
