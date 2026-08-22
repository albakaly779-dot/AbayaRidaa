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

// Roles that admins can create through the current UI
// (rep/support/partner disabled per business requirement; kept in system for future)
const ALLOWED_ROLES_FOR_CREATION = new Set([
  "super_admin",
  "operations_manager",
  "branch_manager",
  "accountant",
  "marketer",
]);

// Additional roles allowed only via direct API (for backwards compat with existing rows)
const ALL_KNOWN_ROLES = new Set([
  ...ALLOWED_ROLES_FOR_CREATION,
  "support",
  "rep",
  "partner",
]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(pw: string): boolean {
  return typeof pw === "string" && pw.length >= 8;
}

async function findUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  // Use Auth Admin pagination as the source of truth; user_profiles intentionally has no email column.
  try {
    let page = 1;
    while (page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (error) break;
      const found = data?.users?.find(
        (u: { email?: string }) =>
          (u.email || "").toLowerCase() === email.toLowerCase(),
      );
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
        "smtpEnabled",
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPassword",
        "smtpFromEmail",
        "smtpFromName",
        "smtpUseTls",
      ]);

    const cfg: SmtpCfg = {};
    (rows || []).forEach((r: { key: string; value: string }) => {
      (cfg as Record<string, string>)[r.key] = r.value;
    });

    if (cfg.smtpEnabled !== "true") {
      return {
        sent: false,
        error: "SMTP غير مفعّل — قم بتفعيله من صفحة الإعدادات",
      };
    }
    if (!cfg.smtpHost || !cfg.smtpUser) {
      return { sent: false, error: "بيانات SMTP ناقصة (Host/User)" };
    }

    const { SMTPClient } = await import(
      "https://deno.land/x/denomailer@1.6.0/mod.ts"
    );
    const smtpPort = parseInt(cfg.smtpPort || "587");
    // Direct TLS only for SMTPS ports (465/8465). Port 587 relies on STARTTLS negotiated
    // after EHLO — otherwise the plaintext 220 greeting corrupts the TLS handshake.
    const useDirectTls = smtpPort === 465 || smtpPort === 8465;
    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtpHost,
        port: smtpPort,
        tls: useDirectTls,
        auth: {
          username: cfg.smtpUser,
          password: cfg.smtpPassword || "",
        },
      },
    });

    const roleLabel = ROLE_LABELS[role] || "مستخدم";
    const loginUrl = `${origin}/login`;
    const html =
      `<div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f8f6f0;border-radius:12px">
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

    const text =
      `مرحباً ${fullName}\n\nتم إنشاء حسابك في نظام رداء:\nالبريد: ${email}\nكلمة المرور: ${password}\nالدور: ${roleLabel}\n\nيرجى تغيير كلمة المرور بعد أول دخول.\n${loginUrl}`;

    await client.send({
      from: `${cfg.smtpFromName || "رداء"} <${
        cfg.smtpFromEmail || cfg.smtpUser
      }>`,
      to: email,
      subject: "🌸 حسابك في نظام رداء - بيانات الدخول",
      content: text,
      html,
    });
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    return { sent: true, error: "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP error";
    console.error("SMTP send failed:", msg);
    return { sent: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // ------------------------------------------------------------------
    // 1. AUTHENTICATION — must have a valid session
    // ------------------------------------------------------------------
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
        JSON.stringify({ error: "Unauthorized — يجب تسجيل الدخول" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // ------------------------------------------------------------------
    // 2. AUTHORIZATION — only admin can create users (server-side check)
    // ------------------------------------------------------------------
    if ((caller.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      console.warn(
        `[invite-user] Unauthorized attempt by ${caller.email} (id=${caller.id})`,
      );
      return new Response(
        JSON.stringify({
          error: "غير مصرح — هذه العملية للمشرف العام فقط",
        }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // ------------------------------------------------------------------
    // 3. INPUT VALIDATION
    // ------------------------------------------------------------------
    let body: InviteBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const rawEmail = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const role = (body.role || "support").trim();
    const fullName = (body.fullName || "").trim();
    // Credentials are never sent by this endpoint. The manager shares them through a protected channel.
    const sendEmail = false;

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return new Response(
        JSON.stringify({ error: "البريد الإلكتروني غير صالح" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!isStrongEnoughPassword(password)) {
      return new Response(
        JSON.stringify({
          error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!ALL_KNOWN_ROLES.has(role)) {
      return new Response(
        JSON.stringify({ error: `الدور "${role}" غير معروف` }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!ALLOWED_ROLES_FOR_CREATION.has(role)) {
      return new Response(
        JSON.stringify({
          error:
            "هذا الدور غير متاح للإنشاء حالياً. الأدوار المتاحة: مشرف عام، مدير عمليات، مدير فرع، محاسب، مسوق",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Prevent creating another admin with the same reserved email
    if (rawEmail === ADMIN_EMAIL.toLowerCase() && rawEmail !== (caller.email || "").toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "لا يمكن إنشاء حساب بالبريد المحجوز للمشرف" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const displayName = fullName || rawEmail.split("@")[0];
    const now = new Date().toISOString();

    // Service role client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // ------------------------------------------------------------------
    // 4. USER PROVISIONING (create or update)
    //
    // Keep user_metadata minimal — do NOT use fields that clash with
    // Supabase internal columns (created_at, updated_at, aud, role, sub).
    // Those clashes previously caused the mysterious "ipNotInner" error.
    // ------------------------------------------------------------------
    const safeMetadata = {
      username: displayName,
      full_name: displayName,
      assigned_role: role,
      must_change_password: true,
      last_password_reset: now,
    };

    let userId: string | null = null;
    let wasExisting = false;
    let metadataWarning: string | null = null;

    const applySafeMetadata = async (targetUserId: string, existingMeta: Record<string, unknown> = {}) => {
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { user_metadata: { ...existingMeta, ...safeMetadata } },
      );
      if (metadataError) {
        metadataWarning = metadataError.message;
        console.error("Metadata update skipped:", metadataError.message);
      }
    };

    const updateCredentials = async (targetUserId: string) => {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password, email_confirm: true },
      );
      if (updateError) {
        console.error("updateUserById failed:", updateError.message);
        return updateError;
      }
      return null;
    };

    userId = await findUserIdByEmail(supabaseAdmin, rawEmail);

    if (userId) {
      wasExisting = true;
      const updateError = await updateCredentials(userId);
      if (updateError) {
        return new Response(
          JSON.stringify({
            error: "تعذر تحديث الحساب. يرجى المحاولة مرة أخرى.",
            technical: updateError.message,
          }),
          { status: 500, headers: jsonHeaders },
        );
      }
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
      await applySafeMetadata(userId, existing?.user?.user_metadata || {});
    } else {
      // Keep createUser minimal. Some Auth/trigger combinations reject metadata
      // during the insert and return the opaque `ipNotInner` error. Metadata is
      // applied in a separate, non-blocking update after the user exists.
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: rawEmail,
        password,
        email_confirm: true,
      });

      if (createError) {
        const msg = createError.message.toLowerCase();
        if (
          msg.includes("already been registered") ||
          msg.includes("email_exists") || msg.includes("duplicate")
        ) {
          userId = await findUserIdByEmail(supabaseAdmin, rawEmail);
          if (userId) {
            wasExisting = true;
            const updateError = await updateCredentials(userId);
            if (updateError) {
              return new Response(
                JSON.stringify({
                  error: "تعذر تحديث الحساب. يرجى المحاولة مرة أخرى.",
                  technical: updateError.message,
                }),
                { status: 500, headers: jsonHeaders },
              );
            }
            const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
            await applySafeMetadata(userId, existing?.user?.user_metadata || {});
          } else {
            return new Response(
              JSON.stringify({
                error: "البريد مسجّل مسبقاً لكن تعذّر العثور على الحساب",
              }),
              { status: 500, headers: jsonHeaders },
            );
          }
        } else {
          console.error("createUser failed:", createError.message);
          return new Response(
            JSON.stringify({
              error: "تعذر إنشاء الحساب. تحقق من صحة البيانات.",
              technical: createError.message,
            }),
            { status: 500, headers: jsonHeaders },
          );
        }
      } else {
        userId = newUserData.user?.id || null;
        if (userId) await applySafeMetadata(userId);
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "لم يتم الحصول على معرّف المستخدم" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // ------------------------------------------------------------------
    // 5. ROLE ASSIGNMENT (atomic with user creation — recovery on fail)
    // ------------------------------------------------------------------
    let roleAssignmentError: string | null = null;
    try {
      // Build permissions list based on role (kept in sync with UI)
      const rolePermissions: Record<string, string[]> = {
        super_admin: [
          "dashboard",
          "orders",
          "customers",
          "products",
          "debts",
          "suppliers",
          "returns",
          "expenses",
          "reps",
          "reports",
          "export",
          "settings",
          "audit",
          "rules",
          "roles",
          "import",
          "notifications",
          "delete",
          "partners",
          "approvals",
          "sessions",
          "backups",
        ],
        operations_manager: [
          "dashboard",
          "orders",
          "customers",
          "products",
          "debts",
          "suppliers",
          "returns",
          "expenses",
          "reps",
          "reports",
          "export",
          "notifications",
        ],
        accountant: [
          "dashboard",
          "debts",
          "expenses",
          "receipts",
          "reports",
          "export",
          "suppliers",
          "partners",
        ],
        branch_manager: [
          "dashboard",
          "orders",
          "customers",
          "products",
          "debts",
          "reports",
          "reps",
          "notifications",
        ],
        marketer: [
          "dashboard",
          "customers",
          "notifications",
          "rules",
          "reports",
        ],
        rep: ["add_customer", "view_own_customers", "add_orders", "rep_dashboard"],
        support: ["dashboard", "orders", "customers", "products", "debts", "reports"],
        partner: ["partner_dashboard"],
      };

      const { error: rlErr } = await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: userId,
          assigned_user_email: rawEmail,
          role,
          permissions: JSON.stringify(rolePermissions[role] || []),
          is_active: true,
          created_by: caller.id,
        },
        { onConflict: "user_id,assigned_user_email" },
      );
      if (rlErr) {
        roleAssignmentError = rlErr.message;
        console.error("Role assignment failed:", rlErr.message);
      } else {
        const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert({
          id: userId,
          full_name: displayName,
          username: displayName,
          assigned_role: role,
          must_change_password: true,
          is_active: true,
          last_password_reset: now,
        }, { onConflict: "id" });
        if (profileError) {
          roleAssignmentError = profileError.message;
          console.error("Profile synchronization failed:", profileError.message);
        }
      }
    } catch (roleErr) {
      roleAssignmentError = roleErr instanceof Error
        ? roleErr.message
        : "role assignment error";
      console.error("Role assignment exception:", roleAssignmentError);
    }

    // If role assignment failed and this was a NEW user, delete them to keep DB consistent
    if (roleAssignmentError && !wasExisting) {
      console.warn(
        `[invite-user] Rolling back user ${userId} because role assignment failed`,
      );
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.error("Rollback delete failed:", delErr);
      }
      return new Response(
        JSON.stringify({
          error: "تم إنشاء الحساب لكن فشل تعيين الدور — تم التراجع",
          technical: roleAssignmentError,
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // ------------------------------------------------------------------
    // 6. NOTIFICATION (WITHOUT plaintext password)
    // ------------------------------------------------------------------
    const emailSent = false;
    let emailError = "";
    try {
      const { data: adminUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const adminUserId = adminUsers?.users?.find(
        (u: { id: string; email?: string }) => (u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      )?.id;

      if (adminUserId) {
        // Store notification WITHOUT password — only metadata
        await supabaseAdmin.from("notifications").insert({
          user_id: adminUserId,
          type: "custom",
          recipient_name: displayName,
          recipient_phone: rawEmail,
          message: `🔐 حساب ${
            wasExisting ? "محدّث" : "جديد"
          }:\nالبريد: ${rawEmail}\nالدور: ${
            ROLE_LABELS[role] || role
          }\nأنشأه: ${caller.email}\n(كلمة المرور المؤقتة أُنشئت — تحقق من الواجهة أو أرسلها للمستخدم)`,
          status: "sent",
        });
      }

      // Passwords are intentionally never sent by this function.
      if (sendEmail && adminUserId) {
        const origin = req.headers.get("origin") || "";
        emailError = "إرسال كلمات المرور معطل لأسباب أمنية";
      }
    } catch (notifErr) {
      console.error("Notification/email step error:", notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        wasExisting,
        email: rawEmail,
        adminEmail: ADMIN_EMAIL,
        emailSent,
        emailError,
        roleWarning: roleAssignmentError,
        metadataWarning,
        message: wasExisting
          ? "تم تحديث الحساب وكلمة المرور بنجاح"
          : "تم إنشاء الحساب بنجاح — جاهز للدخول الفوري",
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "خطأ غير معروف";
    console.error("invite-user error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
        technical: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
