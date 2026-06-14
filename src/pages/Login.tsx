import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, KeyRound, ArrowLeft, Shield, UserCheck, Headphones, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import { sendOtp, verifyOtpAndSetPassword, signInWithPassword, mapSupabaseUser, detectUserRole, ALLOWED_EMAIL } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import brandLogo from "@/assets/brand-logo.png";
import loginBg from "@/assets/login-bg.jpg";

type Step = "role-select" | "login" | "otp" | "set-password";

const ROLES: { key: UserRole; label: string; desc: string; icon: typeof Shield; color: string }[] = [
  { key: "admin", label: "المدير العام", desc: "وصول كامل لجميع الميزات", icon: Shield, color: "from-navy to-navy-light" },
  { key: "rep", label: "مندوب مبيعات", desc: "إدخال بيانات العملاء فقط", icon: UserCheck, color: "from-emerald-500 to-emerald-600" },
  { key: "operations", label: "مدير عمليات", desc: "إدارة الطلبات والمنتجات", icon: Briefcase, color: "from-blue-500 to-blue-600" },
  { key: "support", label: "دعم فني", desc: "مشاهدة البيانات بدون تعديل", icon: Headphones, color: "from-purple-500 to-purple-600" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, setRole } = useAuth();
  const [step, setStep] = useState<Step>("role-select");
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessLogo, setBusinessLogo] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("رداء");

  // Try to load public logo from settings — fetch by checking app_settings without auth
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("app_settings").select("user_id, key, value").in("key", ["logoUrl", "businessName"]).limit(20);
        if (data && data.length > 0) {
          const logoRow = data.find((r: { key: string; value: string }) => r.key === "logoUrl" && r.value);
          const nameRow = data.find((r: { key: string; value: string }) => r.key === "businessName" && r.value);
          if (logoRow?.value) setBusinessLogo(logoRow.value);
          if (nameRow?.value) setBusinessName(nameRow.value);
        }
      } catch {
        /* fall back to default */
      }
    })();
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(role === "admin" ? ALLOWED_EMAIL : "");
    setStep("login");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("يرجى إدخال البريد الإلكتروني وكلمة المرور"); return; }
    setLoading(true);
    try {
      const user = await signInWithPassword(email, password);
      const mapped = mapSupabaseUser(user);
      const detectedRole = await detectUserRole(email);
      mapped.role = detectedRole;
      setRole(detectedRole);
      login(mapped);

      const roleLabel = ROLES.find(r => r.key === detectedRole)?.label || "مستخدم";
      toast.success(`مرحباً بك — ${roleLabel}`);

      if (detectedRole === "rep") {
        navigate("/rep-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "فشل تسجيل الدخول";
      if (msg.includes("Invalid login credentials")) {
        toast.error("كلمة المرور غير صحيحة، أو لم يتم إنشاء حساب بعد");
      } else {
        toast.error(msg);
      }
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) { toast.error("يرجى إدخال البريد الإلكتروني"); return; }
    setLoading(true);
    try {
      await sendOtp(email);
      setStep("otp");
      toast.success("تم إرسال رمز التحقق إلى بريدك الإلكتروني");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "فشل إرسال رمز التحقق";
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) { toast.error("يرجى إدخال رمز التحقق كاملاً"); return; }
    setStep("set-password");
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const user = await verifyOtpAndSetPassword(email, otp, newPassword);
      if (user) {
        const mapped = mapSupabaseUser(user);
        const detectedRole = await detectUserRole(email);
        mapped.role = detectedRole;
        setRole(detectedRole);
        login(mapped);
        toast.success("تم إنشاء الحساب بنجاح — مرحباً بك!");
        navigate(detectedRole === "rep" ? "/rep-dashboard" : "/dashboard");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "فشل إنشاء الحساب";
      toast.error(msg);
      setLoading(false);
    }
  };

  const currentRoleInfo = ROLES.find(r => r.key === selectedRole);
  const displayLogo = businessLogo || brandLogo;

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:max-w-lg">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <img src={displayLogo} alt={businessName} className="mx-auto mb-4 size-20 rounded-2xl object-cover shadow-xl shadow-navy/20 bg-white" />
            <h1 className="font-kufi text-2xl font-bold text-navy">{businessName}</h1>
            <p className="mt-1 text-sm text-gray-500">نظام إدارة المبيعات والمديونيات</p>
          </div>

          {/* Role Selection */}
          {step === "role-select" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-gray-600 mb-4">اختر نوع حسابك</p>
              {ROLES.map((role) => (
                <button key={role.key} onClick={() => handleRoleSelect(role.key)}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-gray-200 p-4 text-right transition-all hover:border-gold hover:shadow-md active:scale-[0.98]">
                  <div className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-bl ${role.color} text-white`}>
                    <role.icon className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-navy">{role.label}</p>
                    <p className="text-xs text-gray-400">{role.desc}</p>
                  </div>
                  <ArrowLeft className="size-5 text-gray-300" />
                </button>
              ))}
            </div>
          )}

          {/* Login Form */}
          {step === "login" && (
            <div>
              {currentRoleInfo && (
                <div className={`mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-l ${currentRoleInfo.color} p-3 text-white`}>
                  <currentRoleInfo.icon className="size-5" />
                  <span className="text-sm font-bold">{currentRoleInfo.label}</span>
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 py-3 pe-4 ps-12 text-sm transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="أدخل بريدك الإلكتروني" dir="ltr"
                      readOnly={selectedRole === "admin"} />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 py-3 pe-4 ps-12 text-sm transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="••••••••" dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="عرض">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-l from-navy to-navy-light py-3.5 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all hover:shadow-xl disabled:opacity-60 active:scale-[0.98]">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري الدخول...
                    </span>
                  ) : "تسجيل الدخول"}
                </button>
                <div className="text-center">
                  <button type="button" onClick={handleSendOtp} disabled={loading}
                    className="text-sm font-semibold text-gold hover:text-gold-dark transition-colors disabled:opacity-60">
                    أول مرة؟ أنشئ حسابك عبر رمز التحقق
                  </button>
                </div>
              </form>
              <button onClick={() => { setStep("role-select"); setPassword(""); }}
                className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-navy transition-colors">
                <ArrowLeft className="size-4" /> تغيير نوع الحساب
              </button>
            </div>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <div className="space-y-5">
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <KeyRound className="mx-auto mb-2 size-8 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">تم إرسال رمز التحقق</p>
                <p className="text-xs text-emerald-600 mt-1">تحقق من بريدك: {email}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">رمز التحقق (4 أرقام)</label>
                <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-xl border-2 border-gray-200 py-3 text-center text-2xl font-bold tracking-[0.5em] transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  placeholder="0000" dir="ltr" maxLength={4} autoFocus />
              </div>
              <button onClick={handleVerifyOtp} disabled={otp.length < 4}
                className="w-full rounded-xl bg-gradient-to-l from-navy to-navy-light py-3.5 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all disabled:opacity-60 active:scale-[0.98]">
                تأكيد الرمز
              </button>
              <button onClick={() => setStep("login")} className="flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-navy">
                <ArrowLeft className="size-4" /> العودة لتسجيل الدخول
              </button>
            </div>
          )}

          {/* Set Password Step */}
          {step === "set-password" && (
            <div className="space-y-5">
              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <Lock className="mx-auto mb-2 size-8 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">أنشئ كلمة مرور لحسابك</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 py-3 pe-4 ps-12 text-sm transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    placeholder="6 أحرف على الأقل" dir="ltr" autoFocus />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="عرض">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleSetPassword} disabled={loading || newPassword.length < 6}
                className="w-full rounded-xl bg-gradient-to-l from-navy to-navy-light py-3.5 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all disabled:opacity-60 active:scale-[0.98]">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري إنشاء الحساب...
                  </span>
                ) : "إنشاء الحساب والدخول"}
              </button>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-cream p-4">
            <p className="text-xs text-gray-500 text-center">🔒 الدخول متاح للمستخدمين المسجلين فقط</p>
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 lg:block">
        <img src={loginBg} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 via-navy/50 to-transparent" />
        <div className="absolute bottom-12 right-12 max-w-md">
          <h2 className="font-kufi text-3xl font-bold leading-relaxed text-white">
            أدر مبيعاتك <br />
            <span className="text-gold-light">بكل سهولة واحترافية</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            نظام متكامل لإدارة الطلبات والعملاء والمديونيات مع قاعدة بيانات حقيقية ونظام مصادقة آمن
          </p>
        </div>
      </div>
    </div>
  );
}
