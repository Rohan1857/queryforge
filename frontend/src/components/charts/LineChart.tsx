import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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

export interface LineChartConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  show_values?: boolean;
  show_dots?: boolean;
  show_legend?: boolean;
  show_tooltip?: boolean;
  show_grid?: boolean;
  x_axis_label?: string;
  y_axis_label?: string;
  curve_type?: "linear" | "monotone" | "step";
}

interface LineChartProps {
  data: Record<string, unknown>[];
  config: LineChartConfig;
}

export function LineChartComponent({ data, config }: LineChartProps) {
  const {
    x_field,
    y_fields,
    colors = [],
    show_values = false,
    show_dots = false,
    show_legend = true,
    show_tooltip = true,
    show_grid = true,
    x_axis_label,
    y_axis_label,
    curve_type = "monotone",
  } = config;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        {show_grid && (
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
        )}
        <XAxis
          dataKey={x_field}
          tick={{ fontSize: 11 }}
          label={x_axis_label ? { value: x_axis_label, position: "insideBottom", offset: -10 } : undefined}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          label={y_axis_label ? { value: y_axis_label, angle: -90, position: "insideLeft" } : undefined}
        />
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
        {y_fields.map((field, index) => {
          const color = colors[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          return (
            <Line
              key={field}
              type={curve_type}
              dataKey={field}
              stroke={color}
              strokeWidth={2}
              dot={show_dots ? { r: 3, fill: color } : false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={800}
              animationEasing="ease-out"
              label={show_values ? { position: "top", fontSize: 10, fill: "#6b7280" } : undefined}
            />
          );
        })}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

export default LineChartComponent;
