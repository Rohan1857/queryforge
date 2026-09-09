import React, { useCallback } from "react";
import clsx from "clsx";
import { Search, ChevronDown, Calendar } from "lucide-react";

export type FilterType = "select" | "date" | "search";

interface FilterWidgetProps {
  type: FilterType;
  options?: string[];
  value: string | { start: string; end: string };
  onChange: (value: string | { start: string; end: string }) => void;
  label?: string;
  placeholder?: string;
}

export function FilterWidget({
  type,
  options = [],
  value,
  onChange,
  label,
  placeholder,
}: FilterWidgetProps) {
  const stringValue = typeof value === "string" ? value : "";
  const dateValue =
    typeof value === "object" && value !== null
      ? (value as { start: string; end: string })
      : { start: "", end: "" };

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleDateChange = useCallback(
    (field: "start" | "end", val: string) => {
      const current =
        typeof value === "object" && value !== null
          ? (value as { start: string; end: string })
          : { start: "", end: "" };
      onChange({ ...current, [field]: val });
    },
    [onChange, value]
  );

  const baseInputStyles = clsx(
    "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
    "border-gray-300 bg-white text-gray-900",
    "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
    "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
    "dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
  );

  return (
    <div className="flex h-full flex-col justify-center px-3 py-2">
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </label>
      )}

      {/* Select / Dropdown */}
      {type === "select" && (
        <div className="relative">
          <select
            value={stringValue}
            onChange={handleSelectChange}
            className={clsx(baseInputStyles, "appearance-none pr-8")}
          >
            <option value="">{placeholder || "Select..."}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      )}

      {/* Search Input */}
      {type === "search" && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={stringValue}
            onChange={handleSearchChange}
            placeholder={placeholder || "Search..."}
            className={clsx(baseInputStyles, "pl-8")}
          />
        </div>
      )}

      {/* Date Range Picker */}
      {type === "date" && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateValue.start}
              onChange={(e) => handleDateChange("start", e.target.value)}
              className={clsx(baseInputStyles, "pl-8")}
            />
          </div>
          <span className="text-xs text-gray-400">to</span>
          <div className="relative flex-1">
            <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateValue.end}
              onChange={(e) => handleDateChange("end", e.target.value)}
              className={clsx(baseInputStyles, "pl-8")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterWidget;
