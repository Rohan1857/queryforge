import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { clsx } from "clsx";

declare global {
  interface Window {
    google?: any;
  }
}

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
  const { login, devLogin, register, googleLogin } = useAuthStore();
  const navigate = useNavigate();
  const showDevLogin = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

  useEffect(() => {
    if (!googleClientId) return;

    const setupGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return;
            try {
              setLoading(true);
              await googleLogin(response.credential);
              navigate("/");
            } catch (err: any) {
              setError(err?.response?.data?.detail || "Google authentication failed");
            } finally {
              setLoading(false);
            }
          },
        });

        const btn = document.getElementById("google-login-target");
        if (btn) {
          window.google.accounts.id.renderButton(btn, {
            theme: "outline",
            size: "large",
            width: 320,
            text: tab === "login" ? "signin_with" : "signup_with",
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          setupGoogle();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [googleClientId, tab]);

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold tracking-wider text-white shadow-sm dark:bg-white dark:text-slate-950">
            QF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            QueryForge
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Governed SQL Analytics & Autonomous Data Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Tabs */}
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
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
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {loading
                ? "Processing..."
                : tab === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>

            {googleClientId && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-white px-2 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                      Or continue with
                    </span>
                  </div>
                </div>
                <div id="google-login-target" className="flex justify-center w-full min-h-[44px]" />
              </div>
            )}

            {tab === "login" && showDevLogin && (
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
              >
                Developer Demo Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
