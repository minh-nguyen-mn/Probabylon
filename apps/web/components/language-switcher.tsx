"use client";

import { useAuthStore } from "../lib/auth-store";

export function LanguageSwitcher() {
  const language = useAuthStore((state) => state.preference.language);
  const setLanguage = useAuthStore((state) => state.setLanguage);

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
      {(["en", "vi"] as const).map((locale) => {
        const active = language === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => void setLanguage(locale)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              active ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-white"
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
