import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const ADMIN_EMAIL = "albakaly779@gmail.com";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  useTls: boolean;
}

interface SendEmailBody {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  smtpConfig?: {
    host: string;
    port: number | string;
    user: string;
    password: string;
    fromEmail?: string;
    fromName?: string;
    useTls?: boolean;
  };
  testMode?: boolean;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // ---------------- AUTHENTICATION ----------------
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — رمز التفويض مفقود" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing env vars" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: caller }, error: authError } = await supabaseClient
      .auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // ---------------- AUTHORIZATION ----------------
    // Only admin can send emails via this function.
    // Regular users must not be able to spoof or spam through the SMTP relay.
    const callerEmail = (caller.email || "").toLowerCase();
    if (callerEmail !== ADMIN_EMAIL.toLowerCase()) {
      console.warn(`[send-email] Unauthorized attempt by ${callerEmail}`);
      return new Response(
        JSON.stringify({
          error: "غير مصرح — إرسال البريد متاح للمشرف العام فقط",
        }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // ---------------- INPUT VALIDATION ----------------
    let body: SendEmailBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { to, subject, html, text, smtpConfig: overrideConfig, testMode } = body;

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "الحقول to و subject مطلوبة" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!isValidEmail(to)) {
      return new Response(
        JSON.stringify({ error: `بريد المستلم غير صالح: ${to}` }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Subject/body length limits to prevent abuse
    if (subject.length > 300) {
      return new Response(
        JSON.stringify({ error: "الموضوع طويل جداً (حد 300 حرف)" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if ((html || "").length > 500_000 || (text || "").length > 500_000) {
      return new Response(
        JSON.stringify({ error: "محتوى البريد طويل جداً" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // ---------------- LOAD SMTP CONFIG ----------------
    let config: SmtpConfig;
    if (overrideConfig && overrideConfig.host && overrideConfig.user) {
      // Override only allowed for admin (already verified above)
      config = {
        host: overrideConfig.host,
        port: parseInt(String(overrideConfig.port || 587)),
        user: overrideConfig.user,
        password: overrideConfig.password || "",
        fromEmail: overrideConfig.fromEmail || overrideConfig.user,
        fromName: overrideConfig.fromName || "رداء",
        useTls: overrideConfig.useTls !== false,
      };
    } else {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const { data: rows, error: rowsErr } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .eq("user_id", caller.id)
        .in("key", [
          "smtpEnabled",
          "smtpHost",
          "smtpPort",
          "smtpUser",
          "smtpPassword",
          "smtpFromEmail",
          "smtpFromName",
          "smtpUseTls",
        ]);

      if (rowsErr) {
        return new Response(
          JSON.stringify({
            error: "تعذر تحميل إعدادات SMTP.",
            technical: rowsErr.message,
          }),
          { status: 500, headers: jsonHeaders },
        );
      }

      const cfg: Record<string, string> = {};
      (rows || []).forEach((r: { key: string; value: string }) => {
        cfg[r.key] = r.value;
      });

      if (cfg.smtpEnabled !== "true") {
        return new Response(
          JSON.stringify({
            error: "SMTP غير مفعّل — فعّله وأحفظ الإعدادات أولاً",
            hint: "اذهب لصفحة الإعدادات > قسم SMTP وفعّله",
          }),
          { status: 400, headers: jsonHeaders },
        );
      }

      if (!cfg.smtpHost || !cfg.smtpUser) {
        return new Response(
          JSON.stringify({
            error: "بيانات SMTP ناقصة — تأكد من إدخال Host و User",
            hint:
              "Gmail: smtp.gmail.com | Outlook: smtp-mail.outlook.com | Zoho: smtp.zoho.com",
          }),
          { status: 400, headers: jsonHeaders },
        );
      }

      config = {
        host: cfg.smtpHost,
        port: parseInt(cfg.smtpPort || "587"),
        user: cfg.smtpUser,
        password: cfg.smtpPassword || "",
        fromEmail: cfg.smtpFromEmail || cfg.smtpUser,
        fromName: cfg.smtpFromName || "رداء",
        useTls: cfg.smtpUseTls === "true",
      };
    }

    if (!config.password) {
      return new Response(
        JSON.stringify({
          error: "كلمة مرور SMTP فارغة",
          hint:
            "لـ Gmail: استخدم App Password من إعدادات Google. لـ SendGrid: user=apikey و password=مفتاح API",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // ---------------- SEND VIA SMTP ----------------
    // TLS handshake at connection start ONLY for SMTPS ports (465 = standard SSL, 8465 = alt).
    // For submission port (587) and standard SMTP (25/2525), the client MUST start plain
    // and let denomailer auto-negotiate STARTTLS after EHLO.
    // Enforcing tls:true on port 587 causes "received corrupt message of type InvalidContentType"
    // because Gmail/Outlook/Zoho send a plaintext 220 greeting the TLS layer can't parse.
    const useDirectTls = config.port === 465 || config.port === 8465;
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: useDirectTls,
        auth: {
          username: config.user,
          password: config.password,
        },
      },
    });

    try {
      await client.send({
        from: `${config.fromName} <${config.fromEmail}>`,
        to,
        subject,
        content: text || subject,
        html: html || `<p>${text || subject}</p>`,
      });
      try {
        await client.close();
      } catch { /* ignore */ }

      return new Response(
        JSON.stringify({
          success: true,
          message: testMode
            ? "تم إرسال الإيميل التجريبي إلى خادم SMTP بنجاح. تحقق من صندوق البريد."
            : "تم تسليم الرسالة إلى خادم SMTP بنجاح.",
          note:
            "التسليم إلى خادم SMTP لا يضمن الوصول إلى صندوق المستلم — تحقق من Spam/Junk",
          to,
          from: `${config.fromName} <${config.fromEmail}>`,
          via: `${config.host}:${config.port}`,
        }),
        { status: 200, headers: jsonHeaders },
      );
    } catch (smtpErr) {
      try {
        await client.close();
      } catch { /* ignore */ }
      const errMsg = smtpErr instanceof Error
        ? smtpErr.message
        : "خطأ SMTP غير معروف";
      let hint =
        "تأكد من: صحة Host والـ Port، استخدام App Password للـ Gmail/Zoho، وأن TLS مضبوط";
      const lower = errMsg.toLowerCase();
      if (lower.includes("auth") || lower.includes("535")) {
        hint =
          "خطأ مصادقة: كلمة المرور خاطئة أو تحتاج App Password. Gmail: https://myaccount.google.com/apppasswords";
      } else if (
        lower.includes("timeout") || lower.includes("connect") ||
        lower.includes("network")
      ) {
        hint =
          "خطأ اتصال: تحقق من Host والـ Port، وأن الشبكة تسمح بالاتصال الخارجي بالمنفذ";
      } else if (lower.includes("tls") || lower.includes("ssl")) {
        hint =
          "خطأ TLS: جرّب تغيير TLS/STARTTLS أو استخدام port آخر (465 لـ SSL، 587 لـ STARTTLS)";
      } else if (lower.includes("relay")) {
        hint =
          "خطأ Relay: الخادم يرفض إرسال الرسائل — تحقق من إعدادات المزود";
      }
      console.error("SMTP send error:", errMsg);
      return new Response(
        JSON.stringify({
          error: "تعذر إرسال البريد. تحقق من إعدادات SMTP.",
          technical: errMsg,
          hint,
        }),
        { status: 500, headers: jsonHeaders },
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "خطأ غير معروف";
    console.error("send-email fatal:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "خطأ غير متوقع في خادم البريد.",
        technical: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
