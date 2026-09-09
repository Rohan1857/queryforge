import { clsx } from "clsx";
import type { WidgetSummaryMetric } from "@/lib/widgetStats";

interface Props {
  metrics: WidgetSummaryMetric[];
  compact?: boolean;
}

export function WidgetSummaryStrip({ metrics, compact = false }: Props) {
  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.id}
          className={clsx(
            "rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-left shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/60",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <span className="mr-1 font-medium text-gray-500 dark:text-gray-400">{metric.label}</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{metric.formatted}</span>
        </div>
      ))}
    </div>
  );
}
