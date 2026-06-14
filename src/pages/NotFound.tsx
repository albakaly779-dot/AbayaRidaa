import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold text-navy">404</h1>
      <p className="text-sm text-gray-500">الصفحة غير موجودة</p>
      <Link to="/dashboard" className="flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white hover:bg-navy-light transition-colors">
        <Home className="size-4" /> العودة للرئيسية
      </Link>
    </div>
  );
}
