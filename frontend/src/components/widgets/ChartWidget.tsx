import { memo, useMemo } from "react";
import { AreaChartComponent } from "@/components/charts/AreaChart";
import { BarChartComponent } from "@/components/charts/BarChart";
import { HeatmapComponent } from "@/components/charts/Heatmap";
import { HistogramChartComponent } from "@/components/charts/Histogram";
import { LineChartComponent } from "@/components/charts/LineChart";
import { PieChartComponent } from "@/components/charts/PieChart";
import { RadarChartComponent } from "@/components/charts/RadarChart";
import { ScatterPlotComponent } from "@/components/charts/ScatterPlot";
import { normalizeWidgetType } from "@/lib/widgetConfig";
import type { ChartConfig } from "@/types/widget";

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "donut"
  | "area"
  | "scatter"
  | "heatmap"
  | "radar"
  | "histogram"
  | "stacked_bar";

interface ChartWidgetProps {
  type: ChartType | string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig;
  onChartClick?: (payload: Record<string, unknown>) => void;
}

interface RenderableChartConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  stacked: boolean;
  orientation: "vertical" | "horizontal";
  show_values: boolean;
  group_field?: string;
  show_legend: boolean;
  show_tooltip: boolean;
  show_grid: boolean;
  x_axis_label: string;
  y_axis_label: string;
  metric_name: string;
  histogram_bins: number;
  curve_type: "linear" | "monotone" | "step";
  donut: boolean;
  z_field?: string;
}

function getRenderableConfig(
  type: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig,
): RenderableChartConfig {
  const sample = data[0] || {};
  const allKeys = Object.keys(sample);
  const numericKeys = allKeys.filter((key) => typeof sample[key] === "number");
  const stringKeys = allKeys.filter((key) => typeof sample[key] === "string");
  const normalizedType = normalizeWidgetType(type);

  const defaultMetric =
    String(chartConfig?.metric_name || chartConfig?.y_fields?.[0] || numericKeys[0] || allKeys[1] || allKeys[0] || "") ||
    "";
  const defaultXField =
    normalizedType === "scatter" || normalizedType === "histogram"
      ? String(
          (chartConfig?.x_field && numericKeys.includes(chartConfig.x_field) ? chartConfig.x_field : undefined) ||
            numericKeys[0] ||
            allKeys[0] ||
            "",
        )
      : String(chartConfig?.x_field || stringKeys[0] || allKeys[0] || "");

  const curveType: RenderableChartConfig["curve_type"] =
    chartConfig?.curve_type === "linear" ||
    chartConfig?.curve_type === "step" ||
    chartConfig?.curve_type === "monotone"
      ? chartConfig.curve_type
      : "monotone";

  return {
    x_field: defaultXField,
    y_fields:
      chartConfig?.y_fields?.length > 0
        ? chartConfig.y_fields
        : defaultMetric
          ? [defaultMetric]
          : numericKeys.slice(0, 3),
    colors: Array.isArray(chartConfig?.colors) && chartConfig.colors.length > 0 ? chartConfig.colors : undefined,
    stacked: normalizedType === "stacked_bar" ? true : Boolean(chartConfig?.stacked),
    orientation: (chartConfig?.orientation as "vertical" | "horizontal") || "vertical",
    show_values: chartConfig?.show_values ?? true,
    group_field: chartConfig?.group_field,
    show_legend: chartConfig?.show_legend ?? true,
    show_tooltip: chartConfig?.show_tooltip ?? true,
    show_grid: chartConfig?.show_grid ?? true,
    x_axis_label: String(chartConfig?.x_axis_label || defaultXField),
    y_axis_label: String(chartConfig?.y_axis_label || defaultMetric),
    metric_name: defaultMetric,
    histogram_bins: Number(chartConfig?.histogram_bins ?? 8),
    curve_type: curveType,
    donut: Boolean(chartConfig?.donut),
    z_field: chartConfig?.z_field as string | undefined,
  };
}

export const ChartRenderer = memo(function ChartRenderer({
  type,
  data,
  chartConfig,
  onChartClick,
}: ChartWidgetProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No matching data found for this query
      </div>
    );
  }

  const normalizedType = normalizeWidgetType(type);
  const config = useMemo(
    () => getRenderableConfig(normalizedType, data, chartConfig),
    [chartConfig, data, normalizedType],
  );

  return (
    <div
      className="h-full w-full animate-fade-in"
      onClick={
        onChartClick
          ? (event) => {
              const target = event.target as HTMLElement;
              const dataIndex = target.getAttribute("data-index");
              if (dataIndex === null) return;
              const index = parseInt(dataIndex, 10);
              if (data[index]) onChartClick(data[index]);
            }
          : undefined
      }
    >
      {normalizedType === "bar" && <BarChartComponent data={data} config={config} />}
      {normalizedType === "stacked_bar" && <BarChartComponent data={data} config={{ ...config, stacked: true }} />}
      {normalizedType === "line" && <LineChartComponent data={data} config={config} />}
      {normalizedType === "pie" && <PieChartComponent data={data} config={config} />}
      {normalizedType === "donut" && <PieChartComponent data={data} config={{ ...config, donut: true }} />}
      {normalizedType === "area" && <AreaChartComponent data={data} config={config} />}
      {normalizedType === "scatter" && <ScatterPlotComponent data={data} config={config} />}
      {normalizedType === "heatmap" && <HeatmapComponent data={data} config={config} />}
      {normalizedType === "radar" && <RadarChartComponent data={data} config={config} />}
      {normalizedType === "histogram" && <HistogramChartComponent data={data} config={config} />}
    </div>
  );
});

export const ChartWidget = ChartRenderer;

export default ChartRenderer;
