import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { DashboardCanvas } from "@/components/canvas/DashboardCanvas";
import { WidgetEditorPanel } from "@/components/canvas/WidgetEditorPanel";
import type { EditorTab } from "@/components/canvas/WidgetCardToolbar";
import { PromptBar } from "@/components/prompt/PromptBar";
import { toast } from "@/components/shared/Toast";
import {
  DASHBOARD_PANEL_STORAGE_KEY,
  buildDashboardSettings,
  clampCanvasZoom,
  getCanvasPreset,
  normalizeDashboardCanvasSettings,
} from "@/lib/dashboardCanvas";
import { dashboardApi } from "@/lib/api";
import { exportDashboard, type DashboardExportFormat } from "@/lib/dashboardExport";
import { useConnectionStore } from "@/stores/connectionStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { LayoutItem } from "@/types/dashboard";
import { useWebSocket } from "@/hooks/useWebSocket";

interface HistorySnapshot {
  canvasSettings: ReturnType<typeof normalizeDashboardCanvasSettings>;
  layout: LayoutItem[];
}

function areLayoutsEqual(a: LayoutItem[], b: LayoutItem[]) {
  if (a.length !== b.length) return false;

  return a.every((item, index) => {
    const other = b[index];
    return (
      item.id === other.id &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h &&
      item.position === other.position
    );
  });
}

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { currentDashboard, isLoading, fetchDashboard, widgets, updateDashboard, updateLayout } =
    useDashboardStore();
  const { fetchConnections } = useConnectionStore();
  const [titleDraft, setTitleDraft] = useState("");
  const [canvasSettings, setCanvasSettings] = useState(normalizeDashboardCanvasSettings(undefined));
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("chart_settings");
  const [isEditorCollapsed, setIsEditorCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DASHBOARD_PANEL_STORAGE_KEY) === "true";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);
  const promptRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const initializedDashboardId = useRef<string | null>(null);

  useWebSocket(id);

  useEffect(() => {
    if (id) {
      void fetchDashboard(id);
      void fetchConnections();
    }
  }, [fetchConnections, fetchDashboard, id]);

  useEffect(() => {
    if (!currentDashboard || initializedDashboardId.current === currentDashboard.id) {
      return;
    }

    initializedDashboardId.current = currentDashboard.id;
    setTitleDraft(currentDashboard.title);
    setCanvasSettings(normalizeDashboardCanvasSettings(currentDashboard.settings));
    setHistoryPast([]);
    setHistoryFuture([]);
  }, [currentDashboard]);

  useEffect(() => {
    if (!selectedWidgetId) return;
    if (!widgets.some((widget) => widget.id === selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [selectedWidgetId, widgets]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_PANEL_STORAGE_KEY, String(isEditorCollapsed));
  }, [isEditorCollapsed]);

  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedWidgetId) || null,
    [selectedWidgetId, widgets],
  );

  const currentLayout = useMemo<LayoutItem[]>(
    () =>
      widgets
        .map((widget, index) => ({
          id: widget.id,
          x: widget.layout_position.x,
          y: widget.layout_position.y,
          w: widget.layout_position.w,
          h: widget.layout_position.h,
          position: widget.layout_position.position ?? index,
        }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [widgets],
  );

  const currentSnapshot = useCallback(
    (): HistorySnapshot => ({
      canvasSettings: { ...canvasSettings },
      layout: currentLayout.map((item) => ({ ...item })),
    }),
    [canvasSettings, currentLayout],
  );

  const pushHistory = useCallback((snapshot: HistorySnapshot) => {
    setHistoryPast((previous) => [...previous.slice(-29), snapshot]);
    setHistoryFuture([]);
  }, []);

  const handleCanvasSettingsChange = useCallback(
    (updater: (current: ReturnType<typeof normalizeDashboardCanvasSettings>) => ReturnType<typeof normalizeDashboardCanvasSettings>) => {
      pushHistory(currentSnapshot());
      setCanvasSettings((current) => updater(current));
    },
    [currentSnapshot, pushHistory],
  );

  const handleLayoutCommitted = useCallback(
    (previousLayout: LayoutItem[], nextLayout: LayoutItem[]) => {
      if (areLayoutsEqual(previousLayout, nextLayout)) {
        return;
      }

      pushHistory({
        canvasSettings: { ...canvasSettings },
        layout: previousLayout.map((item) => ({ ...item })),
      });
    },
    [canvasSettings, pushHistory],
  );

  const handleSave = useCallback(async () => {
    if (!id || !currentDashboard) return;
    const nextTitle = titleDraft.trim() || "Untitled dashboard";

    setIsSaving(true);
    try {
      await updateDashboard(id, {
        title: nextTitle,
        settings: buildDashboardSettings(currentDashboard.settings, canvasSettings),
      });
      setTitleDraft(nextTitle);
      toast("success", "Dashboard saved");
    } catch {
      toast("error", "Failed to save dashboard");
    } finally {
      setIsSaving(false);
    }
  }, [canvasSettings, currentDashboard, id, titleDraft, updateDashboard]);

  const handleShare = useCallback(async () => {
    if (!id || !currentDashboard) return;

    setIsSharing(true);
    try {
      let sharePath = currentDashboard.is_public ? `/public/dashboard/${id}` : null;
      if (!sharePath) {
        const shared = await dashboardApi.share(id);
        sharePath = shared.share_url || `/public/dashboard/${id}`;
        await fetchDashboard(id);
      }

      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      toast("success", "Share link copied");
    } catch {
      toast("error", "Failed to share dashboard");
    } finally {
      setIsSharing(false);
    }
  }, [currentDashboard, fetchDashboard, id]);

  const handleExport = useCallback(
    async (format: DashboardExportFormat) => {
      if (!currentDashboard || !canvasRef.current) return;

      const preset = getCanvasPreset(canvasSettings.preset_id);
      const maxRow = Math.max(
        preset.gridRows,
        ...widgets.map((widget) => widget.layout_position.y + widget.layout_position.h),
      );

      setIsExporting(true);
      try {
        await exportDashboard(format, {
          canvasElement: canvasRef.current,
          dashboard: {
            ...currentDashboard,
            title: titleDraft.trim() || currentDashboard.title,
          },
          preset,
          sectionCount: Math.max(1, Math.ceil(maxRow / preset.gridRows)),
        });
        toast("success", "Dashboard export started");
      } catch {
        toast("error", "Dashboard export failed");
      } finally {
        setIsExporting(false);
      }
    },
    [canvasSettings.preset_id, currentDashboard, titleDraft, widgets],
  );

  const applySnapshot = useCallback(
    async (snapshot: HistorySnapshot) => {
      if (!id) return;

      setCanvasSettings(snapshot.canvasSettings);
      if (!areLayoutsEqual(currentLayout, snapshot.layout)) {
        try {
          await updateLayout(id, snapshot.layout);
        } catch {
          toast("error", "Failed to restore dashboard layout");
        }
      }
    },
    [currentLayout, id, updateLayout],
  );

  const handleUndo = useCallback(async () => {
    if (historyPast.length === 0) return;

    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((items) => items.slice(0, -1));
    setHistoryFuture((items) => [currentSnapshot(), ...items]);
    await applySnapshot(previous);
  }, [applySnapshot, currentSnapshot, historyPast]);

  const handleRedo = useCallback(async () => {
    if (historyFuture.length === 0) return;

    const [next, ...rest] = historyFuture;
    setHistoryFuture(rest);
    setHistoryPast((items) => [...items.slice(-29), currentSnapshot()]);
    await applySnapshot(next);
  }, [applySnapshot, currentSnapshot, historyFuture]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      if (isMeta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }

      if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        void handleUndo();
      }

      if (isMeta && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        void handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRedo, handleSave, handleUndo]);

  const normalizedSavedSettings = useMemo(
    () => normalizeDashboardCanvasSettings(currentDashboard?.settings),
    [currentDashboard?.settings],
  );
  const hasUnsavedChanges =
    titleDraft.trim() !== (currentDashboard?.title || "").trim() ||
    JSON.stringify(canvasSettings) !== JSON.stringify(normalizedSavedSettings);

  if (isLoading || !currentDashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <CanvasToolbar
        title={currentDashboard.title}
        titleDraft={titleDraft}
        canvasSettings={canvasSettings}
        isSaving={isSaving}
        isSharing={isSharing}
        isExporting={isExporting}
        hasUnsavedChanges={hasUnsavedChanges}
        isEditorCollapsed={isEditorCollapsed}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onTitleDraftChange={setTitleDraft}
        onSave={() => void handleSave()}
        onShare={() => void handleShare()}
        onExport={(format) => void handleExport(format)}
        onUndo={() => void handleUndo()}
        onRedo={() => void handleRedo()}
        onToggleGrid={() =>
          handleCanvasSettingsChange((current) => ({
            ...current,
            show_grid: !current.show_grid,
          }))
        }
        onPresetChange={(presetId) =>
          handleCanvasSettingsChange((current) => ({
            ...current,
            preset_id: presetId,
          }))
        }
        onZoomChange={(nextZoom) =>
          handleCanvasSettingsChange((current) => ({
            ...current,
            zoom: clampCanvasZoom(nextZoom),
          }))
        }
        onToggleEditorPanel={() => setIsEditorCollapsed((collapsed) => !collapsed)}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardCanvas
            dashboardId={id!}
            canvasSettings={canvasSettings}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={(widgetId) => {
              setSelectedWidgetId(widgetId);
              setActiveTab("chart_settings");
              setIsEditorCollapsed(false);
            }}
            onOpenWidgetTab={(widgetId, tab) => {
              setSelectedWidgetId(widgetId);
              setActiveTab(tab);
              setIsEditorCollapsed(false);
            }}
            onPromptFocus={() => promptRef.current?.querySelector("input")?.focus()}
            onLayoutCommitted={handleLayoutCommitted}
            canvasRef={canvasRef}
          />

          <div
            ref={promptRef}
            className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <PromptBar dashboardId={id} />
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            isEditorCollapsed
              ? "w-0 border-l-0 opacity-0"
              : "w-[360px] border-l border-slate-200 opacity-100 dark:border-slate-800"
          }`}
        >
          <WidgetEditorPanel
            widget={selectedWidget}
            activeTab={activeTab}
            onClose={() => setSelectedWidgetId(null)}
            onTabChange={setActiveTab}
          />
        </div>
      </div>
    </div>
  );
}
