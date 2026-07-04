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
    const { email, password, role, fullName } = body;

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
    } catch (notifErr) {
      console.log("Notification log skipped:", notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        wasExisting,
        email,
        password,
        adminEmail: ADMIN_EMAIL,
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
