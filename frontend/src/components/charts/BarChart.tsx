import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_COLORS = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ea580c",
];

export interface BarChartConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  stacked?: boolean;
  orientation?: "vertical" | "horizontal";
  show_values?: boolean;
  show_legend?: boolean;
  show_tooltip?: boolean;
  show_grid?: boolean;
  x_axis_label?: string;
  y_axis_label?: string;
}

interface BarChartProps {
  data: Record<string, unknown>[];
  config: BarChartConfig;
}

export function BarChartComponent({ data, config }: BarChartProps) {
  const {
    x_field,
    y_fields,
    colors = [],
    stacked = false,
    orientation = "vertical",
    show_values = false,
    show_legend = true,
    show_tooltip = true,
    show_grid = true,
    x_axis_label,
    y_axis_label,
  } = config;

  const isHorizontal = orientation === "horizontal";
  const layout = isHorizontal ? "vertical" : "horizontal";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
      >
        {show_grid && (
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
        )}
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              label={x_axis_label ? { value: x_axis_label, position: "insideBottom", offset: -10 } : undefined}
            />
            <YAxis
              dataKey={x_field}
              type="category"
              tick={{ fontSize: 11 }}
              width={100}
              label={y_axis_label ? { value: y_axis_label, angle: -90, position: "insideLeft" } : undefined}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={x_field}
              tick={{ fontSize: 11 }}
              label={x_axis_label ? { value: x_axis_label, position: "insideBottom", offset: -10 } : undefined}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={y_axis_label ? { value: y_axis_label, angle: -90, position: "insideLeft" } : undefined}
            />
          </>
        )}
        {show_tooltip && (
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
            }}
          />
        )}
        {show_legend && y_fields.length > 1 && <Legend />}
        {y_fields.map((field, index) => (
          <Bar
            key={field}
            dataKey={field}
            fill={colors[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            stackId={stacked ? "stack" : undefined}
            animationDuration={600}
            animationEasing="ease-out"
            label={show_values ? { position: "top", fontSize: 10, fill: "#6b7280" } : undefined}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

export default BarChartComponent;
