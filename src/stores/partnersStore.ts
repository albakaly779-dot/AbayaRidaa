import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface Partner {
  id: string;
  partnerKey: "first" | "second" | "worker";
  partnerName: string;
  partnerEmail: string;
  percentage: number;
  isActive: boolean;
  notes: string;
}

interface PartnersState {
  partners: Partner[];
  loading: boolean;
  initialized: boolean;
  initializePartners: (userId: string) => Promise<void>;
  refreshPartners: (userId: string) => Promise<void>;
  upsertPartner: (userId: string, partner: Omit<Partner, "id">) => Promise<void>;
  updatePartner: (id: string, data: Partial<Partner>) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  removePartner: (id: string) => Promise<void>;
  distributeProfit: (totalRevenue: number, totalExpenses: number) => {
    netProfit: number;
    distributions: Array<{ partner: Partner; amount: number }>;
    undistributed: number;
  };
}

const DEFAULT_PARTNERS: Array<Omit<Partner, "id">> = [
  { partnerKey: "first", partnerName: "الطرف الأول", partnerEmail: "", percentage: 0, isActive: true, notes: "" },
  { partnerKey: "second", partnerName: "الطرف الثاني", partnerEmail: "", percentage: 0, isActive: true, notes: "" },
  { partnerKey: "worker", partnerName: "الطرف الثالث (العامل)", partnerEmail: "", percentage: 0, isActive: false, notes: "" },
];

export const usePartnersStore = create<PartnersState>()((set, get) => ({
  partners: [],
  loading: true,
  initialized: false,

  initializePartners: async (userId: string) => {
    if (get().initialized) return;
    await get().refreshPartners(userId);
  },

  refreshPartners: async (userId: string) => {
    const { data } = await supabase.from("partners_config").select("*").eq("user_id", userId).order("partner_key");

    let partners: Partner[] = (data || []).map((r: { id: string; partner_key: string; partner_name: string; partner_email: string; percentage: string; is_active: boolean; notes: string }) => ({
      id: r.id,
      partnerKey: r.partner_key as Partner["partnerKey"],
      partnerName: r.partner_name,
      partnerEmail: r.partner_email,
      percentage: Number(r.percentage) || 0,
      isActive: r.is_active,
      notes: r.notes,
    }));

    // Ensure the 3 default partners exist
    for (const def of DEFAULT_PARTNERS) {
      if (!partners.find((p) => p.partnerKey === def.partnerKey)) {
        const { data: inserted } = await supabase.from("partners_config").insert({
          user_id: userId,
          partner_key: def.partnerKey,
          partner_name: def.partnerName,
          partner_email: def.partnerEmail,
          percentage: def.percentage,
          is_active: def.isActive,
          notes: def.notes,
        }).select().single();
        if (inserted) {
          partners.push({
            id: inserted.id,
            partnerKey: def.partnerKey,
            partnerName: def.partnerName,
            partnerEmail: def.partnerEmail,
            percentage: def.percentage,
            isActive: def.isActive,
            notes: def.notes,
          });
        }
      }
    }

    // Order first, second, worker
    const orderMap: Record<string, number> = { first: 1, second: 2, worker: 3 };
    partners.sort((a, b) => (orderMap[a.partnerKey] || 99) - (orderMap[b.partnerKey] || 99));

    set({ partners, loading: false, initialized: true });
  },

  upsertPartner: async (userId, partner) => {
    const { data, error } = await supabase.from("partners_config").upsert({
      user_id: userId,
      partner_key: partner.partnerKey,
      partner_name: partner.partnerName,
      partner_email: partner.partnerEmail,
      percentage: partner.percentage,
      is_active: partner.isActive,
      notes: partner.notes,
    }, { onConflict: "user_id,partner_key" }).select().single();

    if (error) { toast.error("فشل الحفظ: " + error.message); return; }
    await get().refreshPartners(userId);
  },

  updatePartner: async (id, data) => {
    const payload: Record<string, unknown> = {};
    if (data.partnerName !== undefined) payload.partner_name = data.partnerName;
    if (data.partnerEmail !== undefined) payload.partner_email = data.partnerEmail;
    if (data.percentage !== undefined) payload.percentage = data.percentage;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.notes !== undefined) payload.notes = data.notes;

    const { error } = await supabase.from("partners_config").update(payload).eq("id", id);
    if (error) { toast.error("فشل التحديث: " + error.message); return; }
    set((s) => ({ partners: s.partners.map((p) => p.id === id ? { ...p, ...data } : p) }));
  },

  toggleActive: async (id) => {
    const target = get().partners.find((p) => p.id === id);
    if (!target) return;
    const newActive = !target.isActive;
    await supabase.from("partners_config").update({ is_active: newActive }).eq("id", id);
    set((s) => ({ partners: s.partners.map((p) => p.id === id ? { ...p, isActive: newActive } : p) }));
  },

  removePartner: async (id) => {
    await supabase.from("partners_config").delete().eq("id", id);
    set((s) => ({ partners: s.partners.filter((p) => p.id !== id) }));
  },

  distributeProfit: (totalRevenue, totalExpenses) => {
    const netProfit = totalRevenue - totalExpenses;
    const active = get().partners.filter((p) => p.isActive);
    const totalPercent = active.reduce((s, p) => s + p.percentage, 0);
    const distributions = active.map((partner) => ({
      partner,
      amount: netProfit > 0 ? (netProfit * partner.percentage) / 100 : 0,
    }));
    const distributedTotal = distributions.reduce((s, d) => s + d.amount, 0);
    return {
      netProfit,
      distributions,
      undistributed: netProfit - distributedTotal,
      totalPercent,
    } as {
      netProfit: number;
      distributions: Array<{ partner: Partner; amount: number }>;
      undistributed: number;
      totalPercent: number;
    };
  },
}));
