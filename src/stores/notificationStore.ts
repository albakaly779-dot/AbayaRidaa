import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { SMSNotification } from "@/types";
import { SMS_TEMPLATES } from "@/constants/config";
import { getStatusLabel } from "@/lib/formatters";

interface NotificationState {
  notifications: SMSNotification[];
  initialized: boolean;
  initializeData: (userId: string) => Promise<void>;
  addNotification: (n: Omit<SMSNotification, "id" | "sentAt">, userId: string) => void;
  sendStatusChangeSMS: (recipientName: string, recipientPhone: string, orderNumber: string, newStatus: string, orderId: string, userId: string) => void;
  sendPaymentSMS: (recipientName: string, recipientPhone: string, amount: number, remaining: number, orderId: string, userId: string) => void;
  sendDueReminderSMS: (recipientName: string, recipientPhone: string, orderNumber: string, dueDate: string, orderId: string, userId: string) => void;
  getNotifications: () => SMSNotification[];
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  initialized: false,

  initializeData: async (userId: string) => {
    if (get().initialized) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("sent_at", { ascending: false }).limit(200);
    const notifications = (data || []).map((n: SMSNotification) => ({
      id: n.id, type: n.type, recipientName: n.recipient_name, recipientPhone: n.recipient_phone,
      message: n.message, status: n.status, orderId: n.order_id, sentAt: n.sent_at,
    }));
    set({ notifications, initialized: true });
  },

  addNotification: async (data, userId) => {
    const sentAt = new Date().toISOString();
    const { data: row } = await supabase.from("notifications").insert({
      user_id: userId, type: data.type, recipient_name: data.recipientName,
      recipient_phone: data.recipientPhone, message: data.message, status: data.status, order_id: data.orderId,
    }).select().single();
    const notif: SMSNotification = { ...data, id: row?.id || crypto.randomUUID(), sentAt };
    set((s) => ({ notifications: [notif, ...s.notifications].slice(0, 200) }));
  },

  sendStatusChangeSMS: (recipientName, recipientPhone, orderNumber, newStatus, orderId, userId) => {
    const message = SMS_TEMPLATES.statusChange(recipientName, orderNumber, getStatusLabel(newStatus));
    get().addNotification({ type: "status_change", recipientName, recipientPhone, message, status: "sent", orderId }, userId);
    const encoded = encodeURIComponent(message);
    const phone = recipientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("967") ? phone : "967" + phone}?text=${encoded}`, "_blank");
  },

  sendPaymentSMS: (recipientName, recipientPhone, amount, remaining, orderId, userId) => {
    const message = SMS_TEMPLATES.paymentReceived(recipientName, amount, remaining);
    get().addNotification({ type: "payment", recipientName, recipientPhone, message, status: "sent", orderId }, userId);
    const encoded = encodeURIComponent(message);
    const phone = recipientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("967") ? phone : "967" + phone}?text=${encoded}`, "_blank");
  },

  sendDueReminderSMS: (recipientName, recipientPhone, orderNumber, dueDate, orderId, userId) => {
    const message = SMS_TEMPLATES.dueReminder(recipientName, orderNumber, dueDate);
    get().addNotification({ type: "due_reminder", recipientName, recipientPhone, message, status: "sent", orderId }, userId);
    const encoded = encodeURIComponent(message);
    const phone = recipientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("967") ? phone : "967" + phone}?text=${encoded}`, "_blank");
  },

  getNotifications: () => get().notifications,
  clearNotifications: () => set({ notifications: [] }),
}));
