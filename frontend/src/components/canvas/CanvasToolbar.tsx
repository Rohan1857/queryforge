import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Grid3X3,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Save,
  Share2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { clsx } from "clsx";
import type { CanvasPresetId, DashboardCanvasSettings } from "@/types/dashboard";
import { CANVAS_PRESETS } from "@/lib/dashboardCanvas";
import type { DashboardExportFormat } from "@/lib/dashboardExport";

interface Props {
  title: string;
  titleDraft: string;
  canvasSettings: DashboardCanvasSettings;
  isSaving: boolean;
  isSharing: boolean;
  isExporting: boolean;
  hasUnsavedChanges: boolean;
  isEditorCollapsed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTitleDraftChange: (value: string) => void;
  onSave: () => void;
  onShare: () => void;
  onExport: (format: DashboardExportFormat) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  onPresetChange: (presetId: CanvasPresetId) => void;
  onZoomChange: (nextZoom: number) => void;
  onToggleEditorPanel: () => void;
}

const EXPORT_OPTIONS: Array<{ format: DashboardExportFormat; label: string }> = [
  { format: "pdf", label: "PDF report" },
  { format: "pptx", label: "PowerPoint (.pptx)" },
  { format: "png", label: "PNG image" },
  { format: "html", label: "Standalone HTML" },
];

function IconButton({
  onClick,
  title,
  disabled = false,
  active = false,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
        active
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function CanvasToolbar({
  title,
  titleDraft,
  canvasSettings,
  isSaving,
  isSharing,
  isExporting,
  hasUnsavedChanges,
  isEditorCollapsed,
  canUndo,
  canRedo,
  onTitleDraftChange,
  onSave,
  onShare,
  onExport,
  onUndo,
  onRedo,
  onToggleGrid,
  onPresetChange,
  onZoomChange,
  onToggleEditorPanel,
}: Props) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;

    const handleWindowClick = (event: MouseEvent) => {
      if (exportMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setExportMenuOpen(false);
    };

    window.addEventListener("mousedown", handleWindowClick);
    return () => window.removeEventListener("mousedown", handleWindowClick);
  }, [exportMenuOpen]);

  return (
    <div className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Dashboard Studio
              </p>
              <input
                value={titleDraft}
                onChange={(event) => onTitleDraftChange(event.target.value)}
                className="mt-1 w-full max-w-2xl border-none bg-transparent px-0 text-2xl font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-50 dark:placeholder:text-slate-500"
                placeholder="Untitled dashboard"
              />
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {hasUnsavedChanges ? "Unsaved dashboard settings" : `Editing ${title || "dashboard"}`}
              </p>
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : hasUnsavedChanges ? <Save size={16} /> : <Check size={16} />}
              {hasUnsavedChanges ? "Save dashboard" : "Saved"}
            </button>

            <button
              type="button"
              onClick={onShare}
              disabled={isSharing}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-slate-50"
            >
              {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Share dashboard
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Canvas
            </span>
            <select
              value={canvasSettings.preset_id}
              onChange={(event) => onPresetChange(event.target.value as CanvasPresetId)}
              className="border-none bg-transparent pr-8 text-sm font-medium text-slate-700 outline-none focus:ring-0 dark:text-slate-100"
            >
              {CANVAS_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-950">
            <IconButton
              onClick={() => onZoomChange(canvasSettings.zoom - 0.1)}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </IconButton>
            <button
              type="button"
              onClick={() => onZoomChange(0.9)}
              className="min-w-[68px] rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {Math.round(canvasSettings.zoom * 100)}%
            </button>
            <IconButton
              onClick={() => onZoomChange(canvasSettings.zoom + 0.1)}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </IconButton>
          </div>

          <IconButton
            onClick={onToggleGrid}
            title="Toggle canvas grid"
            active={canvasSettings.show_grid}
          >
            <Grid3X3 size={16} />
          </IconButton>

          <IconButton
            onClick={onUndo}
            title="Undo"
            disabled={!canUndo}
          >
            <Undo2 size={16} />
          </IconButton>

          <IconButton
            onClick={onRedo}
            title="Redo"
            disabled={!canRedo}
          >
            <Redo2 size={16} />
          </IconButton>

          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-slate-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export
              <ChevronDown size={14} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.format}
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onExport(option.format);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                  >
                    <span>{option.label}</span>
                    <Download size={14} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleEditorPanel}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-slate-50"
          >
            {isEditorCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            {isEditorCollapsed ? "Show panel" : "Hide panel"}
          </button>
        </div>
      </div>
    </div>
  );
}
