import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Customer, Order, OrderItem, Payment } from "@/types";
import { generateOrderNumber } from "@/lib/utils";
import { toast } from "sonner";

interface DataState {
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  loading: boolean;
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">, userId: string) => Promise<Customer | null>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => void;
  addOrder: (order: Omit<Order, "id" | "orderNumber">, userId: string) => Promise<Order | null>;
  updateOrder: (id: string, data: Partial<Order>) => void;
  updateOrderStatus: (id: string, status: Order["status"]) => void;
  deleteOrder: (id: string) => void;
  addPayment: (payment: Omit<Payment, "id">, userId: string) => Promise<Payment | null>;
  getCustomerDebt: (customerId: string) => number;
  getCustomerOrders: (customerId: string) => Order[];
  getTotalDebt: () => number;
  getTotalSales: () => number;
  getDebtors: () => Array<{ customer: Customer; debt: number; orders: Order[] }>;
}

export const useDataStore = create<DataState>()((set, get) => ({
  customers: [],
  orders: [],
  payments: [],
  loading: true,
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) { set({ loading: false }); return; }
    try {
      const [custRes, ordRes, payRes] = await Promise.all([
        supabase.from("customers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("orders").select("*, order_items(*)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("user_id", userId).order("date", { ascending: false }),
      ]);

      const customers = (custRes.data || []).map((c: Customer) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, city: c.city,
        address: c.address, notes: c.notes, createdAt: c.created_at?.split("T")[0] || "",
        source: c.source || "", addedById: c.added_by_id || "", addedByName: c.added_by_name || "",
      }));

      const orders = (ordRes.data || []).map((o: Order) => ({
        id: o.id, orderNumber: o.order_number, customerId: o.customer_id,
        customerName: o.customer_name, customerPhone: o.customer_phone,
        status: o.status, paymentStatus: o.payment_status,
        items: (o.order_items || []).map((i: OrderItem) => ({
          id: i.id, productCode: i.product_code, productName: i.product_name,
          quantity: i.quantity, unitPrice: i.unit_price, buyPrice: i.buy_price, total: i.total,
        })),
        subtotal: Number(o.subtotal), discount: Number(o.discount), total: Number(o.total),
        paid: Number(o.paid), remaining: Number(o.remaining),
        dueDate: o.due_date, notes: o.notes, repId: o.rep_id, repName: o.rep_name,
        createdAt: o.created_at?.split("T")[0] || "",
      }));

      const payments = (payRes.data || []).map((p: Payment) => ({
        id: p.id, orderId: p.order_id, customerId: p.customer_id,
        customerName: p.customer_name, amount: Number(p.amount),
        method: p.method, date: p.date, notes: p.notes,
        receiptUrl: p.receipt_url || "",
        recordedById: p.recorded_by_id || "",
        recordedByName: p.recorded_by_name || "",
      }));

      set({ customers, orders, payments, loading: false, initialized: true });
    } catch (err) {
      console.error("Failed to load data:", err);
      set({ loading: false, initialized: true });
    }
  },

  addCustomer: async (data, userId) => {
    const { data: row, error } = await supabase.from("customers").insert({
      user_id: userId, name: data.name, phone: data.phone, email: data.email || "",
      city: data.city || "", address: data.address || "", notes: data.notes || "",
      source: data.source || "", added_by_id: data.addedById || userId,
      added_by_name: data.addedByName || "",
    }).select().single();
    if (error) { toast.error("فشل إضافة العميل: " + error.message); return null; }
    const newC: Customer = {
      id: row.id, name: row.name, phone: row.phone, email: row.email, city: row.city,
      address: row.address, notes: row.notes, source: row.source || "",
      addedById: row.added_by_id || userId, addedByName: row.added_by_name || "",
      createdAt: row.created_at?.split("T")[0] || "",
    };
    set((s) => ({ customers: [newC, ...s.customers] }));
    return newC;
  },

  updateCustomer: async (id, data) => {
    const payload: Partial<Customer> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.city !== undefined) payload.city = data.city;
    if (data.notes !== undefined) payload.notes = data.notes;
    await supabase.from("customers").update(payload).eq("id", id);
    set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
  },

  deleteCustomer: async (id) => {
    await supabase.from("customers").delete().eq("id", id);
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
  },

  addOrder: async (orderData, userId) => {
    const orderNumber = generateOrderNumber();
    const { data: row, error } = await supabase.rpc("create_order_with_stock", {
      p_order: {
        user_id: userId,
        order_number: orderNumber,
        customer_id: orderData.customerId,
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        rep_id: orderData.repId || null,
        rep_name: orderData.repName || null,
        status: orderData.status,
        payment_status: orderData.paymentStatus,
        subtotal: orderData.subtotal,
        discount: orderData.discount,
        total: orderData.total,
        paid: orderData.paid,
        remaining: orderData.remaining,
        due_date: orderData.dueDate,
        notes: orderData.notes || "",
      },
      p_items: orderData.items.map((i) => ({
        product_code: i.productCode || "",
        product_name: i.productName,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        buy_price: i.buyPrice || 0,
        total: i.total,
      })),
    });

    if (error || !row) {
      toast.error("فشل إنشاء الطلب: " + (error?.message || "لم تُعد قاعدة البيانات طلباً"));
      return null;
    }

    const newOrder: Order = {
      id: row.id, orderNumber: row.order_number || orderNumber, customerId: row.customer_id,
      customerName: row.customer_name, customerPhone: row.customer_phone,
      items: orderData.items, status: row.status, paymentStatus: row.payment_status,
      subtotal: Number(row.subtotal), discount: Number(row.discount), total: Number(row.total),
      paid: Number(row.paid), remaining: Number(row.remaining),
      dueDate: row.due_date, notes: row.notes,
      repId: row.rep_id, repName: row.rep_name,
      createdAt: row.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
    };
    set((s) => ({ orders: [newOrder, ...s.orders] }));
    return newOrder;
  },

  updateOrder: async (id, data) => {
    const payload: Partial<Order> = {};
    if (data.status) payload.status = data.status;
    if (data.paymentStatus) payload.payment_status = data.paymentStatus;
    if (data.paid !== undefined) payload.paid = data.paid;
    if (data.remaining !== undefined) payload.remaining = data.remaining;
    if (data.notes !== undefined) payload.notes = data.notes;
    await supabase.from("orders").update(payload).eq("id", id);
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...data } : o)) }));
  },

  updateOrderStatus: async (id, status) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
  },

  deleteOrder: async (id) => {
    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
  },

  addPayment: async (paymentData, userId) => {
    const { data: row, error } = await supabase.rpc("record_payment_atomic", {
      p_payment: {
        user_id: userId,
        order_id: paymentData.orderId,
        customer_id: paymentData.customerId,
        customer_name: paymentData.customerName,
        amount: paymentData.amount,
        method: paymentData.method,
        date: paymentData.date,
        notes: paymentData.notes || "",
        receipt_url: paymentData.receiptUrl || null,
        recorded_by_name: paymentData.recordedByName || "",
      },
    });
    if (error || !row) {
      toast.error("فشل تسجيل الدفعة: " + (error?.message || "لم تُعد قاعدة البيانات دفعة"));
      return null;
    }

    const newPayment: Payment = { id: row.id, ...paymentData };
    const newPaid = Number(row.amount) + (get().payments
      .filter((p) => p.orderId === paymentData.orderId)
      .reduce((sum, p) => sum + p.amount, 0));
    const order = get().orders.find((o) => o.id === paymentData.orderId);
    const newRemaining = order ? Math.max(0, order.total - newPaid) : 0;
    const paymentStatus = newRemaining === 0 ? "paid" as const : "partial" as const;

    set((state) => ({
      payments: [newPayment, ...state.payments],
      orders: state.orders.map((o) => o.id === paymentData.orderId
        ? { ...o, paid: Number(row.amount) + o.paid, remaining: newRemaining, paymentStatus }
        : o),
    }));
    return newPayment;
  },

  getCustomerDebt: (customerId) => get().orders.filter((o) => o.customerId === customerId && o.remaining > 0).reduce((sum, o) => sum + o.remaining, 0),
  getCustomerOrders: (customerId) => get().orders.filter((o) => o.customerId === customerId),
  getTotalDebt: () => get().orders.reduce((sum, o) => sum + o.remaining, 0),
  getTotalSales: () => get().orders.reduce((sum, o) => sum + o.total, 0),

  getDebtors: () => {
    const state = get();
    const debtorMap = new Map<string, { debt: number; orders: Order[] }>();
    state.orders.filter((o) => o.remaining > 0).forEach((order) => {
      const existing = debtorMap.get(order.customerId);
      if (existing) { existing.debt += order.remaining; existing.orders.push(order); }
      else debtorMap.set(order.customerId, { debt: order.remaining, orders: [order] });
    });
    return Array.from(debtorMap.entries())
      .map(([customerId, data]) => {
        const customer = state.customers.find((c) => c.id === customerId);
        if (!customer) return null;
        return { customer, ...data };
      })
      .filter(Boolean)
      .sort((a, b) => b!.debt - a!.debt) as Array<{ customer: Customer; debt: number; orders: Order[] }>;
  },
}));
