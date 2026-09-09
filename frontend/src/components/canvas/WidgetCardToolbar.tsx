import { CHART_TYPE_OPTIONS } from "@/lib/widgetConfig";

export type EditorTab = "chart_settings" | "mathematical_summary" | "style_editor";

export const CARD_CHART_TYPE_OPTIONS = CHART_TYPE_OPTIONS.filter((option) =>
  [
    "bar",
    "line",
    "area",
    "pie",
    "donut",
    "scatter",
    "heatmap",
    "stacked_bar",
    "kpi",
    "table",
    "radar",
    "histogram",
  ].includes(option.value),
);

export const CARD_RESIZE_OPTIONS = [
  { label: "Small", value: { w: 6, h: 4 } },
  { label: "Medium", value: { w: 8, h: 5 } },
  { label: "Large", value: { w: 12, h: 6 } },
  { label: "Hero", value: { w: 16, h: 7 } },
] as const;
