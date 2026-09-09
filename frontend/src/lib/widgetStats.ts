import type { SummaryMetricId, Widget } from "@/types/widget";
import { getMetricField, getWidgetData, getWidgetFieldOptions, getWidgetMetricConfig } from "@/lib/widgetConfig";

export interface WidgetSummaryTopValue {
  label: string;
  value: number;
}

export interface WidgetSummaryMetric {
  id: SummaryMetricId;
  label: string;
  raw: number | string | null;
  formatted: string;
}

export interface WidgetSummary {
  metricField: string;
  aggregationMethod: string;
  aggregationValue: number | null;
  percentile: number;
  metrics: Record<SummaryMetricId, WidgetSummaryMetric>;
  headerMetrics: WidgetSummaryMetric[];
  topValues: WidgetSummaryTopValue[];
}

const METRIC_LABELS: Record<SummaryMetricId, string> = {
  count: "Count",
  sum: "Sum",
  average: "Average",
  median: "Median",
  mode: "Mode",
  minimum: "Minimum",
  maximum: "Maximum",
  range: "Range",
  standard_deviation: "Std Dev",
  variance: "Variance",
  percentile: "Percentile",
  growth_rate: "Growth Rate",
  moving_average: "Moving Avg",
  distribution_skew: "Skew",
  top_values: "Top Values",
};

function toNumericValues(rows: Record<string, unknown>[], field: string): number[] {
  return rows
    .map((row) => Number(row[field]))
    .filter((value) => Number.isFinite(value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function variance(values: number[], average: number): number {
  if (values.length === 0) return 0;
  return mean(values.map((value) => (value - average) ** 2));
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (Math.min(Math.max(percentileValue, 0), 100) / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const frequencies = new Map<number, number>();
  let maxCount = 0;
  let modeValue: number | null = null;

  values.forEach((value) => {
    const nextCount = (frequencies.get(value) || 0) + 1;
    frequencies.set(value, nextCount);
    if (nextCount > maxCount) {
      maxCount = nextCount;
      modeValue = value;
    }
  });

  return maxCount > 1 ? modeValue : null;
}

function skew(values: number[], average: number, stdDeviation: number): number | null {
  if (values.length < 3 || stdDeviation === 0) return null;
  const thirdMoment = mean(values.map((value) => (value - average) ** 3));
  return thirdMoment / stdDeviation ** 3;
}

export function formatSummaryValue(value: number | string | null, suffix?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (typeof value === "string") return value;

  const formatted = Math.abs(value) >= 1000
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : value.toLocaleString("en-US", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      });

  return suffix ? `${formatted}${suffix}` : formatted;
}

export function computeWidgetSummary(widget: Widget): WidgetSummary {
  const rows = getWidgetData(widget);
  const metricConfig = getWidgetMetricConfig(widget);
  const { categoricalFields } = getWidgetFieldOptions(widget);
  const metricField = metricConfig.field || getMetricField(widget);
  const values = toNumericValues(rows, metricField);
  const average = mean(values);
  const medianValue = median(values);
  const varianceValue = variance(values, average);
  const stdDeviation = Math.sqrt(varianceValue);
  const percentileValue = percentile(values, metricConfig.percentile ?? 90);
  const modeValue = mode(values);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum;
  const growthRate =
    values.length > 1 && values[0] !== 0 ? ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100 : null;
  const movingAverageWindow = Math.max(1, metricConfig.moving_average_window ?? 3);
  const movingAverage =
    values.length > 0
      ? mean(values.slice(Math.max(0, values.length - movingAverageWindow)))
      : null;
  const skewValue = skew(values, average, stdDeviation);
  const labelField = widget.chart_config.x_field || categoricalFields[0] || metricField;
  const topValues = rows
    .filter((row) => Number.isFinite(Number(row[metricField])))
    .sort((a, b) => Number(b[metricField]) - Number(a[metricField]))
    .slice(0, metricConfig.top_values_limit ?? 3)
    .map((row) => ({
      label: String(row[labelField] ?? metricField),
      value: Number(row[metricField]),
    }));

  const metrics: Record<SummaryMetricId, WidgetSummaryMetric> = {
    count: {
      id: "count",
      label: METRIC_LABELS.count,
      raw: rows.length,
      formatted: formatSummaryValue(rows.length),
    },
    sum: {
      id: "sum",
      label: METRIC_LABELS.sum,
      raw: values.reduce((sum, value) => sum + value, 0),
      formatted: formatSummaryValue(values.reduce((sum, value) => sum + value, 0)),
    },
    average: {
      id: "average",
      label: METRIC_LABELS.average,
      raw: average,
      formatted: formatSummaryValue(average),
    },
    median: {
      id: "median",
      label: METRIC_LABELS.median,
      raw: medianValue,
      formatted: formatSummaryValue(medianValue),
    },
    mode: {
      id: "mode",
      label: METRIC_LABELS.mode,
      raw: modeValue,
      formatted: formatSummaryValue(modeValue),
    },
    minimum: {
      id: "minimum",
      label: METRIC_LABELS.minimum,
      raw: minimum,
      formatted: formatSummaryValue(minimum),
    },
    maximum: {
      id: "maximum",
      label: METRIC_LABELS.maximum,
      raw: maximum,
      formatted: formatSummaryValue(maximum),
    },
    range: {
      id: "range",
      label: METRIC_LABELS.range,
      raw: range,
      formatted: formatSummaryValue(range),
    },
    standard_deviation: {
      id: "standard_deviation",
      label: METRIC_LABELS.standard_deviation,
      raw: stdDeviation,
      formatted: formatSummaryValue(stdDeviation),
    },
    variance: {
      id: "variance",
      label: METRIC_LABELS.variance,
      raw: varianceValue,
      formatted: formatSummaryValue(varianceValue),
    },
    percentile: {
      id: "percentile",
      label: METRIC_LABELS.percentile,
      raw: percentileValue,
      formatted: formatSummaryValue(percentileValue),
    },
    growth_rate: {
      id: "growth_rate",
      label: METRIC_LABELS.growth_rate,
      raw: growthRate,
      formatted: formatSummaryValue(growthRate, "%"),
    },
    moving_average: {
      id: "moving_average",
      label: METRIC_LABELS.moving_average,
      raw: movingAverage,
      formatted: formatSummaryValue(movingAverage),
    },
    distribution_skew: {
      id: "distribution_skew",
      label: METRIC_LABELS.distribution_skew,
      raw: skewValue,
      formatted: formatSummaryValue(skewValue),
    },
    top_values: {
      id: "top_values",
      label: METRIC_LABELS.top_values,
      raw: topValues.length > 0 ? topValues.map((item) => `${item.label}: ${formatSummaryValue(item.value)}`).join(", ") : null,
      formatted:
        topValues.length > 0
          ? topValues.map((item) => `${item.label}: ${formatSummaryValue(item.value)}`).join(", ")
          : "-",
    },
  };

  const aggregationMethod = metricConfig.aggregation ?? "sum";
  const aggregationLookup: Record<string, number | null> = {
    count: rows.length,
    sum: metrics.sum.raw as number,
    mean: average,
    median: medianValue,
    percentile: percentileValue,
  };

  const visibleMetrics = metricConfig.visible_metrics ?? [];

  return {
    metricField,
    aggregationMethod,
    aggregationValue: aggregationLookup[aggregationMethod] ?? metrics.sum.raw as number,
    percentile: metricConfig.percentile ?? 90,
    metrics,
    headerMetrics: visibleMetrics.map((metricId) => metrics[metricId]).filter(Boolean),
    topValues,
  };
}
