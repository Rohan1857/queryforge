import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
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

export interface ScatterPlotConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  group_field?: string;
  z_field?: string;
  show_legend?: boolean;
  show_tooltip?: boolean;
  show_grid?: boolean;
  x_axis_label?: string;
  y_axis_label?: string;
}

interface ScatterPlotProps {
  data: Record<string, unknown>[];
  config: ScatterPlotConfig;
}

export function ScatterPlotComponent({ data, config }: ScatterPlotProps) {
  const {
    x_field,
    y_fields,
    colors = [],
    group_field,
    z_field,
    show_legend = true,
    show_tooltip = true,
    show_grid = true,
    x_axis_label,
    y_axis_label,
  } = config;

  const yField = y_fields[0];
  const groups: Record<string, Record<string, unknown>[]> = {};

  if (group_field) {
    data.forEach((item) => {
      const group = String(item[group_field] ?? "Other");
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
  } else {
    groups.All = data;
  }

  const groupNames = Object.keys(groups);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
        {show_grid && (
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
        )}
        <XAxis
          dataKey={x_field}
          type="number"
          name={x_field}
          tick={{ fontSize: 11 }}
          label={x_axis_label ? { value: x_axis_label, position: "insideBottom", offset: -10 } : undefined}
        />
        <YAxis
          dataKey={yField}
          type="number"
          name={yField}
          tick={{ fontSize: 11 }}
          label={y_axis_label ? { value: y_axis_label, angle: -90, position: "insideLeft" } : undefined}
        />
        {z_field && <ZAxis dataKey={z_field} range={[30, 300]} name={z_field} />}
        {show_tooltip && (
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
            }}
          />
        )}
        {show_legend && groupNames.length > 1 && <Legend />}
        {groupNames.map((name, index) => (
          <Scatter
            key={name}
            name={name}
            data={groups[name]}
            fill={colors[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            animationDuration={600}
            animationEasing="ease-out"
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default ScatterPlotComponent;
