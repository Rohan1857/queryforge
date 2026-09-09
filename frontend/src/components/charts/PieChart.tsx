import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
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
  "#0891b2",
  "#ea580c",
];

export interface PieChartConfig {
  x_field: string;
  y_fields: string[];
  colors?: string[];
  donut?: boolean;
  show_values?: boolean;
  show_legend?: boolean;
  show_tooltip?: boolean;
}

interface PieChartProps {
  data: Record<string, unknown>[];
  config: PieChartConfig;
}

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

const RADIAN = Math.PI / 180;

function renderPercentageLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: LabelProps) {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.03) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#6b7280"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
    >
      {name} ({(percent * 100).toFixed(1)}%)
    </text>
  );
}

export function PieChartComponent({ data, config }: PieChartProps) {
  const {
    x_field,
    y_fields,
    colors = [],
    donut = false,
    show_values = true,
    show_legend = true,
    show_tooltip = true,
  } = config;

  const valueField = y_fields[0];
  const innerRadius = donut ? "50%" : "0%";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie
          data={data}
          dataKey={valueField}
          nameKey={x_field}
          cx="50%"
          cy="50%"
          outerRadius="75%"
          innerRadius={innerRadius}
          label={show_values ? renderPercentageLabel : false}
          labelLine={show_values}
          animationDuration={600}
          animationEasing="ease-out"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            />
          ))}
        </Pie>
        {show_tooltip && (
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
            }}
          />
        )}
        {show_legend && <Legend />}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

export default PieChartComponent;
