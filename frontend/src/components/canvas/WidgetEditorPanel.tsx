import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Paintbrush2, Sigma, X } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/components/shared/Toast";
import { useWidgetSummary } from "@/hooks/useWidgetSummary";
import { useDashboardStore } from "@/stores/dashboardStore";
import { DEFAULT_COLORS } from "@/lib/chartConfig";
import type {
  ChartConfig,
  SummaryMetricId,
  Widget,
  WidgetMetricConfig,
  WidgetStyleConfig,
  WidgetUpdate,
} from "@/types/widget";
import {
  CHART_TYPE_OPTIONS,
  DEFAULT_WIDGET_STYLE,
  buildChartTypeUpdate,
  createChartConfig,
  getWidgetFieldOptions,
  getWidgetMetricConfig,
  getWidgetStyleConfig,
  normalizeWidgetType,
} from "@/lib/widgetConfig";
import type { EditorTab } from "./WidgetCardToolbar";
import { InlineEditableText } from "./InlineEditableText";

interface Props {
  widget: Widget | null;
  activeTab: EditorTab;
  onClose: () => void;
  onTabChange: (tab: EditorTab) => void;
}

const TAB_OPTIONS: Array<{ id: EditorTab; label: string; icon: typeof BarChart3 }> = [
  { id: "chart_settings", label: "Chart", icon: BarChart3 },
  { id: "mathematical_summary", label: "Summary", icon: Sigma },
  { id: "style_editor", label: "Style", icon: Paintbrush2 },
];

const METRIC_OPTIONS: Array<{ value: SummaryMetricId; label: string }> = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "median", label: "Median" },
  { value: "mode", label: "Mode" },
  { value: "minimum", label: "Minimum" },
  { value: "maximum", label: "Maximum" },
  { value: "range", label: "Range" },
  { value: "variance", label: "Variance" },
  { value: "standard_deviation", label: "Std Dev" },
  { value: "percentile", label: "Percentile" },
  { value: "growth_rate", label: "Growth Rate" },
  { value: "moving_average", label: "Moving Avg" },
  { value: "distribution_skew", label: "Skew" },
  { value: "top_values", label: "Top Values" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-gray-950/60">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</span>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string | number;
  type?: "text" | "number" | "url";
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onChange(draft);
          }
        }}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-8 rounded border-0 bg-transparent p-0"
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">{value}</span>
      </div>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-xs text-gray-500 dark:text-gray-400">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function WidgetEditorPanel({ widget, activeTab, onClose, onTabChange }: Props) {
  const { regenerateWidgetAggregation, updateWidget } = useDashboardStore();
  const summary = useWidgetSummary(widget);
  const fieldOptions = useMemo(
    () => (widget ? getWidgetFieldOptions(widget) : { allFields: [], numericFields: [], categoricalFields: [] }),
    [widget],
  );
  const metricConfig = useMemo(
    () => (widget ? getWidgetMetricConfig(widget) : ({} as WidgetMetricConfig)),
    [widget],
  );
  const styleConfig = useMemo(
    () => (widget ? getWidgetStyleConfig(widget) : DEFAULT_WIDGET_STYLE),
    [widget],
  );
  const normalizedType = widget ? normalizeWidgetType(widget.type) : "";
  const paletteSize = useMemo(
    () =>
      widget
        ? Math.max(
            widget.chart_config.y_fields?.length || 0,
            widget.chart_config.colors?.length || 0,
            1,
          )
        : 1,
    [widget],
  );
  const chartColors = useMemo(() => {
    if (!widget) {
      return DEFAULT_COLORS.slice(0, paletteSize);
    }

    return Array.from({ length: paletteSize }, (_, index) => {
      const existing = widget.chart_config.colors?.[index];
      return existing || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    });
  }, [paletteSize, widget]);
  const chartTypeOptions = useMemo(() => {
    if (!widget) return CHART_TYPE_OPTIONS;
    if (CHART_TYPE_OPTIONS.some((option) => option.value === normalizedType)) {
      return CHART_TYPE_OPTIONS;
    }

    const currentLabel =
      normalizedType === "table"
        ? "Data Table"
        : normalizedType === "kpi"
          ? "KPI Card"
          : widget.type;

    return [
      { value: normalizedType, label: currentLabel, icon: BarChart3 },
      ...CHART_TYPE_OPTIONS,
    ];
  }, [normalizedType, widget]);

  const commitUpdate = useCallback(
    async (data: WidgetUpdate) => {
      if (!widget) return;
      try {
        await updateWidget(widget.id, data);
      } catch {
        toast("error", "Failed to save widget changes");
      }
    },
    [updateWidget, widget],
  );

  const commitChartConfig = useCallback(
    async (updates: Partial<ChartConfig>, typeOverride?: string) => {
      if (!widget) return;
      await commitUpdate({
        chart_config: createChartConfig(widget, updates, typeOverride),
      });
    },
    [commitUpdate, widget],
  );

  const commitMetricConfig = useCallback(
    async (updates: Partial<WidgetMetricConfig>) => {
      await commitChartConfig({
        metric_config: {
          ...metricConfig,
          ...updates,
        },
      });
    },
    [commitChartConfig, metricConfig],
  );

  const commitStyle = useCallback(
    async (updates: Partial<WidgetStyleConfig>) => {
      await commitChartConfig({
        style_config: {
          ...styleConfig,
          ...updates,
        },
      });
    },
    [commitChartConfig, styleConfig],
  );

  const handleMetricFieldSave = useCallback(
    async (value: string) => {
      if (!widget) return;
      const nextValue = value.trim();
      if (!fieldOptions.numericFields.includes(nextValue)) {
        toast("error", "Metric field must match a numeric column");
        return;
      }

      await commitChartConfig({
        metric_name: nextValue,
        y_fields: [nextValue],
        metric_config: {
          ...metricConfig,
          field: nextValue,
        },
      });
    },
    [commitChartConfig, fieldOptions.numericFields, metricConfig, widget],
  );

  const handleVisibleMetricToggle = useCallback(
    async (metricId: SummaryMetricId, checked: boolean) => {
      const currentVisible = metricConfig.visible_metrics || [];
      const nextVisible = checked
        ? Array.from(new Set([...currentVisible, metricId]))
        : currentVisible.filter((value) => value !== metricId);

      await commitMetricConfig({ visible_metrics: nextVisible });
    },
    [commitMetricConfig, metricConfig.visible_metrics],
  );

  const handleAggregationChange = useCallback(
    async (value: string) => {
      if (!widget) return;
      const nextAggregation = value as WidgetMetricConfig["aggregation"];
      if (metricConfig.aggregation === nextAggregation) return;

      try {
        await regenerateWidgetAggregation(widget, nextAggregation);
      } catch {
        toast("error", "Failed to rerun the widget query with the new aggregation");
      }
    },
    [metricConfig.aggregation, regenerateWidgetAggregation, widget],
  );

  const handleChartColorChange = useCallback(
    async (index: number, value: string) => {
      const nextColors = chartColors.slice();
      nextColors[index] = value;
      await commitChartConfig({ colors: nextColors });
    },
    [chartColors, commitChartConfig],
  );

  if (!widget) {
    return (
      <aside className="flex h-full w-[360px] shrink-0 border-slate-200 bg-gray-50/80 dark:border-slate-800 dark:bg-gray-950/80">
        <div className="flex h-full min-h-[240px] items-center justify-center p-6 text-center">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Select a card</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Click any dashboard card to edit its chart settings, summary metrics, and style.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col bg-gray-50/80 dark:bg-gray-950/80">
      <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Card Editor
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {widget.title || "Untitled"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {chartTypeOptions.find((option) => option.value === normalizedType)?.label || widget.type}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:hover:bg-gray-900 dark:hover:text-gray-100"
            title="Close editor"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "chart_settings" && (
          <>
            <Section title="Card text" description="Click any field to edit and save on Enter or blur.">
              <div className="space-y-1.5">
                <FieldLabel>Card title</FieldLabel>
                <InlineEditableText
                  value={widget.title || ""}
                  placeholder="Untitled card"
                  onSave={(value) => commitUpdate({ title: value.trim() || "Untitled" })}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Card description</FieldLabel>
                <InlineEditableText
                  value={String(widget.chart_config.card_description || "")}
                  placeholder="Add context for this card"
                  multiline
                  onSave={(value) => commitChartConfig({ card_description: value })}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>X axis label</FieldLabel>
                <InlineEditableText
                  value={String(widget.chart_config.x_axis_label || widget.chart_config.x_field || "")}
                  placeholder="X axis label"
                  onSave={(value) => commitChartConfig({ x_axis_label: value })}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Y axis label</FieldLabel>
                <InlineEditableText
                  value={String(widget.chart_config.y_axis_label || metricConfig.field || "")}
                  placeholder="Y axis label"
                  onSave={(value) => commitChartConfig({ y_axis_label: value })}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Metric name</FieldLabel>
                <InlineEditableText
                  value={String(metricConfig.field || widget.chart_config.metric_name || "")}
                  placeholder="Numeric field name"
                  onSave={handleMetricFieldSave}
                />
              </div>
            </Section>

            <Section title="Chart setup" description="Adjust rendering without rerunning the query.">
              <SelectField
                label="Chart type"
                value={normalizedType}
                options={chartTypeOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                onChange={(value) => commitUpdate(buildChartTypeUpdate(widget, value))}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label="Category field"
                  value={String(widget.chart_config.x_field || fieldOptions.allFields[0] || "")}
                  options={(fieldOptions.allFields.length > 0 ? fieldOptions.allFields : [""]).map((field) => ({
                    label: field || "No fields",
                    value: field,
                  }))}
                  onChange={(value) => commitChartConfig({ x_field: value })}
                />

                <SelectField
                  label="Metric field"
                  value={String(metricConfig.field || widget.chart_config.metric_name || "")}
                  options={(fieldOptions.numericFields.length > 0 ? fieldOptions.numericFields : [""]).map((field) => ({
                    label: field || "No numeric fields",
                    value: field,
                  }))}
                  onChange={(value) => void handleMetricFieldSave(value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Show values"
                  checked={Boolean(widget.chart_config.show_values)}
                  onChange={(value) => commitChartConfig({ show_values: value })}
                />
                <ToggleField
                  label="Show legend"
                  checked={Boolean(widget.chart_config.show_legend ?? true)}
                  onChange={(value) => commitChartConfig({ show_legend: value })}
                />
                <ToggleField
                  label="Show tooltip"
                  checked={Boolean(widget.chart_config.show_tooltip ?? true)}
                  onChange={(value) => commitChartConfig({ show_tooltip: value })}
                />
                <ToggleField
                  label="Show grid"
                  checked={Boolean(widget.chart_config.show_grid ?? true)}
                  onChange={(value) => commitChartConfig({ show_grid: value })}
                />
              </div>

              {(normalizedType === "bar" || normalizedType === "stacked_bar") && (
                <SelectField
                  label="Orientation"
                  value={String(widget.chart_config.orientation || "vertical")}
                  options={[
                    { label: "Vertical", value: "vertical" },
                    { label: "Horizontal", value: "horizontal" },
                  ]}
                  onChange={(value) => commitChartConfig({ orientation: value })}
                />
              )}

              {normalizedType === "histogram" && (
                <RangeField
                  label="Histogram bins"
                  value={Number(widget.chart_config.histogram_bins || 8)}
                  min={3}
                  max={20}
                  onChange={(value) => commitChartConfig({ histogram_bins: value })}
                />
              )}
            </Section>
          </>
        )}

        {activeTab === "mathematical_summary" && (
          <>
            <Section title="Summary controls" description="These metrics are memoized from the widget dataset and metric config.">
              <SelectField
                label="Aggregation"
                value={String(
                  (metricConfig.aggregation as string) === "average"
                    ? "mean"
                    : metricConfig.aggregation || "sum",
                )}
                options={[
                  { label: "Sum", value: "sum" },
                  { label: "Average", value: "mean" },
                  { label: "Median", value: "median" },
                  { label: "Count", value: "count" },
                  { label: "Percentile", value: "percentile" },
                ]}
                onChange={(value) => void handleAggregationChange(value)}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputField
                  label="Percentile"
                  type="number"
                  value={Number(metricConfig.percentile || 90)}
                  onChange={(value) => commitMetricConfig({ percentile: Number(value || 90) })}
                />
                <InputField
                  label="Moving average window"
                  type="number"
                  value={Number(metricConfig.moving_average_window || 3)}
                  onChange={(value) => commitMetricConfig({ moving_average_window: Number(value || 3) })}
                />
                <InputField
                  label="Top values limit"
                  type="number"
                  value={Number(metricConfig.top_values_limit || 3)}
                  onChange={(value) => commitMetricConfig({ top_values_limit: Number(value || 3) })}
                />
              </div>
            </Section>

            <Section title="Header metrics" description="Choose which summary chips stay visible on the card header.">
              <div className="space-y-2">
                {METRIC_OPTIONS.map((metric) => (
                  <ToggleField
                    key={metric.value}
                    label={metric.label}
                    checked={Boolean(metricConfig.visible_metrics?.includes(metric.value))}
                    onChange={(checked) => handleVisibleMetricToggle(metric.value, checked)}
                  />
                ))}
              </div>
            </Section>

            <Section title="Calculated metrics">
              {summary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.values(summary.metrics).map((metric) => (
                      <div
                        key={metric.id}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{metric.label}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{metric.formatted}</p>
                      </div>
                    ))}
                  </div>

                  {summary.topValues.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Top values</p>
                      <div className="mt-2 space-y-2">
                        {summary.topValues.map((item) => (
                          <div key={`${item.label}-${item.value}`} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {item.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No summary is available for this widget yet.</p>
              )}
            </Section>
          </>
        )}

        {activeTab === "style_editor" && (
          <>
            <Section title="Background">
              <SelectField
                label="Background type"
                value={String(styleConfig.background_type || "solid")}
                options={[
                  { label: "Solid color", value: "solid" },
                  { label: "Gradient", value: "gradient" },
                  { label: "Image", value: "image" },
                ]}
                onChange={(value) => commitStyle({ background_type: value as WidgetStyleConfig["background_type"] })}
              />

              {(styleConfig.background_type || "solid") === "solid" && (
                <ColorField
                  label="Background color"
                  value={styleConfig.background_color || "#ffffff"}
                  onChange={(value) => commitStyle({ background_color: value })}
                />
              )}

              {(styleConfig.background_type || "solid") === "gradient" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ColorField
                    label="Gradient from"
                    value={styleConfig.gradient_from || "#eff6ff"}
                    onChange={(value) => commitStyle({ gradient_from: value })}
                  />
                  <ColorField
                    label="Gradient to"
                    value={styleConfig.gradient_to || "#ffffff"}
                    onChange={(value) => commitStyle({ gradient_to: value })}
                  />
                </div>
              )}

              {(styleConfig.background_type || "solid") === "image" && (
                <InputField
                  label="Image URL"
                  type="url"
                  value={styleConfig.background_image || ""}
                  placeholder="https://example.com/background.jpg"
                  onChange={(value) => commitStyle({ background_image: value })}
                />
              )}
            </Section>

            <Section
              title="Chart palette"
              description="Adjust series colors without changing the query or chart structure."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {chartColors.map((color, index) => (
                  <ColorField
                    key={`chart-color-${index}`}
                    label={paletteSize === 1 ? "Series color" : `Series ${index + 1}`}
                    value={color}
                    onChange={(value) => void handleChartColorChange(index, value)}
                  />
                ))}
              </div>
            </Section>

            <Section title="Typography">
              <RangeField
                label="Font size"
                value={Number(styleConfig.font_size || 14)}
                min={11}
                max={28}
                onChange={(value) => commitStyle({ font_size: value })}
              />

              <SelectField
                label="Font weight"
                value={String(styleConfig.font_weight || 600)}
                options={[
                  { label: "400", value: "400" },
                  { label: "500", value: "500" },
                  { label: "600", value: "600" },
                  { label: "700", value: "700" },
                  { label: "800", value: "800" },
                ]}
                onChange={(value) => commitStyle({ font_weight: Number(value) })}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Bold"
                  checked={Boolean(styleConfig.bold)}
                  onChange={(value) => commitStyle({ bold: value })}
                />
                <ToggleField
                  label="Italic"
                  checked={Boolean(styleConfig.italic)}
                  onChange={(value) => commitStyle({ italic: value })}
                />
              </div>
            </Section>

            <Section title="Borders and shadows">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ColorField
                  label="Border color"
                  value={styleConfig.border_color || "#e5e7eb"}
                  onChange={(value) => commitStyle({ border_color: value })}
                />
                <RangeField
                  label="Border width"
                  value={Number(styleConfig.border_width || 1)}
                  min={0}
                  max={8}
                  onChange={(value) => commitStyle({ border_width: value })}
                />
              </div>

              <RangeField
                label="Border radius"
                value={Number(styleConfig.border_radius || 18)}
                min={0}
                max={36}
                onChange={(value) => commitStyle({ border_radius: value })}
              />

              <InputField
                label="Card shadow"
                value={styleConfig.card_shadow || ""}
                onChange={(value) => commitStyle({ card_shadow: value })}
              />

              <InputField
                label="Hover shadow"
                value={styleConfig.hover_shadow || ""}
                onChange={(value) => commitStyle({ hover_shadow: value })}
              />
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}
