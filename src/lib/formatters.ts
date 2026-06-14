import { useSettingsStore } from "@/stores/settingsStore";
import { APP_CONFIG } from "@/constants/config";

function getRate(): number {
  const s = useSettingsStore.getState().settings;
  return s.sarToYer || APP_CONFIG.sarToYer;
}

export function formatCurrency(amount: number, currency: "YER" | "SAR" = "YER"): string {
  if (currency === "SAR") {
    const sarAmount = amount / getRate();
    return `${sarAmount.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
  }
  return `${amount.toLocaleString("ar-YE")} ر.ي`;
}

export function formatDual(amount: number): string {
  const rate = getRate();
  const sar = amount / rate;
  return `${amount.toLocaleString("ar-YE")} ر.ي (${sar.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س)`;
}

export function yerToSar(yer: number): number {
  return yer / getRate();
}

export function sarToYer(sar: number): number {
  return sar * getRate();
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("967")) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

export function validateYemeniPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("967")) return cleaned.length >= 12 && cleaned.length <= 13;
  if (cleaned.startsWith("7") || cleaned.startsWith("9")) return cleaned.length >= 9 && cleaned.length <= 10;
  return cleaned.length >= 9;
}

const statusMap: Record<string, string> = { pending: "قيد الانتظار", processing: "قيد التنفيذ", ready: "جاهز للتسليم", delivered: "تم التسليم", cancelled: "ملغي" };
const paymentStatusMap: Record<string, string> = { paid: "مدفوع", partial: "مدفوع جزئياً", unpaid: "غير مدفوع" };
const paymentMethodMap: Record<string, string> = { cash: "نقداً", transfer: "تحويل بنكي", card: "بطاقة" };
const returnStatusMap: Record<string, string> = { pending: "قيد المراجعة", approved: "تمت الموافقة", completed: "مكتمل", rejected: "مرفوض" };
const returnStatusColorMap: Record<string, string> = { pending: "bg-amber-100 text-amber-800", approved: "bg-blue-100 text-blue-800", completed: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800" };
const expenseCategoryMap: Record<string, string> = { advertising: "إعلانات ممولة", shipping: "شحن وتوصيل", promotions: "عروض وتخفيضات", discounts: "خصومات", rent: "إيجار", salaries: "رواتب", materials: "مواد خام", maintenance: "صيانة", electricity: "كهرباء", commissions: "عمولات", other: "أخرى" };
const expenseCategoryColorMap: Record<string, string> = { advertising: "bg-purple-100 text-purple-800", shipping: "bg-blue-100 text-blue-800", promotions: "bg-amber-100 text-amber-800", discounts: "bg-orange-100 text-orange-800", rent: "bg-gray-100 text-gray-800", salaries: "bg-emerald-100 text-emerald-800", materials: "bg-cyan-100 text-cyan-800", maintenance: "bg-rose-100 text-rose-800", electricity: "bg-yellow-100 text-yellow-800", commissions: "bg-indigo-100 text-indigo-800", other: "bg-gray-100 text-gray-600" };
const txTypeMap: Record<string, string> = { purchase: "شراء", payment: "دفعة", return: "مرتجع" };
const txTypeColorMap: Record<string, string> = { purchase: "bg-red-100 text-red-800", payment: "bg-green-100 text-green-800", return: "bg-amber-100 text-amber-800" };
const statusColorMap: Record<string, string> = { pending: "bg-amber-100 text-amber-800", processing: "bg-blue-100 text-blue-800", ready: "bg-emerald-100 text-emerald-800", delivered: "bg-green-100 text-green-800", cancelled: "bg-red-100 text-red-800" };
const paymentColorMap: Record<string, string> = { paid: "bg-green-100 text-green-800", partial: "bg-orange-100 text-orange-800", unpaid: "bg-red-100 text-red-800" };

export function getStatusLabel(s: string) { return statusMap[s] || s; }
export function getPaymentStatusLabel(s: string) { return paymentStatusMap[s] || s; }
export function getPaymentMethodLabel(m: string) { return paymentMethodMap[m] || m; }
export function getReturnStatusLabel(s: string) { return returnStatusMap[s] || s; }
export function getReturnStatusColor(s: string) { return returnStatusColorMap[s] || "bg-gray-100 text-gray-800"; }
export function getExpenseCategoryLabel(c: string) { return expenseCategoryMap[c] || c; }
export function getExpenseCategoryColor(c: string) { return expenseCategoryColorMap[c] || "bg-gray-100 text-gray-800"; }
export function getTxTypeLabel(t: string) { return txTypeMap[t] || t; }
export function getTxTypeColor(t: string) { return txTypeColorMap[t] || "bg-gray-100 text-gray-800"; }
export function getStatusColor(s: string) { return statusColorMap[s] || "bg-gray-100 text-gray-800"; }
export function getPaymentStatusColor(s: string) { return paymentColorMap[s] || "bg-gray-100 text-gray-800"; }

export function getAuditActionLabel(a: string): string {
  const map: Record<string, string> = {
    create: "إنشاء", update: "تعديل", delete: "حذف", status_change: "تغيير حالة",
    payment: "تسجيل دفعة", login: "تسجيل دخول", export: "تصدير بيانات",
    settings_update: "تحديث الإعدادات", bulk_whatsapp: "واتساب جماعي",
  };
  return map[a] || a;
}

export function getEntityTypeLabel(e: string): string {
  const map: Record<string, string> = {
    order: "طلب", customer: "عميل", product: "منتج", supplier: "مورد",
    expense: "مصروف", return: "مرتجع", rep: "مندوب", commission: "عمولة",
    payment: "دفعة", settings: "إعدادات", system: "النظام",
  };
  return map[e] || e;
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    "\uFEFF" + headers.join(","),
    ...data.map(row => headers.map(h => { const val = String(row[h] ?? ""); return `"${val.replace(/"/g, '""')}"`; }).join(","))
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printElement() { window.print(); }
