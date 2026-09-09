export interface QueryRequest {
  connection_id: string;
  sql: string;
  params?: unknown[];
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  execution_ms: number;
}

export interface PromptRequest {
  prompt: string;
  connection_id?: string;
  dashboard_id?: string;
}

export interface QueryInfo {
  sql: string;
  params: unknown[];
  execution_ms: number;
  row_count: number;
}

export interface WidgetResult {
  id?: string;
  type: string;
  title: string;
  prompt_used: string;
  query_config: Record<string, unknown>;
  chart_config: Record<string, unknown>;
  layout_position: Record<string, unknown>;
  data: Record<string, unknown>[];
  explanation: string;
}

export interface PromptResponse {
  widget: WidgetResult;
  query_info: QueryInfo;
  explanation: string;
}
