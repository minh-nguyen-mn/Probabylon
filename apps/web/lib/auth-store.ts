"use client";

import { create } from "zustand";
import { AuthUser, apiGetMe } from "./auth-api";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pb_token", token);
    }
    set({
      token,
      user,
      isAuthenticated: true,
      isAdmin: user.role === "admin",
      isLoading: false,
    });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pb_token");
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
    });
  },

  hydrate: async () => {
    if (typeof window === "undefined") {
      set({ isLoading: false });
      return;
    }
    const token = localStorage.getItem("pb_token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await apiGetMe();
      set({
        token,
        user,
        isAuthenticated: true,
        isAdmin: user.role === "admin",
        isLoading: false,
      });
    } catch {
      localStorage.removeItem("pb_token");
      set({ isLoading: false });
    }
  },
}));
