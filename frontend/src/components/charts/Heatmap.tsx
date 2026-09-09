import { useMemo } from "react";

export interface HeatmapConfig {
  x_field: string;
  y_fields: string[];
  value_field?: string;
  colors?: string[];
}

interface HeatmapProps {
  data: Record<string, unknown>[];
  config: HeatmapConfig;
}

function lerpColor(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function getHeatColor(normalized: number): string {
  const green = [15, 118, 110];
  const yellow = [217, 119, 6];
  const red = [220, 38, 38];

  if (normalized <= 0.5) {
    return lerpColor(green, yellow, normalized * 2);
  }
  return lerpColor(yellow, red, (normalized - 0.5) * 2);
}

export function HeatmapComponent({ data, config }: HeatmapProps) {
  const { x_field, y_fields, value_field } = config;
  const vField = value_field || y_fields[0];

  const { xLabels, yLabels, grid, minVal, maxVal } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const map = new Map<string, number>();

    let min = Infinity;
    let max = -Infinity;

    if (y_fields.length > 1) {
      data.forEach((row) => {
        const xVal = String(row[x_field] ?? "");
        xSet.add(xVal);
        y_fields.forEach((yField) => {
          ySet.add(yField);
          const value = Number(row[yField]) || 0;
          map.set(`${yField}|${xVal}`, value);
          if (value < min) min = value;
          if (value > max) max = value;
        });
      });
    } else {
      const fields = Object.keys(data[0] || {});
      const rowField = fields.find((field) => field !== x_field && field !== vField) || x_field;

      data.forEach((row) => {
        const xVal = String(row[x_field] ?? "");
        const yVal = String(row[rowField] ?? "");
        const value = Number(row[vField]) || 0;

        xSet.add(xVal);
        ySet.add(yVal);
        map.set(`${yVal}|${xVal}`, value);
        if (value < min) min = value;
        if (value > max) max = value;
      });
    }

    const xArr = Array.from(xSet);
    const yArr = Array.from(ySet);
    const gridData = yArr.map((yLabel) =>
      xArr.map((xLabel) => {
        const key = `${yLabel}|${xLabel}`;
        return map.has(key) ? map.get(key) ?? null : null;
      }),
    );

    return {
      xLabels: xArr,
      yLabels: yArr,
      grid: gridData,
      minVal: min === Infinity ? 0 : min,
      maxVal: max === -Infinity ? 1 : max,
    };
  }, [data, vField, x_field, y_fields]);

  const range = maxVal - minVal || 1;
  const cellPadding = 2;
  const labelWidth = 100;
  const labelHeight = 30;
  const cellWidth = 50;
  const cellHeight = 36;
  const svgWidth = labelWidth + xLabels.length * (cellWidth + cellPadding);
  const svgHeight = labelHeight + yLabels.length * (cellHeight + cellPadding);

  return (
    <div className="h-full w-full overflow-auto">
      <svg width={svgWidth} height={svgHeight} className="min-w-full" style={{ minWidth: svgWidth, minHeight: svgHeight }}>
        {xLabels.map((label, xIndex) => (
          <text
            key={`x-${xIndex}`}
            x={labelWidth + xIndex * (cellWidth + cellPadding) + cellWidth / 2}
            y={labelHeight - 6}
            textAnchor="middle"
            fontSize={10}
            className="fill-gray-600 dark:fill-gray-400"
          >
            {label.length > 8 ? `${label.slice(0, 8)}...` : label}
          </text>
        ))}

        {yLabels.map((yLabel, yIndex) => (
          <g key={`row-${yIndex}`}>
            <text
              x={labelWidth - 8}
              y={labelHeight + yIndex * (cellHeight + cellPadding) + cellHeight / 2 + 4}
              textAnchor="end"
              fontSize={10}
              className="fill-gray-600 dark:fill-gray-400"
            >
              {yLabel.length > 12 ? `${yLabel.slice(0, 12)}...` : yLabel}
            </text>

            {xLabels.map((_, xIndex) => {
              const value = grid[yIndex][xIndex];
              const normalized = value !== null ? (value - minVal) / range : 0;
              const color = value !== null ? getHeatColor(normalized) : "#e5e7eb";

              return (
                <g key={`cell-${yIndex}-${xIndex}`}>
                  <rect
                    x={labelWidth + xIndex * (cellWidth + cellPadding)}
                    y={labelHeight + yIndex * (cellHeight + cellPadding)}
                    width={cellWidth}
                    height={cellHeight}
                    rx={4}
                    fill={color}
                    opacity={value !== null ? 0.88 : 0.3}
                  >
                    <title>
                      {`${yLabel}, ${xLabels[xIndex]}: ${value !== null ? value.toLocaleString() : "N/A"}`}
                    </title>
                  </rect>
                  {value !== null && (
                    <text
                      x={labelWidth + xIndex * (cellWidth + cellPadding) + cellWidth / 2}
                      y={labelHeight + yIndex * (cellHeight + cellPadding) + cellHeight / 2 + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={500}
                      fill="#fff"
                    >
                      {typeof value === "number" && Math.abs(value) >= 1000
                        ? `${(value / 1000).toFixed(1)}k`
                        : value?.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default HeatmapComponent;
