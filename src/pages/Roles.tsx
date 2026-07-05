import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Trash2, Users, ShieldCheck, Eye, Settings,
  Mail, Loader2, Key, Copy, MessageCircle, Send, AlertCircle, CheckCircle2, KeyRound, MailPlus, Activity, FileSpreadsheet, MailCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useSettingsStore } from "@/stores/settingsStore";

interface UserRole {
  id: string;
  assignedUserEmail: string;
  role: "super_admin" | "operations_manager" | "support" | "rep";
  permissions: string;
  isActive: boolean;
  createdAt: string;
}

type RoleKey = UserRole["role"];

interface RoleDef {
  label: string;
  desc: string;
  icon: typeof ShieldCheck;
  color: string;
  iconColor: string;
  permissions: string[];
}

const ROLE_CONFIG: Record<RoleKey, RoleDef> = {
  super_admin: {
    label: "مشرف عام",
    desc: "صلاحية كاملة",
    icon: ShieldCheck,
    color: "bg-red-50 text-red-700 border-red-200",
    iconColor: "text-red-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "suppliers", "returns", "expenses", "reps", "reports", "export", "settings", "audit", "rules", "roles", "import", "notifications", "delete"],
  },
  operations_manager: {
    label: "مدير عمليات",
    desc: "إدارة الطلبات والمنتجات",
    icon: Settings,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "suppliers", "returns", "expenses", "reps", "reports", "export", "notifications"],
  },
  support: {
    label: "دعم فني",
    desc: "مشاهدة البيانات فقط",
    icon: Eye,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "reports"],
  },
  rep: {
    label: "مندوب مبيعات",
    desc: "إدخال بيانات العملاء فقط",
    icon: Users,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600",
    permissions: ["add_customer", "view_own_customers"],
  },
};

const FALLBACK_CONFIG: RoleDef = {
  label: "غير محدد", desc: "دور غير معروف", icon: Users,
  color: "bg-gray-50 text-gray-700 border-gray-200", iconColor: "text-gray-500", permissions: [],
};

const ADMIN_EMAIL = "albakaly779@gmail.com";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

export default function Roles() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const { settings, initializeSettings } = useSettingsStore();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleKey>("support");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendViaSmtp, setSendViaSmtp] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; role: string; name: string; emailSent?: boolean; emailError?: string } | null>(null);
  const [activityCounts, setActivityCounts] = useState<Record<string, { total: number; lastActivity?: string }>>({});

  useEffect(() => { if (user?.id) initializeSettings(user.id); }, [user?.id, initializeSettings]);

  const loadRoles = async () => {
    if (!user?.id) { setLoading(false); return; }
    const { data, error } = await supabase.from("user_roles").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { toast.error("فشل تحميل الصلاحيات: " + error.message); setLoading(false); return; }

    const mapped = (data || []).map((r: { id: string; assigned_user_email: string; role: string; permissions: string; is_active: boolean; created_at: string }) => ({
      id: r.id, assignedUserEmail: r.assigned_user_email, role: (r.role as RoleKey) || "support",
      permissions: r.permissions, isActive: r.is_active, createdAt: r.created_at,
    }));
    setRoles(mapped);

    // Fetch activity counts per user
    if (mapped.length > 0) {
      const emails = mapped.map((r) => r.assignedUserEmail);
      const { data: activities } = await supabase
        .from("user_activity_logs")
        .select("user_email, created_at")
        .in("user_email", emails)
        .order("created_at", { ascending: false })
        .limit(1000);

      const counts: Record<string, { total: number; lastActivity?: string }> = {};
      (activities || []).forEach((a: { user_email: string; created_at: string }) => {
        if (!counts[a.user_email]) counts[a.user_email] = { total: 0, lastActivity: a.created_at };
        counts[a.user_email].total += 1;
      });
      setActivityCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => { loadRoles(); }, [user?.id]);

  const handleAddRole = async () => {
    if (!user?.id) return;
    if (!email.trim() || !email.includes("@")) { toast.error("البريد الإلكتروني غير صحيح"); return; }
    if (email.trim() === user.email) { toast.error("لا يمكنك إضافة نفسك"); return; }

    setInviting(true);
    const config = ROLE_CONFIG[role] || FALLBACK_CONFIG;
    const password = generatePassword();
    const userName = fullName.trim() || email.split("@")[0];

    try {
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
        body: { email: email.trim(), password, role, fullName: userName, sendEmail: sendViaSmtp && settings.smtpEnabled },
      });

      if (inviteError) {
        let errorMsg = inviteError.message;
        if (inviteError instanceof FunctionsHttpError) {
          try { errorMsg = await inviteError.context?.text() || errorMsg; } catch { /* ignore */ }
        }
        toast.error("فشل: " + errorMsg);
        setInviting(false);
        return;
      }

      if (!inviteData?.success) {
        toast.error("فشل: " + (inviteData?.error || "خطأ"));
        setInviting(false);
        return;
      }

      const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: user.id, assigned_user_email: email.trim(), role,
        permissions: JSON.stringify(config.permissions), is_active: true,
      }, { onConflict: "user_id,assigned_user_email" });

      if (roleError) toast.error("الحساب أُنشئ لكن فشل حفظ الدور: " + roleError.message);

      setCredentials({
        email: email.trim(), password, role: config.label, name: userName,
        emailSent: inviteData.emailSent, emailError: inviteData.emailError,
      });

      logAction(user.id, "create", "role", undefined, `إنشاء حساب ${email.trim()} بدور ${config.label}${inviteData.emailSent ? " (إرسال ناجح)" : ""}`);

      if (inviteData.emailSent) {
        toast.success("✅ تم إنشاء الحساب وإرسال البيانات بالبريد");
      } else if (sendViaSmtp && inviteData.emailError) {
        toast.warning(`الحساب أُنشئ. لكن فشل إرسال البريد: ${inviteData.emailError}`);
      } else {
        toast.success(inviteData.wasExisting ? "تم تحديث كلمة المرور" : "تم إنشاء الحساب — جاهز للاستخدام");
      }

      setEmail(""); setFullName(""); setShowForm(false);
      loadRoles();
    } catch (err) {
      toast.error("خطأ: " + (err instanceof Error ? err.message : "غير معروف"));
    }
    setInviting(false);
  };

  const handleDeleteRole = async (id: string, roleEmail: string) => {
    if (!confirm(`هل تريد إزالة صلاحيات ${roleEmail}؟`)) return;
    await supabase.from("user_roles").delete().eq("id", id);
    setRoles((prev) => prev.filter((r) => r.id !== id));
    if (user?.id) logAction(user.id, "delete", "role", id, `إزالة صلاحيات ${roleEmail}`);
    toast.success("تم إزالة الدور");
  };

  const handleToggleActive = async (id: string) => {
    const target = roles.find((r) => r.id === id);
    if (!target) return;
    const newActive = !target.isActive;
    await supabase.from("user_roles").update({ is_active: newActive }).eq("id", id);
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: newActive } : r)));
    toast.success(newActive ? "تم التفعيل" : "تم التعطيل");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const sendCredentialsToAdminEmail = () => {
    if (!credentials) return;
    const subject = encodeURIComponent(`🔐 بيانات دخول - ${credentials.name}`);
    const body = encodeURIComponent(`حساب جديد:\n\nالاسم: ${credentials.name}\nالبريد: ${credentials.email}\nكلمة المرور: ${credentials.password}\nالدور: ${credentials.role}\n\n—\nرداء 🌸`);
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleSendResetEmail = async () => {
    if (!credentials) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(credentials.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) toast.error("فشل: " + error.message);
      else toast.success(`تم إرسال رابط إعادة التعيين إلى ${credentials.email}`);
    } catch (err) { toast.error("خطأ: " + (err instanceof Error ? err.message : "غير معروف")); }
    setSendingReset(false);
  };

  const sendInviteToUserViaWA = () => {
    if (!credentials) return;
    const message = `مرحباً ${credentials.name} 👋\n\nحسابك في نظام رداء:\n📧 ${credentials.email}\n🔑 ${credentials.password}\n🎭 ${credentials.role}\n\n⚠️ غيّر كلمة المرور بعد أول دخول.\n\nرداء 🌸`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy lg:text-2xl">إدارة الصلاحيات (RBAC)</h1>
          <p className="text-sm text-gray-500">إنشاء حسابات فردية، استيراد جماعي، وسجل نشاط لكل مستخدم</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/bulk-import-users"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
            <FileSpreadsheet className="size-4" /> استيراد جماعي CSV
          </Link>
          <button onClick={() => { setShowForm(!showForm); setCredentials(null); }}
            className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light active:scale-[0.98]">
            <Plus className="size-4" /> إنشاء حساب جديد
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold mb-1">📌 كيف يعمل النظام؟</p>
            <ul className="space-y-1 text-xs list-disc list-inside text-amber-800">
              <li>الحسابات تُنشأ فوراً دون رمز تحقق (تجاوز لقفل التسجيل)</li>
              <li>كلمة مرور تلقائية + عرضها لك مباشرة + حفظ في إشعاراتك</li>
              <li>إذا كان SMTP مفعّلاً في الإعدادات، تصل بيانات الدخول للمستخدم بالبريد تلقائياً</li>
              <li>يُطلب من كل مستخدم تغيير كلمة المرور المؤقتة بعد أول دخول</li>
              <li>يمكنك عرض سجل نشاط كل مستخدم من زر <b>"عرض النشاط"</b></li>
            </ul>
            {!settings.smtpEnabled && (
              <p className="mt-2 text-xs bg-white/60 rounded p-2 flex items-center gap-2">
                ⚠️ SMTP غير مفعّل — <Link to="/settings" className="font-bold underline hover:text-amber-900">فعّله من الإعدادات</Link> لإرسال البيانات تلقائياً
              </p>
            )}
            {settings.smtpEnabled && (
              <p className="mt-2 text-xs bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-2 text-emerald-700">
                ✅ SMTP مفعّل — يمكن إرسال البيانات تلقائياً عبر <b>{settings.smtpFromEmail || settings.smtpUser}</b>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Role definitions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(ROLE_CONFIG) as [RoleKey, RoleDef][]).map(([key, config]) => (
          <div key={key} className={`rounded-2xl p-5 border ${config.color}`}>
            <div className="flex items-center gap-3 mb-3">
              <config.icon className={`size-6 ${config.iconColor}`} />
              <div>
                <h3 className="text-sm font-bold">{config.label}</h3>
                <p className="text-[10px] opacity-70">{config.desc}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {config.permissions.slice(0, 6).map((p) => (
                <span key={p} className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold">{p}</span>
              ))}
              {config.permissions.length > 6 && (
                <span className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold">+{config.permissions.length - 6}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Credentials card */}
      {credentials && (
        <div className="rounded-2xl bg-gradient-to-l from-emerald-50 to-white p-5 border-2 border-emerald-300 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-emerald-100 p-2.5"><CheckCircle2 className="size-5 text-emerald-700" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-navy">✅ تم إنشاء الحساب بنجاح</h3>
              {credentials.emailSent ? (
                <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <MailCheck className="size-3.5" /> تم إرسال البيانات لبريد المستخدم تلقائياً
                </p>
              ) : credentials.emailError ? (
                <p className="text-xs text-amber-700">⚠️ لم يتم إرسال البريد: {credentials.emailError}</p>
              ) : (
                <p className="text-xs text-gray-500">احفظ البيانات وأرسلها للمستخدم</p>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">البريد</p>
                <p className="text-sm font-bold text-navy truncate" dir="ltr">{credentials.email}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.email)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><Copy className="size-4" /></button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border-2 border-amber-300 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-700 font-semibold">🔑 كلمة المرور المؤقتة</p>
                <p className="text-base font-bold text-navy font-mono tracking-wider" dir="ltr">{credentials.password}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.password)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-100"><Copy className="size-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={sendCredentialsToAdminEmail}
              className="flex items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-xs font-bold text-white hover:bg-navy-light">
              <MailPlus className="size-4" /> إرسال لإيميلي
            </button>
            <button onClick={handleSendResetEmail} disabled={sendingReset}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50">
              {sendingReset ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              رابط تحقق
            </button>
            <button onClick={sendInviteToUserViaWA}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
              <MessageCircle className="size-4" /> واتساب
            </button>
            <button onClick={() => setCredentials(null)}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
              ✕ إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-navy flex items-center gap-2"><Mail className="size-4" /> إنشاء حساب مستخدم جديد</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">الاسم الكامل</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                placeholder="أحمد محمد" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">البريد الإلكتروني</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                placeholder="user@example.com" dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">الدور</label>
              <select value={role} onChange={(e) => setRole(e.target.value as RoleKey)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gold focus:outline-none">
                <option value="super_admin">مشرف عام</option>
                <option value="operations_manager">مدير عمليات</option>
                <option value="support">دعم فني</option>
                <option value="rep">مندوب مبيعات</option>
              </select>
            </div>
          </div>

          {settings.smtpEnabled && (
            <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-blue-50 border border-blue-200 p-3">
              <input type="checkbox" checked={sendViaSmtp} onChange={(e) => setSendViaSmtp(e.target.checked)}
                className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
              <span className="text-xs font-semibold text-blue-800 flex items-center gap-2">
                <MailCheck className="size-4" /> أرسل بيانات الدخول تلقائياً لبريد المستخدم عبر SMTP
              </span>
            </label>
          )}

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button onClick={handleAddRole} disabled={inviting}
              className="flex items-center gap-2 rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-navy-light disabled:opacity-50">
              {inviting ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              {inviting ? "جاري..." : "إنشاء الحساب"}
            </button>
          </div>
        </div>
      )}

      {/* Owner card */}
      <div className="rounded-2xl bg-gradient-to-l from-gold/10 to-white p-5 border border-gold/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-xl bg-gold/20 p-2.5"><ShieldCheck className="size-5 text-gold-dark" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-navy">المالك (أنت)</p>
            <p className="text-xs text-gray-400" dir="ltr">{user?.email}</p>
          </div>
          <Link to={`/user-activity/${encodeURIComponent(user?.email || "")}`}
            className="flex items-center gap-1.5 rounded-lg bg-navy/10 px-3 py-1.5 text-xs font-bold text-navy hover:bg-navy hover:text-white transition-colors">
            <Activity className="size-3.5" /> نشاطي
          </Link>
          <span className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-bold text-gold-dark">مشرف عام</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-navy" />
        </div>
      )}

      {/* Assigned roles with activity */}
      <div className="space-y-3">
        {roles.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="rounded-full bg-gray-100 p-6"><Users className="size-10 text-gray-300" /></div>
            <h3 className="text-lg font-bold text-navy">لا توجد حسابات مضافة</h3>
            <p className="text-sm text-gray-400">أنت المشرف الوحيد — أنشئ حسابات للموظفين</p>
          </div>
        ) : (
          roles.map((r, idx) => {
            const config = ROLE_CONFIG[r.role] || FALLBACK_CONFIG;
            const Icon = config.icon;
            const activity = activityCounts[r.assignedUserEmail];
            return (
              <div key={r.id}
                className={`rounded-2xl bg-white p-5 border shadow-sm transition-all animate-fade-in opacity-0 ${r.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}
                style={{ animationDelay: `${idx * 60}ms` }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${config.color}`}><Icon className="size-5" /></div>
                    <div>
                      <p className="text-sm font-bold text-navy" dir="ltr">{r.assignedUserEmail}</p>
                      <p className="text-xs text-gray-400">
                        {config.label} · {r.isActive ? "نشط" : "معطل"}
                        {activity && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="text-emerald-600 font-semibold">{activity.total} نشاط</span>
                            {activity.lastActivity && (
                              <span className="ms-1.5 text-[10px]">
                                (آخر: {new Date(activity.lastActivity).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/user-activity/${encodeURIComponent(r.assignedUserEmail)}`}
                      className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                      <Activity className="size-3.5" /> عرض النشاط
                    </Link>
                    <button onClick={() => handleToggleActive(r.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        r.isActive ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {r.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                    <button onClick={() => handleDeleteRole(r.id, r.assignedUserEmail)}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
