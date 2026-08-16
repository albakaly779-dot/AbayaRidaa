import type { Customer, Order, Payment } from "@/types";

// Legacy compatibility exports; production data comes from Supabase.
export const mockCustomers: Customer[] = [];
export const mockOrders: Order[] = [];
export const mockPayments: Payment[] = [];
export const mockMonthlySales = [
  { month: "سبتمبر", sales: 0, orders: 0 },
  { month: "أكتوبر", sales: 0, orders: 0 },
  { month: "نوفمبر", sales: 0, orders: 0 },
  { month: "ديسمبر", sales: 0, orders: 0 },
  { month: "يناير", sales: 0, orders: 0 },
  { month: "فبراير", sales: 0, orders: 0 },
];
export const mockUser = { id: "", name: "رداء", email: "albakaly779@gmail.com", role: "admin" };
