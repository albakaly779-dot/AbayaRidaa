import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "albakaly779@gmail.com";

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
        JSON.stringify({ error: "Unauthorized — يجب تسجيل الدخول" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { email, password, role, fullName, sendEmail } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "البريد وكلمة المرور مطلوبان" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client — bypasses disabled signups
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user exists
    const { data: existingList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return new Response(
        JSON.stringify({ error: "فشل التحقق من المستخدمين: " + listError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = existingList?.users?.find((u: { email?: string }) => u.email === email);
    let userId = existingUser?.id;
    let wasExisting = false;

    if (!existingUser) {
      // Create new user with admin API — bypasses disabled signups
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: fullName || email.split("@")[0],
          invited_by: caller.email,
          assigned_role: role || "support",
          must_change_password: true,
          created_at: new Date().toISOString(),
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: "فشل إنشاء المستخدم: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUserData.user?.id;
    } else {
      // Update existing user
      wasExisting = true;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          username: fullName || existingUser.user_metadata?.username || email.split("@")[0],
          assigned_role: role || existingUser.user_metadata?.assigned_role || "support",
          must_change_password: true,
          last_password_reset: new Date().toISOString(),
        },
      });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "فشل تحديث المستخدم: " + updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Log notification for admin to see in their notifications list + trigger email delivery attempt
    try {
      // Find admin user_id for notification
      const { data: profileData } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("email", ADMIN_EMAIL)
        .maybeSingle();

      if (profileData?.id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: profileData.id,
          type: "custom",
          recipient_name: fullName || email.split("@")[0],
          recipient_phone: email,
          message: `🔐 بيانات دخول مستخدم ${wasExisting ? "محدّث" : "جديد"}:\nالبريد: ${email}\nكلمة المرور: ${password}\nالدور: ${role || "support"}\nأنشأه: ${caller.email}`,
          status: "sent",
        });
      }

      // Attempt to send password recovery email via Supabase built-in SMTP
      // This gives the new user a proper way to set their own password via email
      try {
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${req.headers.get("origin") || ""}/login` },
        });
      } catch (linkErr) {
        console.log("Recovery link generation skipped:", linkErr);
      }

      // If sendEmail flag is set, attempt to send credentials via custom SMTP
      let emailSent = false;
      let emailError = "";
      if (sendEmail && profileData?.id) {
        try {
          const { data: smtpRows } = await supabaseAdmin
            .from("app_settings")
            .select("key, value")
            .eq("user_id", profileData.id)
            .in("key", ["smtpEnabled", "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "smtpFromEmail", "smtpFromName", "smtpUseTls"]);

          const cfg: Record<string, string> = {};
          (smtpRows || []).forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value; });

          if (cfg.smtpEnabled === "true" && cfg.smtpHost && cfg.smtpUser) {
            const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
            const smtpClient = new SMTPClient({
              connection: {
                hostname: cfg.smtpHost,
                port: parseInt(cfg.smtpPort || "587"),
                tls: cfg.smtpUseTls === "true",
                auth: { username: cfg.smtpUser, password: cfg.smtpPassword },
              },
            });

            const roleLabel = role === "super_admin" ? "مشرف عام" : role === "operations_manager" ? "مدير عمليات" : role === "rep" ? "مندوب مبيعات" : "دعم فني";
            const html = `<div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
              <h2 style="color:#1a2332;text-align:center">🌸 مرحباً ${fullName || email.split("@")[0]}</h2>
              <p>تم إنشاء حسابك في نظام <b>رداء</b> لإدارة المبيعات.</p>
              <div style="background:white;padding:20px;border-radius:10px;margin:20px 0;border-right:4px solid #c9a84c">
                <p><b>📧 البريد:</b> <span style="font-family:monospace">${email}</span></p>
                <p><b>🔑 كلمة المرور:</b> <span style="font-family:monospace;background:#fef3c7;padding:4px 8px;border-radius:4px">${password}</span></p>
                <p><b>🎭 الدور:</b> ${roleLabel}</p>
              </div>
              <p style="color:#dc2626">⚠️ <b>مهم:</b> يُطلب منك تغيير كلمة المرور بعد أول تسجيل دخول لأسباب أمنية.</p>
              <p style="text-align:center;margin-top:30px"><a href="${req.headers.get("origin") || ""}/login" style="background:#1a2332;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;display:inline-block">🔐 تسجيل الدخول الآن</a></p>
              <hr style="margin:30px 0;border:none;border-top:1px solid #eee">
              <p style="color:#999;font-size:12px;text-align:center">نظام رداء لإدارة المبيعات · لا ترد على هذا البريد</p>
            </div>`;

            await smtpClient.send({
              from: `${cfg.smtpFromName || "رداء"} <${cfg.smtpFromEmail || cfg.smtpUser}>`,
              to: email,
              subject: `🌸 حسابك في نظام رداء - بيانات الدخول`,
              content: `مرحباً ${fullName || email},\n\nتم إنشاء حسابك في نظام رداء.\nالبريد: ${email}\nكلمة المرور: ${password}\nالدور: ${roleLabel}\n\nيرجى تغيير كلمة المرور بعد الدخول.`,
              html,
            });
            await smtpClient.close();
            emailSent = true;
          } else {
            emailError = "SMTP غير مفعّل — قم بضبطه من صفحة الإعدادات";
          }
        } catch (smtpErr) {
          emailError = smtpErr instanceof Error ? smtpErr.message : "خطأ SMTP";
          console.error("SMTP send failed:", emailError);
        }
      }

      (globalThis as { __emailResult?: { sent: boolean; error: string } }).__emailResult = { sent: emailSent, error: emailError };
    } catch (notifErr) {
      console.log("Notification log skipped:", notifErr);
    }

    const emailResult = (globalThis as { __emailResult?: { sent: boolean; error: string } }).__emailResult || { sent: false, error: "" };

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        wasExisting,
        email,
        password,
        adminEmail: ADMIN_EMAIL,
        emailSent: emailResult.sent,
        emailError: emailResult.error,
        message: wasExisting
          ? "تم تحديث الحساب وكلمة المرور بنجاح"
          : "تم إنشاء الحساب بنجاح — جاهز للدخول الفوري",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
    console.error("invite-user error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
