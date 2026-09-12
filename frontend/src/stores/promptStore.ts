import { create } from "zustand";
import { promptApi } from "@/lib/api";
import type { PromptResponse } from "@/types/query";

interface PromptHistoryItem {
  prompt: string;
  response: PromptResponse;
  timestamp: string;
}

interface PromptState {
  history: PromptHistoryItem[];
  suggestions: string[];
  isProcessing: boolean;
  lastResult: PromptResponse | null;
  error: string | null;

  sendPrompt: (
    prompt: string,
    connectionId?: string,
    dashboardId?: string,
  ) => Promise<PromptResponse>;
  fetchSuggestions: (connectionId?: string) => Promise<void>;
  clearLastResult: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  history: [],
  suggestions: [],
  isProcessing: false,
  lastResult: null,
  error: null,

  sendPrompt: async (prompt, connectionId, dashboardId) => {
    set({ isProcessing: true, error: null });
    try {
      const response = await promptApi.send({
        prompt,
        connection_id: connectionId,
        dashboard_id: dashboardId,
      });
      set({
        lastResult: response,
        history: [
          { prompt, response, timestamp: new Date().toISOString() },
          ...get().history,
        ],
      });
      return response;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to process prompt";
      set({ error: message });
      throw err;
    } finally {
      set({ isProcessing: false });
    }
  },

  fetchSuggestions: async (connectionId) => {
    try {
      const suggestions = await promptApi.suggest(connectionId);
      const cleaned = (suggestions || []).flatMap((s) => {
        if (typeof s === "string" && s.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [s];
          } catch {
            return [s];
          }
        }
        return [s];
      });
      set({ suggestions: cleaned });
    } catch {
      // Suggestions are non-critical
    }
  },

  clearLastResult: () => set({ lastResult: null }),
}));
