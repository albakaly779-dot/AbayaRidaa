import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  createdAt: string;
}

interface AuditState {
  logs: AuditLog[];
  loading: boolean;
  initialized: boolean;
  initializeLogs: (userId: string) => Promise<void>;
  logAction: (userId: string, action: string, entityType: string, entityId: string | undefined, details: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>()((set, get) => ({
  logs: [],
  loading: true,
  initialized: false,

  initializeLogs: async (userId: string) => {
    if (get().initialized) return;
    const { data } = await supabase.from("audit_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    const logs = (data || []).map((r: any) => ({
      id: r.id, action: r.action, entityType: r.entity_type,
      entityId: r.entity_id, details: r.details, createdAt: r.created_at,
    }));
    set({ logs, loading: false, initialized: true });
  },

  logAction: async (userId, action, entityType, entityId, details) => {
    const { data: row } = await supabase.from("audit_logs").insert({
      user_id: userId, action, entity_type: entityType, entity_id: entityId || "", details,
    }).select().single();
    if (row) {
      const newLog: AuditLog = { id: row.id, action, entityType, entityId, details, createdAt: row.created_at };
      set((s) => ({ logs: [newLog, ...s.logs].slice(0, 200) }));
    }
  },
}));
