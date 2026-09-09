import { useMemo } from "react";
import type { Widget } from "@/types/widget";
import { computeWidgetSummary } from "@/lib/widgetStats";

export function useWidgetSummary(widget: Widget | null) {
  const metricConfig = widget?.chart_config.metric_config;

  return useMemo(
    () => (widget ? computeWidgetSummary(widget) : null),
    [
      widget?.id,
      widget?.data,
      widget?.cached_data,
      widget?.chart_config.metric_name,
      widget?.chart_config.x_field,
      widget?.chart_config.y_fields,
      metricConfig?.field,
      metricConfig?.aggregation,
      metricConfig?.percentile,
      metricConfig?.moving_average_window,
      metricConfig?.top_values_limit,
      metricConfig?.visible_metrics,
    ],
  );
}
