import { AlertCircle, Database } from "lucide-react";
import type { Widget } from "@/types/widget";
import { ChartWidget, type ChartType } from "./ChartWidget";
import { TableWidget } from "./TableWidget";
import { KPIWidget } from "./KPIWidget";
import { TextWidget } from "./TextWidget";
import { FilterWidget, type FilterType } from "./FilterWidget";

interface Props {
  widget: Widget;
  onFilterChange?: (value: string | { start: string; end: string }) => void;
  onTextChange?: (content: string) => void;
  onChartClick?: (payload: Record<string, unknown>) => void;
}

const CHART_TYPES = new Set<string>([
  "bar",
  "line",
  "pie",
  "donut",
  "area",
  "scatter",
  "heatmap",
]);

// All known renderable types (charts + special)
const ALL_KNOWN_TYPES = new Set<string>([
  ...CHART_TYPES,
  "table",
  "kpi",
  "text",
  "filter",
]);

// ── Data validation helpers ─────────────────────────────────

function validateChartData(
  data: Record<string, unknown>[],
  config: Widget["chart_config"],
  type: string,
): { valid: boolean; message?: string; fixedConfig?: Widget["chart_config"] } {
  if (!data || data.length === 0) {
    return { valid: false, message: "No matching data found for this query" };
  }

  if (!config) {
    // No config but we have data — still renderable as table
    return { valid: true };
  }

  // For chart types that need x_field/y_fields, try to auto-fix mismatches
  if (type !== "kpi" && type !== "text" && type !== "filter") {
    const sampleRow = data[0];
    const availableKeys = Object.keys(sampleRow);
    let xField = config.x_field;
    let yFields = config.y_fields || [];

    // Auto-fix x_field: case-insensitive match or pick first string column
    if (xField && !(xField in sampleRow)) {
      const lowerMap = Object.fromEntries(availableKeys.map((k) => [k.toLowerCase(), k]));
      if (xField.toLowerCase() in lowerMap) {
        xField = lowerMap[xField.toLowerCase()];
      } else {
        // Pick first non-numeric column
        const stringCol = availableKeys.find(
          (k) => typeof sampleRow[k] === "string",
        );
        if (stringCol) {
          xField = stringCol;
        }
      }
    }

    // Auto-fix y_fields: case-insensitive match or pick numeric columns
    if (yFields.length > 0) {
      const validY = yFields.filter((f) => f in sampleRow);
      if (validY.length === 0) {
        const lowerMap = Object.fromEntries(availableKeys.map((k) => [k.toLowerCase(), k]));
        const caseFixed = yFields
          .map((f) => lowerMap[f.toLowerCase()])
          .filter(Boolean) as string[];
        if (caseFixed.length > 0) {
          yFields = caseFixed;
        } else {
          // Pick numeric columns
          const numericCols = availableKeys.filter(
            (k) => typeof sampleRow[k] === "number",
          );
          if (numericCols.length > 0) {
            yFields = numericCols.slice(0, 3);
          } else {
            return {
              valid: false,
              message: `No numeric columns found for chart. Available: ${availableKeys.join(", ")}`,
            };
          }
        }
      }
    }

    // Return fixed config if we auto-corrected anything
    if (xField !== config.x_field || yFields !== config.y_fields) {
      return {
        valid: true,
        fixedConfig: { ...config, x_field: xField, y_fields: yFields },
      };
    }
  }

  return { valid: true };
}

// ── Error display component ─────────────────────────────────

function DataError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
        <AlertCircle size={20} className="text-amber-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

function EmptyData() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <Database size={20} className="text-gray-400" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No matching data found for this query
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Try modifying your prompt or check the data source
      </p>
    </div>
  );
}

// ── Main renderer ───────────────────────────────────────────

export function WidgetRenderer({
  widget,
  onFilterChange,
  onTextChange,
  onChartClick,
}: Props) {
  const data = widget.data || widget.cached_data || [];
  const config = widget.chart_config;

  // Handle chart types (including table which uses same data format)
  if (CHART_TYPES.has(widget.type) || widget.type === "table") {
    const validation = validateChartData(
      data as Record<string, unknown>[],
      config,
      widget.type,
    );

    if (!validation.valid) {
      // If validation fails but we have data, fall back to table view
      if (data && (data as Record<string, unknown>[]).length > 0) {
        return (
          <TableWidget
            data={data as Record<string, unknown>[]}
            columns={config?.y_fields}
          />
        );
      }
      return validation.message ? (
        <DataError message={validation.message} />
      ) : (
        <EmptyData />
      );
    }

    // Use auto-fixed config if validation corrected it
    const effectiveConfig = validation.fixedConfig || config;

    if (widget.type === "table") {
      return (
        <TableWidget
          data={data as Record<string, unknown>[]}
          columns={effectiveConfig?.y_fields}
        />
      );
    }

    return (
      <ChartWidget
        type={widget.type as ChartType}
        data={data as Record<string, unknown>[]}
        chartConfig={effectiveConfig}
        onChartClick={onChartClick}
      />
    );
  }

  switch (widget.type) {
    case "kpi": {
      const kpiData = data as Record<string, unknown>[];
      if (!kpiData || kpiData.length === 0) {
        return <EmptyData />;
      }
      const firstRow = kpiData[0];
      const valueField = config?.y_fields?.[0];
      const value = firstRow ? Number(firstRow[valueField] ?? 0) : 0;
      const label =
        config?.x_field && firstRow
          ? String(firstRow[config.x_field] ?? valueField)
          : valueField ?? widget.title ?? "Metric";

      return (
        <KPIWidget
          value={value}
          title={label}
          subtitle={widget.prompt_used ?? undefined}
          prefix={config?.prefix as string | undefined}
          suffix={config?.suffix as string | undefined}
        />
      );
    }

    case "text":
      return (
        <TextWidget
          content={(config?.content as string) ?? widget.prompt_used ?? ""}
          onChange={onTextChange}
          readOnly={!onTextChange}
        />
      );

    case "filter": {
      const filterType: FilterType =
        (config?.filter_type as FilterType) ?? "select";
      const options = (config?.options as string[]) ?? [];
      const filterValue =
        (config?.current_value as string | { start: string; end: string }) ??
        "";
      return (
        <FilterWidget
          type={filterType}
          options={options}
          value={filterValue}
          onChange={onFilterChange ?? (() => {})}
          label={widget.title ?? config?.x_field ?? undefined}
          placeholder={config?.placeholder as string | undefined}
        />
      );
    }

    default:
      // Instead of "Unsupported widget type", try to render as a table
      // if there's data available
      if (data && (data as Record<string, unknown>[]).length > 0) {
        return (
          <TableWidget
            data={data as Record<string, unknown>[]}
            columns={config?.y_fields}
          />
        );
      }
      return (
        <DataError
          message={
            ALL_KNOWN_TYPES.has(widget.type)
              ? "No matching data found for this query"
              : `Unable to render widget. Try changing the chart type.`
          }
        />
      );
  }
}
