// Excel export utilities using SheetJS (xlsx)
import * as XLSX from "xlsx";
import type { Order, Payment } from "@/types";
import { formatCurrency } from "./formatters";

export type ReportType = "income" | "expenses" | "sales" | "returns" | "profits" | "net_profits" | "inventory" | "customers" | "commissions";

export interface ReportMeta {
  title: string;
  subtitle: string;
  generatedAt: string;
  businessName: string;
  from?: string;
  to?: string;
}

function autoWidth(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[h] ?? "").length)
    );
    return { wch: Math.min(50, Math.max(12, maxLen + 3)) };
  });
}

function styleHeader(ws: XLSX.WorkSheet, headers: string[]): void {
  // Bold header row (limited style support in free xlsx)
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) {
      ws[cell].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1B2A4A" } } };
    }
  });
}

function addMetaRows(ws: XLSX.WorkSheet, meta: ReportMeta, dataStartRow: number): void {
  XLSX.utils.sheet_add_aoa(ws, [
    [meta.businessName],
    [meta.title],
    [meta.subtitle],
    [`تاريخ التوليد: ${meta.generatedAt}`],
    meta.from && meta.to ? [`الفترة: من ${meta.from} إلى ${meta.to}`] : [""],
    [""],
  ], { origin: `A${dataStartRow}` });
}

export function generateExcelReport(
  reportType: ReportType,
  data: Record<string, unknown>[],
  meta: ReportMeta,
  summary?: Record<string, string | number>
): Blob {
  const wb = XLSX.utils.book_new();

  // Insert metadata rows at top
  const headerRows = [
    [meta.businessName],
    [meta.title],
    [meta.subtitle],
    [`تاريخ التوليد: ${meta.generatedAt}`],
    meta.from ? [`من: ${meta.from}   إلى: ${meta.to || "الآن"}`] : [""],
    [""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerRows);

  if (data.length > 0) {
    XLSX.utils.sheet_add_json(ws, data, { origin: -1 });
    ws["!cols"] = autoWidth(data);
    // Header for data table is at row 6 (0-indexed) after metadata
    const dataHeaderRow = headerRows.length;
    Object.keys(data[0]).forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: dataHeaderRow, c: i });
      if (ws[cell]) ws[cell].s = { font: { bold: true } };
    });
  }

  // Add summary at bottom
  if (summary) {
    XLSX.utils.sheet_add_aoa(ws, [[""], ["ملخص التقرير"], ...Object.entries(summary).map(([k, v]) => [k, v])], { origin: -1 });
  }

  const sheetName = reportType === "income" ? "الدخل"
    : reportType === "expenses" ? "المصروفات"
    : reportType === "sales" ? "المبيعات"
    : reportType === "returns" ? "المرتجعات"
    : reportType === "profits" ? "الأرباح"
    : reportType === "net_profits" ? "صافي الأرباح"
    : reportType === "inventory" ? "المخزون"
    : reportType === "customers" ? "العملاء"
    : reportType === "commissions" ? "العمولات"
    : "تقرير";

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadExcel(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Data preparation helpers
export function prepareSalesData(orders: Order[]) {
  return orders.map((o) => ({
    "رقم الطلب": o.orderNumber,
    "العميل": o.customerName,
    "الهاتف": o.customerPhone,
    "التاريخ": o.createdAt,
    "الحالة": o.status,
    "حالة الدفع": o.paymentStatus,
    "الإجمالي (ر.ي)": Number(o.total),
    "الإجمالي (ر.س)": Number(formatCurrency(o.total, "SAR").replace(/[^\d.]/g, "")),
    "المدفوع": Number(o.paid),
    "المتبقي": Number(o.remaining),
    "الخصم": Number(o.discount),
    "المندوب": o.repName || "-",
  }));
}

export function prepareIncomeData(payments: Payment[]) {
  return payments.map((p) => ({
    "التاريخ": p.date,
    "العميل": p.customerName,
    "المبلغ (ر.ي)": Number(p.amount),
    "طريقة الدفع": p.method === "cash" ? "نقدي" : p.method === "transfer" ? "تحويل" : "بطاقة",
    "الطلب المرتبط": p.orderId,
    "سجّله": p.recordedByName || "-",
    "ملاحظات": p.notes || "",
  }));
}

export function prepareExpensesData(expenses: Array<{ date: string; category: string; description: string; amount: number; notes?: string }>) {
  return expenses.map((e) => ({
    "التاريخ": e.date,
    "الفئة": e.category,
    "الوصف": e.description,
    "المبلغ (ر.ي)": Number(e.amount),
    "ملاحظات": e.notes || "",
  }));
}

export function prepareReturnsData(returns: Array<{ date: string; type: string; customerName?: string; supplierName?: string; reason: string; totalAmount: number; status: string }>) {
  return returns.map((r) => ({
    "التاريخ": r.date,
    "النوع": r.type === "customer" ? "من العميل" : "للمورد",
    "الطرف": r.customerName || r.supplierName || "-",
    "السبب": r.reason,
    "المبلغ (ر.ي)": Number(r.totalAmount),
    "الحالة": r.status,
  }));
}

export function prepareProfitsData(orders: Order[]) {
  return orders.map((o) => {
    const cost = (o.items || []).reduce((sum, i) => sum + (i.buyPrice || 0) * i.quantity, 0);
    const profit = Number(o.total) - cost;
    const margin = o.total > 0 ? (profit / Number(o.total)) * 100 : 0;
    return {
      "رقم الطلب": o.orderNumber,
      "العميل": o.customerName,
      "التاريخ": o.createdAt,
      "الإيرادات (ر.ي)": Number(o.total),
      "التكلفة (ر.ي)": cost,
      "الربح (ر.ي)": profit,
      "الهامش %": Number(margin.toFixed(2)),
    };
  });
}

export function prepareInventoryData(products: Array<{ code: string; name: string; category: string; stock_quantity: number; min_stock_alert: number; sell_price: number; total_cost: number }>) {
  return products.map((p) => ({
    "الكود": p.code,
    "الاسم": p.name,
    "الفئة": p.category,
    "المخزون": p.stock_quantity,
    "حد التنبيه": p.min_stock_alert,
    "سعر البيع (ر.ي)": Number(p.sell_price),
    "التكلفة (ر.ي)": Number(p.total_cost),
    "الحالة": p.stock_quantity <= p.min_stock_alert ? "منخفض" : "متوفر",
  }));
}
