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
            "rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-left font-mono dark:border-slate-800 dark:bg-slate-900",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <span className="mr-1.5 uppercase tracking-wider text-slate-500 dark:text-slate-400">{metric.label}:</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{metric.formatted}</span>
        </div>
      ))}
    </div>
  );
}
