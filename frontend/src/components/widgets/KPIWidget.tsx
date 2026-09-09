import clsx from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KPITrend {
  direction: "up" | "down";
  percent: number;
}

interface KPIWidgetProps {
  value: number;
  title: string;
  subtitle?: string;
  trend?: KPITrend;
  prefix?: string;
  suffix?: string;
}

function formatKPIValue(value: number, prefix?: string, suffix?: string): string {
  let formatted: string;

  if (Math.abs(value) >= 1_000_000_000) {
    formatted = `${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (Math.abs(value) >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 10_000) {
    formatted = `${(value / 1_000).toFixed(1)}K`;
  } else {
    formatted = value.toLocaleString("en-US", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

export function KPIWidget({
  value,
  title,
  subtitle,
  trend,
  prefix,
  suffix,
}: KPIWidgetProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-3 text-center">
      {/* Title */}
      <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </span>

      {/* Value */}
      <span
        className={clsx(
          "font-bold tabular-nums text-gray-900 dark:text-white",
          "text-3xl sm:text-4xl md:text-5xl",
          "leading-tight"
        )}
      >
        {formatKPIValue(value, prefix, suffix)}
      </span>

      {/* Trend */}
      {trend && (
        <div
          className={clsx(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            trend.direction === "up"
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          )}
        >
          {trend.direction === "up" ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>{trend.percent.toFixed(1)}%</span>
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <span className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {subtitle}
        </span>
      )}
    </div>
  );
}

export default KPIWidget;
