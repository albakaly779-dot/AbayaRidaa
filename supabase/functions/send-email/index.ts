import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  useTls: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { to, subject, html, text, smtpConfig: overrideConfig, testMode } = body;

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "الحقول to و subject مطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load SMTP config: use override or load from caller's app_settings
    let config: SmtpConfig;
    if (overrideConfig) {
      config = {
        host: overrideConfig.host,
        port: parseInt(String(overrideConfig.port || 587)),
        user: overrideConfig.user,
        password: overrideConfig.password,
        fromEmail: overrideConfig.fromEmail || overrideConfig.user,
        fromName: overrideConfig.fromName || "رداء",
        useTls: overrideConfig.useTls !== false,
      };
    } else {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: rows } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .eq("user_id", caller.id)
        .in("key", ["smtpEnabled", "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "smtpFromEmail", "smtpFromName", "smtpUseTls"]);

      const cfg: Record<string, string> = {};
      (rows || []).forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value; });

      if (cfg.smtpEnabled !== "true") {
        return new Response(
          JSON.stringify({ error: "SMTP غير مفعّل — قم بتفعيله وحفظ الإعدادات أولاً" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!cfg.smtpHost || !cfg.smtpUser) {
        return new Response(
          JSON.stringify({ error: "بيانات SMTP ناقصة — تأكد من إدخال Host و User" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Send via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: config.useTls,
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
      await client.close();

      return new Response(
        JSON.stringify({
          success: true,
          message: testMode ? "تم إرسال الإيميل التجريبي بنجاح" : "تم الإرسال",
          to,
          from: `${config.fromName} <${config.fromEmail}>`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpErr) {
      try { await client.close(); } catch { /* ignore */ }
      const errMsg = smtpErr instanceof Error ? smtpErr.message : "خطأ SMTP غير معروف";
      return new Response(
        JSON.stringify({
          error: `SMTP Error: ${errMsg}`,
          hint: "تأكد من: صحة الـ Host والـ Port، استخدام App Password (Gmail/Zoho)، وأن TLS مضبوط",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
    console.error("send-email error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
