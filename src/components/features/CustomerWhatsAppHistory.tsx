import { useMemo } from "react";
import { MessageCircle, RefreshCw, Clock, X } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { formatDate } from "@/lib/formatters";

interface Props {
  open: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
}

export default function CustomerWhatsAppHistory({ open, onClose, customerName, customerPhone }: Props) {
  const { notifications } = useNotificationStore();

  const customerMessages = useMemo(() => {
    const cleaned = customerPhone.replace(/\D/g, "");
    return notifications.filter((n) => {
      const nPhone = n.recipientPhone.replace(/\D/g, "");
      return nPhone === cleaned || nPhone.endsWith(cleaned.slice(-9)) || cleaned.endsWith(nPhone.slice(-9));
    }).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [notifications, customerPhone]);

  const resendMessage = (message: string, phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleaned.startsWith("967") ? cleaned : "967" + cleaned}?text=${encoded}`, "_blank");
  };

  const typeLabels: Record<string, string> = {
    status_change: "تغيير حالة",
    payment: "دفعة",
    due_reminder: "تذكير تسليم",
    custom: "مخصص",
  };

  const typeColors: Record<string, string> = {
    status_change: "bg-blue-100 text-blue-700",
    payment: "bg-emerald-100 text-emerald-700",
    due_reminder: "bg-amber-100 text-amber-700",
    custom: "bg-gray-100 text-gray-700",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4 bg-gradient-to-l from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2.5"><MessageCircle className="size-5 text-emerald-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-navy">سجل رسائل {customerName}</h3>
              <p className="text-[10px] text-gray-400">{customerMessages.length} رسالة مرسلة</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
          {customerMessages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <MessageCircle className="size-10 text-gray-300" />
              <p className="text-sm text-gray-400">لا توجد رسائل مرسلة لهذا العميل</p>
            </div>
          ) : (
            customerMessages.map((msg) => (
              <div key={msg.id} className="rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${typeColors[msg.type] || typeColors.custom}`}>
                      {typeLabels[msg.type] || msg.type}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${msg.status === "sent" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {msg.status === "sent" ? "مرسل" : "فشل"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="size-3" />
                    {formatDate(msg.sentAt)}
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-2">{msg.message}</p>
                <button onClick={() => resendMessage(msg.message, msg.recipientPhone)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                  <RefreshCw className="size-3" /> إعادة إرسال
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
