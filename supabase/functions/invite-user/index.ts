import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "albakaly779@gmail.com";

interface InviteBody {
  email: string;
  password: string;
  role?: string;
  fullName?: string;
  sendEmail?: boolean;
}

interface SmtpCfg {
  smtpEnabled?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpUseTls?: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مشرف عام",
  operations_manager: "مدير عمليات",
  support: "دعم فني",
  rep: "مندوب مبيعات",
  accountant: "محاسب",
  branch_manager: "مدير فرع",
  marketer: "مسوق",
  partner: "شريك",
};

async function findUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  // Strategy 1: user_profiles (synced by trigger, no pagination needed)
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) return profile.id as string;

  // Strategy 2: paginated listUsers as fallback
  try {
    let page = 1;
    while (page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) break;
      const found = data?.users?.find((u: { email?: string }) => u.email === email);
      if (found) return found.id;
      if (!data?.users || data.users.length < 100) break;
      page++;
    }
  } catch (err) {
    console.error("listUsers fallback failed:", err);
  }
  return null;
}

async function sendCredentialsEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  adminUserId: string,
  email: string,
  password: string,
  fullName: string,
  role: string,
  origin: string,
): Promise<{ sent: boolean; error: string }> {
  try {
    const { data: rows } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .eq("user_id", adminUserId)
      .in("key", [
        "smtpEnabled", "smtpHost", "smtpPort", "smtpUser",
        "smtpPassword", "smtpFromEmail", "smtpFromName", "smtpUseTls",
      ]);

    const cfg: SmtpCfg = {};
    (rows || []).forEach((r: { key: string; value: string }) => {
      (cfg as Record<string, string>)[r.key] = r.value;
    });

    if (cfg.smtpEnabled !== "true") {
      return { sent: false, error: "SMTP غير مفعّل — قم بتفعيله من صفحة الإعدادات" };
    }
    if (!cfg.smtpHost || !cfg.smtpUser) {
      return { sent: false, error: "بيانات SMTP ناقصة (Host/User)" };
    }

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtpHost,
        port: parseInt(cfg.smtpPort || "587"),
        tls: cfg.smtpUseTls === "true",
        auth: {
          username: cfg.smtpUser,
          password: cfg.smtpPassword || "",
        },
      },
    });

    const roleLabel = ROLE_LABELS[role] || "مستخدم";
    const loginUrl = `${origin}/login`;
    const html = `<div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
  <h2 style="color:#1a2332;text-align:center">🌸 مرحباً ${fullName}</h2>
  <p>تم إنشاء حسابك في نظام <b>رداء</b> لإدارة المبيعات.</p>
  <div style="background:white;padding:20px;border-radius:10px;margin:20px 0;border-right:4px solid #c9a84c">
    <p><b>📧 البريد:</b> <span style="font-family:monospace">${email}</span></p>
    <p><b>🔑 كلمة المرور المؤقتة:</b> <span style="font-family:monospace;background:#fef3c7;padding:4px 8px;border-radius:4px">${password}</span></p>
    <p><b>🎭 الدور:</b> ${roleLabel}</p>
  </div>
  <p style="color:#dc2626">⚠️ <b>مهم:</b> يُطلب منك تغيير كلمة المرور بعد أول تسجيل دخول لأسباب أمنية.</p>
  <p style="text-align:center;margin-top:30px">
    <a href="${loginUrl}" style="background:#1a2332;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;display:inline-block">🔐 تسجيل الدخول الآن</a>
  </p>
  <hr style="margin:30px 0;border:none;border-top:1px solid #eee">
  <p style="color:#999;font-size:12px;text-align:center">نظام رداء لإدارة المبيعات · لا ترد على هذا البريد</p>
</div>`;

    const text = `مرحباً ${fullName}\n\nتم إنشاء حسابك في نظام رداء:\nالبريد: ${email}\nكلمة المرور: ${password}\nالدور: ${roleLabel}\n\nيرجى تغيير كلمة المرور بعد أول دخول.\n${loginUrl}`;

    await client.send({
      from: `${cfg.smtpFromName || "رداء"} <${cfg.smtpFromEmail || cfg.smtpUser}>`,
      to: email,
      subject: "🌸 حسابك في نظام رداء - بيانات الدخول",
      content: text,
      html,
    });
    try { await client.close(); } catch { /* ignore */ }
    return { sent: true, error: "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP error";
    console.error("SMTP send failed:", msg);
    return { sent: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
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

    // Verify caller
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — يجب تسجيل الدخول" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // Parse body
    let body: InviteBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { email, password, role, fullName, sendEmail } = body;
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "البريد وكلمة المرور مطلوبان" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Service role client
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const displayName = (fullName || email.split("@")[0]).trim();
    const roleKey = role || "support";
    const now = new Date().toISOString();

    let userId: string | null = null;
    let wasExisting = false;

    // Try to find existing user first (avoids listUsers pagination bug)
    userId = await findUserIdByEmail(supabaseAdmin, email);

    if (userId) {
      // Update existing user
      wasExisting = true;
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
      const existingMeta = existing?.user?.user_metadata || {};

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existingMeta,
          username: displayName,
          full_name: displayName,
          assigned_role: roleKey,
          must_change_password: true,
          last_password_reset: now,
        },
      });

      if (updateError) {
        console.error("updateUserById failed:", updateError.message);
        return new Response(
          JSON.stringify({ error: "فشل تحديث المستخدم: " + updateError.message }),
          { status: 500, headers: jsonHeaders },
        );
      }
    } else {
      // Create new user
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: displayName,
          full_name: displayName,
          invited_by: caller.email,
          assigned_role: roleKey,
          must_change_password: true,
          created_at: now,
        },
      });

      if (createError) {
        // If race-conditioned "already exists" - try to find & update
        const msg = createError.message.toLowerCase();
        if (msg.includes("already been registered") || msg.includes("email_exists") || msg.includes("duplicate")) {
          userId = await findUserIdByEmail(supabaseAdmin, email);
          if (userId) {
            wasExisting = true;
            const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
              password,
              email_confirm: true,
              user_metadata: {
                username: displayName,
                full_name: displayName,
                assigned_role: roleKey,
                must_change_password: true,
                last_password_reset: now,
              },
            });
            if (updErr) {
              return new Response(
                JSON.stringify({ error: "فشل التحديث: " + updErr.message }),
                { status: 500, headers: jsonHeaders },
              );
            }
          } else {
            return new Response(
              JSON.stringify({ error: "البريد مسجّل مسبقاً لكن تعذّر العثور على الحساب" }),
              { status: 500, headers: jsonHeaders },
            );
          }
        } else {
          console.error("createUser failed:", createError.message);
          return new Response(
            JSON.stringify({ error: "فشل إنشاء المستخدم: " + createError.message }),
            { status: 500, headers: jsonHeaders },
          );
        }
      } else {
        userId = newUserData.user?.id || null;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "لم يتم الحصول على معرّف المستخدم" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // Log credentials as internal notification for admin
    let emailSent = false;
    let emailError = "";
    try {
      const { data: adminProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("email", ADMIN_EMAIL)
        .maybeSingle();

      const adminUserId = adminProfile?.id as string | undefined;

      if (adminUserId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: adminUserId,
          type: "custom",
          recipient_name: displayName,
          recipient_phone: email,
          message: `🔐 بيانات دخول ${wasExisting ? "محدّثة" : "جديدة"}:\nالبريد: ${email}\nكلمة المرور: ${password}\nالدور: ${ROLE_LABELS[roleKey] || roleKey}\nأنشأه: ${caller.email}`,
          status: "sent",
        });
      }

      // Send credentials email if requested
      if (sendEmail && adminUserId) {
        const origin = req.headers.get("origin") || "";
        const result = await sendCredentialsEmail(
          supabaseAdmin,
          adminUserId,
          email,
          password,
          displayName,
          roleKey,
          origin,
        );
        emailSent = result.sent;
        emailError = result.error;
      }
    } catch (notifErr) {
      console.error("Notification/email step error:", notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        wasExisting,
        email,
        adminEmail: ADMIN_EMAIL,
        emailSent,
        emailError,
        message: wasExisting
          ? "تم تحديث الحساب وكلمة المرور بنجاح"
          : "تم إنشاء الحساب بنجاح — جاهز للدخول الفوري",
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
    console.error("invite-user error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
