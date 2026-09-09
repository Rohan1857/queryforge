import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  value: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  maxLength?: number;
  onSave: (value: string) => Promise<void> | void;
}

export function InlineEditableText({
  value,
  placeholder,
  className,
  inputClassName,
  multiline = false,
  maxLength = 160,
  onSave,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }, [isEditing]);

  const save = async () => {
    const nextValue = draft.trim();
    setIsEditing(false);
    if (nextValue !== value) {
      await onSave(nextValue);
    }
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={2}
          maxLength={maxLength}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void save();
            }
          }}
          className={clsx(
            "w-full resize-none rounded-lg border border-blue-400 bg-white/80 px-2 py-1 text-sm text-gray-700 outline-none ring-1 ring-blue-100 dark:bg-gray-900/60 dark:text-gray-100",
            inputClassName,
          )}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
        }}
        className={clsx(
          "w-full rounded-lg border border-blue-400 bg-white/80 px-2 py-1 text-sm text-gray-700 outline-none ring-1 ring-blue-100 dark:bg-gray-900/60 dark:text-gray-100",
          inputClassName,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
      className={clsx(
        "group inline-flex w-full items-center gap-1 text-left text-sm transition-colors hover:text-blue-600 dark:hover:text-blue-300",
        className,
      )}
    >
      <span className={clsx("min-w-0 flex-1 truncate", !value && "text-gray-400 dark:text-gray-500")}>
        {value || placeholder || "Click to edit"}
      </span>
      <Pencil size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}
