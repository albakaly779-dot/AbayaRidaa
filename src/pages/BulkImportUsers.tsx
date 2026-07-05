import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle, Users, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface ParsedUser {
  email: string;
  fullName: string;
  role: string;
  status: "pending" | "processing" | "success" | "error";
  message?: string;
  password?: string;
  errors?: string[];
}

const VALID_ROLES = ["super_admin", "operations_manager", "support", "rep"];
const ROLE_LABELS: Record<string, string> = {
  super_admin: "مشرف عام",
  operations_manager: "مدير عمليات",
  support: "دعم فني",
  rep: "مندوب مبيعات",
};

const SAMPLE_CSV = `email,fullName,role
ahmed@example.com,أحمد محمد الحضرمي,operations_manager
fatima@example.com,فاطمة علي,support
sarah@example.com,سارة عبدالله,rep
omar@example.com,عمر خالد,rep`;

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

function parseCSV(text: string): ParsedUser[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = headers.indexOf("email");
  const nameIdx = headers.findIndex((h) => h === "fullname" || h === "name" || h === "full_name");
  const roleIdx = headers.indexOf("role");

  if (emailIdx === -1) throw new Error("العمود 'email' مفقود من ملف CSV");

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = cols[emailIdx] || "";
    const fullName = nameIdx >= 0 ? cols[nameIdx] || "" : "";
    const role = (roleIdx >= 0 ? cols[roleIdx] || "" : "support").toLowerCase();

    const errors: string[] = [];
    if (!email || !email.includes("@")) errors.push("البريد غير صحيح");
    if (role && !VALID_ROLES.includes(role)) errors.push(`الدور غير صحيح: ${role}`);

    return {
      email,
      fullName: fullName || email.split("@")[0],
      role: VALID_ROLES.includes(role) ? role : "support",
      status: "pending" as const,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

export default function BulkImportUsers() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<ParsedUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [sendEmails, setSendEmails] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error("الملف فارغ أو تنسيقه غير صحيح");
        return;
      }
      setUsers(parsed);
      const validCount = parsed.filter((p) => !p.errors).length;
      toast.success(`تم تحميل ${parsed.length} صف — ${validCount} صالح للاستيراد`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل قراءة الملف";
      toast.error(msg);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل نموذج CSV");
  };

  const handleStartImport = async () => {
    if (!user?.id) return;
    const validUsers = users.filter((u) => !u.errors);
    if (validUsers.length === 0) {
      toast.error("لا يوجد مستخدمون صالحون للاستيراد");
      return;
    }
    if (!confirm(`سيتم إنشاء ${validUsers.length} حساب جديد. متابعة؟`)) return;

    setImporting(true);
    setProgress({ current: 0, total: validUsers.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (u.errors) continue;

      setUsers((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "processing" } : p));

      const password = generatePassword();

      try {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
          body: {
            email: u.email,
            password,
            role: u.role,
            fullName: u.fullName,
            sendEmail: sendEmails,
          },
        });

        if (inviteError) {
          let errorMsg = inviteError.message;
          if (inviteError instanceof FunctionsHttpError) {
            try { errorMsg = await inviteError.context?.text() || errorMsg; } catch { /* ignore */ }
          }
          setUsers((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "error", message: errorMsg } : p));
          failCount++;
        } else if (inviteData?.success) {
          // Save role
          const permissions = u.role === "super_admin"
            ? ["dashboard", "orders", "customers", "products", "settings", "audit", "rules", "roles"]
            : u.role === "operations_manager"
            ? ["dashboard", "orders", "customers", "products", "reports"]
            : u.role === "rep"
            ? ["add_customer", "view_own_customers"]
            : ["dashboard", "orders", "customers"];

          await supabase.from("user_roles").upsert({
            user_id: user.id,
            assigned_user_email: u.email,
            role: u.role,
            permissions: JSON.stringify(permissions),
            is_active: true,
          }, { onConflict: "user_id,assigned_user_email" });

          const emailStatus = sendEmails
            ? (inviteData.emailSent ? " · تم إرسال إيميل" : ` · إيميل: ${inviteData.emailError || "فشل"}`)
            : "";
          setUsers((prev) => prev.map((p, idx) => idx === i ? {
            ...p,
            status: "success",
            password,
            message: (inviteData.wasExisting ? "محدّث" : "جديد") + emailStatus,
          } : p));
          successCount++;
        } else {
          setUsers((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "error", message: inviteData?.error || "خطأ غير معروف" } : p));
          failCount++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "خطأ غير معروف";
        setUsers((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "error", message: msg } : p));
        failCount++;
      }

      setProgress({ current: i + 1, total: validUsers.length });

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    logAction(user.id, "create", "role", undefined, `استيراد جماعي: ${successCount} نجح، ${failCount} فشل`);
    toast.success(`اكتمل: ${successCount} حساب أُنشئ، ${failCount} فشل`);
    setImporting(false);
  };

  const exportResults = () => {
    if (users.length === 0) return;
    const headers = "email,fullName,role,status,password,message";
    const rows = users.map((u) => [
      u.email,
      u.fullName,
      u.role,
      u.status,
      u.password || "",
      (u.message || "").replace(/,/g, ";"),
    ].join(",")).join("\n");
    const csv = "\uFEFF" + headers + "\n" + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-import-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل نتائج الاستيراد مع كلمات المرور");
  };

  const validCount = users.filter((u) => !u.errors).length;
  const errorCount = users.filter((u) => u.errors).length;
  const successCount = users.filter((u) => u.status === "success").length;
  const failedCount = users.filter((u) => u.status === "error").length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <Link to="/roles" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy mb-2">
          <ArrowLeft className="size-4" /> العودة لإدارة الصلاحيات
        </Link>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-gold" /> استيراد جماعي للمستخدمين من CSV
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">أنشئ عشرات الحسابات دفعة واحدة مع تعيين الأدوار وإرسال البيانات</p>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 flex-1">
            <p className="font-bold mb-2">📋 كيفية استخدام الاستيراد الجماعي:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800">
              <li>حمّل نموذج CSV بالضغط على "تنزيل النموذج"</li>
              <li>افتحه في Excel أو أي محرر نصوص</li>
              <li>أضف صفاً لكل مستخدم: <b>email, fullName, role</b></li>
              <li>الأدوار المسموحة: <code className="bg-white px-1 rounded">super_admin</code>, <code className="bg-white px-1 rounded">operations_manager</code>, <code className="bg-white px-1 rounded">support</code>, <code className="bg-white px-1 rounded">rep</code></li>
              <li>ارفع الملف واستعرض النتائج قبل الاستيراد</li>
              <li>اضغط "بدء الاستيراد" — سيتم توليد كلمات مرور تلقائياً</li>
              <li>احفظ ملف النتائج لاحتوائه على كلمات المرور المولّدة</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={downloadTemplate}
          className="flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-navy px-4 py-3 text-sm font-bold text-navy hover:bg-navy hover:text-white transition-colors">
          <Download className="size-4" /> تنزيل النموذج (CSV)
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-bl from-navy to-navy-light px-4 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-shadow">
          <Upload className="size-4" /> رفع ملف CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
        {users.length > 0 && (
          <button onClick={exportResults}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600">
            <Download className="size-4" /> تنزيل النتائج مع كلمات المرور
          </button>
        )}
      </div>

      {/* Summary + Send emails option */}
      {users.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-sm">
              <Users className="size-5 text-navy mb-2" />
              <p className="text-xs text-gray-500">إجمالي الصفوف</p>
              <p className="text-2xl font-bold text-navy tabular-nums">{users.length}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200">
              <CheckCircle2 className="size-5 text-emerald-600 mb-2" />
              <p className="text-xs text-emerald-700">صالح للاستيراد</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{validCount}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
              <XCircle className="size-5 text-amber-600 mb-2" />
              <p className="text-xs text-amber-700">فيها أخطاء</p>
              <p className="text-2xl font-bold text-amber-700 tabular-nums">{errorCount}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 border border-blue-200">
              <CheckCircle2 className="size-5 text-blue-600 mb-2" />
              <p className="text-xs text-blue-700">تم استيرادهم</p>
              <p className="text-2xl font-bold text-blue-700 tabular-nums">{successCount}</p>
              {failedCount > 0 && <p className="text-[10px] text-red-500 mt-0.5">فشل: {failedCount}</p>}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 border border-gray-100 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)}
                className="size-5 rounded border-gray-300 text-gold focus:ring-gold" />
              <div>
                <p className="text-sm font-bold text-navy">إرسال البيانات لبريد كل مستخدم تلقائياً</p>
                <p className="text-[10px] text-gray-500">يتطلب تفعيل SMTP من صفحة الإعدادات</p>
              </div>
            </label>

            <div className="flex gap-2 flex-wrap">
              <button onClick={handleStartImport} disabled={importing || validCount === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {importing ? `جاري الاستيراد (${progress.current}/${progress.total})` : `بدء استيراد ${validCount} مستخدم`}
              </button>
              <button onClick={() => setUsers([])} disabled={importing}
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                <Trash2 className="size-4" />
              </button>
            </div>

            {importing && (
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }} />
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b bg-cream/50 text-right">
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">#</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">البريد</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الاسم</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الدور</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">الحالة</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">كلمة المرور</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 sm:px-4">ملاحظة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u, i) => (
                    <tr key={i} className={u.errors ? "bg-red-50/30" : u.status === "success" ? "bg-emerald-50/30" : u.status === "error" ? "bg-red-50/50" : ""}>
                      <td className="px-3 py-2.5 text-xs text-gray-500 sm:px-4">{i + 1}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold sm:px-4" dir="ltr">{u.email}</td>
                      <td className="px-3 py-2.5 text-xs sm:px-4">{u.fullName}</td>
                      <td className="px-3 py-2.5 sm:px-4">
                        <span className="rounded-lg bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">{ROLE_LABELS[u.role] || u.role}</span>
                      </td>
                      <td className="px-3 py-2.5 sm:px-4">
                        {u.errors ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <XCircle className="size-3" /> خطأ
                          </span>
                        ) : u.status === "processing" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            <Loader2 className="size-3 animate-spin" /> جاري
                          </span>
                        ) : u.status === "success" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="size-3" /> نجح
                          </span>
                        ) : u.status === "error" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <XCircle className="size-3" /> فشل
                          </span>
                        ) : (
                          <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">في الانتظار</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs sm:px-4">
                        {u.password ? (
                          <code className="text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" dir="ltr">{u.password}</code>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-gray-500 sm:px-4 max-w-[200px] truncate">
                        {u.errors ? u.errors.join(", ") : u.message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {users.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <FileSpreadsheet className="mx-auto size-12 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-600">لم يتم رفع أي ملف بعد</p>
          <p className="text-xs text-gray-400 mt-1">حمّل النموذج، املأ بياناتك، ثم ارفعه هنا</p>
        </div>
      )}
    </div>
  );
}
