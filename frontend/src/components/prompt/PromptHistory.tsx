import { BarChart3, LineChart, PieChart, Table, Hash, Clock } from "lucide-react";
import { usePromptStore } from "@/stores/promptStore";

const chartIcons: Record<string, typeof BarChart3> = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  table: Table,
  kpi: Hash,
};

interface Props {
  onSelect: (prompt: string) => void;
}

export function PromptHistory({ onSelect }: Props) {
  const { history } = usePromptStore();

  if (history.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-10 mt-14 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <div className="sticky top-0 border-b border-gray-100 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <Clock size={14} />
          Recent
        </div>
      </div>
      {history.slice(0, 10).map((item, i) => {
        const Icon = chartIcons[item.response.widget.type] || BarChart3;
        return (
          <button
            key={i}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.prompt);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Icon size={16} className="shrink-0 text-gray-400" />
            <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
              {item.prompt}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
