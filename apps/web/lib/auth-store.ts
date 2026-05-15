"use client";

import { create } from "zustand";

import { apiGetMe, apiLogout, apiUpdatePreferences, AuthStatus, AuthUser, UserPreference } from "./auth-api";

type AuthState = {
  user: AuthUser | null;
  preference: UserPreference;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuthStatus: (status: AuthStatus) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setLanguage: (language: "en" | "vi") => Promise<void>;
};

const defaultPreference: UserPreference = {
  language: "en",
  timezone: "UTC",
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  preference: defaultPreference,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  setAuthStatus: (status) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pb_language", status.preference.language);
    }
    set({
      user: status.user,
      preference: status.preference,
      isAuthenticated: true,
      isAdmin: status.user.role === "admin",
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await apiLogout();
    } finally {
      set({
        user: null,
        preference: {
          ...defaultPreference,
          language: typeof window !== "undefined" ? ((localStorage.getItem("pb_language") as "en" | "vi") || "en") : "en",
        },
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
      });
    }
  },

  hydrate: async () => {
    try {
      const status = await apiGetMe();
      if (typeof window !== "undefined") {
        localStorage.setItem("pb_language", status.preference.language);
      }
      set({
        user: status.user,
        preference: status.preference,
        isAuthenticated: true,
        isAdmin: status.user.role === "admin",
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        preference: {
          ...defaultPreference,
          language: typeof window !== "undefined" ? ((localStorage.getItem("pb_language") as "en" | "vi") || "en") : "en",
        },
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
      });
    }
  },

  setLanguage: async (language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pb_language", language);
    }
    set((state) => ({
      preference: {
        ...state.preference,
        language,
      },
    }));
    try {
      const status = await apiUpdatePreferences({ language });
      set({
        user: status.user,
        preference: status.preference,
        isAuthenticated: true,
        isAdmin: status.user.role === "admin",
        isLoading: false,
      });
    } catch {
      return;
    }
  },
}));
