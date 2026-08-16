import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import Customers from "@/pages/Customers";
import CustomerProfile from "@/pages/CustomerProfile";
import Products from "@/pages/Products";
import Debts from "@/pages/Debts";
import Suppliers from "@/pages/Suppliers";
import Returns from "@/pages/Returns";
import Expenses from "@/pages/Expenses";
import Reps from "@/pages/Reps";
import Invoice from "@/pages/Invoice";
import Reports from "@/pages/Reports";
import ExportPage from "@/pages/Export";
import Import from "@/pages/Import";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import AuditLogs from "@/pages/AuditLogs";
import Rules from "@/pages/Rules";
import Roles from "@/pages/Roles";
import RepDashboard from "@/pages/RepDashboard";
import RepPerformance from "@/pages/RepPerformance";
import RepActivity from "@/pages/RepActivity";
import Receipts from "@/pages/Receipts";
import PhoneValidator from "@/pages/PhoneValidator";
import ProductProfitability from "@/pages/ProductProfitability";
import InvoicePreview from "@/pages/InvoicePreview";
import ChangePassword from "@/pages/ChangePassword";
import UserActivity from "@/pages/UserActivity";
import BulkImportUsers from "@/pages/BulkImportUsers";
import Partners from "@/pages/Partners";
import PartnerDashboard from "@/pages/PartnerDashboard";
import ReportsAutomation from "@/pages/ReportsAutomation";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import ActivityAnalytics from "@/pages/ActivityAnalytics";
import InvoiceTemplatesCustom from "@/pages/InvoiceTemplatesCustom";
import RepPricing from "@/pages/RepPricing";
import EmailTemplates from "@/pages/EmailTemplates";
import Approvals from "@/pages/Approvals";
import Sessions from "@/pages/Sessions";
import SmartBackups from "@/pages/SmartBackups";
import type { UserRole } from "@/lib/auth";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role === "rep") return <Navigate to="/rep-dashboard" replace />;
  if (role === "partner") return <Navigate to="/partner-dashboard" replace />;
  return <>{children}</>;
}

function PermissionRoute({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const ADMIN_ROLES: UserRole[] = ["admin"];
const OPERATIONS_ROLES: UserRole[] = ["admin", "operations"];

function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
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
    </BrowserRouter>
  );
}
