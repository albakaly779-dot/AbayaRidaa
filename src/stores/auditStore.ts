import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

function getDeviceInfo(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : /Edge/.test(ua) ? "Edge" : "غير معروف";
  const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : /Android/.test(ua) ? "Android" : /iOS|iPhone|iPad/.test(ua) ? "iOS" : "غير معروف";
  return `${browser} · ${os} · ${isMobile ? "جوال" : "سطح مكتب"}`;
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
    const logs = (data || []).map((r: AuditLog) => ({
      id: r.id, action: r.action, entityType: r.entity_type,
      entityId: r.entity_id, details: r.details, createdAt: r.created_at,
      ipAddress: r.ip_address || "", userAgent: r.user_agent || "", deviceInfo: r.device_info || "",
    }));
    set({ logs, loading: false, initialized: true });
  },

  logAction: async (userId, action, entityType, entityId, details) => {
    const deviceInfo = getDeviceInfo();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 200) : "";
    const { data: row } = await supabase.from("audit_logs").insert({
      user_id: userId, action, entity_type: entityType, entity_id: entityId || "", details,
      device_info: deviceInfo, user_agent: userAgent, ip_address: "",
    }).select().single();
    if (row) {
      const newLog: AuditLog = { id: row.id, action, entityType, entityId, details, createdAt: row.created_at, deviceInfo, userAgent };
      set((s) => ({ logs: [newLog, ...s.logs].slice(0, 200) }));
    }
  },
}));
