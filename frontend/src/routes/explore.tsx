import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Columns3,
  Search,
  Copy,
  Code,
  Clock,
  Database,
  ChevronUp,
  Download,
  Plus,
  BarChart3,
  TrendingUp,
  Hash,
  List,
  Loader2,
} from "lucide-react";
import { useConnectionStore } from "@/stores/connectionStore";
import { usePromptStore } from "@/stores/promptStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { toast } from "@/components/shared/Toast";
import type { PromptResponse } from "@/types/query";
import type { SchemaMetadata, TableMetadata } from "@/types/connection";

// ── Types ───────────────────────────────────────────────────

interface ExploreResult {
  id: string;
  prompt: string;
  response: PromptResponse;
  connectionId?: string;
  connectionName?: string;
  timestamp: string;
  showSql: boolean;
  viewMode: "chart" | "table";
}

// ── Suggestion categories ────────────────────────────────────

const SUGGESTION_CATEGORIES = [
  { icon: TrendingUp, label: "Trends", color: "text-blue-500" },
  { icon: BarChart3, label: "Rankings", color: "text-green-500" },
  { icon: Hash, label: "Metrics", color: "text-amber-500" },
  { icon: List, label: "Data", color: "text-purple-500" },
];

// ── Component ────────────────────────────────────────────────

export default function ExplorePage() {
  const {
    connections,
    schemas,
    fetchConnections,
    fetchSchema,
  } = useConnectionStore();
  const { sendPrompt, suggestions, fetchSuggestions, isProcessing } =
    usePromptStore();
  const { dashboards, fetchDashboards } = useDashboardStore();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const promptInputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Load connections + dashboards on mount
  useEffect(() => {
    fetchConnections();
    fetchDashboards();
  }, [fetchConnections, fetchDashboards]);

  // Auto-select first connection
  useEffect(() => {
    if (!selectedConnectionId && connections.length > 0) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  // Fetch schema + suggestions when connection changes
  useEffect(() => {
    if (selectedConnectionId) {
      if (!schemas[selectedConnectionId]) {
        fetchSchema(selectedConnectionId);
      }
      fetchSuggestions(selectedConnectionId);
    }
  }, [selectedConnectionId, schemas, fetchSchema, fetchSuggestions]);

  const currentSchema: SchemaMetadata | null =
    selectedConnectionId ? schemas[selectedConnectionId] ?? null : null;

  const selectedConnection = connections.find(
    (c) => c.id === selectedConnectionId,
  );

  // ── Schema filter ────────────────────────────────────────────

  const filteredTables: TableMetadata[] =
    currentSchema?.tables.filter((t) => {
      if (!schemaFilter) return true;
      const q = schemaFilter.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
      );
    }) ?? [];

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Submit prompt ─────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (text?: string) => {
      const prompt = text ?? promptText;
      if (!prompt.trim() || !selectedConnectionId) return;

      try {
        const response = await sendPrompt(prompt, selectedConnectionId);
        const result: ExploreResult = {
          id: crypto.randomUUID(),
          prompt,
          response,
          connectionId: selectedConnectionId,
          connectionName: selectedConnection?.name,
          timestamp: new Date().toISOString(),
          showSql: false,
          viewMode: response.widget.type === "table" ? "table" : "chart",
        };
        setResults((prev) => [...prev, result]);
        setPromptText("");

        // Scroll to bottom after render
        setTimeout(() => {
          resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } catch {
        toast("error", "Failed to process prompt");
      }
    },
    [promptText, selectedConnectionId, selectedConnection, sendPrompt],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Result actions ──────────────────────────────────────────

  const toggleSql = (id: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, showSql: !r.showSql } : r)),
    );
  };

  const toggleViewMode = (id: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, viewMode: r.viewMode === "chart" ? "table" : "chart" }
          : r,
      ),
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("success", "Copied to clipboard");
  };

  const handleAddToDashboard = async (result: ExploreResult, dashboardId: string) => {
    try {
      await sendPrompt(
        result.prompt,
        result.connectionId,
        dashboardId,
      );
      toast("success", "Widget added to dashboard");
    } catch {
      toast("error", "Failed to add widget");
    }
  };

  const handleDownloadCsv = (result: ExploreResult) => {
    const data = result.response.widget.data;
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? "")).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.response.widget.title || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Table click → fill prompt ────────────────────────────────

  const handleTableClick = (tableName: string) => {
    setPromptText(`Show me data from ${tableName}`);
    promptInputRef.current?.focus();
  };

  const handleColumnClick = (tableName: string, columnName: string) => {
    setPromptText((prev) =>
      prev
        ? `${prev}, ${tableName}.${columnName}`
        : `Show me ${columnName} from ${tableName}`,
    );
    promptInputRef.current?.focus();
  };

  // ── Suggestion click → auto-submit ──────────────────────────

  const handleSuggestionClick = (suggestion: string) => {
    setPromptText(suggestion);
    handleSubmit(suggestion);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Top: Prompt Bar */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {/* Connection selector */}
          <select
            value={selectedConnectionId ?? ""}
            onChange={(e) => setSelectedConnectionId(e.target.value || null)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select data source</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>

          {/* Prompt input */}
          <div className="relative flex-1">
            <input
              ref={promptInputRef}
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your data..."
              disabled={isProcessing}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isProcessing || !promptText.trim() || !selectedConnectionId}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 p-1.5 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Middle: Schema Browser + Results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Schema Browser (25%) */}
        <div className="w-1/4 overflow-auto border-r border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/50">
          <div className="p-3">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={schemaFilter}
                onChange={(e) => setSchemaFilter(e.target.value)}
                placeholder="Filter tables..."
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>

            {!currentSchema ? (
              <div className="flex flex-col items-center py-8">
                <Database
                  size={28}
                  className="mb-2 text-gray-300 dark:text-gray-600"
                />
                <p className="text-xs text-gray-400">
                  {selectedConnectionId
                    ? "Loading schema..."
                    : "Select a data source"}
                </p>
              </div>
            ) : filteredTables.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                No tables found
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredTables.map((table) => (
                  <div key={table.name}>
                    <button
                      onClick={() => toggleTable(table.name)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {expandedTables.has(table.name) ? (
                        <ChevronDown size={12} className="shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight size={12} className="shrink-0 text-gray-400" />
                      )}
                      <Table2 size={12} className="shrink-0 text-amber-500" />
                      <span
                        className="cursor-pointer truncate font-mono text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTableClick(table.name);
                        }}
                      >
                        {table.name}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        {table.row_count.toLocaleString()}
                      </span>
                    </button>

                    {expandedTables.has(table.name) && (
                      <div className="ml-5 border-l border-gray-200 pl-2 dark:border-gray-700">
                        {table.columns.map((col) => (
                          <button
                            key={col.name}
                            onClick={() =>
                              handleColumnClick(table.name, col.name)
                            }
                            className="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <Columns3
                              size={10}
                              className="shrink-0 text-gray-400"
                            />
                            <span className="truncate font-mono text-gray-600 dark:text-gray-400">
                              {col.name}
                            </span>
                            <span className="ml-auto rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500 dark:bg-gray-800">
                              {col.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Results Area (75%) */}
        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <BarChart3
                size={48}
                className="mb-4 text-gray-200 dark:text-gray-700"
              />
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Explore your data
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Ask a question or click a table in the schema browser
              </p>
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  dashboards={dashboards}
                  onToggleSql={() => toggleSql(result.id)}
                  onToggleView={() => toggleViewMode(result.id)}
                  onCopy={copyToClipboard}
                  onAddToDashboard={(dashId) =>
                    handleAddToDashboard(result, dashId)
                  }
                  onDownloadCsv={() => handleDownloadCsv(result)}
                />
              ))}
              <div ref={resultsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Suggestions */}
      {suggestions.length > 0 && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="shrink-0 text-xs text-gray-400">Try asking:</span>
              {suggestions.slice(0, 6).map((s, i) => {
                const cat = SUGGESTION_CATEGORIES[i % SUGGESTION_CATEGORIES.length];
                const Icon = cat.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                  >
                    <Icon size={12} className={cat.color} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Result Card ──────────────────────────────────────────────

interface ResultCardProps {
  result: ExploreResult;
  dashboards: { id: string; title: string }[];
  onToggleSql: () => void;
  onToggleView: () => void;
  onCopy: (text: string) => void;
  onAddToDashboard: (dashboardId: string) => void;
  onDownloadCsv: () => void;
}

function ResultCard({
  result,
  dashboards,
  onToggleSql,
  onToggleView,
  onCopy,
  onAddToDashboard,
  onDownloadCsv,
}: ResultCardProps) {
  const { response } = result;
  const widget = response.widget;
  const queryInfo = response.query_info;
  const [showDashboardPicker, setShowDashboardPicker] = useState(false);

  // Build a widget-like object for WidgetRenderer
  const widgetObj = {
    id: result.id,
    dashboard_id: "",
    type: result.viewMode === "table" ? "table" : widget.type,
    title: widget.title,
    prompt_used: widget.prompt_used,
    chart_config: widget.chart_config as import("@/types/widget").ChartConfig,
    layout_position: { x: 0, y: 0, w: 12, h: 6 },
    data: widget.data,
    created_at: result.timestamp,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Prompt text */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {result.prompt}
        </p>
        <button
          onClick={() => onCopy(result.prompt)}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          title="Copy prompt"
        >
          <Copy size={14} />
        </button>
      </div>

      {/* SQL toggle */}
      <button
        onClick={onToggleSql}
        className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
      >
        <Code size={12} />
        <span>SQL Query</span>
        {result.showSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {result.showSql && (
        <div className="border-b border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">
            {queryInfo.sql}
          </pre>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800">
        <span className="flex items-center gap-1">
          <Table2 size={12} />
          {queryInfo.row_count} rows
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {queryInfo.execution_ms}ms
        </span>
        {result.connectionName && (
          <span className="flex items-center gap-1">
            <Database size={12} />
            {result.connectionName}
          </span>
        )}
      </div>

      {/* Visualization */}
      <div className="h-80 p-4">
        <WidgetRenderer widget={widgetObj} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
        {/* Add to Dashboard */}
        <div className="relative">
          <button
            onClick={() => setShowDashboardPicker(!showDashboardPicker)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus size={12} />
            Add to Dashboard
          </button>
          {showDashboardPicker && (
            <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {dashboards.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">
                  No dashboards yet
                </p>
              ) : (
                dashboards.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      onAddToDashboard(d.id);
                      setShowDashboardPicker(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {d.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* View toggle */}
        <button
          onClick={onToggleView}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {result.viewMode === "chart" ? "Show as Table" : "Show as Chart"}
        </button>

        {/* Download CSV */}
        <button
          onClick={onDownloadCsv}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Download size={12} />
          CSV
        </button>

        {/* Explanation */}
        {response.explanation && (
          <p className="ml-auto text-xs text-gray-400">
            {response.explanation}
          </p>
        )}
      </div>
    </div>
  );
}
