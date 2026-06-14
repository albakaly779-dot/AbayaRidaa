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
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors dir="rtl" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/rep-dashboard" element={<ProtectedRoute><RepDashboard /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><AdminRoute><AppLayout /></AdminRoute></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
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
          <Route path="receipts" element={<Receipts />} />
          <Route path="invoice/:orderId" element={<Invoice />} />
          <Route path="reports" element={<Reports />} />
          <Route path="product-profitability" element={<ProductProfitability />} />
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
