import { useState, useRef, useMemo } from "react";
import {
  Upload, FileSpreadsheet, Users, Package, ShoppingBag, AlertTriangle,
  CheckCircle, X, Loader2, Eye, Save, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";

type ImportType = "customers" | "products" | "orders";

interface ParsedRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const IMPORT_CONFIGS: Record<ImportType, { label: string; icon: typeof Users; requiredFields: string[]; optionalFields: string[]; color: string }> = {
  customers: {
    label: "العملاء",
    icon: Users,
    requiredFields: ["الاسم", "الهاتف"],
    optionalFields: ["البريد", "المحافظة", "العنوان", "ملاحظات"],
    color: "bg-blue-50 text-blue-700",
  },
  products: {
    label: "المنتجات",
    icon: Package,
    requiredFields: ["الرمز", "الاسم", "سعر_البيع"],
    optionalFields: ["التصنيف", "التكلفة", "المخزون", "الحد_الأدنى"],
    color: "bg-emerald-50 text-emerald-700",
  },
  orders: {
    label: "الطلبات",
    icon: ShoppingBag,
    requiredFields: ["العميل", "الهاتف", "المنتج", "الكمية", "السعر"],
    optionalFields: ["الخصم", "ملاحظات", "الحالة"],
    color: "bg-gold/10 text-gold-dark",
  },
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export default function Import() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<ImportType>("customers");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"select" | "preview" | "done">("select");

  const config = IMPORT_CONFIGS[importType];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("يرجى رفع ملف CSV فقط");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      if (data.length === 0) {
        toast.error("الملف فارغ أو غير صالح");
        return;
      }
      setParsedData(data);
      validateData(data);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const validateData = (data: ParsedRow[]) => {
    const errs: ValidationError[] = [];
    const headers = Object.keys(data[0] || {});

    // Check required fields
    config.requiredFields.forEach((field) => {
      if (!headers.includes(field)) {
        errs.push({ row: 0, field, message: `العمود "${field}" مطلوب ولم يتم العثور عليه` });
      }
    });

    // Validate rows
    data.forEach((row, idx) => {
      if (importType === "customers") {
        if (!row["الاسم"]?.trim()) errs.push({ row: idx + 2, field: "الاسم", message: "الاسم مطلوب" });
        if (!row["الهاتف"]?.trim()) errs.push({ row: idx + 2, field: "الهاتف", message: "الهاتف مطلوب" });
      } else if (importType === "products") {
        if (!row["الرمز"]?.trim()) errs.push({ row: idx + 2, field: "الرمز", message: "الرمز مطلوب" });
        if (!row["الاسم"]?.trim()) errs.push({ row: idx + 2, field: "الاسم", message: "الاسم مطلوب" });
        const price = parseFloat(row["سعر_البيع"]);
        if (isNaN(price) || price <= 0) errs.push({ row: idx + 2, field: "سعر_البيع", message: "السعر غير صالح" });
      } else if (importType === "orders") {
        if (!row["العميل"]?.trim()) errs.push({ row: idx + 2, field: "العميل", message: "اسم العميل مطلوب" });
        if (!row["المنتج"]?.trim()) errs.push({ row: idx + 2, field: "المنتج", message: "المنتج مطلوب" });
      }
    });

    setErrors(errs);
  };

  const handleImport = async () => {
    if (!user?.id) return;
    const criticalErrors = errors.filter((e) => e.row === 0);
    if (criticalErrors.length > 0) {
      toast.error("يوجد أخطاء في بنية الملف — تحقق من أسماء الأعمدة");
      return;
    }

    setImporting(true);

    try {
      if (importType === "customers") {
        const batch = parsedData.filter((r) => r["الاسم"]?.trim() && r["الهاتف"]?.trim()).map((r) => ({
          user_id: user.id,
          name: r["الاسم"].trim(),
          phone: r["الهاتف"].trim(),
          email: r["البريد"]?.trim() || "",
          city: r["المحافظة"]?.trim() || "",
          address: r["العنوان"]?.trim() || "",
          notes: r["ملاحظات"]?.trim() || "",
        }));

        for (let i = 0; i < batch.length; i += 50) {
          const { error } = await supabase.from("customers").insert(batch.slice(i, i + 50));
          if (error) { toast.error("خطأ: " + error.message); setImporting(false); return; }
        }
        logAction(user.id, "import", "customer", undefined, `استيراد ${batch.length} عميل من CSV`);
        toast.success(`تم استيراد ${batch.length} عميل بنجاح`);
      } else if (importType === "products") {
        const batch = parsedData.filter((r) => r["الرمز"]?.trim() && r["الاسم"]?.trim()).map((r) => ({
          code: r["الرمز"].trim(),
          name: r["الاسم"].trim(),
          category: r["التصنيف"]?.trim() || "عباية كلاسيكية",
          sell_price: parseFloat(r["سعر_البيع"]) || 8000,
          total_cost: parseFloat(r["التكلفة"]) || 2750,
          stock_quantity: parseInt(r["المخزون"]) || 0,
          min_stock_alert: parseInt(r["الحد_الأدنى"]) || 2,
        }));

        for (let i = 0; i < batch.length; i += 50) {
          const { error } = await supabase.from("products").upsert(batch.slice(i, i + 50), { onConflict: "code" });
          if (error) { toast.error("خطأ: " + error.message); setImporting(false); return; }
        }
        logAction(user.id, "import", "product", undefined, `استيراد ${batch.length} منتج من CSV`);
        toast.success(`تم استيراد ${batch.length} منتج بنجاح`);
      }

      setStep("done");
    } catch (err: any) {
      toast.error("فشل الاستيراد: " + (err?.message || "خطأ غير معروف"));
    }
    setImporting(false);
  };

  const resetImport = () => {
    setParsedData([]);
    setErrors([]);
    setFileName("");
    setStep("select");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const rowErrors = errors.filter((e) => e.row > 0);
  const structureErrors = errors.filter((e) => e.row === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy lg:text-2xl">استيراد البيانات</h1>
        <p className="text-sm text-gray-500">تحميل بيانات من ملفات CSV دفعة واحدة مع معاينة والتحقق</p>
      </div>

      {/* Step: Select */}
      {step === "select" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Object.entries(IMPORT_CONFIGS) as [ImportType, typeof IMPORT_CONFIGS.customers][]).map(([type, conf]) => (
              <button key={type} onClick={() => setImportType(type)}
                className={`rounded-2xl p-5 border-2 text-right transition-all ${
                  importType === type ? "border-navy bg-navy/5 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`rounded-xl p-2.5 ${conf.color}`}><conf.icon className="size-5" /></div>
                  <h3 className="text-sm font-bold text-navy">{conf.label}</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400">الأعمدة المطلوبة:</p>
                  <div className="flex flex-wrap gap-1">
                    {conf.requiredFields.map((f) => (
                      <span key={f} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">{f}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">أعمدة اختيارية:</p>
                  <div className="flex flex-wrap gap-1">
                    {conf.optionalFields.map((f) => (
                      <span key={f} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{f}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center hover:border-gold transition-colors">
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            <Upload className="mx-auto size-10 text-gray-300 mb-3" />
            <h3 className="text-sm font-bold text-navy mb-1">اسحب الملف هنا أو اضغط للرفع</h3>
            <p className="text-xs text-gray-400 mb-4">يدعم ملفات CSV — حد أقصى 1000 سجل</p>
            <button onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all active:scale-[0.98]">
              <FileSpreadsheet className="size-4 inline-block me-2" /> اختر ملف CSV
            </button>
          </div>

          {/* Template download helper */}
          <div className="rounded-2xl bg-cream/80 p-5 border border-gold/20">
            <h3 className="text-sm font-bold text-navy mb-2">نموذج الملف (CSV)</h3>
            <p className="text-xs text-gray-500 mb-3">أنشئ ملف CSV بالأعمدة التالية (السطر الأول = عناوين الأعمدة):</p>
            <div className="rounded-xl bg-white p-3 text-xs font-mono text-gray-600 overflow-x-auto" dir="ltr">
              {importType === "customers" && "الاسم,الهاتف,البريد,المحافظة,العنوان,ملاحظات\nأحمد محمد,967779111222,ahmed@mail.com,صنعاء,شارع الخمسين,عميل مميز"}
              {importType === "products" && "الرمز,الاسم,سعر_البيع,التصنيف,التكلفة,المخزون,الحد_الأدنى\nRM-001,عباية كلاسيكية,8000,عباية كلاسيكية,2750,10,2"}
              {importType === "orders" && "العميل,الهاتف,المنتج,الكمية,السعر,الخصم,ملاحظات\nأحمد,967779111222,عباية كلاسيكية,2,8000,0,ملاحظة"}
            </div>
          </div>
        </>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-5 text-navy" />
              <div>
                <p className="text-sm font-bold text-navy">{fileName}</p>
                <p className="text-xs text-gray-400">{parsedData.length} سجل · {Object.keys(parsedData[0] || {}).length} أعمدة</p>
              </div>
            </div>
            <button onClick={resetImport} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                <AlertTriangle className="size-4" /> {errors.length} تحذير
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {structureErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">بنية: {e.message}</p>
                ))}
                {rowErrors.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">سطر {e.row}: {e.field} — {e.message}</p>
                ))}
                {rowErrors.length > 10 && <p className="text-xs text-red-400">... و {rowErrors.length - 10} تحذيرات أخرى</p>}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-sm font-bold text-navy flex items-center gap-2"><Eye className="size-4" /> معاينة البيانات (أول 20 سجل)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-cream/50 border-b text-right">
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500">#</th>
                    {Object.keys(parsedData[0] || {}).map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedData.slice(0, 20).map((row, idx) => {
                    const hasError = rowErrors.some((e) => e.row === idx + 2);
                    return (
                      <tr key={idx} className={hasError ? "bg-red-50" : "hover:bg-cream/30"}>
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        {Object.values(row).map((val, i) => (
                          <td key={i} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{val || "—"}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsedData.length > 20 && <p className="text-center text-xs text-gray-400 py-3">... و {parsedData.length - 20} سجلات إضافية</p>}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={resetImport}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
            <button onClick={handleImport} disabled={importing || structureErrors.length > 0}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {importing ? "جاري الاستيراد..." : `استيراد ${parsedData.length} سجل`}
            </button>
          </div>
        </>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="rounded-full bg-emerald-50 p-6"><CheckCircle className="size-12 text-emerald-500" /></div>
          <h3 className="text-lg font-bold text-navy">تم الاستيراد بنجاح</h3>
          <p className="text-sm text-gray-500">تم تحميل {parsedData.length} سجل إلى قاعدة البيانات</p>
          <button onClick={resetImport}
            className="rounded-xl bg-navy px-8 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all">
            استيراد ملف آخر
          </button>
        </div>
      )}
    </div>
  );
}
