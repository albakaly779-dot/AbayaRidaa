import { useState, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, Database, CheckCircle, CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useSupplierStore } from "@/stores/supplierStore";
import { useReturnStore } from "@/stores/returnStore";
import { useRepStore } from "@/stores/repStore";
import { exportToCSV, exportToJSON } from "@/lib/formatters";
import BackupScheduler from "@/components/features/BackupScheduler";

export default function ExportPage() {
  const { user } = useAuth();
  const { orders, customers, payments, initializeData } = useDataStore();
  const { expenses, initializeData: initExp } = useExpenseStore();
  const { suppliers, transactions, initializeData: initSup } = useSupplierStore();
  const { returns, initializeData: initRet } = useReturnStore();
  const { reps, commissions, initializeData: initRep } = useRepStore();

  useEffect(() => {
    if (user?.id) { initializeData(user.id); initExp(user.id); initSup(user.id); initRet(user.id); initRep(user.id); }
  }, [user?.id]);

  const exportSections = [
    {
      title: "الطلبات", icon: FileSpreadsheet, count: orders.length, color: "bg-gold/10 text-gold-dark",
      exportCSV: () => {
        exportToCSV(orders.map((o) => ({
          "رقم الطلب": o.orderNumber, "العميل": o.customerName, "الهاتف": o.customerPhone,
          "الإجمالي": o.total, "المدفوع": o.paid, "المتبقي": o.remaining,
          "الحالة": o.status, "الدفع": o.paymentStatus, "التاريخ": o.createdAt, "التسليم": o.dueDate,
          "المنتجات": o.items.map(i => i.productName).join(" | "), "ملاحظات": o.notes,
        })), "طلبات-رداء");
        toast.success("تم تصدير الطلبات");
      },
      exportJSON: () => { exportToJSON(orders, "طلبات-رداء"); toast.success("تم تصدير الطلبات"); },
    },
    {
      title: "العملاء", icon: FileText, count: customers.length, color: "bg-blue-50 text-blue-700",
      exportCSV: () => {
        exportToCSV(customers.map((c) => ({ "الاسم": c.name, "الهاتف": c.phone, "البريد": c.email, "المحافظة": c.city, "العنوان": c.address, "ملاحظات": c.notes, "تاريخ التسجيل": c.createdAt })), "عملاء-رداء");
        toast.success("تم تصدير العملاء");
      },
      exportJSON: () => { exportToJSON(customers, "عملاء-رداء"); toast.success("تم تصدير العملاء"); },
    },
    {
      title: "المصروفات", icon: FileSpreadsheet, count: expenses.length, color: "bg-red-50 text-red-700",
      exportCSV: () => {
        exportToCSV(expenses.map((e) => ({ "التصنيف": e.category, "الوصف": e.description, "المبلغ": e.amount, "التاريخ": e.date, "ثابت": e.isFixed ? "نعم" : "لا", "ملاحظات": e.notes })), "مصروفات-رداء");
        toast.success("تم تصدير المصروفات");
      },
      exportJSON: () => { exportToJSON(expenses, "مصروفات-رداء"); toast.success("تم تصدير المصروفات"); },
    },
    {
      title: "الموردون", icon: FileText, count: suppliers.length, color: "bg-emerald-50 text-emerald-700",
      exportCSV: () => {
        exportToCSV(suppliers.map((s) => ({ "الاسم": s.name, "الشركة": s.company, "الهاتف": s.phone, "المدينة": s.city, "ملاحظات": s.notes })), "موردون-رداء");
        toast.success("تم تصدير الموردون");
      },
      exportJSON: () => { exportToJSON({ suppliers, transactions }, "موردون-رداء"); toast.success("تم تصدير الموردون"); },
    },
    {
      title: "المرتجعات", icon: FileText, count: returns.length, color: "bg-amber-50 text-amber-700",
      exportCSV: () => {
        exportToCSV(returns.map((r) => ({ "النوع": r.type === "customer" ? "زبون" : "مورد", "الاسم": r.type === "customer" ? r.customerName : r.supplierName, "المبلغ": r.totalAmount, "السبب": r.reason, "الحالة": r.status, "التاريخ": r.date })), "مرتجعات-رداء");
        toast.success("تم تصدير المرتجعات");
      },
      exportJSON: () => { exportToJSON(returns, "مرتجعات-رداء"); toast.success("تم تصدير المرتجعات"); },
    },
    {
      title: "المناديب والعمولات", icon: FileSpreadsheet, count: reps.length, color: "bg-indigo-50 text-indigo-700",
      exportCSV: () => {
        exportToCSV(commissions.map((c) => ({ "المندوب": c.repName, "رقم الطلب": c.orderNumber, "إجمالي الطلب": c.orderTotal, "العمولة": c.commissionAmount, "خصم الشحن": c.shippingDeduction, "الصافي": c.netCommission, "مدفوعة": c.isPaid ? "نعم" : "لا", "التاريخ": c.date })), "عمولات-رداء");
        toast.success("تم تصدير العمولات");
      },
      exportJSON: () => { exportToJSON({ reps, commissions }, "مناديب-رداء"); toast.success("تم تصدير المناديب"); },
    },
    {
      title: "المدفوعات", icon: FileText, count: payments.length, color: "bg-purple-50 text-purple-700",
      exportCSV: () => {
        exportToCSV(payments.map((p) => ({ "العميل": p.customerName, "المبلغ": p.amount, "الطريقة": p.method, "التاريخ": p.date, "ملاحظات": p.notes })), "مدفوعات-رداء");
        toast.success("تم تصدير المدفوعات");
      },
      exportJSON: () => { exportToJSON(payments, "مدفوعات-رداء"); toast.success("تم تصدير المدفوعات"); },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy lg:text-2xl">تصدير البيانات والنسخ الاحتياطي</h1>
        <p className="text-sm text-gray-500">تصدير بصيغة Excel (CSV) أو JSON مع جدولة نسخ احتياطي تلقائي</p>
      </div>

      {/* Backup Scheduler */}
      <BackupScheduler />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportSections.map((section, idx) => (
          <div key={section.title} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 animate-fade-in opacity-0" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-xl p-2.5 ${section.color}`}><section.icon className="size-5" /></div>
              <div>
                <h3 className="text-sm font-bold text-navy">{section.title}</h3>
                <p className="text-xs text-gray-400">{section.count} سجل</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={section.exportCSV} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                <Download className="size-3.5" /> Excel (CSV)
              </button>
              <button onClick={section.exportJSON} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                <Download className="size-3.5" /> JSON
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-bl from-navy to-navy-light p-6 text-white">
        <h3 className="text-base font-bold mb-2">💡 نصائح التصدير والنسخ الاحتياطي</h3>
        <ul className="space-y-2 text-sm text-white/80">
          <li className="flex items-center gap-2"><CheckCircle className="size-4 text-gold-light" />ملفات CSV تفتح مباشرة في Excel وGoogle Sheets</li>
          <li className="flex items-center gap-2"><CheckCircle className="size-4 text-gold-light" />ملفات JSON مناسبة للنسخ الاحتياطي الكامل</li>
          <li className="flex items-center gap-2"><CheckCircle className="size-4 text-gold-light" />فعّل جدولة النسخ اليومي أو الأسبوعي للتذكير التلقائي</li>
          <li className="flex items-center gap-2"><CheckCircle className="size-4 text-gold-light" />استخدم زر Google Drive لرفع نسخة احتياطية مباشرة</li>
        </ul>
      </div>
    </div>
  );
}
