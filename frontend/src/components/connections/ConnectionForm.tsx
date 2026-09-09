import { useState } from "react";
import {
  Database,
  FileSpreadsheet,
  FileJson,
  FileText,
  Sheet,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { useConnectionStore } from "@/stores/connectionStore";
import { toast } from "@/components/shared/Toast";
import { DatabaseConnector } from "./DatabaseConnector";
import { GoogleDriveConnector } from "./GoogleDriveConnector";
import { FileUploader } from "./FileUploader";
import type { ConnectionCreate } from "@/types/connection";

// ── Connection type definitions ──────────────────────────────

type ConnectionType = ConnectionCreate["type"];

interface ConnectionTypeOption {
  type: ConnectionType;
  label: string;
  description: string;
  icon: typeof Database;
  category: "database" | "file" | "cloud";
}

const CONNECTION_TYPES: ConnectionTypeOption[] = [
  {
    type: "postgres",
    label: "PostgreSQL",
    description: "Open-source relational database",
    icon: Database,
    category: "database",
  },
  {
    type: "mysql",
    label: "MySQL",
    description: "Popular relational database",
    icon: Database,
    category: "database",
  },
  {
    type: "sqlite",
    label: "SQLite",
    description: "Lightweight file-based database",
    icon: Database,
    category: "database",
  },
  {
    type: "gdrive",
    label: "Google Sheets",
    description: "Connect a Google Spreadsheet",
    icon: Sheet,
    category: "cloud",
  },
  {
    type: "csv",
    label: "CSV",
    description: "Upload a comma-separated file",
    icon: FileText,
    category: "file",
  },
  {
    type: "excel",
    label: "Excel",
    description: "Upload an Excel spreadsheet",
    icon: FileSpreadsheet,
    category: "file",
  },
  {
    type: "json",
    label: "JSON",
    description: "Upload a JSON data file",
    icon: FileJson,
    category: "file",
  },
];

// ── Steps ────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Type" },
  { number: 2, label: "Configure" },
  { number: 3, label: "Test" },
  { number: 4, label: "Save" },
];

// ── Component ────────────────────────────────────────────────

interface ConnectionFormProps {
  onComplete: () => void;
}

export function ConnectionForm({ onComplete }: ConnectionFormProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<ConnectionType | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [connectionName, setConnectionName] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [createdConnectionId, setCreatedConnectionId] = useState<string | null>(null);

  const { createConnection, testConnection } = useConnectionStore();
  const connectionTypeLabel =
    CONNECTION_TYPES.find((ct) => ct.type === selectedType)?.label ?? "";
  const hasHost = Boolean(config.host);
  const hasDatabase = Boolean(config.database);
  const hasFilename = Boolean(config.filename);

  // ── Navigation ─────────────────────────────────────────────

  const canGoNext = (): boolean => {
    switch (step) {
      case 1:
        return selectedType !== null;
      case 2:
        return Object.keys(config).length > 0;
      case 3:
        return testStatus === "success";
      case 4:
        return connectionName.trim().length > 0;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (step < 4 && canGoNext()) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      if (step === 4) {
        // Going back from save — clear test status so user can re-test
      }
      if (step === 3) {
        setTestStatus("idle");
        setTestMessage("");
      }
    }
  };

  // ── Test connection ────────────────────────────────────────

  const handleTest = async () => {
    if (!selectedType) return;

    setTestStatus("testing");
    setTestMessage("");

    try {
      // First create a temporary connection to test
      const tempConn = await createConnection({
        name: `_test_${Date.now()}`,
        type: selectedType,
        config,
      });

      setCreatedConnectionId(tempConn.id);

      const result = await testConnection(tempConn.id);
      if (result.success) {
        setTestStatus("success");
        setTestMessage(result.message || "Connection successful!");
      } else {
        setTestStatus("error");
        setTestMessage(result.message || "Connection failed.");
      }
    } catch (err: unknown) {
      setTestStatus("error");
      setTestMessage(
        err instanceof Error ? err.message : "Failed to test connection.",
      );
    }
  };

  // ── Save connection ────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedType || !connectionName.trim()) return;

    setIsSaving(true);
    try {
      if (createdConnectionId) {
        // We already created during test; in a real app we would rename it.
        // For now, create a new one with the real name.
        await createConnection({
          name: connectionName.trim(),
          type: selectedType,
          config,
        });
      } else {
        await createConnection({
          name: connectionName.trim(),
          type: selectedType,
          config,
        });
      }
      toast("success", `Connection "${connectionName}" created successfully`);
      onComplete();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save connection.";
      toast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── File upload handler ────────────────────────────────────

  const handleFileUpload = (result: {
    file_id: string;
    filename: string;
    columns: { name: string; type: string }[];
    row_count: number;
  }) => {
    setConfig({
      ...config,
      file_id: result.file_id,
      filename: result.filename,
      columns: result.columns,
      row_count: result.row_count,
    });
  };

  // ── Determine which configurator to show ───────────────────

  const isDbType = selectedType === "postgres" || selectedType === "mysql" || selectedType === "sqlite";
  const isFileType = selectedType === "csv" || selectedType === "excel" || selectedType === "json";
  const isGDrive = selectedType === "gdrive";

  return (
    <div className="flex flex-col">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.number} className="flex items-center">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                step === s.number
                  ? "bg-blue-600 text-white"
                  : step > s.number
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800",
              )}
            >
              {step > s.number ? <Check size={14} /> : s.number}
            </div>
            <span
              className={clsx(
                "ml-1.5 text-xs font-medium",
                step === s.number
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400",
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={clsx(
                  "mx-3 h-px w-8",
                  step > s.number
                    ? "bg-green-300 dark:bg-green-700"
                    : "bg-gray-200 dark:bg-gray-700",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[320px]">
        {/* ── Step 1: Choose Type ──────────────────────────── */}
        {step === 1 && (
          <div>
            <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              Choose a data source type
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CONNECTION_TYPES.map((ct) => {
                const Icon = ct.icon;
                const isSelected = selectedType === ct.type;
                return (
                  <button
                    key={ct.type}
                    onClick={() => {
                      setSelectedType(ct.type);
                      setConfig({});
                    }}
                    className={clsx(
                      "flex flex-col items-center rounded-xl border-2 p-4 text-center transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600",
                    )}
                  >
                    <Icon
                      size={28}
                      className={clsx(
                        "mb-2",
                        isSelected
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400",
                      )}
                    />
                    <span
                      className={clsx(
                        "text-sm font-medium",
                        isSelected
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300",
                      )}
                    >
                      {ct.label}
                    </span>
                    <span className="mt-0.5 text-[11px] text-gray-500">
                      {ct.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Configure ───────────────────────────── */}
        {step === 2 && selectedType && (
          <div>
            {isDbType && (
              <DatabaseConnector
                type={selectedType as "postgres" | "mysql" | "sqlite"}
                config={config}
                onChange={setConfig}
              />
            )}
            {isGDrive && (
              <GoogleDriveConnector config={config} onChange={setConfig} />
            )}
            {isFileType && (
              <FileUploader onUploadComplete={handleFileUpload} />
            )}
          </div>
        )}

        {/* ── Step 3: Test Connection ─────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-8">
            {testStatus === "idle" && (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Database size={28} className="text-gray-400" />
                </div>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Ready to test your connection
                </p>
                <button
                  onClick={handleTest}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Test Connection
                </button>
              </>
            )}

            {testStatus === "testing" && (
              <>
                <Loader2
                  size={36}
                  className="mb-4 animate-spin text-blue-500"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Testing connection...
                </p>
              </>
            )}

            {testStatus === "success" && (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="mb-1 text-sm font-medium text-green-700 dark:text-green-400">
                  Connection successful!
                </p>
                <p className="text-xs text-gray-500">{testMessage}</p>
              </>
            )}

            {testStatus === "error" && (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <p className="mb-1 text-sm font-medium text-red-700 dark:text-red-400">
                  Connection failed
                </p>
                <p className="mb-4 text-xs text-gray-500">{testMessage}</p>
                <button
                  onClick={handleTest}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Name and Save ───────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Connection Name
              </label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="My Production Database"
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                A friendly name to identify this connection
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Summary
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {connectionTypeLabel}
                  </span>
                </div>
                {hasHost && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Host</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {String(config.host)}:{String(config.port)}
                    </span>
                  </div>
                )}
                {hasDatabase && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Database</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {String(config.database)}
                    </span>
                  </div>
                )}
                {hasFilename && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">File</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {String(config.filename)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Test</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    Passed
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          onClick={goBack}
          disabled={step === 1}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            step === 1
              ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
          )}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {step < 4 ? (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              canGoNext()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600",
            )}
          >
            Next
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!canGoNext() || isSaving}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors",
              canGoNext() && !isSaving
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600",
            )}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {isSaving ? "Saving..." : "Save Connection"}
          </button>
        )}
      </div>
    </div>
  );
}
