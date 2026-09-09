import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { BarChart3 } from "lucide-react";
import { clsx } from "clsx";

// ── Password strength helper ───────────────────────────────────

function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  if (pw.length === 0) return { score: 0, label: "", color: "bg-gray-200" };

  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "Strong", color: "bg-green-500" };
  return { score, label: "Very Strong", color: "bg-emerald-500" };
}

// ── Component ──────────────────────────────────────────────────

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, devLogin, register } = useAuthStore();
  const navigate = useNavigate();
  const showDevLogin = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const passwordsMatch = password === confirmPassword;
  const canRegister =
    email.trim() &&
    name.trim() &&
    password.length >= 8 &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (tab === "register" && !passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await devLogin();
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.05),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <BarChart3 className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Prompt BI
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Natural-language Business Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200/50 dark:bg-gray-900 dark:ring-gray-800">
          {/* Tabs */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError("");
                }}
                className={clsx(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                )}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Min. 8 characters"
              />
              {/* Password strength indicator — only shown during registration */}
              {tab === "register" && password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={clsx(
                          "h-1 flex-1 rounded-full transition-colors",
                          level <= strength.score
                            ? strength.color
                            : "bg-gray-200 dark:bg-gray-700",
                        )}
                      />
                    ))}
                  </div>
                  <p
                    className={clsx(
                      "mt-1 text-xs",
                      strength.score <= 1
                        ? "text-red-500"
                        : strength.score <= 3
                          ? "text-amber-500"
                          : "text-green-500",
                    )}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password — only for registration */}
            {tab === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={clsx(
                    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-gray-800 dark:text-white",
                    confirmPassword.length > 0 && !passwordsMatch
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600",
                  )}
                  placeholder="Re-enter password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-red-500">
                    Passwords do not match
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (tab === "register" && !canRegister)}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "..."
                : tab === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>

            {tab === "login" && showDevLogin && (
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={loading}
                className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60"
              >
                Use Developer Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
