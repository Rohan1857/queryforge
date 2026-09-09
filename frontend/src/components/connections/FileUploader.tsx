import { useState, useRef, useCallback } from "react";
import { Upload, File, CheckCircle, AlertCircle, X } from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api";

interface DetectedColumn {
  name: string;
  type: string;
}

interface UploadResult {
  file_id: string;
  filename: string;
  columns: DetectedColumn[];
  row_count: number;
}

interface FileUploaderProps {
  onUploadComplete: (result: UploadResult) => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/json": ".json",
};

const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.json";

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAccepted = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return (
      ACCEPTED_TYPES[f.type] !== undefined ||
      ["csv", "xlsx", "xls", "json"].includes(ext ?? "")
    );
  };

  const uploadFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        const response = await api.post<UploadResult>("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setUploadProgress(pct);
            }
          },
        });

        setUploadResult(response.data);
        setUploadProgress(100);
        onUploadComplete(response.data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Upload failed. Please try again.";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile) return;

      if (!isAccepted(droppedFile)) {
        setError("Unsupported file type. Please upload a .csv, .xlsx, or .json file.");
        return;
      }

      uploadFile(droppedFile);
    },
    [uploadFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!isAccepted(selectedFile)) {
        setError("Unsupported file type. Please upload a .csv, .xlsx, or .json file.");
        return;
      }

      uploadFile(selectedFile);
    },
    [uploadFile],
  );

  const handleReset = () => {
    setFile(null);
    setUploadProgress(0);
    setUploadResult(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
            isDragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600",
          )}
        >
          <Upload
            size={32}
            className={clsx(
              "mb-3",
              isDragOver ? "text-blue-500" : "text-gray-400",
            )}
          />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDragOver ? "Drop file here" : "Drag and drop your file here"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            or click to browse. Accepts .csv, .xlsx, .json
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* File selected / uploading */}
      {file && (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <File size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={handleReset}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(isUploading || uploadProgress > 0) && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span>{isUploading ? "Uploading..." : "Upload complete"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-300",
                    uploadProgress === 100 ? "bg-green-500" : "bg-blue-600",
                  )}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success status */}
          {uploadResult && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle size={16} />
              Uploaded successfully
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Schema preview after upload */}
      {uploadResult && uploadResult.columns.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
            Detected Schema ({uploadResult.row_count} rows)
          </h4>
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-2 pr-4 font-medium text-gray-500">Column</th>
                  <th className="pb-2 font-medium text-gray-500">Type</th>
                </tr>
              </thead>
              <tbody>
                {uploadResult.columns.map((col) => (
                  <tr
                    key={col.name}
                    className="border-b border-gray-50 dark:border-gray-800/50"
                  >
                    <td className="py-1.5 pr-4 font-mono text-gray-900 dark:text-gray-200">
                      {col.name}
                    </td>
                    <td className="py-1.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {col.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
