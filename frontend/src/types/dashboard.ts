import type { Widget } from "./widget";

export interface Dashboard {
  id: string;
  title: string;
  description?: string;
  layout: Record<string, unknown>;
  settings: DashboardSettings;
  is_public: boolean;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardDetail extends Dashboard {
  widgets: Widget[];
}

export interface DashboardCreate {
  title: string;
  description?: string;
}

export type CanvasPresetId =
  | "presentation_16_9"
  | "classic_4_3"
  | "square_1_1"
  | "ultrawide_21_9"
  | "laptop_3_2"
  | "mobile_9_16"
  | "a4_landscape"
  | "a4_portrait";

export interface DashboardCanvasSettings {
  preset_id: CanvasPresetId;
  zoom: number;
  show_grid: boolean;
}

export interface DashboardSettings extends Record<string, unknown> {
  canvas?: DashboardCanvasSettings;
}

export interface DashboardUpdate {
  title?: string;
  description?: string;
  settings?: DashboardSettings;
}

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  position?: number;
}
