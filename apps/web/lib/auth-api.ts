"use client";

import { getApiBaseUrl } from "./runtime";

const REQUEST_TIMEOUT_MS = 30000;

function getAuthApiBase(): string {
  return getApiBaseUrl();
}

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  google_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserPreference = {
  language: "en" | "vi";
  timezone: string;
};

export type AuthStatus = {
  user: AuthUser;
  preference: UserPreference;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
};

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      cache: "no-store",
      credentials: "include",
      ...init,
      signal: controller.signal,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractErrorMessage(payload: any, fallback: string): string {
  const detail = payload?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => item?.msg).filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return fallback;
}

export async function authFetch(path: string, init?: RequestInit, retry = true): Promise<Response> {
  const response = await fetchWithTimeout(`${getAuthApiBase()}${path}`, init);
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const refreshResponse = await fetchWithTimeout(`${getAuthApiBase()}/auth/refresh`, { method: "POST" });
    if (refreshResponse.ok) {
      return authFetch(path, init, false);
    }
  }
  return response;
}

async function parseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(payload, fallback));
  }
  return response.json() as Promise<T>;
}

export async function apiRegister(email: string, username: string, password: string, name: string): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${getAuthApiBase()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, name }),
  });
  return parseJson<TokenResponse>(response, "Registration failed");
}

export async function apiLogin(identifier: string, password: string): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${getAuthApiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  return parseJson<TokenResponse>(response, "Login failed");
}

export async function apiLogout(): Promise<void> {
  const response = await fetchWithTimeout(`${getAuthApiBase()}/auth/logout`, { method: "POST" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(payload, "Logout failed"));
  }
}

export async function apiGetMe(): Promise<AuthStatus> {
  const response = await authFetch("/auth/me");
  return parseJson<AuthStatus>(response, "Not authenticated");
}

export async function apiUpdatePreferences(payload: Partial<UserPreference>): Promise<AuthStatus> {
  const response = await authFetch("/auth/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<AuthStatus>(response, "Failed to update preferences");
}

export async function apiGetGoogleAuthUrl(): Promise<string> {
  const response = await fetchWithTimeout(`${getAuthApiBase()}/auth/google`);
  const payload = await parseJson<{ authorization_url: string }>(response, "Failed to start Google authentication");
  return payload.authorization_url;
}

export async function apiFetchUsers(search: string = ""): Promise<AuthUser[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await authFetch(`/admin/users${q}`);
  return parseJson<AuthUser[]>(response, "Failed to fetch users");
}

export async function apiUpdateUser(userId: string, data: { name?: string; role?: string; is_active?: boolean }): Promise<AuthUser> {
  const response = await authFetch(`/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<AuthUser>(response, "Failed to update user");
}

export async function apiDeleteUser(userId: string): Promise<void> {
  const response = await authFetch(`/admin/users/${userId}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(payload, "Failed to delete user"));
  }
}

export async function apiFetchProposals(statusFilter: string = ""): Promise<any[]> {
  const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
  const response = await authFetch(`/admin/proposals${q}`);
  return parseJson<any[]>(response, "Failed to fetch proposals");
}

export async function apiModerateProposal(
  proposalId: string,
  data: {
    status?: string;
    moderation_notes?: string;
    category?: string;
    duplicate_of_market_id?: string;
  }
): Promise<{ detail: string; market_id?: string }> {
  const response = await authFetch(`/admin/proposals/${proposalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<{ detail: string; market_id?: string }>(response, "Failed to moderate proposal");
}

export async function apiAdminAnalytics(): Promise<{
  users: number;
  admins: number;
  markets: number;
  proposals: number;
  forecasts: number;
}> {
  const response = await authFetch("/admin/analytics");
  return parseJson(response, "Failed to load admin analytics");
}
