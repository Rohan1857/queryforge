import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import { Plus } from "lucide-react";
import { clsx } from "clsx";
import {
  CANVAS_COLS,
  CANVAS_MARGIN,
  getCanvasPreset,
  getCanvasRowHeight,
  getCanvasScaledSize,
  getCanvasSectionCount,
  getCanvasSectionTop,
  getCanvasStageHeight,
} from "@/lib/dashboardCanvas";
import { buildOrderedLayout } from "@/lib/widgetConfig";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { DashboardCanvasSettings, LayoutItem } from "@/types/dashboard";
import { WidgetWrapper } from "./WidgetWrapper";
import type { EditorTab } from "./WidgetCardToolbar";

interface Props {
  dashboardId: string;
  canvasSettings: DashboardCanvasSettings;
  selectedWidgetId: string | null;
  onSelectWidget: (widgetId: string) => void;
  onOpenWidgetTab: (widgetId: string, tab: EditorTab) => void;
  onPromptFocus: () => void;
  onLayoutCommitted: (previousLayout: LayoutItem[], nextLayout: LayoutItem[]) => void;
  canvasRef: RefObject<HTMLDivElement>;
}

function toLayoutItems(layout: Layout[]): LayoutItem[] {
  return buildOrderedLayout(
    layout.map((item) => ({
      id: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })),
  );
}

function areLayoutItemsEqual(a: LayoutItem[], b: LayoutItem[]): boolean {
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

export function DashboardCanvas({
  dashboardId,
  canvasSettings,
  selectedWidgetId,
  onSelectWidget,
  onOpenWidgetTab,
  onPromptFocus,
  onLayoutCommitted,
  canvasRef,
}: Props) {
  const { widgets, updateLayout } = useDashboardStore();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedLayoutRef = useRef<LayoutItem[]>([]);
  const preset = useMemo(() => getCanvasPreset(canvasSettings.preset_id), [canvasSettings.preset_id]);
  const rowHeight = useMemo(() => getCanvasRowHeight(preset), [preset]);

  const layouts = useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.layout_position.x,
        y: widget.layout_position.y,
        w: widget.layout_position.w,
        h: widget.layout_position.h,
        minW: widget.layout_position.min_w ?? 2,
        minH: widget.layout_position.min_h ?? 2,
      })),
    [widgets],
  );

  const layoutItems = useMemo(() => toLayoutItems(layouts), [layouts]);
  const maxWidgetRow = useMemo(
    () =>
      Math.max(
        preset.gridRows,
        ...widgets.map((widget) => widget.layout_position.y + widget.layout_position.h),
      ),
    [preset.gridRows, widgets],
  );
  const sectionCount = useMemo(
    () => getCanvasSectionCount(maxWidgetRow, preset),
    [maxWidgetRow, preset],
  );
  const stageHeight = useMemo(
    () => getCanvasStageHeight(sectionCount, preset),
    [preset, sectionCount],
  );
  const scaledCanvas = useMemo(
    () => getCanvasScaledSize(preset.width, stageHeight, canvasSettings.zoom),
    [canvasSettings.zoom, preset.width, stageHeight],
  );

  useEffect(() => {
    committedLayoutRef.current = layoutItems;
  }, [layoutItems]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void updateLayout(dashboardId, toLayoutItems(layout));
      }, 220);
    },
    [dashboardId, updateLayout],
  );

  const handleLayoutCommit = useCallback(
    (layout: Layout[]) => {
      const nextItems = toLayoutItems(layout);
      const previousItems = committedLayoutRef.current;
      if (areLayoutItemsEqual(previousItems, nextItems)) {
        return;
      }

      committedLayoutRef.current = nextItems;
      onLayoutCommitted(previousItems, nextItems);
    },
    [onLayoutCommitted],
  );

  if (widgets.length === 0) {
    return (
      <div className="flex-1 overflow-auto bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto flex min-h-full min-w-fit items-start justify-center">
          <div style={{ width: scaledCanvas.width, height: scaledCanvas.height }}>
            <div
              style={{
                width: preset.width,
                height: stageHeight,
                transform: `scale(${canvasSettings.zoom})`,
                transformOrigin: "top left",
              }}
            >
              <div
                ref={canvasRef}
                data-dashboard-canvas
                className="relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                style={{
                  width: preset.width,
                  height: stageHeight,
                }}
              >
                <div
                  className={clsx(
                    "absolute inset-0 opacity-40 dark:opacity-20",
                    canvasSettings.show_grid && "dot-grid-bg",
                  )}
                />
                <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <Plus size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Empty Dashboard Canvas
                  </h3>
                  <p className="mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
                    Run natural-language queries below to synthesize cards. Position, resize, and inspect telemetry with full snap-to-grid governance.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {["Show monthly revenue", "Top 10 customers", "Sales by region"].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={onPromptFocus}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                      >
                        <span>&gt;</span>
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto flex min-h-full min-w-fit items-start justify-center">
        <div style={{ width: scaledCanvas.width, height: scaledCanvas.height }}>
          <div
            style={{
              width: preset.width,
              height: stageHeight,
              transform: `scale(${canvasSettings.zoom})`,
              transformOrigin: "top left",
            }}
          >
            <div
              ref={canvasRef}
              data-dashboard-canvas
              className="relative rounded-lg bg-transparent"
              style={{
                width: preset.width,
                height: stageHeight,
              }}
            >
              {Array.from({ length: sectionCount }, (_, index) => (
                <div
                  key={`section-${index + 1}`}
                  data-dashboard-section={index + 1}
                  className="pointer-events-none absolute inset-x-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  style={{
                    top: getCanvasSectionTop(index, preset),
                    height: preset.height,
                  }}
                >
                  <div className="absolute left-4 top-4 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    SECTION {index + 1}
                  </div>
                </div>
              ))}

              <div
                className={clsx(
                  "pointer-events-none absolute inset-0 rounded-lg opacity-40 dark:opacity-20",
                  canvasSettings.show_grid && "dot-grid-bg",
                )}
              />

              <GridLayout
                className="layout"
                layout={layouts}
                cols={CANVAS_COLS}
                width={preset.width}
                rowHeight={rowHeight}
                margin={CANVAS_MARGIN}
                containerPadding={CANVAS_MARGIN}
                compactType={null}
                preventCollision={false}
                draggableHandle=".drag-handle"
                draggableCancel="button,input,textarea,select,option,[contenteditable='true']"
                resizeHandles={["n", "s", "e", "w", "ne", "nw", "se", "sw"]}
                onLayoutChange={handleLayoutChange}
                onDragStop={handleLayoutCommit}
                onResizeStop={handleLayoutCommit}
              >
                {widgets.map((widget) => (
                  <div key={widget.id}>
                    <WidgetWrapper
                      widget={widget}
                      isSelected={selectedWidgetId === widget.id}
                      onSelect={onSelectWidget}
                      onOpenTab={(tab) => onOpenWidgetTab(widget.id, tab)}
                    />
                  </div>
                ))}
              </GridLayout>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
