import { useEffect } from "react";
import { useMemo } from "react";
import { Bell, CreditCard, Truck, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationStore } from "@/stores/notificationStore";
import { formatDate } from "@/lib/formatters";

const typeIcons: Record<string, typeof Bell> = { status_change: Truck, payment: CreditCard, due_reminder: Bell };
const typeLabels: Record<string, string> = { status_change: "تغيير حالة", payment: "دفعة", due_reminder: "تذكير موعد" };
const typeColors: Record<string, string> = { status_change: "bg-blue-100 text-blue-800", payment: "bg-green-100 text-green-800", due_reminder: "bg-amber-100 text-amber-800" };

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, initializeData, clearNotifications } = useNotificationStore();

  useEffect(() => { if (user?.id) initializeData(user.id); }, [user?.id]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl">سجل الإشعارات</h1>
          <p className="text-xs text-gray-500 sm:text-sm">{notifications.length} رسالة مرسلة</p>
        </div>
        {notifications.length > 0 && (
          <button onClick={() => { if (window.confirm("حذف كل الإشعارات؟")) clearNotifications(); }}
            className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100">
            <Trash2 className="size-4" /> مسح السجل
          </button>
        )}
      </div>
      <div className="space-y-3">
        {notifications.map((n, idx) => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 animate-fade-in opacity-0 sm:p-5" style={{ animationDelay: `${Math.min(idx, 15) * 40}ms` }}>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`flex size-9 items-center justify-center rounded-full ${typeColors[n.type] || "bg-gray-100"} sm:size-10`}><Icon className="size-4 sm:size-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${typeColors[n.type]}`}>{typeLabels[n.type]}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700">تم الإرسال</span>
                  </div>
                  <p className="text-sm font-semibold text-navy">{n.recipientName}</p>
                  <div className="mt-2 rounded-lg bg-cream/60 p-2.5 sm:p-3"><p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{n.message}</p></div>
                  <p className="mt-2 text-[10px] text-gray-400">{formatDate(n.sentAt?.split("T")[0] || "")}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {notifications.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="rounded-full bg-gray-50 p-6"><Bell className="size-10 text-gray-300" /></div>
          <h3 className="text-lg font-bold text-navy">لا توجد إشعارات</h3>
          <p className="text-sm text-gray-400">ستظهر هنا الرسائل المرسلة للعملاء</p>
        </div>
      )}
    </div>
  );
}
