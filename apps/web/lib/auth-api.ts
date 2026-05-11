const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pb_token");
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = { ...authHeaders(), ...(init?.headers || {}) };
  return fetch(url, { ...init, headers });
}

export async function apiRegister(email: string, username: string, password: string, name: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Registration failed");
  }
  return res.json();
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Login failed");
  }
  return res.json();
}

export async function apiGoogleLogin(
  idToken: string,
  username?: string,
  password?: string,
  name?: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken, username, password, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.detail?.code || body.detail || "Google login failed") as any;
    error.detail = body.detail;
    throw error;
  }
  return res.json();
}

export async function apiGetMe(): Promise<AuthUser> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// Admin APIs
export async function apiFetchUsers(search: string = ""): Promise<AuthUser[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await authFetch(`${API_BASE}/admin/users${q}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function apiUpdateUser(userId: string, data: { name?: string; role?: string; is_active?: boolean }): Promise<AuthUser> {
  const res = await authFetch(`${API_BASE}/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to update user");
  }
  return res.json();
}

export async function apiDeleteUser(userId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/admin/users/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete user");
  }
}
