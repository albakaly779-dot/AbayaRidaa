import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "albakaly779@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Authentication check — any authenticated user can trigger customer notifications
    // (used by reps when adding customers) but must be logged in.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: caller } } = await supabaseClient.auth.getUser(token);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    let body: {
      customerName?: string;
      customerPhone?: string;
      source?: string;
      repName?: string;
      repEmail?: string;
    };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { customerName, customerPhone, source, repName, repEmail } = body;
    if (!customerName || !repName) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: customerName, repName",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Admin service client for writing notification (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const sourceLabels: Record<string, string> = {
      whatsapp: "واتساب",
      instagram: "إنستقرام",
      facebook: "فيسبوك",
      direct: "مباشر",
      referral: "توصية",
      other: "أخرى",
    };
    const sourceLabel = sourceLabels[source || ""] || source || "غير محدد";

    // Find admin user id to attribute the notification
    const { data: adminProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();

    if (adminProfile?.id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: adminProfile.id,
        type: "custom",
        recipient_name: "المدير",
        recipient_phone: ADMIN_EMAIL,
        message: `🆕 عميل جديد: ${customerName} (${
          customerPhone || "بدون هاتف"
        }) | المصدر: ${sourceLabel} | المندوب: ${repName}${
          repEmail ? ` (${repEmail})` : ""
        }`,
        status: "sent",
      });
    }

    console.log(
      `[notify-admin] Customer added: ${customerName} by ${repName} (caller: ${caller.email})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification recorded for admin",
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Error in notify-admin:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
