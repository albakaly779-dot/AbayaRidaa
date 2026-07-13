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
        <Route path="/" element={<ProtectedRoute><PasswordChangeGuard><AdminRoute><AppLayout /></AdminRoute></PasswordChangeGuard></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="executive-dashboard" element={<ExecutiveDashboard />} />
          <Route path="partner-dashboard" element={<PartnerDashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerProfile />} />
          <Route path="phone-validator" element={<PhoneValidator />} />
          <Route path="products" element={<Products />} />
          <Route path="debts" element={<Debts />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="returns" element={<Returns />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reps" element={<Reps />} />
          <Route path="rep-performance" element={<RepPerformance />} />
          <Route path="rep-activity/:repId" element={<RepActivity />} />
          <Route path="rep-pricing" element={<RepPricing />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="invoice/:orderId" element={<Invoice />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports-automation" element={<ReportsAutomation />} />
          <Route path="product-profitability" element={<ProductProfitability />} />
          <Route path="invoice-preview" element={<InvoicePreview />} />
          <Route path="invoice-templates" element={<InvoiceTemplatesCustom />} />
          <Route path="partners" element={<Partners />} />
          <Route path="activity-analytics" element={<ActivityAnalytics />} />
          <Route path="email-templates" element={<EmailTemplates />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="smart-backups" element={<SmartBackups />} />
          <Route path="user-activity/:email" element={<UserActivity />} />
          <Route path="bulk-import-users" element={<BulkImportUsers />} />
          <Route path="rules" element={<Rules />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="import" element={<Import />} />
          <Route path="roles" element={<Roles />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
