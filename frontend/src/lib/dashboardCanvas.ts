import type { CanvasPresetId, DashboardCanvasSettings, DashboardSettings } from "@/types/dashboard";

export interface CanvasPreset {
  id: CanvasPresetId;
  label: string;
  width: number;
  height: number;
  gridRows: number;
  exportFormat?: "wide" | "tall" | "paper_landscape" | "paper_portrait" | "square";
}

export const CANVAS_COLS = 24;
export const CANVAS_MARGIN: [number, number] = [12, 12];
export const CANVAS_SECTION_GAP = 0;
export const MIN_CANVAS_ZOOM = 0.5;
export const MAX_CANVAS_ZOOM = 1.6;
export const DEFAULT_CANVAS_PRESET_ID: CanvasPresetId = "presentation_16_9";
export const DASHBOARD_PANEL_STORAGE_KEY = "queryforge:dashboard-editor-panel-collapsed";

export const CANVAS_PRESETS: CanvasPreset[] = [
  {
    id: "presentation_16_9",
    label: "16:9 Presentation",
    width: 1440,
    height: 810,
    gridRows: 18,
    exportFormat: "wide",
  },
  {
    id: "classic_4_3",
    label: "4:3 Classic",
    width: 1280,
    height: 960,
    gridRows: 20,
    exportFormat: "wide",
  },
  {
    id: "square_1_1",
    label: "1:1 Square",
    width: 1080,
    height: 1080,
    gridRows: 20,
    exportFormat: "square",
  },
  {
    id: "ultrawide_21_9",
    label: "21:9 Ultra Wide",
    width: 1680,
    height: 720,
    gridRows: 16,
    exportFormat: "wide",
  },
  {
    id: "laptop_3_2",
    label: "3:2 Laptop",
    width: 1440,
    height: 960,
    gridRows: 20,
    exportFormat: "wide",
  },
  {
    id: "mobile_9_16",
    label: "9:16 Mobile",
    width: 810,
    height: 1440,
    gridRows: 24,
    exportFormat: "tall",
  },
  {
    id: "a4_landscape",
    label: "A4 Landscape",
    width: 1404,
    height: 993,
    gridRows: 20,
    exportFormat: "paper_landscape",
  },
  {
    id: "a4_portrait",
    label: "A4 Portrait",
    width: 993,
    height: 1404,
    gridRows: 24,
    exportFormat: "paper_portrait",
  },
];

const DEFAULT_CANVAS_SETTINGS: DashboardCanvasSettings = {
  preset_id: DEFAULT_CANVAS_PRESET_ID,
  zoom: 0.9,
  show_grid: false,
};

export function clampCanvasZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CANVAS_SETTINGS.zoom;
  }

  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, Number(value.toFixed(2))));
}

export function getCanvasPreset(presetId: CanvasPresetId | string | undefined): CanvasPreset {
  return (
    CANVAS_PRESETS.find((preset) => preset.id === presetId) ||
    CANVAS_PRESETS.find((preset) => preset.id === DEFAULT_CANVAS_PRESET_ID) ||
    CANVAS_PRESETS[0]
  );
}

export function normalizeDashboardCanvasSettings(
  settings: DashboardSettings | Record<string, unknown> | undefined,
): DashboardCanvasSettings {
  const canvas = settings && typeof settings === "object" ? settings.canvas : undefined;

  return {
    preset_id: getCanvasPreset((canvas as DashboardCanvasSettings | undefined)?.preset_id).id,
    zoom: clampCanvasZoom((canvas as DashboardCanvasSettings | undefined)?.zoom ?? DEFAULT_CANVAS_SETTINGS.zoom),
    show_grid: Boolean((canvas as DashboardCanvasSettings | undefined)?.show_grid ?? DEFAULT_CANVAS_SETTINGS.show_grid),
  };
}

export function buildDashboardSettings(
  currentSettings: DashboardSettings | Record<string, unknown> | undefined,
  canvasSettings: DashboardCanvasSettings,
): DashboardSettings {
  const baseSettings =
    currentSettings && typeof currentSettings === "object" ? { ...currentSettings } : {};

  return {
    ...baseSettings,
    canvas: {
      preset_id: getCanvasPreset(canvasSettings.preset_id).id,
      zoom: clampCanvasZoom(canvasSettings.zoom),
      show_grid: Boolean(canvasSettings.show_grid),
    },
  };
}

export function getCanvasRowHeight(preset: CanvasPreset): number {
  return Math.floor((preset.height - CANVAS_MARGIN[1] * (preset.gridRows - 1)) / preset.gridRows);
}

export function getCanvasSectionCount(
  maxWidgetRow: number,
  preset: CanvasPreset,
): number {
  return Math.max(1, Math.ceil(maxWidgetRow / preset.gridRows));
}

export function getCanvasStageHeight(sectionCount: number, preset: CanvasPreset): number {
  return sectionCount * preset.height + Math.max(0, sectionCount - 1) * CANVAS_SECTION_GAP;
}

export function getCanvasSectionTop(sectionIndex: number, preset: CanvasPreset): number {
  return sectionIndex * (preset.height + CANVAS_SECTION_GAP);
}

export function getCanvasScaledSize(
  width: number,
  height: number,
  zoom: number,
): { width: number; height: number } {
  return {
    width: Math.round(width * zoom),
    height: Math.round(height * zoom),
  };
}
