import {
  Activity,
  AreaChart,
  BarChart3,
  Hash,
  LineChart,
  PieChart,
  ScatterChart,
  Table,
} from "lucide-react";

export const DEFAULT_COLORS = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ea580c",
  "#16a34a",
  "#be123c",
];

export const CHART_TYPE_ICONS: Record<string, typeof BarChart3> = {
  bar: BarChart3,
  stacked_bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  donut: PieChart,
  table: Table,
  kpi: Hash,
  area: AreaChart,
  scatter: ScatterChart,
  heatmap: Activity,
  radar: Activity,
  histogram: BarChart3,
};

export const DEFAULT_CHART_OPTIONS: Record<string, Record<string, unknown>> = {
  bar: {
    stacked: false,
    show_values: false,
    orientation: "vertical",
    show_grid: true,
    show_legend: true,
    show_tooltip: true,
  },
  stacked_bar: {
    stacked: true,
    show_values: false,
    orientation: "vertical",
    show_grid: true,
    show_legend: true,
    show_tooltip: true,
  },
  line: {
    show_values: false,
    show_dots: false,
    curve_type: "monotone",
    show_grid: true,
    show_legend: true,
    show_tooltip: true,
  },
  pie: {
    show_labels: true,
    show_legend: true,
    show_tooltip: true,
  },
  donut: {
    donut: true,
    show_labels: true,
    show_legend: true,
    show_tooltip: true,
  },
  area: {
    show_values: false,
    curve_type: "monotone",
    stacked: false,
    show_grid: true,
    show_legend: true,
    show_tooltip: true,
  },
  scatter: {
    show_grid: true,
    show_legend: true,
    show_tooltip: true,
  },
  heatmap: {
    show_tooltip: true,
  },
  radar: {
    show_legend: true,
    show_tooltip: true,
    show_grid: true,
  },
  histogram: {
    histogram_bins: 8,
    show_grid: true,
    show_tooltip: true,
  },
  table: {
    page_size: 50,
    striped: true,
    sortable: true,
  },
  kpi: {
    prefix: "",
    suffix: "",
  },
};

export const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "Bar Chart",
  stacked_bar: "Stacked Bar",
  line: "Line Chart",
  pie: "Pie Chart",
  donut: "Donut Chart",
  table: "Data Table",
  kpi: "KPI Card",
  area: "Area Chart",
  scatter: "Scatter Plot",
  heatmap: "Heatmap",
  radar: "Radar Chart",
  histogram: "Histogram",
};

export const CHART_TYPE_ALIASES: Record<string, string> = {
  bar_chart: "bar",
  line_chart: "line",
  area_chart: "area",
  pie_chart: "pie",
  donut_chart: "donut",
  scatter_plot: "scatter",
  radar_chart: "radar",
  histogram_chart: "histogram",
  histogram: "histogram",
  heatmap: "heatmap",
  stacked_bar_chart: "stacked_bar",
};

export const SUPPORTED_CHART_TYPES = [
  "bar",
  "line",
  "area",
  "pie",
  "donut",
  "scatter",
  "heatmap",
  "stacked_bar",
  "kpi",
  "table",
  "radar",
  "histogram",
] as const;

export function normalizeChartType(type: string): string {
  return CHART_TYPE_ALIASES[type] ?? type;
}
