import type { LayoutItem } from "@/types/dashboard";
import type {
  ChartConfig,
  SummaryMetricId,
  Widget,
  WidgetMetricConfig,
  WidgetStyleConfig,
  WidgetUpdate,
} from "@/types/widget";
import {
  CHART_TYPE_ICONS,
  CHART_TYPE_LABELS,
  DEFAULT_CHART_OPTIONS,
  DEFAULT_COLORS,
  SUPPORTED_CHART_TYPES,
  normalizeChartType,
} from "@/lib/chartConfig";

export const DEFAULT_VISIBLE_SUMMARY_METRICS: SummaryMetricId[] = [
  "sum",
  "average",
  "growth_rate",
];

export const DEFAULT_WIDGET_STYLE: WidgetStyleConfig = {
  background_type: "solid",
  background_color: "#ffffff",
  gradient_from: "#eff6ff",
  gradient_to: "#ffffff",
  background_image: "",
  font_size: 14,
  font_weight: 600,
  bold: false,
  italic: false,
  border_color: "#e5e7eb",
  border_width: 1,
  border_radius: 18,
  highlight_border: false,
  card_shadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
  hover_shadow: "0 18px 38px rgba(15, 23, 42, 0.14)",
  padding: 12,
  spacing: 10,
  alignment: "left",
};

export const DEFAULT_WIDGET_METRIC_CONFIG: WidgetMetricConfig = {
  aggregation: "sum",
  percentile: 90,
  moving_average_window: 3,
  top_values_limit: 3,
  show_in_header: true,
  visible_metrics: DEFAULT_VISIBLE_SUMMARY_METRICS,
};

export const CHART_TYPE_OPTIONS = SUPPORTED_CHART_TYPES.map((value) => ({
  value,
  label: CHART_TYPE_LABELS[value],
  icon: CHART_TYPE_ICONS[value],
}));

export function getWidgetData(widget: Widget): Record<string, unknown>[] {
  return widget.data || widget.cached_data || [];
}

export function getWidgetFieldOptions(widget: Widget) {
  const rows = getWidgetData(widget);
  const allFields = rows.length > 0 ? Object.keys(rows[0]) : [];
  const numericFields = allFields.filter((field) =>
    rows.some((row) => Number.isFinite(Number(row[field]))),
  );
  const categoricalFields = allFields.filter((field) => !numericFields.includes(field));

  return {
    allFields,
    numericFields,
    categoricalFields,
  };
}

export function getCardDescription(widget: Widget): string {
  return String(widget.chart_config?.card_description ?? "");
}

export function getMetricField(widget: Widget): string {
  const { numericFields } = getWidgetFieldOptions(widget);
  return (
    String(
      widget.chart_config.metric_config?.field ||
        widget.chart_config.metric_name ||
        widget.chart_config.y_fields?.[0] ||
        numericFields[0] ||
        "",
    ) || ""
  );
}

export function getAggregationLabel(
  aggregation: WidgetMetricConfig["aggregation"] | string,
  percentile = 90,
): string {
  switch (aggregation) {
    case "mean":
    case "average":
      return "average";
    case "median":
      return "median";
    case "count":
      return "count";
    case "percentile":
      return `${percentile}th percentile`;
    default:
      return "sum";
  }
}

export function buildAggregationModificationPrompt(
  widget: Widget,
  aggregation: WidgetMetricConfig["aggregation"],
): string {
  const metricConfig = getWidgetMetricConfig(widget);
  const metricField = metricConfig.field || getMetricField(widget) || "the primary metric";
  const aggregationLabel = getAggregationLabel(aggregation, metricConfig.percentile);

  return [
    `Change this widget so it uses ${aggregationLabel} for ${metricField}.`,
    "Keep the same filters, grouping, date range, and business meaning.",
    "Only update the aggregation logic needed for the query and keep the chart aligned with the new result.",
  ].join(" ");
}

export function getWidgetMetricConfig(widget: Widget): WidgetMetricConfig {
  const current = widget.chart_config.metric_config || {};
  const showSummaryMetrics = widget.chart_config.showSummaryMetrics;

  return {
    ...DEFAULT_WIDGET_METRIC_CONFIG,
    ...current,
    show_in_header:
      typeof showSummaryMetrics === "boolean"
        ? showSummaryMetrics
        : (current.show_in_header ?? DEFAULT_WIDGET_METRIC_CONFIG.show_in_header),
    field: current.field || getMetricField(widget),
    visible_metrics:
      current.visible_metrics && current.visible_metrics.length > 0
        ? current.visible_metrics
        : DEFAULT_VISIBLE_SUMMARY_METRICS,
  };
}

export function getShowSummaryMetrics(widget: Widget): boolean {
  if (typeof widget.chart_config.showSummaryMetrics === "boolean") {
    return widget.chart_config.showSummaryMetrics;
  }

  return Boolean(getWidgetMetricConfig(widget).show_in_header ?? true);
}

export function getWidgetStyleConfig(widget: Widget): WidgetStyleConfig {
  return {
    ...DEFAULT_WIDGET_STYLE,
    ...(widget.chart_config.style_config || {}),
  };
}

export function createChartConfig(
  widget: Widget,
  updates: Partial<ChartConfig> = {},
  typeOverride?: string,
): ChartConfig {
  const { allFields, numericFields, categoricalFields } = getWidgetFieldOptions(widget);
  const current = widget.chart_config || ({} as ChartConfig);
  const normalizedType = normalizeWidgetType(typeOverride || widget.type);
  const mergedMetricConfig: WidgetMetricConfig = {
    ...getWidgetMetricConfig(widget),
    ...(updates.metric_config || {}),
  };
  const showSummaryMetrics =
    typeof updates.showSummaryMetrics === "boolean"
      ? updates.showSummaryMetrics
      : typeof current.showSummaryMetrics === "boolean"
        ? current.showSummaryMetrics
        : Boolean(mergedMetricConfig.show_in_header ?? true);
  const mergedStyleConfig: WidgetStyleConfig = {
    ...getWidgetStyleConfig(widget),
    ...(updates.style_config || {}),
  };

  const xField =
    String(updates.x_field ?? current.x_field ?? categoricalFields[0] ?? allFields[0] ?? "") || "";
  const metricField =
    String(
      updates.metric_name ??
        mergedMetricConfig.field ??
        current.metric_name ??
        current.y_fields?.[0] ??
        numericFields[0] ??
        allFields[1] ??
        allFields[0] ??
        "",
    ) || "";
  const yFields =
    updates.y_fields && updates.y_fields.length > 0
      ? updates.y_fields
      : current.y_fields && current.y_fields.length > 0
        ? current.y_fields
        : metricField
          ? [metricField]
          : [];
  const defaultOptions = DEFAULT_CHART_OPTIONS[normalizedType] || {};

  return {
    ...defaultOptions,
    ...current,
    ...updates,
    x_field: xField,
    y_fields: yFields,
    group_field: updates.group_field ?? current.group_field,
    aggregation: String(updates.aggregation ?? current.aggregation ?? defaultOptions.aggregation ?? "sum"),
    colors:
      (updates.colors as string[] | undefined) ??
      (Array.isArray(current.colors) && current.colors.length > 0 ? current.colors : DEFAULT_COLORS),
    stacked: Boolean(updates.stacked ?? current.stacked ?? defaultOptions.stacked ?? false),
    show_values: Boolean(updates.show_values ?? current.show_values ?? defaultOptions.show_values ?? true),
    orientation: String(updates.orientation ?? current.orientation ?? defaultOptions.orientation ?? "vertical"),
    show_legend: Boolean(updates.show_legend ?? current.show_legend ?? defaultOptions.show_legend ?? true),
    show_tooltip: Boolean(updates.show_tooltip ?? current.show_tooltip ?? defaultOptions.show_tooltip ?? true),
    show_grid: Boolean(updates.show_grid ?? current.show_grid ?? defaultOptions.show_grid ?? true),
    showSummaryMetrics,
    x_axis_label: String(updates.x_axis_label ?? current.x_axis_label ?? xField),
    y_axis_label: String(updates.y_axis_label ?? current.y_axis_label ?? metricField),
    metric_name: metricField,
    card_description: String(updates.card_description ?? current.card_description ?? ""),
    histogram_bins: Number(
      updates.histogram_bins ?? current.histogram_bins ?? defaultOptions.histogram_bins ?? 8,
    ),
    style_config: mergedStyleConfig,
    metric_config: {
      ...mergedMetricConfig,
      show_in_header: showSummaryMetrics,
      field: String(updates.metric_name ?? mergedMetricConfig.field ?? metricField),
    },
  };
}

export function normalizeWidgetType(type: string): string {
  return normalizeChartType(type);
}

export function isChartWidgetType(type: string): boolean {
  return CHART_TYPE_OPTIONS.some((option) => option.value === normalizeWidgetType(type));
}

export function buildChartTypeUpdate(widget: Widget, nextType: string): WidgetUpdate {
  const normalizedType = normalizeWidgetType(nextType);

  return {
    type: normalizedType,
    chart_config: createChartConfig(
      widget,
      {
        stacked: normalizedType === "stacked_bar",
        donut: normalizedType === "donut",
      },
      normalizedType,
    ),
  };
}

export function buildOrderedLayout(layout: LayoutItem[]): LayoutItem[] {
  return layout
    .slice()
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id.localeCompare(b.id);
    })
    .map((item, index) => ({
      ...item,
      position: index,
    }));
}
