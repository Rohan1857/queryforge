import { useState } from "react";
import { CheckCircle, ExternalLink } from "lucide-react";
import { clsx } from "clsx";

interface GoogleDriveConnectorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function GoogleDriveConnector({ config, onChange }: GoogleDriveConnectorProps) {
  const [isAuthed, setIsAuthed] = useState(false);

  const spreadsheetId = (config.spreadsheet_id as string) ?? "";

  const handleGoogleSignIn = () => {
    // Placeholder: In a real implementation this would initiate the
    // Google OAuth2 flow via a popup or redirect.
    // For now we simulate a successful auth after a short delay.
    setIsAuthed(true);
    onChange({ ...config, google_authenticated: true });
  };

  return (
    <div className="space-y-5">
      {/* Google Sign-In */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Step 1: Authenticate with Google
        </p>

        {isAuthed ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle size={16} />
            Connected to Google account
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>

      {/* Spreadsheet ID */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Step 2: Enter Spreadsheet ID
        </p>
        <p className="mb-3 text-xs text-gray-500">
          Find it in the Google Sheets URL: docs.google.com/spreadsheets/d/
          <span className="font-semibold text-gray-700 dark:text-gray-300">SPREADSHEET_ID</span>
          /edit
        </p>
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => onChange({ ...config, spreadsheet_id: e.target.value })}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          disabled={!isAuthed}
          className={clsx(
            "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white",
            isAuthed
              ? "border-gray-300 dark:border-gray-700"
              : "cursor-not-allowed border-gray-200 opacity-50 dark:border-gray-800",
          )}
        />
        {spreadsheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Open spreadsheet
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
