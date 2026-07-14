import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface FixedExpense {
  key: string;
  label: string;
  amount: number;
}

export type InvoiceTemplate = "modern" | "classic" | "minimal";
export type InvoicePageSize = "A4" | "A5" | "thermal80" | "thermal58";
export type SmtpProvider = "custom" | "gmail" | "zoho" | "sendgrid" | "mailgun" | "outlook";

export interface AppSettings {
  // Business info
  sarToYer: number;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  logoUrl: string;

  // Invoice customization
  invoiceTemplate: InvoiceTemplate;
  invoicePrimaryColor: string;
  invoiceHeaderText: string;
  invoiceFooterText: string;
  invoiceTaxNumber: string;
  invoiceTerms: string;
  invoiceShowBarcode: boolean;
  invoiceLogoUrl: string;
  invoicePageSize: InvoicePageSize;
  invoiceShowSignature: boolean;
  invoiceCopyLabel: string;

  // SMTP settings for email delivery
  smtpEnabled: boolean;
  smtpProvider: SmtpProvider;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpUseTls: boolean;

  // Feature toggles
  featureWhatsapp: boolean;
  featureSmsAlerts: boolean;
  featureStockAlerts: boolean;
  featureCommissions: boolean;
  featureReturns: boolean;
  featureExpenses: boolean;
  featureExport: boolean;

  fixedExpenses: FixedExpense[];
}

export const SMTP_PRESETS: Record<SmtpProvider, { host: string; port: number; useTls: boolean; label: string; note: string }> = {
  custom: { host: "", port: 587, useTls: true, label: "مخصص", note: "أدخل بيانات SMTP يدوياً" },
  gmail: { host: "smtp.gmail.com", port: 587, useTls: true, label: "Gmail", note: "استخدم App Password (كلمة مرور التطبيق) من إعدادات Google" },
  outlook: { host: "smtp-mail.outlook.com", port: 587, useTls: true, label: "Outlook", note: "استخدم كلمة مرور حسابك" },
  zoho: { host: "smtp.zoho.com", port: 465, useTls: true, label: "Zoho", note: "استخدم App Password من إعدادات الأمان" },
  sendgrid: { host: "smtp.sendgrid.net", port: 587, useTls: true, label: "SendGrid", note: "اسم المستخدم = 'apikey' وكلمة المرور = مفتاح API" },
  mailgun: { host: "smtp.mailgun.org", port: 587, useTls: true, label: "Mailgun", note: "استخدم بيانات SMTP من لوحة Mailgun" },
};

const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [
  { key: "salaries", label: "رواتب الموظفين", amount: 250000 },
  { key: "rent", label: "إيجار المحل", amount: 20000 },
  { key: "electricity", label: "الكهرباء", amount: 10000 },
  { key: "advertising", label: "ميزانية الإعلانات", amount: 40000 },
];

const DEFAULT_SETTINGS: AppSettings = {
  sarToYer: 140,
  businessName: "رداء",
  businessPhone: "967779673273",
  businessAddress: "صنعاء، اليمن",
  logoUrl: "",
  invoiceTemplate: "modern",
  invoicePrimaryColor: "#1B2A4A",
  invoiceHeaderText: "نظام إدارة المبيعات",
  invoiceFooterText: "شكراً لتعاملكم مع رداء",
  invoiceTaxNumber: "",
  invoiceTerms: "",
  invoiceShowBarcode: true,
  invoiceLogoUrl: "",
  invoicePageSize: "A4",
  invoiceShowSignature: true,
  invoiceCopyLabel: "نسخة العميل",
  smtpEnabled: false,
  smtpProvider: "custom",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpFromEmail: "",
  smtpFromName: "رداء",
  smtpUseTls: true,
  featureWhatsapp: true,
  featureSmsAlerts: true,
  featureStockAlerts: true,
  featureCommissions: true,
  featureReturns: true,
  featureExpenses: true,
  featureExport: true,
  fixedExpenses: DEFAULT_FIXED_EXPENSES,
};

interface SettingsState {
  settings: AppSettings;
  initialized: boolean;
  loading: boolean;
  initializeSettings: (userId: string) => Promise<void>;
  refreshSettings: (userId: string) => Promise<void>;
  updateSetting: (userId: string, key: string, value: string) => Promise<void>;
  updateSettings: (userId: string, updates: Partial<AppSettings>) => Promise<void>;
  getTotalFixedExpenses: () => number;
}

function serializeValue(val: unknown): string {
  if (Array.isArray(val) || (typeof val === "object" && val !== null)) {
    return JSON.stringify(val);
  }
  return String(val);
}

function applyValue(merged: AppSettings, key: string, val: string): void {
  const k = key as keyof AppSettings;
  if (!(k in merged)) return;
  const defaultVal = merged[k];
  if (Array.isArray(defaultVal)) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) (merged as Record<string, unknown>)[k] = parsed as AppSettings[keyof AppSettings];
    } catch {
      /* keep default */
    }
  } else if (typeof defaultVal === "number") {
    (merged as Record<string, unknown>)[k] = parseFloat(val) || defaultVal as AppSettings[keyof AppSettings];
  } else if (typeof defaultVal === "boolean") {
    (merged as Record<string, unknown>)[k] = val === "true" as AppSettings[keyof AppSettings];
  } else {
    (merged as Record<string, unknown>)[k] = val as AppSettings[keyof AppSettings];
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  initialized: false,
  loading: true,

  initializeSettings: async (userId: string) => {
    if (get().initialized) return;
    const { data } = await supabase.from("app_settings").select("key, value").eq("user_id", userId);
    const merged: AppSettings = { ...DEFAULT_SETTINGS };
    (data || []).forEach((row: { key: string; value: string }) => {
      applyValue(merged, row.key, row.value);
    });
    set({ settings: merged, initialized: true, loading: false });
  },

  refreshSettings: async (userId: string) => {
    const { data } = await supabase.from("app_settings").select("key, value").eq("user_id", userId);
    const merged: AppSettings = { ...DEFAULT_SETTINGS };
    (data || []).forEach((row: { key: string; value: string }) => {
      applyValue(merged, row.key, row.value);
    });
    set({ settings: merged, initialized: true, loading: false });
  },

  updateSetting: async (userId, key, value) => {
    const { error } = await supabase.from("app_settings").upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (error) throw error;
    const updated = { ...get().settings };
    applyValue(updated, key, value);
    set({ settings: updated });
  },

  updateSettings: async (userId, updates) => {
    const promises = Object.entries(updates).map(([key, val]) => {
      const strVal = serializeValue(val);
      return supabase.from("app_settings").upsert(
        { user_id: userId, key, value: strVal, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
    });
    const results = await Promise.all(promises);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error("فشل حفظ بعض الإعدادات: " + failed.error.message);
      throw failed.error;
    }
    set((state) => ({ settings: { ...state.settings, ...updates } }));
    toast.success("تم حفظ الإعدادات بنجاح");
  },

  getTotalFixedExpenses: () => {
    return get().settings.fixedExpenses.reduce((s, e) => s + e.amount, 0);
  },
}));
