import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface HistogramConfig {
  x_field: string;
  colors?: string[];
  histogram_bins?: number;
  show_grid?: boolean;
  show_tooltip?: boolean;
  x_axis_label?: string;
  y_axis_label?: string;
}

interface HistogramProps {
  data: Record<string, unknown>[];
  config: HistogramConfig;
}

function buildHistogram(
  rows: Record<string, unknown>[],
  field: string,
  bins: number,
) {
  const values = rows.map((row) => Number(row[field])).filter((value) => Number.isFinite(value));
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / bins;
  const histogram = Array.from({ length: bins }, (_, index) => {
    const start = min + index * bucketSize;
    const end = index === bins - 1 ? max : start + bucketSize;
    return {
      bucket: `${start.toFixed(1)}-${end.toFixed(1)}`,
      count: 0,
    };
  });

  values.forEach((value) => {
    const rawIndex = Math.floor((value - min) / bucketSize);
    const index = Math.min(histogram.length - 1, Math.max(0, rawIndex));
    histogram[index].count += 1;
  });

  return histogram;
}

export function HistogramChartComponent({ data, config }: HistogramProps) {
  const {
    x_field,
    colors = ["#2563eb"],
    histogram_bins = 8,
    show_grid = true,
    show_tooltip = true,
    x_axis_label,
    y_axis_label,
  } = config;

  const histogramData = useMemo(
    () => buildHistogram(data, x_field, Math.max(3, histogram_bins)),
    [data, histogram_bins, x_field],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={histogramData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        {show_grid && (
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
        )}
        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} label={x_axis_label ? { value: x_axis_label, position: "insideBottom", offset: -10 } : undefined} />
        <YAxis tick={{ fontSize: 11 }} label={y_axis_label ? { value: y_axis_label, angle: -90, position: "insideLeft" } : undefined} />
        {show_tooltip && (
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
            }}
          />
        )}
        <Bar dataKey="count" fill={colors[0]} radius={[8, 8, 0, 0]} animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default HistogramChartComponent;
