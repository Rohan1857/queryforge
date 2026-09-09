import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const DEFAULT_COLORS = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
];

export interface RadarChartConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  show_legend?: boolean;
  show_tooltip?: boolean;
}

interface RadarChartProps {
  data: Record<string, unknown>[];
  config: RadarChartConfig;
}

export function RadarChartComponent({ data, config }: RadarChartProps) {
  const { x_field, y_fields, colors = [], show_legend = true, show_tooltip = true } = config;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsRadarChart data={data} outerRadius="70%">
        <PolarGrid />
        <PolarAngleAxis dataKey={x_field} tick={{ fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fontSize: 10 }} />
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
            <Radar
              key={field}
              name={field}
              dataKey={field}
              stroke={color}
              fill={color}
              fillOpacity={0.25}
            />
          );
        })}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}

export default RadarChartComponent;
