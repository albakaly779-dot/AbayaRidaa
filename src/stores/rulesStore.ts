import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface DiscountRule {
  id: string;
  name: string;
  type: "governorate_discount" | "amount_discount" | "product_discount";
  conditionField: string;
  conditionValue: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface RulesState {
  rules: DiscountRule[];
  initialized: boolean;
  loading: boolean;
  initializeRules: (userId: string) => Promise<void>;
  addRule: (rule: Omit<DiscountRule, "id" | "createdAt">, userId: string) => Promise<void>;
  updateRule: (id: string, data: Partial<DiscountRule>) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  killAllRules: () => Promise<void>;
  calculateDiscount: (governorate: string, orderTotal: number) => { totalDiscount: number; appliedRules: string[] };
}

export const useRulesStore = create<RulesState>()((set, get) => ({
  rules: [],
  initialized: false,
  loading: true,

  initializeRules: async (userId: string) => {
    if (get().initialized) return;
    const { data } = await supabase.from("discount_rules").select("*").eq("user_id", userId).order("priority", { ascending: true });
    const rules = (data || []).map((r: any) => ({
      id: r.id, name: r.name, type: r.type, conditionField: r.condition_field,
      conditionValue: r.condition_value, discountType: r.discount_type,
      discountValue: Number(r.discount_value), isActive: r.is_active,
      priority: r.priority, createdAt: r.created_at,
    }));
    set({ rules, initialized: true, loading: false });
  },

  addRule: async (rule, userId) => {
    const { data: row, error } = await supabase.from("discount_rules").insert({
      user_id: userId, name: rule.name, type: rule.type,
      condition_field: rule.conditionField, condition_value: rule.conditionValue,
      discount_type: rule.discountType, discount_value: rule.discountValue,
      is_active: rule.isActive, priority: rule.priority,
    }).select().single();
    if (error) { toast.error("فشل إنشاء القاعدة"); return; }
    const newRule: DiscountRule = { ...rule, id: row.id, createdAt: row.created_at };
    set((s) => ({ rules: [...s.rules, newRule] }));
    toast.success("تم إنشاء القاعدة");
  },

  updateRule: async (id, data) => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.conditionValue !== undefined) payload.condition_value = data.conditionValue;
    if (data.discountType !== undefined) payload.discount_type = data.discountType;
    if (data.discountValue !== undefined) payload.discount_value = data.discountValue;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    if (data.priority !== undefined) payload.priority = data.priority;
    await supabase.from("discount_rules").update(payload).eq("id", id);
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },

  toggleRule: async (id) => {
    const rule = get().rules.find((r) => r.id === id);
    if (!rule) return;
    const newActive = !rule.isActive;
    await supabase.from("discount_rules").update({ is_active: newActive }).eq("id", id);
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, isActive: newActive } : r)) }));
    toast.success(newActive ? "تم تفعيل القاعدة" : "تم تعطيل القاعدة");
  },

  deleteRule: async (id) => {
    await supabase.from("discount_rules").delete().eq("id", id);
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
    toast.success("تم حذف القاعدة");
  },

  killAllRules: async () => {
    const activeRules = get().rules.filter((r) => r.isActive);
    for (const rule of activeRules) {
      await supabase.from("discount_rules").update({ is_active: false }).eq("id", rule.id);
    }
    set((s) => ({ rules: s.rules.map((r) => ({ ...r, isActive: false })) }));
    toast.success("تم تعطيل جميع القواعد (إيقاف طارئ)");
  },

  calculateDiscount: (governorate, orderTotal) => {
    const activeRules = get().rules.filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);
    let totalDiscount = 0;
    const appliedRules: string[] = [];

    for (const rule of activeRules) {
      if (rule.type === "governorate_discount") {
        if (governorate && rule.conditionValue.split(",").map((v) => v.trim()).includes(governorate)) {
          const discount = rule.discountType === "fixed" ? rule.discountValue : (orderTotal * rule.discountValue) / 100;
          totalDiscount += discount;
          appliedRules.push(`${rule.name}: -${rule.discountType === "fixed" ? discount + " ر.ي" : rule.discountValue + "%"}`);
        }
      } else if (rule.type === "amount_discount") {
        const threshold = parseFloat(rule.conditionValue);
        if (orderTotal >= threshold) {
          const discount = rule.discountType === "fixed" ? rule.discountValue : (orderTotal * rule.discountValue) / 100;
          totalDiscount += discount;
          appliedRules.push(`${rule.name}: -${rule.discountType === "fixed" ? discount + " ر.ي" : rule.discountValue + "%"}`);
        }
      }
    }

    return { totalDiscount, appliedRules };
  },
}));
