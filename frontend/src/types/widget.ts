export type WidgetAlignment = "left" | "center" | "right";
export type WidgetBackgroundType = "solid" | "gradient" | "image";
export type WidgetAggregationMethod = "sum" | "mean" | "median" | "count" | "percentile";

export type SummaryMetricId =
  | "count"
  | "sum"
  | "average"
  | "median"
  | "mode"
  | "minimum"
  | "maximum"
  | "range"
  | "standard_deviation"
  | "variance"
  | "percentile"
  | "growth_rate"
  | "moving_average"
  | "distribution_skew"
  | "top_values";

export type SupportedWidgetType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "heatmap"
  | "radar"
  | "histogram"
  | "stacked_bar"
  | "table"
  | "kpi"
  | "text"
  | "filter";

export interface WidgetStyleConfig {
  background_type?: WidgetBackgroundType;
  background_color?: string;
  gradient_from?: string;
  gradient_to?: string;
  background_image?: string;
  font_size?: number;
  font_weight?: number;
  bold?: boolean;
  italic?: boolean;
  border_color?: string;
  border_width?: number;
  border_radius?: number;
  highlight_border?: boolean;
  card_shadow?: string;
  hover_shadow?: string;
  padding?: number;
  spacing?: number;
  alignment?: WidgetAlignment;
}

export interface WidgetMetricConfig {
  field?: string;
  aggregation?: WidgetAggregationMethod;
  percentile?: number;
  moving_average_window?: number;
  top_values_limit?: number;
  show_in_header?: boolean;
  visible_metrics?: SummaryMetricId[];
}

export interface ChartConfig {
  x_field: string;
  y_fields: string[];
  group_field?: string;
  aggregation: string;
  colors: string[];
  stacked: boolean;
  show_values: boolean;
  orientation: string;
  x_axis_label?: string;
  y_axis_label?: string;
  metric_name?: string;
  card_description?: string;
  show_legend?: boolean;
  show_tooltip?: boolean;
  show_grid?: boolean;
  showSummaryMetrics?: boolean;
  histogram_bins?: number;
  style_config?: WidgetStyleConfig;
  metric_config?: WidgetMetricConfig;
  /** Allow extra properties used by KPI, text, and filter widgets */
  [key: string]: unknown;
}

export interface LayoutPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  min_w?: number;
  min_h?: number;
  position?: number;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  connection_id?: string | null;
  type: SupportedWidgetType | string;
  title?: string;
  prompt_used?: string;
  query_config?: Record<string, unknown>;
  chart_config: ChartConfig;
  layout_position: LayoutPosition;
  data?: Record<string, unknown>[];
  cached_data?: Record<string, unknown>[];
  created_at: string;
}

export interface WidgetCreate {
  dashboard_id: string;
  type: string;
  title?: string;
  connection_id?: string;
  query_config: Record<string, unknown>;
  chart_config: Record<string, unknown>;
  layout_position: Record<string, unknown>;
}

export interface WidgetUpdate {
  title?: string;
  type?: string;
  query_config?: Record<string, unknown>;
  chart_config?: Record<string, unknown>;
  layout_position?: Record<string, unknown>;
}
