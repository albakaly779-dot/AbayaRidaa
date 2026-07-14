import { useState, useEffect, useMemo } from "react";
import { CloudUpload, Clock, AlertTriangle, CheckCircle, Calendar, Download, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDataStore } from "@/stores/dataStore";
import { useExpenseStore } from "@/stores/expenseStore";
import { useSupplierStore } from "@/stores/supplierStore";
import { useReturnStore } from "@/stores/returnStore";
import { useRepStore } from "@/stores/repStore";
import { exportToJSON } from "@/lib/formatters";

const BACKUP_STORAGE_KEY = "ridaa_last_backup";
const BACKUP_SCHEDULE_KEY = "ridaa_backup_schedule";

type Schedule = "daily" | "weekly" | "manual";

function getLastBackup(): string | null {
  return localStorage.getItem(BACKUP_STORAGE_KEY);
}

function setLastBackup() {
  localStorage.setItem(BACKUP_STORAGE_KEY, new Date().toISOString());
}

function getSchedule(): Schedule {
  return (localStorage.getItem(BACKUP_SCHEDULE_KEY) as Schedule) || "weekly";
}

function setScheduleStorage(s: Schedule) {
  localStorage.setItem(BACKUP_SCHEDULE_KEY, s);
}

function daysSinceLastBackup(): number {
  const last = getLastBackup();
  if (!last) return 999;
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
}

export function useBackupAlert(): { showAlert: boolean; daysSince: number; lastBackup: string | null } {
  const days = daysSinceLastBackup();
  return {
    showAlert: days >= 7,
    daysSince: days,
    lastBackup: getLastBackup(),
  };
}

export default function BackupScheduler({ compact }: { compact?: boolean } = {}) {
  const { user } = useAuth();
  const { orders, customers, payments } = useDataStore();
  const { expenses } = useExpenseStore();
  const { suppliers, transactions } = useSupplierStore();
  const { returns } = useReturnStore();
  const { reps, commissions } = useRepStore();

  const [schedule, setSchedule] = useState<Schedule>(getSchedule());
  const [lastBackup, setLastBackupState] = useState(getLastBackup());
  const daysSince = daysSinceLastBackup();
  const isOverdue = daysSince >= 7;

  const handleScheduleChange = (s: Schedule) => {
    setSchedule(s);
    setScheduleStorage(s);
    toast.success(`تم تغيير الجدولة إلى: ${s === "daily" ? "يومي" : s === "weekly" ? "أسبوعي" : "يدوي"}`);
  };

  const handleBackupNow = () => {
    const allData = {
      orders, customers, payments, expenses,
      suppliers, transactions, returns, reps, commissions,
      exportDate: new Date().toISOString(),
      version: "3.0",
      schedule,
    };
    exportToJSON(allData, `نسخة-احتياطية-رداء-${new Date().toISOString().split("T")[0]}`);
    setLastBackup();
    setLastBackupState(new Date().toISOString());
    toast.success("تم إنشاء نسخة احتياطية بنجاح");
  };

  const handleGoogleDriveBackup = () => {
    handleBackupNow();
    setTimeout(() => {
      window.open("https://drive.google.com/drive/my-drive", "_blank");
    }, 500);
  };

  const formatLastBackup = () => {
    if (!lastBackup) return "لم يتم أخذ نسخة بعد";
    const d = new Date(lastBackup);
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Check if backup is needed based on schedule
  useEffect(() => {
    if (schedule === "manual") return;
    const needed = schedule === "daily" ? daysSince >= 1 : daysSince >= 7;
    if (needed && orders.length > 0) {
      // Show a notification instead of auto-backing up
      toast.info(
        schedule === "daily"
          ? "حان موعد النسخة الاحتياطية اليومية — اذهب للتصدير"
          : "حان موعد النسخة الاحتياطية الأسبوعية — اذهب للتصدير",
        { duration: 8000 }
      );
    }
  }, [daysSince, orders.length, schedule]);

  if (compact) {
    return (
      <div className={`rounded-xl p-3 border flex items-center justify-between ${isOverdue ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center gap-2">
          {isOverdue ? <AlertTriangle className="size-4 text-red-500" /> : <CheckCircle className="size-4 text-emerald-500" />}
          <div>
            <p className="text-[10px] font-semibold text-gray-700">آخر نسخة: {formatLastBackup()}</p>
            {isOverdue && <p className="text-[9px] text-red-500 font-semibold">⚠️ مر أكثر من {daysSince} يوم بدون نسخة!</p>}
          </div>
        </div>
        <button onClick={handleBackupNow}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white ${isOverdue ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"} transition-colors`}>
          <Download className="size-3 inline-block me-1" /> نسخ الآن
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-5">
        <div className={`rounded-xl p-2.5 ${isOverdue ? "bg-red-50" : "bg-emerald-50"}`}>
          <Shield className={`size-5 ${isOverdue ? "text-red-600" : "text-emerald-600"}`} />
        </div>
        <div>
          <h2 className="text-base font-bold text-navy">جدولة النسخ الاحتياطي</h2>
          <p className="text-xs text-gray-400">حماية بياناتك من الفقدان</p>
        </div>
      </div>

      {/* Last backup status */}
      <div className={`rounded-xl p-4 mb-4 border ${isOverdue ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center gap-2 mb-1">
          {isOverdue ? <AlertTriangle className="size-4 text-red-500" /> : <CheckCircle className="size-4 text-emerald-500" />}
          <p className={`text-sm font-bold ${isOverdue ? "text-red-700" : "text-emerald-700"}`}>
            {isOverdue ? `تحذير: لم يتم أخذ نسخة منذ ${daysSince} يوم!` : "النسخ الاحتياطي محدّث"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="size-3" />
          <span>آخر نسخة: {formatLastBackup()}</span>
        </div>
      </div>

      {/* Schedule selection */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">جدول النسخ:</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "daily" as Schedule, label: "يومي", desc: "كل يوم" },
            { key: "weekly" as Schedule, label: "أسبوعي", desc: "كل أسبوع" },
            { key: "manual" as Schedule, label: "يدوي", desc: "عند الحاجة" },
          ]).map((opt) => (
            <button key={opt.key} onClick={() => handleScheduleChange(opt.key)}
              className={`rounded-xl p-3 border-2 text-center transition-all ${
                schedule === opt.key ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-300"
              }`}>
              <Calendar className={`size-4 mx-auto mb-1 ${schedule === opt.key ? "text-navy" : "text-gray-400"}`} />
              <p className={`text-xs font-bold ${schedule === opt.key ? "text-navy" : "text-gray-600"}`}>{opt.label}</p>
              <p className="text-[9px] text-gray-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={handleBackupNow}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-bold text-white shadow-lg shadow-navy/20 hover:bg-navy-light transition-all active:scale-[0.98]">
          <Download className="size-4" /> نسخة احتياطية
        </button>
        <button onClick={handleGoogleDriveBackup}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]">
          <CloudUpload className="size-4" /> رفع لـ Drive
        </button>
      </div>
    </div>
  );
}
