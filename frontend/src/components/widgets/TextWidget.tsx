import React, { useRef, useCallback, useEffect } from "react";
import clsx from "clsx";
import { Bold, Italic, Heading1, Heading2 } from "lucide-react";
import DOMPurify from "dompurify";

interface TextWidgetProps {
  content: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={clsx(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "h1", "h2", "p", "br", "div", "span", "u"],
  ALLOWED_ATTR: ["class", "style"],
  RETURN_DOM_FRAGMENT: true as const,
};

/**
 * Safely set the content of a DOM node using DOMPurify to create
 * a sanitized DocumentFragment, avoiding raw innerHTML assignment.
 */
function setSanitizedContent(node: HTMLElement, html: string): void {
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG) as DocumentFragment;
  node.textContent = "";
  node.appendChild(clean);
}

/**
 * Extract and sanitize the HTML string from a contentEditable element.
 */
function getSanitizedContent(node: HTMLElement): string {
  const raw = node.cloneNode(true) as HTMLElement;
  // Use DOMPurify to sanitize the serialized output
  return DOMPurify.sanitize(raw.outerHTML ? extractInner(raw) : "", {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "h1", "h2", "p", "br", "div", "span", "u"],
    ALLOWED_ATTR: ["class", "style"],
  });
}

function extractInner(el: HTMLElement): string {
  const wrapper = document.createElement("div");
  while (el.firstChild) {
    wrapper.appendChild(el.firstChild);
  }
  // DOMPurify.sanitize with string input returns string by default
  return DOMPurify.sanitize(wrapper.outerHTML, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "h1", "h2", "p", "br", "div", "span", "u"],
    ALLOWED_ATTR: ["class", "style"],
  });
}

export function TextWidget({ content, onChange, readOnly = false }: TextWidgetProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const readOnlyRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize the editable area content on mount
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      setSanitizedContent(editorRef.current, content);
      initializedRef.current = true;
    }
  }, [content]);

  // Set read-only content
  useEffect(() => {
    if (readOnlyRef.current) {
      setSanitizedContent(readOnlyRef.current, content);
    }
  }, [content]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current && onChange) {
      onChange(getSanitizedContent(editorRef.current));
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current && onChange) {
      onChange(getSanitizedContent(editorRef.current));
    }
  }, [onChange]);

  const handleFormatBlock = useCallback(
    (tag: string) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const parentBlock = selection.anchorNode?.parentElement?.closest(
        "h1, h2, p, div"
      );
      const currentTag = parentBlock?.tagName?.toLowerCase();

      if (currentTag === tag) {
        execCommand("formatBlock", "p");
      } else {
        execCommand("formatBlock", tag);
      }
    },
    [execCommand]
  );

  if (readOnly) {
    return (
      <div className="prose prose-sm h-full max-w-none overflow-auto p-4 dark:prose-invert">
        <div ref={readOnlyRef} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        <ToolbarButton onClick={() => execCommand("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <ToolbarButton
          onClick={() => handleFormatBlock("h1")}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormatBlock("h2")}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className={clsx(
          "prose prose-sm max-w-none flex-1 overflow-auto p-4 outline-none dark:prose-invert",
          "focus:ring-2 focus:ring-blue-500/20 focus:ring-inset"
        )}
      />
    </div>
  );
}

export default TextWidget;
