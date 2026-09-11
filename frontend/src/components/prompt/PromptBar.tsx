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
          "flex items-center gap-2 rounded-md border bg-white px-3.5 py-1.5 shadow-sm transition-colors dark:bg-slate-900",
          focused
            ? "border-slate-900 dark:border-slate-200"
            : "border-slate-200 dark:border-slate-800",
        )}
      >
        {connections.length > 0 && (
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="max-w-[140px] rounded border-0 bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 focus:outline-none dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="">{dashboardId ? "Dashboard source" : "Select source"}</option>
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
          className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
          disabled={isProcessing}
        />

        <button
          onClick={() => handleSubmit()}
          disabled={isProcessing || !input.trim()}
          className={clsx(
            "rounded-md p-1.5 transition-colors",
            isProcessing
              ? "text-slate-400"
              : input.trim()
                ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                : "text-slate-300 dark:text-slate-600",
          )}
        >
          {isProcessing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
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
        <div className="mt-2.5 rounded-md border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <ChartIcon size={16} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {lastResult.widget.title}
              </h4>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                {lastResult.widget.type} &middot; <span className="tabular-nums">{lastResult.query_info.row_count}</span> rows &middot;{" "}
                <span className="tabular-nums">{lastResult.query_info.execution_ms}</span>ms
              </p>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                {lastResult.explanation}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {dashboardId && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                Added to dashboard
              </div>
            )}
            <button
              onClick={clearLastResult}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
