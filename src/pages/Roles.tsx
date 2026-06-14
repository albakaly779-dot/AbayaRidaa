import { useState, useEffect } from "react";
import {
  Plus, Trash2, X, Users, ShieldCheck, Eye, Settings,
  Mail, Loader2, Key, Copy, MessageCircle, Send, AlertCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuditStore } from "@/stores/auditStore";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";

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
    desc: "صلاحية كاملة — تعديل الإعدادات وحذف البيانات",
    icon: ShieldCheck,
    color: "bg-red-50 text-red-700 border-red-200",
    iconColor: "text-red-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "suppliers", "returns", "expenses", "reps", "reports", "export", "settings", "audit", "rules", "roles", "import", "notifications", "delete"],
  },
  operations_manager: {
    label: "مدير عمليات",
    desc: "إدارة الطلبات والمنتجات والعملاء — بدون الإعدادات الحساسة",
    icon: Settings,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "suppliers", "returns", "expenses", "reps", "reports", "export", "notifications"],
  },
  support: {
    label: "دعم فني",
    desc: "مشاهدة البيانات فقط — بدون تعديل أو حذف",
    icon: Eye,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600",
    permissions: ["dashboard", "orders", "customers", "products", "debts", "reports"],
  },
  rep: {
    label: "مندوب مبيعات",
    desc: "إدخال بيانات العملاء فقط — بدون رؤية الأرباح أو التكاليف",
    icon: Users,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600",
    permissions: ["add_customer", "view_own_customers"],
  },
};

const FALLBACK_CONFIG: RoleDef = {
  label: "غير محدد",
  desc: "دور غير معروف",
  icon: Users,
  color: "bg-gray-50 text-gray-700 border-gray-200",
  iconColor: "text-gray-500",
  permissions: [],
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
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleKey>("support");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; role: string; name: string } | null>(null);

  const loadRoles = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load roles:", error);
      toast.error("فشل تحميل الصلاحيات: " + error.message);
      setLoading(false);
      return;
    }
    setRoles(
      (data || []).map((r: { id: string; assigned_user_email: string; role: string; permissions: string; is_active: boolean; created_at: string }) => ({
        id: r.id,
        assignedUserEmail: r.assigned_user_email,
        role: (r.role as RoleKey) || "support",
        permissions: r.permissions,
        isActive: r.is_active,
        createdAt: r.created_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { loadRoles(); }, [user?.id]);

  const handleAddRole = async () => {
    if (!user?.id) return;
    if (!email.trim()) { toast.error("البريد الإلكتروني مطلوب"); return; }
    if (email.trim() === user.email) { toast.error("لا يمكنك إضافة نفسك"); return; }
    if (!email.includes("@")) { toast.error("صيغة البريد الإلكتروني غير صحيحة"); return; }

    setInviting(true);
    const config = ROLE_CONFIG[role] || FALLBACK_CONFIG;
    const password = generatePassword();
    const userName = fullName.trim() || email.split("@")[0];

    try {
      // 1. Call edge function to create user via admin API (bypasses disabled signups)
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim(),
          password,
          role,
          fullName: userName,
        },
      });

      if (inviteError) {
        let errorMsg = inviteError.message;
        if (inviteError instanceof FunctionsHttpError) {
          try {
            const text = await inviteError.context?.text();
            errorMsg = text || errorMsg;
          } catch { /* ignore */ }
        }
        toast.error("فشل إنشاء الحساب: " + errorMsg);
        setInviting(false);
        return;
      }

      if (!inviteData?.success) {
        toast.error("فشل إنشاء الحساب: " + (inviteData?.error || "خطأ غير معروف"));
        setInviting(false);
        return;
      }

      // 2. Save role assignment in user_roles table
      const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: user.id,
        assigned_user_email: email.trim(),
        role,
        permissions: JSON.stringify(config.permissions),
        is_active: true,
      }, { onConflict: "user_id,assigned_user_email" });

      if (roleError) {
        console.error("Role save error:", roleError);
        toast.error("الحساب أُنشئ لكن فشل حفظ الدور: " + roleError.message);
      }

      // 3. Show credentials to admin
      setCredentials({ email: email.trim(), password, role: config.label, name: userName });

      logAction(user.id, "create", "role", undefined, `إنشاء حساب ${email.trim()} بدور ${config.label}`);
      toast.success(inviteData.wasExisting ? "تم تحديث كلمة المرور" : "تم إنشاء الحساب — جاهز للاستخدام فوراً");

      setEmail("");
      setFullName("");
      setShowForm(false);
      loadRoles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير معروف";
      toast.error("فشل العملية: " + msg);
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
    toast.success(newActive ? "تم تفعيل الدور" : "تم تعطيل الدور");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const sendCredentialsToAdminWA = () => {
    if (!credentials) return;
    const message = `🔐 بيانات دخول مستخدم جديد في نظام رداء:\n\n👤 الاسم: ${credentials.name}\n📧 البريد: ${credentials.email}\n🔑 كلمة المرور: ${credentials.password}\n🎭 الدور: ${credentials.role}\n\n⚠️ يرجى مطالبة المستخدم بتغيير كلمة المرور بعد أول تسجيل دخول.`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/967779673273?text=${encoded}`, "_blank");
    toast.success("تم فتح واتساب — أرسل البيانات لنفسك");
  };

  const sendInviteToUserViaEmail = () => {
    if (!credentials) return;
    const subject = encodeURIComponent("دعوة للانضمام إلى نظام رداء");
    const body = encodeURIComponent(
      `مرحباً ${credentials.name}،\n\nتم إنشاء حسابك في نظام رداء لإدارة المبيعات.\n\n📧 البريد: ${credentials.email}\n🔑 كلمة المرور: ${credentials.password}\n🎭 الدور: ${credentials.role}\n\nيمكنك الآن تسجيل الدخول مباشرة باستخدام البيانات أعلاه.\n⚠️ يُنصح بتغيير كلمة المرور بعد أول تسجيل دخول.\n\nشكراً لك،\nرداء 🌸`
    );
    window.open(`mailto:${credentials.email}?subject=${subject}&body=${body}`, "_blank");
    toast.success("تم فتح البريد لإرسال الدعوة");
  };

  const sendInviteToUserViaWA = () => {
    if (!credentials) return;
    const message = `مرحباً ${credentials.name} 👋\n\nتم إنشاء حسابك في نظام رداء.\n\n📧 البريد: ${credentials.email}\n🔑 كلمة المرور: ${credentials.password}\n🎭 الدور: ${credentials.role}\n\nسجل دخولك مباشرة بهذه البيانات. ⚠️ غيّر كلمة المرور بعد أول دخول.\n\nرداء 🌸`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast.success("تم فتح واتساب لإرسال البيانات");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy lg:text-2xl">إدارة الصلاحيات (RBAC)</h1>
          <p className="text-sm text-gray-500">إنشاء حسابات للمستخدمين بصلاحيات محددة — يتم إنشاء الحساب فوراً وعرض البيانات لك</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setCredentials(null); }}
          className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all active:scale-[0.98]">
          <Plus className="size-4" /> إنشاء حساب جديد
        </button>
      </div>

      {/* Important notice about how it works */}
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold mb-1">📌 كيف يعمل النظام الآن؟</p>
            <ul className="space-y-1 text-xs list-disc list-inside text-amber-800">
              <li>عند إنشاء مستخدم جديد، يتم إنشاء حسابه فوراً (بدون رمز تحقق - بسبب أن التسجيل مغلق في النظام)</li>
              <li>يُولّد النظام كلمة مرور تلقائياً ويعرضها لك مباشرة</li>
              <li>تستطيع إرسال البيانات للمستخدم بنفسك عبر واتساب أو البريد</li>
              <li>المستخدم يدخل مباشرة بالبريد + كلمة المرور — بدون OTP</li>
              <li>يتم حفظ نسخة من البيانات في إشعاراتك للمراجعة لاحقاً</li>
            </ul>
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

      {/* Generated credentials card */}
      {credentials && (
        <div className="rounded-2xl bg-gradient-to-l from-emerald-50 to-white p-5 border-2 border-emerald-300 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-emerald-100 p-2.5"><CheckCircle2 className="size-5 text-emerald-700" /></div>
            <div>
              <h3 className="text-sm font-bold text-navy">✅ تم إنشاء الحساب بنجاح</h3>
              <p className="text-xs text-gray-500">احفظ هذه البيانات أو أرسلها للمستخدم — يستطيع الدخول فوراً</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">الاسم الكامل</p>
                <p className="text-sm font-bold text-navy truncate">{credentials.name}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.name)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <Copy className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">البريد الإلكتروني</p>
                <p className="text-sm font-bold text-navy truncate" dir="ltr">{credentials.email}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.email)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <Copy className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border-2 border-amber-300 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-700 font-semibold">🔑 كلمة المرور المؤقتة</p>
                <p className="text-base font-bold text-navy font-mono tracking-wider" dir="ltr">{credentials.password}</p>
              </div>
              <button onClick={() => copyToClipboard(credentials.password)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-100">
                <Copy className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white p-3 border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">الدور المخصص</p>
                <p className="text-sm font-bold text-navy">{credentials.role}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={sendInviteToUserViaEmail}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors">
              <Mail className="size-4" /> إيميل للمستخدم
            </button>
            <button onClick={sendInviteToUserViaWA}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
              <MessageCircle className="size-4" /> واتساب للمستخدم
            </button>
            <button onClick={sendCredentialsToAdminWA}
              className="flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-light transition-colors">
              <Send className="size-4" /> إرسال لي ({ADMIN_EMAIL.split("@")[0]})
            </button>
          </div>

          <button onClick={() => setCredentials(null)}
            className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            ✕ إغلاق
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-navy flex items-center gap-2"><Mail className="size-4" /> إنشاء حساب مستخدم جديد</h3>
          <p className="text-xs text-gray-400">سيتم إنشاء الحساب فوراً وعرض البيانات لك لإرسالها للمستخدم</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">الاسم الكامل (اختياري)</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                placeholder="مثال: أحمد محمد" />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">البريد الإلكتروني</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
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
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button onClick={handleAddRole} disabled={inviting}
              className="flex items-center gap-2 rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all disabled:opacity-50">
              {inviting ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              {inviting ? "جاري إنشاء الحساب..." : "إنشاء الحساب الآن"}
            </button>
          </div>
        </div>
      )}

      {/* Current owner */}
      <div className="rounded-2xl bg-gradient-to-l from-gold/10 to-white p-5 border border-gold/20">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gold/20 p-2.5"><ShieldCheck className="size-5 text-gold-dark" /></div>
          <div>
            <p className="text-sm font-bold text-navy">المالك (أنت)</p>
            <p className="text-xs text-gray-400" dir="ltr">{user?.email}</p>
          </div>
          <span className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-bold text-gold-dark ms-auto">مشرف عام</span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-navy" />
        </div>
      )}

      {/* Assigned roles */}
      <div className="space-y-3">
        {roles.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="rounded-full bg-gray-100 p-6"><Users className="size-10 text-gray-300" /></div>
            <h3 className="text-lg font-bold text-navy">لا توجد حسابات مضافة</h3>
            <p className="text-sm text-gray-400">أنت المشرف الوحيد حالياً — أنشئ حسابات للموظفين</p>
          </div>
        ) : (
          roles.map((r, idx) => {
            const config = ROLE_CONFIG[r.role] || FALLBACK_CONFIG;
            const Icon = config.icon;
            return (
              <div key={r.id}
                className={`rounded-2xl bg-white p-5 border shadow-sm transition-all animate-fade-in opacity-0 ${r.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}
                style={{ animationDelay: `${idx * 60}ms` }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${config.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy" dir="ltr">{r.assignedUserEmail}</p>
                      <p className="text-xs text-gray-400">{config.label} · {r.isActive ? "نشط" : "معطل"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleToggleActive(r.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${r.isActive ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
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
