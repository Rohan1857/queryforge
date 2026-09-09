import { useState } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";
import { clsx } from "clsx";

type DbType = "postgres" | "mysql" | "sqlite";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

interface DatabaseConnectorProps {
  type: DbType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const DEFAULT_PORTS: Record<DbType, number> = {
  postgres: 5432,
  mysql: 3306,
  sqlite: 0,
};

const TYPE_LABELS: Record<DbType, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

export function DatabaseConnector({ type, config, onChange }: DatabaseConnectorProps) {
  const [showPassword, setShowPassword] = useState(false);

  const dbConfig: DatabaseConfig = {
    host: (config.host as string) ?? "localhost",
    port: (config.port as number) ?? DEFAULT_PORTS[type],
    database: (config.database as string) ?? "",
    username: (config.username as string) ?? "",
    password: (config.password as string) ?? "",
    ssl: (config.ssl as boolean) ?? false,
  };

  const update = (field: keyof DatabaseConfig, value: string | number | boolean) => {
    onChange({ ...config, [field]: value });
  };

  const isSqlite = type === "sqlite";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        <Shield size={16} />
        Configuring {TYPE_LABELS[type]} connection
      </div>

      {isSqlite ? (
        /* SQLite only needs a file path */
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Database File Path
          </label>
          <input
            type="text"
            value={dbConfig.database}
            onChange={(e) => update("database", e.target.value)}
            placeholder="/path/to/database.sqlite"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      ) : (
        <>
          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Host
              </label>
              <input
                type="text"
                value={dbConfig.host}
                onChange={(e) => update("host", e.target.value)}
                placeholder="localhost"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Port
              </label>
              <input
                type="number"
                value={dbConfig.port}
                onChange={(e) => update("port", parseInt(e.target.value, 10) || 0)}
                placeholder={String(DEFAULT_PORTS[type])}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Database Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Database Name
            </label>
            <input
              type="text"
              value={dbConfig.database}
              onChange={(e) => update("database", e.target.value)}
              placeholder="my_database"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={dbConfig.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="postgres"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={dbConfig.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                SSL Connection
              </p>
              <p className="text-xs text-gray-500">
                Encrypt data in transit with SSL/TLS
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dbConfig.ssl}
              onClick={() => update("ssl", !dbConfig.ssl)}
              className={clsx(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                dbConfig.ssl ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700",
              )}
            >
              <span
                className={clsx(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  dbConfig.ssl ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
