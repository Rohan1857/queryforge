import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BarChart3, LineChart, PieChart, Table, Hash } from "lucide-react";
import { clsx } from "clsx";
import { usePromptStore } from "@/stores/promptStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { toast } from "@/components/shared/Toast";
import { PromptSuggestions } from "./PromptSuggestions";
import { PromptHistory } from "./PromptHistory";

const chartIcons: Record<string, typeof BarChart3> = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  table: Table,
  kpi: Hash,
};

interface PromptBarProps {
  dashboardId?: string;
}

export function PromptBar({ dashboardId }: PromptBarProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isProcessing, lastResult, sendPrompt, clearLastResult } = usePromptStore();
  const { fetchDashboard } = useDashboardStore();
  const { connections } = useConnectionStore();

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = async (promptText?: string) => {
    const text = promptText || input.trim();
    if (!text || isProcessing) return;
    setInput(text);
    try {
      await sendPrompt(text, selectedConnection || undefined, dashboardId);
      if (dashboardId) {
        await fetchDashboard(dashboardId);
      }
    } catch {
      toast("error", "Failed to process prompt");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const ChartIcon = lastResult ? (chartIcons[lastResult.widget.type] || BarChart3) : BarChart3;

  return (
    <div className="relative w-full">
      <div
        className={clsx(
          "flex items-center gap-2 rounded-xl border bg-white px-4 py-2 shadow-sm transition-all dark:bg-gray-900",
          focused
            ? "border-blue-500 ring-2 ring-blue-500/20"
            : "border-gray-200 dark:border-gray-800",
        )}
      >
        {connections.length > 0 && (
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="max-w-[140px] rounded-md border-0 bg-gray-100 px-2 py-1 text-xs text-gray-600 focus:outline-none dark:bg-gray-800 dark:text-gray-400"
          >
            <option value="">{dashboardId ? "Use dashboard source" : "Select source"}</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data... (Ctrl+K)"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white"
          disabled={isProcessing}
        />

        <button
          onClick={() => handleSubmit()}
          disabled={isProcessing || !input.trim()}
          className={clsx(
            "rounded-lg p-2 transition-colors",
            isProcessing
              ? "text-blue-500"
              : input.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-300 dark:text-gray-600",
          )}
        >
          {isProcessing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      {/* Suggestions when focused + empty */}
      {focused && !input && !lastResult && (
        <PromptSuggestions
          connectionId={selectedConnection}
          onSelect={(text) => handleSubmit(text)}
        />
      )}

      {/* History dropdown */}
      {focused && !input && !lastResult && (
        <PromptHistory onSelect={(text) => handleSubmit(text)} />
      )}

      {/* Result preview */}
      {lastResult && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <ChartIcon size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {lastResult.widget.title}
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                {lastResult.widget.type} &middot; {lastResult.query_info.row_count} rows &middot;{" "}
                {lastResult.query_info.execution_ms}ms
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {lastResult.explanation}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {dashboardId && (
              <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                Card added to dashboard
              </div>
            )}
            <button
              onClick={clearLastResult}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
