import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Columns3,
  Key,
  Link2,
} from "lucide-react";
import { clsx } from "clsx";
import type { SchemaMetadata, TableMetadata, ColumnMetadata } from "@/types/connection";

interface SchemaExplorerProps {
  schema: SchemaMetadata;
  connectionName: string;
}

export function SchemaExplorer({ schema, connectionName }: SchemaExplorerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [connectionExpanded, setConnectionExpanded] = useState(true);

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  return (
    <div className="select-none text-sm">
      {/* Connection root node */}
      <button
        onClick={() => setConnectionExpanded(!connectionExpanded)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
      >
        {connectionExpanded ? (
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-gray-400" />
        )}
        <span className="truncate">{connectionName}</span>
        <span className="ml-auto text-xs text-gray-400">
          {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Tables */}
      {connectionExpanded && (
        <div className="ml-3 border-l border-gray-200 pl-2 dark:border-gray-700">
          {schema.tables.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-400">No tables found</p>
          ) : (
            schema.tables.map((table) => (
              <TableNode
                key={table.name}
                table={table}
                isExpanded={expandedTables.has(table.name)}
                onToggle={() => toggleTable(table.name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Table node ───────────────────────────────────────────────

interface TableNodeProps {
  table: TableMetadata;
  isExpanded: boolean;
  onToggle: () => void;
}

function TableNode({ table, isExpanded, onToggle }: TableNodeProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {isExpanded ? (
          <ChevronDown size={12} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-gray-400" />
        )}
        <Table2 size={14} className="shrink-0 text-amber-500" />
        <span className="truncate font-mono text-xs">{table.name}</span>
        <span className="ml-auto text-xs text-gray-400">
          {table.row_count.toLocaleString()} rows
        </span>
      </button>

      {/* Columns */}
      {isExpanded && (
        <div className="ml-5 border-l border-gray-200 pl-2 dark:border-gray-700">
          {table.columns.map((col) => (
            <ColumnNode key={col.name} column={col} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Column node ──────────────────────────────────────────────

interface ColumnNodeProps {
  column: ColumnMetadata;
}

function ColumnNode({ column }: ColumnNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex items-center gap-2 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Columns3 size={12} className="shrink-0 text-gray-400" />
      <span className="truncate font-mono text-xs text-gray-600 dark:text-gray-400">
        {column.name}
      </span>
      <span className="ml-auto flex items-center gap-1">
        {column.is_primary_key && (
          <span title="Primary Key">
            <Key size={11} className="text-yellow-500" />
          </span>
        )}
        {column.is_foreign_key && (
          <span title="Foreign Key">
            <Link2 size={11} className="text-blue-500" />
          </span>
        )}
        <span
          className={clsx(
            "rounded px-1 py-0.5 text-[10px]",
            "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
          )}
        >
          {column.type}
        </span>
      </span>

      {/* Sample values tooltip */}
      {showTooltip && column.sample_values.length > 0 && (
        <div className="absolute left-full top-0 z-30 ml-2 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Sample values
          </p>
          <div className="space-y-0.5">
            {column.sample_values.slice(0, 5).map((val, i) => (
              <p
                key={i}
                className="truncate font-mono text-xs text-gray-600 dark:text-gray-400"
              >
                {val}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
