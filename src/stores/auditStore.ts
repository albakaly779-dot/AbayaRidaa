import { supabase } from "@/lib/supabase";

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  createdAt: string;
  result?: "SUCCESS" | "DENIED" | "FAILED" | "ROLLED_BACK";
  requestId?: string;
  entryHash?: string;
  previousHash?: string;
  keyId?: string;
  verified?: boolean;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

interface AuditState {
  logs: AuditLog[];
  loading: boolean;
  initialized: boolean;
  initializeLogs: (userId: string) => Promise<void>;
  logAction: (userId: string, action: string, entityType: string, entityId: string | undefined, details: string) => Promise<void>;
}

function mapSecureRow(row: Record<string, unknown>): AuditLog {
  const after = row.after_data as Record<string, unknown> | null;
  const changes = row.changes_data as Record<string, unknown> | null;
  const details = typeof after?.details === "string"
    ? after.details
    : typeof changes?.details === "string"
      ? changes.details
      : String(row.reason || row.action || "");
  return {
    id: String(row.event_id || row.id),
    action: String(row.action || "unknown"),
    entityType: String(row.entity_type || "system"),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    details,
    createdAt: String(row.occurred_at || row.created_at),
    result: (row.result as AuditLog["result"]) || "SUCCESS",
    requestId: row.request_id ? String(row.request_id) : undefined,
    entryHash: row.entry_hash ? String(row.entry_hash) : undefined,
    previousHash: row.previous_hash ? String(row.previous_hash) : undefined,
    keyId: row.key_id ? String(row.key_id) : undefined,
    verified: Boolean(row.entry_hash && row.previous_hash),
  };
}

function mapLegacyRow(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    action: String(row.action || "unknown"),
    entityType: String(row.entity_type || "system"),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    details: String(row.details || ""),
    createdAt: String(row.created_at),
    ipAddress: row.ip_address ? String(row.ip_address) : "",
    userAgent: row.user_agent ? String(row.user_agent) : "",
    deviceInfo: row.device_info ? String(row.device_info) : "",
  };
}

export const useAuditStore = create<AuditState>()((set, get) => ({
  logs: [],
  loading: true,
  initialized: false,

  initializeLogs: async () => {
    if (get().initialized) return;
    set({ loading: true });
    const secure = await supabase
      .from("audit_events")
      .select("*")
      .order("sequence", { ascending: false })
      .limit(300);

    if (!secure.error) {
      set({ logs: (secure.data || []).map((row) => mapSecureRow(row as Record<string, unknown>)), loading: false, initialized: true });
      return;
    }

    // Backward-compatible read-only fallback for older installations before the migration.
    const legacy = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    set({ logs: (legacy.data || []).map((row) => mapLegacyRow(row as Record<string, unknown>)), loading: false, initialized: true });
  },

  logAction: async (_userId, action, entityType, entityId, details) => {
    const requestId = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("audit-event", {
      body: {
        action,
        event_type: "USER_ACTION",
        entity_type: entityType,
        entity_id: entityId || null,
        request_id: requestId,
        result: "SUCCESS",
        after: { details },
      },
    });

    if (error || !data?.success) {
      console.warn("Secure audit event was not appended", error?.message || data?.error);
      return;
    }

    const row = data.event as Record<string, unknown> | undefined;
    if (row) {
      set((state) => ({ logs: [mapSecureRow(row), ...state.logs].slice(0, 300) }));
    }
  },
}));
