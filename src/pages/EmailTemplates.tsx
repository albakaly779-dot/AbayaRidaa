import { useEffect, useState } from "react";
import { Mail, Save, Loader2, Eye, Info, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface EmailTemplate {
  id: string;
  templateKey: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
}

const TEMPLATE_TYPES = [
  { key: "welcome", label: "🎉 رسالة الترحيب", description: "ترسل تلقائياً عند إنشاء حساب جديد" },
  { key: "password_reset", label: "🔑 إعادة تعيين كلمة المرور", description: "عند طلب المستخدم إعادة تعيين كلمة المرور" },
  { key: "invoice", label: "📄 الفاتورة", description: "عند إرسال فاتورة بالبريد للعميل" },
  { key: "reminder", label: "⏰ التذكير بالديون", description: "تذكير العميل بدفعة مستحقة" },
  { key: "notification", label: "🔔 إشعار عام", description: "إشعارات النظام العامة" },
];

const AVAILABLE_VARS = [
  { key: "{{name}}", desc: "الاسم" },
  { key: "{{email}}", desc: "البريد" },
  { key: "{{password}}", desc: "كلمة المرور" },
  { key: "{{business_name}}", desc: "اسم النشاط" },
  { key: "{{amount}}", desc: "المبلغ" },
  { key: "{{date}}", desc: "التاريخ" },
  { key: "{{order_number}}", desc: "رقم الطلب" },
  { key: "{{link}}", desc: "الرابط" },
];

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: "🌸 مرحباً بك في نظام {{business_name}}",
    body: `<div dir="rtl" style="font-family:Cairo,Arial;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332">مرحباً {{name}} 👋</h2>
  <p>تم إنشاء حسابك بنجاح في نظام {{business_name}}.</p>
  <div style="background:white;padding:15px;border-radius:8px;margin:15px 0">
    <p><b>📧 البريد:</b> {{email}}</p>
    <p><b>🔑 كلمة المرور:</b> {{password}}</p>
  </div>
  <p style="color:#dc2626">⚠️ يُطلب منك تغيير كلمة المرور بعد أول تسجيل دخول.</p>
  <a href="{{link}}" style="background:#1a2332;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;display:inline-block">تسجيل الدخول</a>
</div>`,
  },
  password_reset: {
    subject: "🔑 إعادة تعيين كلمة المرور - {{business_name}}",
    body: `<div dir="rtl" style="font-family:Cairo,Arial;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332">مرحباً {{name}}</h2>
  <p>تلقّينا طلبك لإعادة تعيين كلمة المرور.</p>
  <p>اضغط على الرابط أدناه لإكمال العملية:</p>
  <a href="{{link}}" style="background:#c9a84c;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;display:inline-block">إعادة التعيين</a>
  <p style="color:#666;font-size:12px;margin-top:20px">إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>
</div>`,
  },
  invoice: {
    subject: "📄 فاتورة رقم {{order_number}} - {{business_name}}",
    body: `<div dir="rtl" style="font-family:Cairo,Arial;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332">فاتورة رقم {{order_number}}</h2>
  <p>مرحباً {{name}}،</p>
  <div style="background:white;padding:15px;border-radius:8px">
    <p><b>التاريخ:</b> {{date}}</p>
    <p><b>الإجمالي:</b> {{amount}}</p>
  </div>
  <p>شكراً لتعاملكم معنا 🌸</p>
</div>`,
  },
  reminder: {
    subject: "⏰ تذكير بمستحقات - {{business_name}}",
    body: `<div dir="rtl" style="font-family:Cairo,Arial;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332">تذكير بالدفعة</h2>
  <p>مرحباً {{name}}،</p>
  <p>هذه رسالة تذكير بوجود مبلغ مستحق:</p>
  <div style="background:#fef3c7;padding:15px;border-radius:8px;border-right:4px solid #f59e0b">
    <p><b>المبلغ:</b> {{amount}}</p>
    <p><b>رقم الطلب:</b> {{order_number}}</p>
  </div>
  <p>يرجى التواصل معنا لسداد المستحقات. شكراً لتعاونكم.</p>
</div>`,
  },
  notification: {
    subject: "🔔 إشعار من {{business_name}}",
    body: `<div dir="rtl" style="font-family:Cairo,Arial;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332">إشعار جديد</h2>
  <p>مرحباً {{name}}،</p>
  <p>{{message}}</p>
</div>`,
  },
};

export default function EmailTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [selectedKey, setSelectedKey] = useState("welcome");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (user?.id) loadTemplates();
  }, [user?.id]);

  useEffect(() => {
    const t = templates[selectedKey];
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.bodyHtml);
    } else {
      const def = DEFAULT_TEMPLATES[selectedKey];
      setSubject(def?.subject || "");
      setBodyHtml(def?.body || "");
    }
  }, [selectedKey, templates]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("email_templates").select("*").eq("user_id", user.id);
    const map: Record<string, EmailTemplate> = {};
    (data || []).forEach((r: { id: string; template_key: string; subject: string; body_html: string; is_active: boolean }) => {
      map[r.template_key] = {
        id: r.id, templateKey: r.template_key, subject: r.subject, bodyHtml: r.body_html, isActive: r.is_active,
      };
    });
    setTemplates(map);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("email_templates").upsert({
      user_id: user.id,
      template_key: selectedKey,
      subject,
      body_html: bodyHtml,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,template_key" });
    if (error) { toast.error("فشل الحفظ: " + error.message); setSaving(false); return; }
    toast.success("✅ تم حفظ القالب");
    loadTemplates();
    setSaving(false);
  };

  const handleReset = () => {
    if (!confirm("استعادة القالب الافتراضي؟")) return;
    const def = DEFAULT_TEMPLATES[selectedKey];
    setSubject(def?.subject || "");
    setBodyHtml(def?.body || "");
    toast.success("تم استعادة القالب الافتراضي");
  };

  const insertVariable = (v: string) => {
    setBodyHtml((prev) => prev + v);
    toast.success(`تم إضافة ${v}`);
  };

  // Preview with sample data
  const previewHtml = bodyHtml
    .replace(/{{name}}/g, "أحمد محمد")
    .replace(/{{email}}/g, "ahmed@example.com")
    .replace(/{{password}}/g, "TempPass2026")
    .replace(/{{business_name}}/g, "رداء")
    .replace(/{{amount}}/g, "50,000 ر.ي")
    .replace(/{{date}}/g, new Date().toLocaleDateString("ar-SA"))
    .replace(/{{order_number}}/g, "ORD-2026-001")
    .replace(/{{link}}/g, "#")
    .replace(/{{message}}/g, "لديك إشعار جديد يستحق الاهتمام.");

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-navy" /></div>;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <Mail className="size-5 text-blue-600" /> محرر قوالب البريد الإلكتروني
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">خصّص جميع الرسائل التي يرسلها النظام</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Template list */}
        <div className="rounded-2xl bg-white p-3 border border-gray-100 shadow-sm space-y-1">
          <h3 className="text-xs font-bold text-navy mb-2 px-2">📚 القوالب</h3>
          {TEMPLATE_TYPES.map((t) => (
            <button key={t.key} onClick={() => setSelectedKey(t.key)}
              className={`w-full text-right rounded-lg px-3 py-2 text-xs transition-colors ${
                selectedKey === t.key ? "bg-navy text-white" : "hover:bg-cream/50"
              }`}>
              <p className="font-bold">{t.label}</p>
              <p className={`text-[10px] mt-0.5 ${selectedKey === t.key ? "text-white/70" : "text-gray-500"}`}>{t.description}</p>
              {templates[t.key] && (
                <span className={`text-[9px] ${selectedKey === t.key ? "text-emerald-300" : "text-emerald-600"} mt-1 block`}>✅ محفوظ</span>
              )}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-navy flex items-center gap-2">
                <Sparkles className="size-4 text-gold" /> {TEMPLATE_TYPES.find((t) => t.key === selectedKey)?.label}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200">
                  <Eye className="size-3" /> {showPreview ? "إخفاء" : "معاينة"}
                </button>
                <button onClick={handleReset}
                  className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                  <RefreshCw className="size-3" /> افتراضي
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">📧 موضوع البريد</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
                placeholder="موضوع البريد" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">💌 محتوى البريد (HTML)</label>
              <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-mono focus:border-gold focus:outline-none"
                rows={12} dir="ltr" />
            </div>

            {/* Variables */}
            <div className="rounded-xl bg-blue-50 p-3 border border-blue-200">
              <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1"><Info className="size-3" /> المتغيرات المتاحة (اضغط للإضافة):</p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARS.map((v) => (
                  <button key={v.key} onClick={() => insertVariable(v.key)}
                    className="rounded-md bg-white border border-blue-200 px-2 py-1 text-[10px] font-mono text-blue-700 hover:bg-blue-100">
                    {v.key} <span className="text-gray-500">({v.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy text-white py-3 text-sm font-bold hover:bg-navy-light shadow-lg disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "جاري الحفظ..." : "حفظ القالب"}
            </button>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
                <Eye className="size-4" /> معاينة مباشرة (ببيانات تجريبية)
              </h3>
              <div className="rounded-xl bg-gray-100 p-4">
                <div className="rounded-lg bg-white p-2 mb-3 shadow-sm">
                  <p className="text-[10px] text-gray-500">From: رداء &lt;noreply@rada.com&gt;</p>
                  <p className="text-[10px] text-gray-500">To: أحمد محمد &lt;ahmed@example.com&gt;</p>
                  <p className="text-sm font-bold text-navy mt-1">{subject
                    .replace(/{{name}}/g, "أحمد محمد")
                    .replace(/{{business_name}}/g, "رداء")
                    .replace(/{{order_number}}/g, "ORD-001")}</p>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
