import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Paintbrush2,
  Pencil,
  RefreshCw,
  Sigma,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";
import { useWidgetSummary } from "@/hooks/useWidgetSummary";
import { useDashboardStore } from "@/stores/dashboardStore";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { InlineEditableText } from "./InlineEditableText";
import { WidgetSummaryStrip } from "./WidgetSummaryStrip";
import {
  CARD_CHART_TYPE_OPTIONS,
  CARD_RESIZE_OPTIONS,
  type EditorTab,
} from "./WidgetCardToolbar";
import {
  buildChartTypeUpdate,
  createChartConfig,
  getCardDescription,
  getShowSummaryMetrics,
  getWidgetMetricConfig,
  getWidgetStyleConfig,
  normalizeWidgetType,
} from "@/lib/widgetConfig";
import { getCardContainerStyle, getWidgetTextStyle } from "@/lib/widgetStyles";
import type { Widget } from "@/types/widget";

interface Props {
  widget: Widget;
  isSelected: boolean;
  onSelect: (widgetId: string) => void;
  onOpenTab: (tab: EditorTab) => void;
}

interface ContextMenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

const MENU_WIDTH = 300;
const MENU_MIN_WIDTH = 140;
const MENU_EDGE_PADDING = 12;
const MENU_HEADER_OFFSET = 10;

function MenuSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  destructive = false,
  trailing,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
        destructive
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={14} />
        <span className="truncate">{label}</span>
      </span>
      {trailing}
    </button>
  );
}

function resolveContextMenuPosition(
  cardRect: DOMRect,
  headerRect: DOMRect,
  menuRect: DOMRect,
): ContextMenuPosition {
  const viewportMaxWidth = window.innerWidth - MENU_EDGE_PADDING * 2;
  const cardInnerWidth = cardRect.width - MENU_EDGE_PADDING * 2;
  const width =
    cardInnerWidth >= MENU_MIN_WIDTH
      ? Math.min(MENU_WIDTH, viewportMaxWidth, cardInnerWidth)
      : Math.min(viewportMaxWidth, Math.max(120, cardRect.width - 16));

  const desiredLeft = headerRect.left + headerRect.width / 2 - width / 2;
  const minLeft = Math.max(MENU_EDGE_PADDING, cardRect.left + MENU_EDGE_PADDING);
  const maxLeft = Math.min(
    window.innerWidth - width - MENU_EDGE_PADDING,
    cardRect.right - width - MENU_EDGE_PADDING,
  );
  const left =
    maxLeft >= minLeft
      ? Math.min(Math.max(desiredLeft, minLeft), maxLeft)
      : Math.min(
          Math.max(desiredLeft, MENU_EDGE_PADDING),
          window.innerWidth - width - MENU_EDGE_PADDING,
        );

  const desiredTop = headerRect.bottom + MENU_HEADER_OFFSET;
  const minTop = Math.max(MENU_EDGE_PADDING, cardRect.top + MENU_EDGE_PADDING);
  const maxBottom = Math.min(
    window.innerHeight - MENU_EDGE_PADDING,
    cardRect.bottom - MENU_EDGE_PADDING,
  );
  const nextTop =
    desiredTop + menuRect.height > maxBottom
      ? Math.max(minTop, maxBottom - menuRect.height)
      : desiredTop;

  return {
    left,
    top: Math.max(minTop, nextTop),
    width,
    maxHeight: Math.max(0, maxBottom - Math.max(minTop, nextTop)),
  };
}

export function WidgetWrapper({ widget, isSelected, onSelect, onOpenTab }: Props) {
  const { duplicateWidget, refreshWidget, removeWidget, updateWidget } = useDashboardStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition>({
    left: 0,
    top: 0,
    width: MENU_WIDTH,
    maxHeight: 360,
  });
  const [sqlEditorOpen, setSqlEditorOpen] = useState(false);
  const [sqlDraft, setSqlDraft] = useState("");
  const [paramsDraft, setParamsDraft] = useState("[]");
  const [isSavingSql, setIsSavingSql] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const summary = useWidgetSummary(widget);
  const metricConfig = useMemo(() => getWidgetMetricConfig(widget), [widget]);
  const styleConfig = useMemo(() => getWidgetStyleConfig(widget), [widget]);
  const cardStyle = useMemo(
    () => getCardContainerStyle(styleConfig, isHovered || isSelected),
    [isHovered, isSelected, styleConfig],
  );
  const textStyle = useMemo(() => getWidgetTextStyle(styleConfig), [styleConfig]);
  const cardDescription = getCardDescription(widget);
  const showSummary = getShowSummaryMetrics(widget);
  const normalizedWidgetType = normalizeWidgetType(widget.type);

  useEffect(() => {
    setSqlDraft(String(widget.query_config?.sql || ""));
    setParamsDraft(JSON.stringify(widget.query_config?.params || [], null, 2));
  }, [widget.id, widget.query_config]);

  const closeContextMenu = useCallback(() => {
    setIsContextMenuOpen(false);
  }, []);

  const positionContextMenu = useCallback(() => {
    if (!cardRef.current || !headerRef.current || !contextMenuRef.current) {
      return;
    }

    const nextPosition = resolveContextMenuPosition(
      cardRef.current.getBoundingClientRect(),
      headerRef.current.getBoundingClientRect(),
      contextMenuRef.current.getBoundingClientRect(),
    );

    setContextMenuPosition((current) =>
      current.left === nextPosition.left &&
      current.top === nextPosition.top &&
      current.width === nextPosition.width &&
      current.maxHeight === nextPosition.maxHeight
        ? current
        : nextPosition,
    );
  }, []);

  useLayoutEffect(() => {
    if (!isContextMenuOpen) return undefined;

    const frameId = window.requestAnimationFrame(positionContextMenu);
    const handleViewportChange = () => positionContextMenu();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isContextMenuOpen, positionContextMenu]);

  useEffect(() => {
    if (!isContextMenuOpen) return undefined;

    const handleWindowClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (contextMenuRef.current?.contains(target) || cardRef.current?.contains(target)) {
        return;
      }

      closeContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("mousedown", handleWindowClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleWindowClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeContextMenu, isContextMenuOpen]);

  const commitUpdate = async (updater: () => Promise<void>, errorMessage: string) => {
    try {
      await updater();
    } catch {
      toast("error", errorMessage);
    }
  };

  const openContextMenu = () => {
    onSelect(widget.id);
    setIsContextMenuOpen(true);
  };

  const handleChartTypeChange = async (nextType: string) => {
    closeContextMenu();
    onSelect(widget.id);
    await commitUpdate(
      () => updateWidget(widget.id, buildChartTypeUpdate(widget, nextType)),
      "Failed to change chart type",
    );
  };

  const handleToggleSummaryMetrics = async () => {
    closeContextMenu();
    onSelect(widget.id);
    await commitUpdate(
      () =>
        updateWidget(widget.id, {
          chart_config: createChartConfig(widget, {
            showSummaryMetrics: !showSummary,
            metric_config: {
              ...metricConfig,
              show_in_header: !showSummary,
            },
          }),
        }),
      "Failed to update summary metrics visibility",
    );
  };

  const handleDuplicate = async () => {
    closeContextMenu();
    onSelect(widget.id);
    await commitUpdate(
      async () => {
        const duplicated = await duplicateWidget(widget.id);
        onSelect(duplicated.id);
      },
      "Failed to duplicate widget",
    );
  };

  const handleDelete = async () => {
    closeContextMenu();
    onSelect(widget.id);
    if (!window.confirm("Delete this card?")) return;

    await commitUpdate(() => removeWidget(widget.id), "Failed to delete widget");
  };

  const handleRefresh = async () => {
    closeContextMenu();
    setIsRefreshing(true);
    await commitUpdate(() => refreshWidget(widget.id), "Refresh failed");
    setIsRefreshing(false);
  };

  const handleDownloadCsv = () => {
    closeContextMenu();
    const rows = widget.data || widget.cached_data || [];
    if (rows.length === 0) {
      toast("info", "No rows available to export");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${widget.title || "widget"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResize = async (dimensions: { w: number; h: number }) => {
    closeContextMenu();
    await commitUpdate(
      () =>
        updateWidget(widget.id, {
          layout_position: dimensions,
        }),
      "Failed to resize card",
    );
  };

  const handleExportCardImage = async () => {
    closeContextMenu();
    if (!cardRef.current) return;

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${(widget.title || "widget").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.click();
    } catch {
      toast("error", "Failed to export chart image");
    }
  };

  const handleSaveSql = async () => {
    if (!widget.connection_id) {
      toast("error", "This card does not have a data connection");
      return;
    }

    let parsedParams: unknown[];
    try {
      const parsed = JSON.parse(paramsDraft || "[]");
      parsedParams = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      toast("error", "SQL params must be valid JSON");
      return;
    }

    setIsSavingSql(true);
    try {
      await updateWidget(widget.id, {
        query_config: {
          ...(widget.query_config || {}),
          sql: sqlDraft,
          params: parsedParams,
        },
      });
      setSqlEditorOpen(false);
      toast("success", "SQL query updated");
    } catch {
      toast("error", "Failed to update SQL query");
    } finally {
      setIsSavingSql(false);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        onClick={() => onSelect(widget.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openContextMenu();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          "group relative flex h-full min-h-0 flex-col overflow-hidden border",
          isSelected && "ring-2 ring-blue-500/30",
        )}
        style={cardStyle}
      >
        <div
          ref={headerRef}
          className="drag-handle flex items-start justify-between gap-4 border-b border-black/5"
          style={{
            padding: styleConfig.padding,
          }}
        >
          <div className="min-w-0 flex-1 cursor-grab space-y-2 active:cursor-grabbing">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              <GripVertical size={12} />
              Card
            </div>

            <div style={textStyle}>
              <InlineEditableText
                value={widget.title || ""}
                placeholder="Untitled card"
                className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                onSave={(value) =>
                  commitUpdate(
                    () => updateWidget(widget.id, { title: value.trim() || "Untitled" }),
                    "Failed to update card title",
                  )
                }
              />
            </div>

            <div style={textStyle}>
              <InlineEditableText
                value={cardDescription}
                placeholder="Add a card description"
                multiline
                className="text-xs text-gray-500 dark:text-gray-400"
                inputClassName="text-xs"
                onSave={(value) =>
                  commitUpdate(
                    () =>
                      updateWidget(widget.id, {
                        chart_config: createChartConfig(widget, {
                          card_description: value,
                        }),
                      }),
                    "Failed to update card description",
                  )
                }
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isRefreshing && <Loader2 size={14} className="animate-spin text-blue-500" />}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openContextMenu();
              }}
              className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 opacity-100 shadow-sm transition hover:border-slate-300 hover:text-slate-900 md:opacity-0 md:group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
              title="Open card menu"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {showSummary && summary && summary.headerMetrics.length > 0 && (
          <div
            className="border-b border-black/5"
            style={{
              paddingLeft: styleConfig.padding,
              paddingRight: styleConfig.padding,
              paddingBottom: styleConfig.spacing,
            }}
          >
            <WidgetSummaryStrip metrics={summary.headerMetrics} compact />
          </div>
        )}

        <div
          className="min-h-0 flex-1 overflow-hidden"
          style={{
            padding: styleConfig.padding,
          }}
        >
          <div className="h-full min-h-0 overflow-hidden rounded-2xl bg-white/10 dark:bg-black/10">
            <WidgetRenderer widget={widget} />
          </div>
        </div>
      </div>

      {isContextMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="fixed z-[80] overflow-y-auto rounded-[22px] border border-slate-200 bg-white/98 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur dark:border-slate-700 dark:bg-slate-950/98"
            style={{
              left: contextMenuPosition.left,
              top: contextMenuPosition.top,
              width: contextMenuPosition.width,
              maxHeight: contextMenuPosition.maxHeight,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <MenuSectionLabel>Edit</MenuSectionLabel>
            <MenuAction
              icon={Pencil}
              label="Edit chart"
              onClick={() => {
                closeContextMenu();
                onSelect(widget.id);
                onOpenTab("chart_settings");
              }}
            />
            <MenuAction
              icon={Paintbrush2}
              label="Edit style"
              onClick={() => {
                closeContextMenu();
                onSelect(widget.id);
                onOpenTab("style_editor");
              }}
            />
            <MenuAction
              icon={Sigma}
              label="Edit summary"
              onClick={() => {
                closeContextMenu();
                onSelect(widget.id);
                onOpenTab("mathematical_summary");
              }}
            />
            <MenuAction
              icon={Sigma}
              label="Show Summary Metrics"
              onClick={() => void handleToggleSummaryMetrics()}
              trailing={
                showSummary ? (
                  <Check size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
                ) : null
              }
            />
            <MenuAction
              icon={FileCode2}
              label="Edit SQL query"
              onClick={() => {
                closeContextMenu();
                setSqlEditorOpen(true);
              }}
            />

            <MenuSectionLabel>Chart Type</MenuSectionLabel>
            <div className="grid grid-cols-2 gap-1 px-1">
              {CARD_CHART_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void handleChartTypeChange(option.value)}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition",
                    option.value === normalizedWidgetType
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <option.icon size={14} />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>

            <MenuSectionLabel>Resize Card</MenuSectionLabel>
            <div className="grid grid-cols-2 gap-1 px-1">
              {CARD_RESIZE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => void handleResize(option.value)}
                  className="rounded-xl px-3 py-2 text-left text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="ml-2 text-slate-400">
                    {option.value.w}x{option.value.h}
                  </span>
                </button>
              ))}
            </div>

            <MenuSectionLabel>Actions</MenuSectionLabel>
            <MenuAction icon={Copy} label="Duplicate card" onClick={() => void handleDuplicate()} />
            <MenuAction icon={RefreshCw} label="Refresh data" onClick={() => void handleRefresh()} />
            <MenuAction icon={Download} label="Export chart image" onClick={() => void handleExportCardImage()} />
            <MenuAction icon={Download} label="Export data" onClick={handleDownloadCsv} />
            <MenuAction
              icon={Trash2}
              label="Delete card"
              destructive
              onClick={() => void handleDelete()}
            />
          </div>,
          document.body,
        )}

      <Modal open={sqlEditorOpen} onClose={() => setSqlEditorOpen(false)} title="Edit SQL query">
        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              SQL
            </span>
            <textarea
              rows={10}
              value={sqlDraft}
              onChange={(event) => setSqlDraft(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="SELECT ..."
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Params JSON
            </span>
            <textarea
              rows={4}
              value={paramsDraft}
              onChange={(event) => setParamsDraft(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="[]"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSqlEditorOpen(false)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSql()}
              disabled={isSavingSql}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {isSavingSql ? <Loader2 size={15} className="animate-spin" /> : <FileCode2 size={15} />}
              Save SQL
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
