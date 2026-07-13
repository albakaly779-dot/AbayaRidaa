import { useEffect, useState } from "react";
import { Monitor, Smartphone, Globe, LogOut, Shield, Loader2, AlertCircle, RefreshCw, Clock, MapPin, ShieldAlert, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useAuditStore } from "@/stores/auditStore";
import { formatDate } from "@/lib/formatters";
import { logActivity } from "@/hooks/useActivityLogger";

interface LoginRecord {
  id: string;
  user_email: string;
  action_type: string;
  action_name: string;
  user_agent: string;
  created_at: string;
}

function parseUserAgent(ua: string): { browser: string; os: string; device: "desktop" | "mobile"; icon: typeof Monitor } {
  if (!ua) return { browser: "غير معروف", os: "غير معروف", device: "desktop", icon: Monitor };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : /Edge/.test(ua) ? "Edge" : "غير معروف";
  const os = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "غير معروف";
  return { browser, os, device: isMobile ? "mobile" : "desktop", icon: isMobile ? Smartphone : Monitor };
}

export default function Sessions() {
  const { user, logout } = useAuth();
  const { logAction } = useAuditStore();
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const currentUA = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const currentInfo = parseUserAgent(currentUA);

  const loadHistory = async () => {
    if (!user?.email) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_activity_logs")
      .select("id, user_email, action_type, action_name, user_agent, created_at")
      .eq("user_email", user.email)
      .in("action_type", ["login", "logout"])
      .order("created_at", { ascending: false })
      .limit(30);
    setLoginHistory((data || []) as LoginRecord[]);
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, [user?.email]);

  const handleGlobalLogout = async () => {
    if (!confirm("سيتم تسجيل خروجك من جميع الأجهزة والجلسات. متابعة؟")) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) { toast.error("فشل: " + error.message); setSigningOut(false); return; }
      if (user?.id) {
        logAction(user.id, "logout", "session", undefined, "تسجيل خروج شامل من جميع الأجهزة");
        logActivity(user.email, user.id, "logout", "تسجيل خروج شامل (Global)", { details: "من صفحة إدارة الجلسات" });
      }
      toast.success("تم تسجيل الخروج من جميع الأجهزة");
      setTimeout(() => logout(), 800);
    } catch (err) {
      toast.error("خطأ: " + (err instanceof Error ? err.message : "غير معروف"));
      setSigningOut(false);
    }
  };

  const CurrentIcon = currentInfo.icon;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <Shield className="size-5 text-emerald-600" /> إدارة الجلسات والأمان
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">عرض الجلسات النشطة وتاريخ الدخول مع خيارات تسجيل خروج آمنة</p>
      </div>

      {/* Current session */}
      <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/20 p-4">
              <CurrentIcon className="size-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-bold">الجلسة الحالية</p>
                <span className="rounded-full bg-white/30 px-2 py-0.5 text-[10px] font-bold animate-pulse">🟢 نشطة الآن</span>
              </div>
              <p className="text-sm text-white/90" dir="ltr">{user?.email}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs">
                <div className="flex items-center gap-1.5"><Monitor className="size-3" /> {currentInfo.browser}</div>
                <div className="flex items-center gap-1.5"><Globe className="size-3" /> {currentInfo.os}</div>
                <div className="flex items-center gap-1.5"><Smartphone className="size-3" /> {currentInfo.device === "mobile" ? "جوال" : "سطح مكتب"}</div>
                <div className="flex items-center gap-1.5"><MapPin className="size-3" /> {typeof window !== "undefined" ? window.location.hostname : "-"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security actions */}
      <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900 mb-1">🛡️ إجراءات الأمان الشاملة</p>
            <p className="text-xs text-red-800">
              إذا كنت تشك بأن حسابك مُخترق أو تريد تأمينه، سجّل خروجاً شاملاً من جميع الأجهزة والمتصفحات مرة واحدة.
            </p>
          </div>
        </div>
        <button onClick={handleGlobalLogout} disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white py-3 text-sm font-bold hover:bg-red-700 shadow-md disabled:opacity-50">
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          {signingOut ? "جاري..." : "🚨 تسجيل خروج شامل من جميع الأجهزة"}
        </button>
      </div>

      {/* Login history */}
      <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-navy flex items-center gap-2">
            <Clock className="size-4 text-navy" /> سجل تسجيلات الدخول (آخر 30)
          </h3>
          <button onClick={loadHistory} className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold hover:bg-gray-200">
            <RefreshCw className="size-3" /> تحديث
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-navy" /></div>
        ) : loginHistory.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto size-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">لا توجد سجلات دخول بعد</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loginHistory.map((rec, idx) => {
              const info = parseUserAgent(rec.user_agent);
              const Icon = info.icon;
              const isLogin = rec.action_type === "login";
              const isRecent = idx === 0;
              return (
                <div key={rec.id} className={`flex items-center gap-3 rounded-xl p-3 border ${
                  isRecent ? "bg-emerald-50 border-emerald-200" : "bg-cream/40 border-gray-100"
                }`}>
                  <div className={`rounded-lg p-2 ${isLogin ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {isLogin ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-navy">{rec.action_name || (isLogin ? "تسجيل دخول" : "تسجيل خروج")}</p>
                      {isRecent && <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[9px] font-bold">الأحدث</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Icon className="size-3" /> {info.browser}</span>
                      <span>·</span>
                      <span>{info.os}</span>
                      <span>·</span>
                      <span>{info.device === "mobile" ? "📱 جوال" : "💻 سطح مكتب"}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-500">{formatDate(rec.created_at)}</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">
                      {new Date(rec.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security tips */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-2">🔒 نصائح لتأمين حسابك:</p>
            <ul className="text-xs list-disc list-inside space-y-1">
              <li>غيّر كلمة المرور بانتظام (كل 3 أشهر على الأقل)</li>
              <li>لا تشارك بيانات دخولك مع أي شخص</li>
              <li>إذا لاحظت جلسة غير معروفة، سجّل خروجاً شاملاً فوراً</li>
              <li>استخدم كلمات مرور قوية (12 حرف على الأقل مع رموز)</li>
              <li>تحقق من هذه الصفحة دورياً لمراجعة نشاط حسابك</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
