import { useEffect, useState } from "react";
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  FileText,
  FileSpreadsheet,
  FileJson,
  Sheet,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useConnectionStore } from "@/stores/connectionStore";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { SchemaExplorer } from "@/components/connections/SchemaExplorer";
import { toast } from "@/components/shared/Toast";
import type { Connection } from "@/types/connection";

const TYPE_ICONS: Record<string, typeof Database> = {
  postgres: Database,
  mysql: Database,
  sqlite: Database,
  gdrive: Sheet,
  csv: FileText,
  excel: FileSpreadsheet,
  json: FileJson,
};

export default function ConnectionsPage() {
  const {
    connections,
    schemas,
    isLoading,
    fetchConnections,
    deleteConnection,
    testConnection,
    syncConnection,
    fetchSchema,
  } = useConnectionStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const selected = connections.find((c) => c.id === selectedId) ?? null;
  const selectedSchema = selected
    ? schemas[selected.id] ?? selected.schema_cache ?? null
    : null;

  const handleSelect = async (conn: Connection) => {
    setSelectedId(conn.id);
    setShowForm(false);
    if (!schemas[conn.id] && !conn.schema_cache) {
      try {
        await fetchSchema(conn.id);
      } catch {
        // Schema fetch failed — will show empty state
      }
    }
  };

  const handleTest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await testConnection(id);
      toast(result.success ? "success" : "error", result.message);
    } catch {
      toast("error", "Connection test failed");
    }
  };

  const handleSync = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await syncConnection(id);
      toast("success", "Schema synced");
      // Refresh schema in detail view
      if (selectedId === id) {
        await fetchSchema(id);
      }
    } catch {
      toast("error", "Sync failed");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this connection?")) return;
    try {
      await deleteConnection(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
      toast("success", "Connection deleted");
    } catch {
      toast("error", "Failed to delete");
    }
  };

  const handleFormComplete = () => {
    setShowForm(false);
    fetchConnections();
  };

  const handleAddNew = () => {
    setShowForm(true);
    setSelectedId(null);
  };

  return (
    <div className="flex h-full">
      {/* Left panel — Connection list (40%) */}
      <div className="w-2/5 border-r border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Connections
            </h1>
            <p className="text-xs text-gray-500">
              {connections.length} data source{connections.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        <div className="overflow-auto p-4" style={{ height: "calc(100% - 73px)" }}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Database
                size={40}
                className="mb-3 text-gray-300 dark:text-gray-600"
              />
              <p className="text-sm font-medium text-gray-500">
                No connections yet
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Add a data source to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((c) => {
                const Icon = TYPE_ICONS[c.type] ?? Database;
                const isSelected = selectedId === c.id && !showForm;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          isSelected
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : "bg-gray-100 dark:bg-gray-800",
                        )}
                      >
                        <Icon
                          size={18}
                          className={clsx(
                            isSelected
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-500",
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                            {c.type}
                          </span>
                          <span className="flex items-center gap-1">
                            {c.status === "active" ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            )}
                            {c.status}
                          </span>
                          {c.schema_cache && (
                            <span>
                              {c.schema_cache.tables?.length ?? 0} tables
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleTest(c.id, e)}
                        title="Test connection"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      >
                        <CheckCircle size={14} />
                      </button>
                      <button
                        onClick={(e) => handleSync(c.id, e)}
                        title="Sync schema"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(c.id, e)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Detail / Form (60%) */}
      <div className="flex-1 overflow-auto">
        {showForm ? (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                New Connection
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            <ConnectionForm onComplete={handleFormComplete} />
          </div>
        ) : selected && selectedSchema ? (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selected.name}
                </h2>
                <p className="text-xs text-gray-500">
                  {selected.type} — {selected.status}
                  {selected.last_synced &&
                    ` — Last synced ${selected.last_synced}`}
                </p>
              </div>
            </div>
            <SchemaExplorer
              schema={selectedSchema}
              connectionName={selected.name}
            />
          </div>
        ) : selected ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Database
              size={36}
              className="mb-3 text-gray-300 dark:text-gray-600"
            />
            <p className="text-sm text-gray-500">
              No schema available.{" "}
              <button
                onClick={(e) => handleSync(selected.id, e)}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Sync now
              </button>
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <Database
              size={40}
              className="mb-3 text-gray-300 dark:text-gray-600"
            />
            <p className="text-sm font-medium text-gray-500">
              Select a connection to view its schema
            </p>
            <p className="mt-1 text-xs text-gray-400">
              or click "Add" to create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
