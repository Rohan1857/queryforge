import { useState, useCallback } from "react";
import { queryApi } from "@/lib/api";
import type { QueryResult } from "@/types/query";

/**
 * Custom hook for executing SQL queries against connections.
 * Wraps queryApi.execute with loading/error state management.
 */
export function useDataQuery() {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = useCallback(
    async (connectionId: string, sql: string, params?: unknown[]): Promise<QueryResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const queryResult = await queryApi.execute({
          connection_id: connectionId,
          sql,
          params,
        });
        setResult(queryResult);
        return queryResult;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Query execution failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    executeQuery,
    result,
    isLoading,
    error,
    clearResult,
  };
}
