import { TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}

export default function StatCard({ title, value, icon: Icon, trend, trendUp, delay = 0 }: Props) {
  return (
    <div
      className="rounded-xl bg-white p-3 shadow-sm border border-gray-100 transition-shadow hover:shadow-md animate-fade-in opacity-0 sm:rounded-2xl sm:p-5"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-gray-500 truncate sm:text-xs">{title}</p>
          <p className="mt-1 text-sm font-bold text-navy tabular-nums sm:text-lg lg:text-xl">{value}</p>
          {trend && (
            <p className={`mt-1 text-[10px] truncate sm:text-xs ${trendUp === true ? "text-emerald-600" : trendUp === false ? "text-red-500" : "text-gray-400"}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-cream p-2 sm:rounded-xl sm:p-2.5">
          <Icon className="size-4 text-gold sm:size-5" />
        </div>
      </div>
    </div>
  );
}
