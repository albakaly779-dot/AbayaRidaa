export type OrderStatus = "pending" | "processing" | "ready" | "delivered" | "cancelled";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type PaymentMethod = "cash" | "transfer" | "card";
export type ReturnType = "customer" | "supplier";
export type ReturnStatus = "pending" | "approved" | "completed" | "rejected";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  source?: string;
  addedById?: string;
  addedByName?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productCode?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyPrice?: number;
  costBreakdown?: CostBreakdown;
  total: number;
}

export interface CostBreakdown {
  fabricCost: number;
  tarhaCost: number;
  extrasCost: number;
  totalCost: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  repId?: string;
  repName?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: string;
  dueDate: string;
}

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  notes: string;
  receiptUrl?: string;
  recordedById?: string;
  recordedByName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
  notes: string;
  createdAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  supplierName: string;
  type: "purchase" | "payment" | "return";
  amount: number;
  pieces: number;
  fabricType: string;
  fabricUnit: string;
  fabricQuantity: number;
  date: string;
  notes: string;
}

export interface Return {
  id: string;
  type: ReturnType;
  orderId?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  repId?: string;
  repName?: string;
  shippingCost?: number;
  items: ReturnItem[];
  reason: string;
  totalAmount: number;
  status: ReturnStatus;
  date: string;
  notes: string;
}

export interface ReturnItem {
  id: string;
  productCode?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  notes: string;
  isFixed?: boolean;
}

export type ExpenseCategory = "advertising" | "shipping" | "promotions" | "discounts" | "rent" | "salaries" | "materials" | "maintenance" | "electricity" | "commissions" | "other";

export interface User {
  id: string;
  name: string;
  username: string;
  role: string;
}

export interface SalesRep {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  commissionRate: number;
  notes: string;
  createdAt: string;
  isActive: boolean;
}

export interface RepCommission {
  id: string;
  repId: string;
  repName: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  commissionAmount: number;
  shippingDeduction: number;
  netCommission: number;
  isPaid: boolean;
  date: string;
  notes: string;
}

export interface SMSNotification {
  id: string;
  type: "status_change" | "payment" | "due_reminder" | "custom";
  recipientName: string;
  recipientPhone: string;
  message: string;
  sentAt: string;
  status: "sent" | "failed" | "pending";
  orderId?: string;
}

export interface MonthlySales {
  month: string;
  sales: number;
  orders: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalSales: number;
  totalExpenses: number;
  totalReturns: number;
  totalCommissions: number;
  productionCosts: number;
  netIncome: number;
  totalDebt: number;
  ordersCount: number;
  customersCount: number;
}

export interface StockAlert {
  code: string;
  name: string;
  stock: number;
  minAlert: number;
  category: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  type: "governorate_discount" | "amount_discount" | "product_discount";
  conditionField: string;
  conditionValue: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export interface UserRole {
  id: string;
  assignedUserEmail: string;
  role: "super_admin" | "operations_manager" | "support" | "rep";
  permissions: string;
  isActive: boolean;
  createdAt: string;
}
