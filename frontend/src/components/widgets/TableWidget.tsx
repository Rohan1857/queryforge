import { useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface TableWidgetProps {
  data: Record<string, unknown>[];
  columns?: string[];
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Format a numeric value with commas and 2 decimal places */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  return String(val);
}

export function TableWidget({ data, columns: columnsProp }: TableWidgetProps) {
  const columns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    if (data.length > 0) return Object.keys(data[0]);
    return [];
  }, [data, columnsProp]);

  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const handleSort = useCallback(
    (column: string) => {
      setSort((prev) => {
        if (prev.column !== column) return { column, direction: "asc" };
        if (prev.direction === "asc") return { column, direction: "desc" };
        return { column: null, direction: null };
      });
      setPage(0);
    },
    []
  );

  const sortedData = useMemo(() => {
    if (!sort.column || !sort.direction) return data;

    const col = sort.column;
    const dir = sort.direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }

      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [data, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(
    () => sortedData.slice(page * pageSize, (page + 1) * pageSize),
    [sortedData, page, pageSize]
  );

  // Reset page if it goes out of bounds
  if (page >= totalPages && page > 0) {
    setPage(totalPages - 1);
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col) => {
                const isActive = sort.column === col;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={clsx(
                      "cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition-colors",
                      "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                      isActive && "text-gray-900 dark:text-gray-100"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {isActive && sort.direction === "asc" && (
                        <ChevronUp className="h-3 w-3" />
                      )}
                      {isActive && sort.direction === "desc" && (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {!isActive && (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-t border-gray-100 transition-colors dark:border-gray-800",
                  i % 2 === 0
                    ? "bg-white dark:bg-gray-900"
                    : "bg-gray-50/50 dark:bg-gray-800/30"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={clsx(
                      "whitespace-nowrap px-3 py-1.5",
                      typeof row[col] === "number"
                        ? "text-right tabular-nums text-gray-700 dark:text-gray-300"
                        : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedData.length > PAGE_SIZE_OPTIONS[0] && (
        <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              {page * pageSize + 1}-
              {Math.min((page + 1) * pageSize, sortedData.length)} of{" "}
              {sortedData.length.toLocaleString()}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableWidget;
