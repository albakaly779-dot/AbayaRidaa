import { useEffect, useRef, useState } from "react";
import { FileImage, Upload, Trash2, Check, Star, Loader2, Info, Eye, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useAuditStore } from "@/stores/auditStore";
import { logActivity } from "@/hooks/useActivityLogger";

interface CustomTemplate {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  isActive: boolean;
  createdAt: string;
}

const AVAILABLE_PLACEHOLDERS = [
  { key: "{customer_name}", label: "اسم العميل" },
  { key: "{customer_phone}", label: "هاتف العميل" },
  { key: "{order_number}", label: "رقم الطلب" },
  { key: "{order_date}", label: "تاريخ الطلب" },
  { key: "{items_table}", label: "جدول المنتجات" },
  { key: "{subtotal}", label: "المجموع الفرعي" },
  { key: "{discount}", label: "الخصم" },
  { key: "{total}", label: "الإجمالي" },
  { key: "{paid}", label: "المدفوع" },
  { key: "{remaining}", label: "المتبقي" },
  { key: "{business_name}", label: "اسم النشاط" },
  { key: "{business_phone}", label: "هاتف النشاط" },
];

export default function InvoiceTemplatesCustom() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => { loadTemplates(); }, [user?.id]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("invoice_templates_custom")
      .select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const mapped: CustomTemplate[] = (data || []).map((r: { id: string; name: string; file_url: string; file_type: string; is_active: boolean; created_at: string }) => ({
      id: r.id, name: r.name, fileUrl: r.file_url, fileType: r.file_type, isActive: r.is_active, createdAt: r.created_at,
    }));
    setTemplates(mapped);
    setLoading(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!user?.id) return;
    if (!templateName.trim()) { toast.error("أدخل اسماً للقالب أولاً"); return; }

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("نوع الملف غير مدعوم — استخدم PNG, JPG, WebP, SVG, أو PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename = `${user.id}/${Date.now()}-${templateName.replace(/\s+/g, "_")}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("invoice_templates").upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) { toast.error("فشل الرفع: " + uploadError.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("invoice_templates").getPublicUrl(filename);

      const fileType = file.type === "application/pdf" ? "pdf"
        : file.type === "image/svg+xml" ? "svg"
        : "png";

      const { error: insertError } = await supabase.from("invoice_templates_custom").insert({
        user_id: user.id,
        name: templateName,
        file_url: urlData.publicUrl,
        file_type: fileType,
        placeholders: JSON.stringify([]),
        is_active: false,
      });

      if (insertError) { toast.error("فشل الحفظ: " + insertError.message); setUploading(false); return; }

      if (user?.id) {
        logAction(user.id, "create", "invoice_template", undefined, `رفع قالب فاتورة: ${templateName}`);
        logActivity(user.email, user.id, "action", `رفع قالب فاتورة مخصص: ${templateName}`, { entityType: "invoice_template" });
      }

      toast.success("✅ تم رفع القالب بنجاح");
      setTemplateName("");
      loadTemplates();
    } catch (err) {
      toast.error("خطأ: " + (err instanceof Error ? err.message : "غير معروف"));
    }
    setUploading(false);
  };

  const handleActivate = async (id: string) => {
    if (!user?.id) return;
    // Deactivate all first
    await supabase.from("invoice_templates_custom").update({ is_active: false }).eq("user_id", user.id);
    // Activate selected
    await supabase.from("invoice_templates_custom").update({ is_active: true }).eq("id", id);
    setTemplates((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
    toast.success("تم تعيينه كقالب افتراضي");
  };

  const handleDelete = async (t: CustomTemplate) => {
    if (!confirm(`حذف القالب "${t.name}"؟`)) return;
    // Delete from storage
    const path = t.fileUrl.split("/invoice_templates/")[1];
    if (path) await supabase.storage.from("invoice_templates").remove([path]);
    await supabase.from("invoice_templates_custom").delete().eq("id", t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("تم الحذف");
  };

  const copyPlaceholder = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(`تم نسخ ${key}`);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <FileImage className="size-5 text-purple-600" /> قوالب الفواتير المخصصة
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">صمّم فواتيرك خارجياً (Canva/Photoshop/Illustrator) وارفعها هنا</p>
      </div>

      {/* Info */}
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="text-sm text-purple-900 flex-1">
            <p className="font-bold mb-2">🎨 كيف تعمل القوالب المخصصة؟</p>
            <ol className="text-xs list-decimal list-inside space-y-1 mb-3">
              <li>صمّم فاتورتك في أي برنامج (Canva، Photoshop، Illustrator)</li>
              <li>ضع نصوصاً بديلة (Placeholders) في المكان الذي تريد استبدال البيانات فيه، مثل: <code className="bg-white px-1 rounded" dir="ltr">{"{customer_name}"}</code></li>
              <li>احفظ التصميم بصيغة PNG أو PDF أو SVG بجودة عالية</li>
              <li>ارفع الملف هنا وسيحفظ المقاسات والألوان الأصلية</li>
              <li>عند طباعة الفاتورة، ستُستبدل الـ Placeholders بالبيانات الفعلية</li>
            </ol>
            <div className="bg-white rounded-lg p-3 border border-purple-200">
              <p className="text-xs font-bold mb-2">📋 المتغيرات المتاحة (اضغط للنسخ):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {AVAILABLE_PLACEHOLDERS.map((p) => (
                  <button key={p.key} onClick={() => copyPlaceholder(p.key)}
                    className="text-right rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1.5 text-[10px] transition-colors">
                    <code className="text-purple-700 font-bold block" dir="ltr">{p.key}</code>
                    <span className="text-purple-600 text-[9px]">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload form */}
      <div className="rounded-2xl bg-white p-5 border-2 border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
          <Upload className="size-4" /> رفع قالب جديد
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1 block">اسم القالب</label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
              placeholder="مثال: قالب رأس السنة" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1 block">اختر الملف (PNG, PDF, SVG - حتى 5MB)</label>
            <button onClick={() => fileInputRef.current?.click()} disabled={!templateName.trim() || uploading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "جاري الرفع..." : "اختر الملف"}
            </button>
            <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg,.pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-navy" /></div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <FileImage className="mx-auto size-12 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">لا توجد قوالب مخصصة بعد</p>
          <p className="text-xs text-gray-400 mt-1">ارفع أول قالب لك من الأعلى</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className={`rounded-2xl border-2 bg-white overflow-hidden ${t.isActive ? "border-emerald-400 shadow-lg shadow-emerald-500/10" : "border-gray-200"}`}>
              <div className="relative aspect-[3/4] bg-cream/30 flex items-center justify-center overflow-hidden">
                {t.fileType === "pdf" ? (
                  <div className="flex flex-col items-center gap-2 text-red-500">
                    <FileImage className="size-16" />
                    <span className="text-xs font-bold">ملف PDF</span>
                  </div>
                ) : (
                  <img src={t.fileUrl} alt={t.name} className="w-full h-full object-contain" />
                )}
                {t.isActive && (
                  <div className="absolute top-2 left-2 rounded-full bg-emerald-500 text-white px-2 py-1 text-[10px] font-bold flex items-center gap-1 shadow-lg">
                    <Check className="size-3" /> افتراضي
                  </div>
                )}
                <button onClick={() => setPreviewUrl(t.fileUrl)}
                  className="absolute top-2 right-2 rounded-full bg-white/90 hover:bg-white text-navy p-1.5 shadow-lg">
                  <Eye className="size-3.5" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-bold text-navy truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t.fileType} · {new Date(t.createdAt).toLocaleDateString("ar-SA")}</p>
                </div>
                <div className="flex gap-1.5">
                  {!t.isActive && (
                    <button onClick={() => handleActivate(t.id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 py-1.5 text-xs font-bold hover:bg-emerald-100">
                      <Star className="size-3" /> تعيين افتراضي
                    </button>
                  )}
                  <button onClick={() => handleDelete(t)} className="rounded-lg bg-red-50 text-red-600 p-1.5 hover:bg-red-100">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto bg-white rounded-2xl">
            <button onClick={() => setPreviewUrl(null)} className="absolute top-2 left-2 z-10 rounded-full bg-white shadow-lg p-2 hover:bg-gray-100">
              <X className="size-4" />
            </button>
            {previewUrl.endsWith(".pdf") ? (
              <iframe src={previewUrl} className="w-full h-[80vh]" title="Preview" />
            ) : (
              <img src={previewUrl} alt="Preview" className="w-full h-auto" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
