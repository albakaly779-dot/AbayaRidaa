import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_EMAIL = "albakaly779@gmail.com";
const ALLOWED_RESULTS = new Set(["SUCCESS", "DENIED", "FAILED", "ROLLED_BACK"]);
const SENSITIVE = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|smtp)/i;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function redact(value: Json, key?: string): Json {
  if (key && SENSITIVE.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

function canonicalJson(value: Record<string, Json>): string {
  const sort = (input: Json): Json => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sort(v)]));
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function hmacHex(secret: Uint8Array, input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const hmacKeyB64 = Deno.env.get("AUDIT_HMAC_KEY_B64") ?? "";
  const keyId = Deno.env.get("AUDIT_HMAC_KEY_ID") ?? "v1";

  if (!token || !supabaseUrl || !anonKey || !serviceKey || !hmacKeyB64) return response({ error: "Audit service is not configured" }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !caller) return response({ error: "Unauthorized" }, 401);

  // All authenticated users may create an audit event for their own request,
  // while the database remains INSERT-only and the HMAC key stays server-side.
  const adminClient = createClient(supabaseUrl, serviceKey);
  let body: Record<string, Json>;
  try { body = await req.json(); } catch { return response({ error: "Invalid JSON" }, 400); }

  const action = String(body.action || "").trim();
  const eventType = String(body.event_type || "").trim();
  const entityType = String(body.entity_type || "").trim();
  const result = String(body.result || "SUCCESS").trim();
  if (!action || !eventType || !entityType || !ALLOWED_RESULTS.has(result)) return response({ error: "Invalid audit event" }, 400);

  const tenantKey = String(body.tenant_key || "default");
  const { data: head, error: headError } = await adminClient
    .from("audit_events")
    .select("entry_hash")
    .eq("tenant_key", tenantKey)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (headError) return response({ error: "Unable to read audit chain head" }, 500);

  const event: Record<string, Json> = {
    actor_user_id: caller.id,
    request_id: body.request_id ?? null,
    correlation_id: body.correlation_id ?? null,
    action,
    event_type: eventType,
    entity_type: entityType,
    entity_id: body.entity_id ?? null,
    source_type: body.source_type ?? null,
    source_id: body.source_id ?? null,
    result,
    reason: body.reason ?? null,
    before: redact(body.before ?? null),
    after: redact(body.after ?? null),
    changes: redact(body.changes ?? null),
    occurred_at: body.occurred_at ?? new Date().toISOString(),
    previous_hash: head?.entry_hash ?? "GENESIS",
  };
  const key = base64ToBytes(hmacKeyB64);
  const entryHash = await hmacHex(key, canonicalJson(event));
  const { data, error } = await adminClient.rpc("append_audit_event", {
    p_tenant_key: tenantKey,
    p_event: event,
    p_entry_hash: entryHash,
    p_key_id: keyId,
  });
  if (error) {
    console.error("append_audit_event failed", error.message);
    return response({ error: "Unable to append audit event" }, 500);
  }

  return response({ success: true, event: data, caller: caller.email === ADMIN_EMAIL ? "admin" : "user" });
});
