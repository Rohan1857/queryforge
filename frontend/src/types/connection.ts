export interface ColumnMetadata {
  name: string;
  type: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  sample_values: string[];
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  row_count: number;
  relationships: Record<string, unknown>[];
}

export interface SchemaMetadata {
  tables: TableMetadata[];
}

export interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
  schema_cache?: SchemaMetadata;
  last_synced?: string;
  created_at: string;
}

export interface ConnectionCreate {
  name: string;
  type: "postgres" | "mysql" | "sqlite" | "gdrive" | "csv" | "excel" | "json";
  config: Record<string, unknown>;
}

export interface ConnectionTest {
  success: boolean;
  message: string;
  schema_info?: SchemaMetadata;
}
