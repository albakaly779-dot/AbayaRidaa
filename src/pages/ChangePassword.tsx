import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, ShieldCheck, Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/hooks/useActivityLogger";
import brandLogo from "@/assets/brand-logo.png";

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "8 أحرف على الأقل", test: (p) => p.length >= 8 },
  { label: "حرف كبير (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "حرف صغير (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "رقم (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "رمز خاص (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function calculateStrength(pass: string): { score: number; label: string; color: string; percent: number } {
  if (!pass) return { score: 0, label: "لا يوجد", color: "bg-gray-300", percent: 0 };
  let score = 0;
  PASSWORD_RULES.forEach((r) => { if (r.test(pass)) score++; });
  if (pass.length >= 12) score = Math.min(6, score + 1);

  const configs = [
    { label: "ضعيف جداً", color: "bg-red-500", percent: 15 },
    { label: "ضعيف", color: "bg-orange-500", percent: 30 },
    { label: "متوسط", color: "bg-yellow-500", percent: 50 },
    { label: "جيد", color: "bg-lime-500", percent: 70 },
    { label: "قوي", color: "bg-emerald-500", percent: 85 },
    { label: "ممتاز", color: "bg-emerald-600", percent: 100 },
  ];
  const idx = Math.min(score, configs.length - 1);
  return { score, ...configs[idx] };
}

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => calculateStrength(newPassword), [newPassword]);
  const passwordsMatch = newPassword && newPassword === confirmPassword;
  const meetsRequirements = PASSWORD_RULES.every((r) => r.test(newPassword));
  const canSubmit = newPassword && meetsRequirements && passwordsMatch && strength.score >= 4;

  const isFirstTime = user?.mustChangePassword;

  const handleSubmit = async () => {
    if (!user) { toast.error("يجب تسجيل الدخول أولاً"); return; }
    if (!canSubmit) { toast.error("يرجى تلبية جميع متطلبات كلمة المرور"); return; }

    setLoading(true);
    try {
      // Verify current password by attempting sign-in (unless first time)
      if (!isFirstTime && currentPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyError) {
          toast.error("كلمة المرور الحالية غير صحيحة");
          setLoading(false);
          return;
        }
      }

      // Update password + clear must_change_password flag
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false,
          password_last_changed: new Date().toISOString(),
        },
      });

      if (updateError) {
        toast.error("فشل تحديث كلمة المرور: " + updateError.message);
        setLoading(false);
        return;
      }

      // Log activity
      if (user.email && user.id) {
        await logActivity(user.email, user.id, "action", "تغيير كلمة المرور", {
          entityType: "auth",
          details: `تم تحديث كلمة المرور بنجاح (قوة: ${strength.label})`,
        });
      }

      toast.success("✅ تم تغيير كلمة المرور بنجاح");

      // If admin, update local state; otherwise force re-login for security
      if (updateData.user && isFirstTime) {
        toast.info("يرجى تسجيل الدخول من جديد بكلمة المرور الجديدة");
        setTimeout(async () => {
          await logout();
          navigate("/login");
        }, 1500);
      } else {
        setTimeout(() => navigate("/dashboard"), 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير معروف";
      toast.error("خطأ: " + msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-bl from-navy via-navy-light to-navy flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src={brandLogo} alt="رداء" className="mx-auto size-16 rounded-2xl object-cover shadow-xl" />
          <h1 className="mt-4 text-2xl font-bold text-white">🔐 تغيير كلمة المرور</h1>
          {isFirstTime && (
            <div className="mt-3 mx-auto max-w-md rounded-xl bg-amber-500/20 border border-amber-400/50 p-3 backdrop-blur-sm">
              <p className="text-xs text-amber-100 font-semibold">
                ⚠️ هذا أول تسجيل دخول لك — يجب تغيير كلمة المرور المؤقتة لأسباب أمنية
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
          {!isFirstTime && (
            <button onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-xs text-gray-500 hover:text-navy">
              <ArrowLeft className="size-4" /> العودة
            </button>
          )}

          <div className="space-y-5">
            {/* User info */}
            <div className="rounded-xl bg-cream/40 p-3 border border-gold/20">
              <p className="text-[10px] text-gray-500">تسجيل الدخول باسم</p>
              <p className="text-sm font-bold text-navy" dir="ltr">{user?.email}</p>
            </div>

            {/* Current password (skip if first time) */}
            {!isFirstTime && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <KeyRound className="inline size-3.5 me-1" /> كلمة المرور الحالية
                </label>
                <div className="relative">
                  <input type={showCurrent ? "text" : "password"} value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pe-11 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="أدخل كلمة المرور الحالية" dir="ltr" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* New password */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <ShieldCheck className="inline size-3.5 me-1" /> كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pe-11 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  placeholder="أدخل كلمة مرور قوية" dir="ltr" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-500">قوة كلمة المرور</span>
                    <span className="text-[10px] font-bold text-navy">{strength.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full ${strength.color} transition-all duration-300 rounded-full`}
                      style={{ width: `${strength.percent}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Requirements checklist */}
            <div className="rounded-xl bg-cream/40 p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-500 mb-1">متطلبات كلمة المرور:</p>
              {PASSWORD_RULES.map((rule, i) => {
                const passed = newPassword && rule.test(newPassword);
                return (
                  <div key={i} className={`flex items-center gap-2 text-[11px] transition-colors ${passed ? "text-emerald-700" : "text-gray-500"}`}>
                    {passed ? <CheckCircle2 className="size-3.5 shrink-0" /> : <XCircle className="size-3.5 shrink-0 text-gray-300" />}
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">تأكيد كلمة المرور</label>
              <input type={showNew ? "text" : "password"} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                  confirmPassword && !passwordsMatch
                    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-200 focus:border-gold focus:ring-gold/20"
                }`}
                placeholder="أعد إدخال كلمة المرور" dir="ltr" />
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-[10px] text-red-600 flex items-center gap-1">
                  <XCircle className="size-3" /> كلمتا المرور غير متطابقتين
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1 text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> كلمتا المرور متطابقتان
                </p>
              )}
            </div>

            <button onClick={handleSubmit} disabled={!canSubmit || loading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all ${
                canSubmit && !loading
                  ? "bg-navy hover:bg-navy-light shadow-navy/30 active:scale-[0.98]"
                  : "bg-gray-300 cursor-not-allowed"
              }`}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {loading ? "جاري التحديث..." : "🔒 تغيير كلمة المرور"}
            </button>

            {isFirstTime && (
              <p className="text-center text-[10px] text-gray-400">
                بعد التغيير، سيتم تسجيل خروجك لإعادة الدخول بكلمة المرور الجديدة
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
