import { useCallback } from "react";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptResponse } from "@/types/query";

/**
 * Convenience hook wrapping the prompt store for common usage patterns.
 * Provides a simplified interface for sending prompts and reading results.
 */
export function usePromptEngine(connectionId?: string, dashboardId?: string) {
  const {
    isProcessing,
    lastResult,
    suggestions,
    error,
    history,
    sendPrompt: storeSendPrompt,
    fetchSuggestions,
    clearLastResult,
  } = usePromptStore();

  const sendPrompt = useCallback(
    async (prompt: string): Promise<PromptResponse> => {
      return storeSendPrompt(prompt, connectionId, dashboardId);
    },
    [storeSendPrompt, connectionId, dashboardId],
  );

  const loadSuggestions = useCallback(() => {
    fetchSuggestions(connectionId);
  }, [fetchSuggestions, connectionId]);

  return {
    sendPrompt,
    isProcessing,
    lastResult,
    suggestions,
    error,
    history,
    loadSuggestions,
    clearLastResult,
  };
}
