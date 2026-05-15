"use client";

import { useAuthStore } from "../lib/auth-store";
import { AppLocale, messages } from "../i18n/messages";

export function useI18n() {
  const language = useAuthStore((state) => state.preference.language) as AppLocale;
  const locale = language || "en";

  function t<T extends keyof typeof messages.en>(section: T, key: keyof (typeof messages.en)[T]): string {
    const bundle = messages[locale] || messages.en;
    return String(bundle[section][key] || messages.en[section][key]);
  }

  return { locale, t };
}
