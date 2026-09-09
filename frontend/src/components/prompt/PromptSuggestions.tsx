import { useEffect } from "react";
import { Sparkles, TrendingUp, Trophy, BarChart3, Database } from "lucide-react";
import { usePromptStore } from "@/stores/promptStore";

const categoryIcons: Record<string, typeof Sparkles> = {
  Trends: TrendingUp,
  Rankings: Trophy,
  Metrics: BarChart3,
  Data: Database,
};

function categorize(suggestion: string): string {
  const lower = suggestion.toLowerCase();
  if (lower.includes("trend") || lower.includes("over time") || lower.includes("growth"))
    return "Trends";
  if (lower.includes("top") || lower.includes("best") || lower.includes("rank"))
    return "Rankings";
  if (lower.includes("total") || lower.includes("average") || lower.includes("count"))
    return "Metrics";
  return "Data";
}

interface Props {
  connectionId?: string;
  onSelect: (prompt: string) => void;
}

export function PromptSuggestions({ connectionId, onSelect }: Props) {
  const { suggestions, fetchSuggestions } = usePromptStore();

  useEffect(() => {
    fetchSuggestions(connectionId || undefined);
  }, [connectionId, fetchSuggestions]);

  if (suggestions.length === 0) return null;

  const grouped: Record<string, string[]> = {};
  for (const s of suggestions) {
    const cat = categorize(s);
    (grouped[cat] ??= []).push(s);
  }

  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
        <Sparkles size={14} />
        Suggestions
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, items]) => {
          const Icon = categoryIcons[category] || Sparkles;
          return (
            <div key={category}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Icon size={12} />
                {category}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <button
                    key={item}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(item);
                    }}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
