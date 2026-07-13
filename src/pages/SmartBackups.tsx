import { useEffect, useState, useRef } from "react";
import { HardDrive, Download, Upload, Loader2, Info, Database, Shield, CheckCircle2, FileJson, Trash2, RefreshCw, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useAuditStore } from "@/stores/auditStore";
import { logActivity } from "@/hooks/useActivityLogger";

interface BackupMeta {
  version: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  tables: Record<string, number>;
  totalRecords: number;
}

const BACKUP_TABLES = [
  "customers", "orders", "order_items", "payments", "products",
  "suppliers", "supplier_transactions", "sales_reps", "rep_commissions",
  "expenses", "returns", "return_items", "notifications",
  "audit_logs", "discount_rules", "partners_config", "user_roles",
  "email_templates", "app_settings", "rep_pricing", "report_schedules",
] as const;

export default function SmartBackups() {
  const { user } = useAuth();
  const { logAction } = useAuditStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, table: "" });
  const [stats, setStats] = useState<Record<string, number>>({});
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    const saved = localStorage.getItem("last_backup_date");
    if (saved) setLastBackup(saved);
  }, [user?.id]);

  const loadStats = async () => {
    if (!user?.id) return;
    const counts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      try {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        counts[table] = count || 0;
      } catch {
        counts[table] = 0;
      }
    }
    setStats(counts);
  };

  const handleExport = async () => {
    if (!user?.id) return;
    setExporting(true);
    setProgress({ current: 0, total: BACKUP_TABLES.length, table: "" });

    const backup: { meta: BackupMeta; data: Record<string, unknown[]> } = {
      meta: {
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
        tables: {},
        totalRecords: 0,
      },
      data: {},
    };

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      setProgress({ current: i + 1, total: BACKUP_TABLES.length, table });
      try {
        const { data } = await supabase.from(table).select("*").limit(10000);
        backup.data[table] = data || [];
        backup.meta.tables[table] = (data || []).length;
        backup.meta.totalRecords += (data || []).length;
      } catch {
        backup.data[table] = [];
        backup.meta.tables[table] = 0;
      }
    }

    // Download as JSON
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `rada-backup-${dateStr}-${backup.meta.totalRecords}records.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save last backup date
    const now = new Date().toISOString();
    localStorage.setItem("last_backup_date", now);
    setLastBackup(now);

    if (user?.id) {
      logAction(user.id, "export", "backup", undefined, `نسخة احتياطية شاملة: ${backup.meta.totalRecords} سجل من ${BACKUP_TABLES.length} جدول`);
      logActivity(user.email, user.id, "action", `نسخة احتياطية شاملة (${backup.meta.totalRecords} سجل)`, { entityType: "backup" });
    }

    toast.success(`✅ تم تصدير ${backup.meta.totalRecords} سجل`);
    setExporting(false);
    setProgress({ current: 0, total: 0, table: "" });
  };

  const handleImport = async (file: File) => {
    if (!user?.id) return;
    if (!confirm("⚠️ استعادة النسخة الاحتياطية قد تُنشئ سجلات مكررة. متابعة؟")) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup: { meta: BackupMeta; data: Record<string, unknown[]> } = JSON.parse(text);

      if (!backup.meta || !backup.data) {
        toast.error("ملف غير صالح - ليس نسخة احتياطية");
        setImporting(false);
        return;
      }

      let imported = 0;
      let failed = 0;
      const tableKeys = Object.keys(backup.data);
      setProgress({ current: 0, total: tableKeys.length, table: "" });

      for (let i = 0; i < tableKeys.length; i++) {
        const table = tableKeys[i];
        setProgress({ current: i + 1, total: tableKeys.length, table });
        const rows = backup.data[table] as Array<Record<string, unknown>>;
        if (rows.length === 0) continue;

        // Insert in batches of 100
        for (let j = 0; j < rows.length; j += 100) {
          const batch = rows.slice(j, j + 100);
          try {
            // Remove id and let DB regenerate to avoid conflicts
            const cleanBatch = batch.map((r) => {
              const { id, ...rest } = r;
              return rest;
            });
            const { error } = await supabase.from(table).insert(cleanBatch);
            if (error) failed += batch.length;
            else imported += batch.length;
          } catch {
            failed += batch.length;
          }
        }
      }

      if (user?.id) {
        logAction(user.id, "import", "backup", undefined, `استعادة نسخة احتياطية: ${imported} ناجح، ${failed} فشل`);
      }

      toast.success(`✅ تم استيراد ${imported} سجل${failed > 0 ? ` (فشل ${failed})` : ""}`);
      loadStats();
    } catch (err) {
      toast.error("فشل: " + (err instanceof Error ? err.message : "خطأ"));
    }
    setImporting(false);
    setProgress({ current: 0, total: 0, table: "" });
  };

  const totalRecords = Object.values(stats).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-navy sm:text-xl lg:text-2xl flex items-center gap-2">
          <HardDrive className="size-5 text-purple-600" /> النسخ الاحتياطي الذكي
        </h1>
        <p className="text-xs text-gray-500 sm:text-sm">حماية بياناتك بالتصدير والاستعادة الآمنة</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-bl from-purple-500 to-purple-600 p-5 text-white shadow-lg shadow-purple-500/20">
          <Database className="size-6 mb-2" />
          <p className="text-xs text-white/80">إجمالي السجلات</p>
          <p className="text-3xl font-bold tabular-nums">{totalRecords.toLocaleString("ar-EG")}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
          <FileJson className="size-6 mb-2" />
          <p className="text-xs text-white/80">جداول محمية</p>
          <p className="text-3xl font-bold tabular-nums">{BACKUP_TABLES.length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-bl from-blue-500 to-blue-600 p-5 text-white shadow-lg shadow-blue-500/20">
          <Calendar className="size-6 mb-2" />
          <p className="text-xs text-white/80">آخر نسخة</p>
          <p className="text-sm font-bold">
            {lastBackup ? new Date(lastBackup).toLocaleDateString("ar-SA") : "لا يوجد بعد"}
          </p>
          {lastBackup && (
            <p className="text-[10px] text-white/70 tabular-nums">
              {new Date(lastBackup).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-1">💾 عن النسخ الاحتياطي:</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              <li>يشمل: العملاء، الطلبات، المدفوعات، المنتجات، الموردين، المصروفات، المرتجعات، الإعدادات، الصلاحيات، والقواعد</li>
              <li>الملف يُحفظ محلياً على جهازك بصيغة JSON مقروءة</li>
              <li>يُنصح بأخذ نسخة أسبوعية على الأقل والاحتفاظ بها في مكان آمن</li>
              <li>الاستعادة ستُنشئ سجلات جديدة (لا تحذف الموجود) — احذر التكرار</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Export */}
        <div className="rounded-2xl bg-white p-6 border-2 border-emerald-200 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-emerald-100 p-3">
              <Download className="size-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">📥 تصدير نسخة احتياطية</h3>
              <p className="text-xs text-gray-500 mt-1">قم بتنزيل نسخة كاملة من جميع بياناتك في ملف JSON</p>
            </div>
          </div>
          {exporting && progress.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">جاري النسخ: {progress.table}</span>
                <span className="font-bold text-emerald-600">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <button onClick={handleExport} disabled={exporting || importing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white py-3 text-sm font-bold hover:bg-emerald-600 shadow-md disabled:opacity-50">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {exporting ? "جاري التصدير..." : "بدء النسخ الاحتياطي الآن"}
          </button>
        </div>

        {/* Import */}
        <div className="rounded-2xl bg-white p-6 border-2 border-amber-200 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-amber-100 p-3">
              <Upload className="size-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">📤 استعادة نسخة احتياطية</h3>
              <p className="text-xs text-gray-500 mt-1">استعد بياناتك من ملف JSON محفوظ سابقاً</p>
            </div>
          </div>
          {importing && progress.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">جاري الاستيراد: {progress.table}</span>
                <span className="font-bold text-amber-600">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={exporting || importing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white py-3 text-sm font-bold hover:bg-amber-600 shadow-md disabled:opacity-50">
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {importing ? "جاري الاستيراد..." : "اختر ملف JSON للاستعادة"}
          </button>
        </div>
      </div>

      {/* Stats table */}
      <div className="rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-navy flex items-center gap-2">
            <Database className="size-4" /> إحصاء البيانات الحالية
          </h3>
          <button onClick={loadStats} className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold hover:bg-gray-200">
            <RefreshCw className="size-3" /> تحديث
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {BACKUP_TABLES.map((table) => (
            <div key={table} className="flex items-center justify-between rounded-lg bg-cream/40 p-2.5 border border-gray-100">
              <span className="text-[11px] text-gray-600 font-semibold truncate" dir="ltr">{table}</span>
              <span className="text-xs font-bold text-navy tabular-nums bg-white px-2 rounded">
                {(stats[table] || 0).toLocaleString("ar-EG")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Best practices */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <div className="flex items-start gap-3">
          <Shield className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-bold mb-2">🛡️ أفضل الممارسات:</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              <li>خذ نسخة أسبوعياً كل يوم أحد</li>
              <li>خزّن النسخ في مكانين على الأقل (جهازك + Google Drive/Dropbox)</li>
              <li>احتفظ بآخر 4 نسخ على الأقل قبل حذف القديم</li>
              <li>قبل أي تحديث كبير أو عملية جماعية، خذ نسخة احتياطية</li>
              <li>اختبر الاستعادة سنوياً للتأكد من سلامة النسخ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
