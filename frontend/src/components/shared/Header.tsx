import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Moon, Sun, Keyboard } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { clsx } from "clsx";

// ── Dark mode helpers ─────────────────────────────────────────

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  // Respect system preference on first visit
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDarkMode(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("theme", dark ? "dark" : "light");
}

// Initialize on load
const initialDark = getInitialDarkMode();
applyDarkMode(initialDark);

// ── Component ─────────────────────────────────────────────────

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(initialDark);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;

      // ? key → show shortcuts
      if (e.key === "?" && !e.target) {
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Cmd+K → focus prompt bar
      if (isMeta && e.key === "k") {
        e.preventDefault();
        const promptInput = document.querySelector<HTMLInputElement>(
          '[placeholder*="Ask anything"]',
        );
        promptInput?.focus();
      }

      // Escape → close modal/shortcuts
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    applyDarkMode(next);
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-950">
        <div />

        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={16} />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <User size={18} />
              <span>{user?.name || "User"}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 animate-scale-in rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className={clsx(
                    "flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50",
                    "dark:text-red-400 dark:hover:bg-gray-800",
                  )}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-80 animate-scale-in rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {[
                ["Cmd + K", "Focus prompt bar"],
                ["Cmd + S", "Save dashboard"],
                ["Delete", "Remove selected widget"],
                ["Cmd + Z", "Undo layout change"],
                ["Cmd + Shift + Z", "Redo"],
                ["Escape", "Close modal / deselect"],
                ["?", "Show this dialog"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {desc}
                  </span>
                  <kbd className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
