import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth";

const AppLayout = lazy(() => import("@/components/layout/AppLayout"));
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Orders = lazy(() => import("@/pages/Orders"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerProfile = lazy(() => import("@/pages/CustomerProfile"));
const Products = lazy(() => import("@/pages/Products"));
const Debts = lazy(() => import("@/pages/Debts"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Returns = lazy(() => import("@/pages/Returns"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Reps = lazy(() => import("@/pages/Reps"));
const Invoice = lazy(() => import("@/pages/Invoice"));
const Reports = lazy(() => import("@/pages/Reports"));
const ExportPage = lazy(() => import("@/pages/Export"));
const Import = lazy(() => import("@/pages/Import"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const Rules = lazy(() => import("@/pages/Rules"));
const Roles = lazy(() => import("@/pages/Roles"));
const RepDashboard = lazy(() => import("@/pages/RepDashboard"));
const RepPerformance = lazy(() => import("@/pages/RepPerformance"));
const RepActivity = lazy(() => import("@/pages/RepActivity"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const PhoneValidator = lazy(() => import("@/pages/PhoneValidator"));
const ProductProfitability = lazy(() => import("@/pages/ProductProfitability"));
const InvoicePreview = lazy(() => import("@/pages/InvoicePreview"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));
const UserActivity = lazy(() => import("@/pages/UserActivity"));
const BulkImportUsers = lazy(() => import("@/pages/BulkImportUsers"));
const Partners = lazy(() => import("@/pages/Partners"));
const PartnerDashboard = lazy(() => import("@/pages/PartnerDashboard"));
const ReportsAutomation = lazy(() => import("@/pages/ReportsAutomation"));
const ExecutiveDashboard = lazy(() => import("@/pages/ExecutiveDashboard"));
const ActivityAnalytics = lazy(() => import("@/pages/ActivityAnalytics"));
const InvoiceTemplatesCustom = lazy(() => import("@/pages/InvoiceTemplatesCustom"));
const RepPricing = lazy(() => import("@/pages/RepPricing"));
const EmailTemplates = lazy(() => import("@/pages/EmailTemplates"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const Sessions = lazy(() => import("@/pages/Sessions"));
const SmartBackups = lazy(() => import("@/pages/SmartBackups"));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6" dir="rtl">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-9 animate-spin rounded-full border-4 border-navy/20 border-t-navy" />
        <p className="text-sm text-gray-500">جاري تحميل الصفحة...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-navy/20 border-t-navy" />
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (role === "rep") return <Navigate to="/rep-dashboard" replace />;
  if (role === "partner") return <Navigate to="/partner-dashboard" replace />;
  return <>{children}</>;
}

function PermissionRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const ADMIN_ROLES: UserRole[] = ["admin"];
const OPERATIONS_ROLES: UserRole[] = ["admin", "operations"];

function PasswordChangeGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.mustChangePassword && window.location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors dir="rtl" />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/rep-dashboard" element={<ProtectedRoute><PasswordChangeGuard><RepDashboard /></PasswordChangeGuard></ProtectedRoute>} />
          <Route path="/partner-dashboard" element={<ProtectedRoute><PasswordChangeGuard><PartnerDashboard /></PasswordChangeGuard></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><PasswordChangeGuard><AdminRoute><AppLayout /></AdminRoute></PasswordChangeGuard></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="executive-dashboard" element={<PermissionRoute roles={ADMIN_ROLES}><ExecutiveDashboard /></PermissionRoute>} />
            <Route path="orders" element={<PermissionRoute roles={OPERATIONS_ROLES}><Orders /></PermissionRoute>} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerProfile />} />
            <Route path="phone-validator" element={<PermissionRoute roles={ADMIN_ROLES}><PhoneValidator /></PermissionRoute>} />
            <Route path="products" element={<PermissionRoute roles={OPERATIONS_ROLES}><Products /></PermissionRoute>} />
            <Route path="debts" element={<PermissionRoute roles={ADMIN_ROLES}><Debts /></PermissionRoute>} />
            <Route path="suppliers" element={<PermissionRoute roles={ADMIN_ROLES}><Suppliers /></PermissionRoute>} />
            <Route path="returns" element={<PermissionRoute roles={OPERATIONS_ROLES}><Returns /></PermissionRoute>} />
            <Route path="expenses" element={<PermissionRoute roles={ADMIN_ROLES}><Expenses /></PermissionRoute>} />
            <Route path="reps" element={<PermissionRoute roles={ADMIN_ROLES}><Reps /></PermissionRoute>} />
            <Route path="rep-performance" element={<PermissionRoute roles={ADMIN_ROLES}><RepPerformance /></PermissionRoute>} />
            <Route path="rep-activity/:repId" element={<RepActivity />} />
            <Route path="rep-pricing" element={<PermissionRoute roles={ADMIN_ROLES}><RepPricing /></PermissionRoute>} />
            <Route path="receipts" element={<PermissionRoute roles={ADMIN_ROLES}><Receipts /></PermissionRoute>} />
            <Route path="invoice/:orderId" element={<Invoice />} />
            <Route path="reports" element={<PermissionRoute roles={ADMIN_ROLES}><Reports /></PermissionRoute>} />
            <Route path="reports-automation" element={<PermissionRoute roles={ADMIN_ROLES}><ReportsAutomation /></PermissionRoute>} />
            <Route path="product-profitability" element={<PermissionRoute roles={ADMIN_ROLES}><ProductProfitability /></PermissionRoute>} />
            <Route path="invoice-preview" element={<InvoicePreview />} />
            <Route path="invoice-templates" element={<PermissionRoute roles={ADMIN_ROLES}><InvoiceTemplatesCustom /></PermissionRoute>} />
            <Route path="partners" element={<PermissionRoute roles={ADMIN_ROLES}><Partners /></PermissionRoute>} />
            <Route path="activity-analytics" element={<PermissionRoute roles={ADMIN_ROLES}><ActivityAnalytics /></PermissionRoute>} />
            <Route path="email-templates" element={<PermissionRoute roles={ADMIN_ROLES}><EmailTemplates /></PermissionRoute>} />
            <Route path="approvals" element={<PermissionRoute roles={OPERATIONS_ROLES}><Approvals /></PermissionRoute>} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="smart-backups" element={<PermissionRoute roles={ADMIN_ROLES}><SmartBackups /></PermissionRoute>} />
            <Route path="user-activity/:email" element={<UserActivity />} />
            <Route path="bulk-import-users" element={<PermissionRoute roles={ADMIN_ROLES}><BulkImportUsers /></PermissionRoute>} />
            <Route path="rules" element={<PermissionRoute roles={ADMIN_ROLES}><Rules /></PermissionRoute>} />
            <Route path="export" element={<PermissionRoute roles={ADMIN_ROLES}><ExportPage /></PermissionRoute>} />
            <Route path="import" element={<PermissionRoute roles={ADMIN_ROLES}><Import /></PermissionRoute>} />
            <Route path="roles" element={<PermissionRoute roles={ADMIN_ROLES}><Roles /></PermissionRoute>} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="audit" element={<PermissionRoute roles={ADMIN_ROLES}><AuditLogs /></PermissionRoute>} />
            <Route path="settings" element={<PermissionRoute roles={ADMIN_ROLES}><Settings /></PermissionRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
