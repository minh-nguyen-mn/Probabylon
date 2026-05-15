"use client";

import { FormEvent, useState } from "react";

import { useI18n } from "../../hooks/use-i18n";
import { apiGetGoogleAuthUrl, apiRegister } from "../../lib/auth-api";
import { useAuthStore } from "../../lib/auth-store";

export default function RegisterPage() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { hydrate } = useAuthStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedName = name.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedUsername || !normalizedEmail) {
      setError("Please enter your full name, username, and email.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
      setError("Username may only contain letters, numbers, and underscores.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      await apiRegister(normalizedEmail, normalizedUsername, password, normalizedName);
      await hydrate();
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setError("");
    setLoading(true);
    try {
      const url = await apiGetGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Google registration failed.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-indigo-500/20">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="mb-1 text-2xl font-bold text-white">{t("auth", "register")}</h1>
            <p className="text-sm text-zinc-400">Create a persistent account for private forecasts, market submissions, and admin-reviewed participation.</p>
          </div>

          {error ? <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t("auth", "name")} value={name} onChange={setName} placeholder="Avery Nguyen" />
            <Field label={t("auth", "username")} value={username} onChange={setUsername} placeholder="avery_nguyen" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="avery@example.com" />
            <Field label={t("auth", "password")} type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            <Field label={t("auth", "confirmPassword")} type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" />

            <button type="submit" disabled={loading} className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 font-bold text-white disabled:opacity-50">
              {loading ? "Creating account..." : t("auth", "register")}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleRegister()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/50 py-3 text-sm font-medium text-white transition-all hover:bg-zinc-800 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("auth", "continueWithGoogle")}
          </button>

          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-500">
              {t("auth", "haveAccount")}{" "}
              <a href="/login" className="font-medium text-violet-400 transition-colors hover:text-violet-300">
                {t("auth", "login")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 ml-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white transition-all focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        placeholder={placeholder}
      />
    </div>
  );
}
