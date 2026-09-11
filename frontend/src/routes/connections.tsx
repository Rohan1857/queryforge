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
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Plus size={14} />
            Add Connection
          </button>
        </div>

        <div className="overflow-auto p-3" style={{ height: "calc(100% - 73px)" }}>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Database
                size={36}
                className="mb-3 text-slate-300 dark:text-slate-600"
              />
              <p className="text-xs font-medium text-slate-500">
                No connections configured
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Add a data source to begin running SQL
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {connections.map((c) => {
                const Icon = TYPE_ICONS[c.type] ?? Database;
                const isSelected = selectedId === c.id && !showForm;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-md border p-2.5 text-left transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={clsx(
                          "flex h-8 w-8 items-center justify-center rounded-md",
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                        )}
                      >
                        <Icon size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                          <span className="rounded bg-slate-100 px-1 py-0.5 uppercase dark:bg-slate-800">
                            {c.type}
                          </span>
                          <span className="flex items-center gap-1">
                            {c.status === "active" ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            )}
                            {c.status}
                          </span>
                          {c.schema_cache && (
                            <span className="tabular-nums">
                              {c.schema_cache.tables?.length ?? 0} tables
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => handleTest(c.id, e)}
                        title="Test connection"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <CheckCircle size={13} />
                      </button>
                      <button
                        onClick={(e) => handleSync(c.id, e)}
                        title="Sync schema"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(c.id, e)}
                        title="Delete"
                        className="rounded p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={13} />
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
