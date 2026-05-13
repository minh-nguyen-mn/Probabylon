import {
  AgentHubPayload,
  CategoryDetailPayload,
  CategorySnapshot,
  DashboardPayload,
  ExplorePayload,
  ForecastResult,
  HomeSnapshot,
  InsightsPayload,
  MarketDetailPayload,
  MarketRow,
  ProfilePayload,
  ProposalRow,
  TrendsPayload,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const REQUEST_TIMEOUT_MS = 30000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Platform request timed out. Please make sure the api service is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const raw = await res.text();

  if (!res.ok) {
    throw new Error(raw || fallbackMessage);
  }

  if (!raw.trim()) {
    throw new Error(`${fallbackMessage}: empty response body`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${fallbackMessage}: invalid JSON response`);
  }
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("pb_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit, fallbackMessage: string = "Request failed"): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...authHeaders(),
    },
  });
  return parseJsonResponse<T>(res, fallbackMessage);
}

export async function getDashboard(): Promise<DashboardPayload> {
  return apiFetch<DashboardPayload>("/dashboard", undefined, "Failed to load dashboard");
}

export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  return apiFetch<HomeSnapshot>("/home", undefined, "Failed to load home");
}

export async function getExploreMarkets(searchParams?: {
  search?: string;
  sort?: string;
  category?: string;
}): Promise<ExplorePayload> {
  const qs = new URLSearchParams();
  if (searchParams?.search) qs.set("search", searchParams.search);
  if (searchParams?.sort) qs.set("sort", searchParams.sort);
  if (searchParams?.category) qs.set("category", searchParams.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ExplorePayload>(`/markets/explore${suffix}`, undefined, "Failed to explore markets");
}

export async function getCategories(): Promise<{ categories: CategorySnapshot[] }> {
  return apiFetch<{ categories: CategorySnapshot[] }>("/categories", undefined, "Failed to load categories");
}

export async function getCategoryDetail(slug: string): Promise<CategoryDetailPayload> {
  return apiFetch<CategoryDetailPayload>(`/categories/${slug}`, undefined, "Failed to load category");
}

export async function getMarketDetail(marketId: string): Promise<MarketDetailPayload> {
  return apiFetch<MarketDetailPayload>(`/markets/${marketId}`, undefined, "Failed to load market detail");
}

export async function createMarket(payload: {
  question: string;
  description: string;
  category: string;
  resolution_criteria: string;
  expires_at: string;
  initial_probability?: number;
  rounds?: number;
  max_agents?: number;
  lmsr_b?: number;
}): Promise<any> {
  return apiFetch<any>(
    "/markets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to create market"
  );
}

export async function submitMarketProposal(payload: {
  question: string;
  description: string;
  resolution_criteria: string;
  category: string;
  expires_at: string;
}): Promise<{ id: string; status: string; message: string }> {
  return apiFetch<{ id: string; status: string; message: string }>(
    "/market-proposals",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to submit market proposal"
  );
}

export async function getMyMarketProposals(): Promise<{ proposals: ProposalRow[] }> {
  return apiFetch<{ proposals: ProposalRow[] }>("/market-proposals/mine", undefined, "Failed to load proposals");
}

export async function askForecast(payload: { question: string; category: string; context?: string }): Promise<ForecastResult> {
  return apiFetch<ForecastResult>(
    "/forecasts/ask",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to generate forecast"
  );
}

export async function getAgentHub(): Promise<AgentHubPayload> {
  return apiFetch<AgentHubPayload>("/agents", undefined, "Failed to load agents");
}

export async function getInsights(): Promise<InsightsPayload> {
  return apiFetch<InsightsPayload>("/insights", undefined, "Failed to load insights");
}

export async function getTrends(): Promise<TrendsPayload> {
  return apiFetch<TrendsPayload>("/trends", undefined, "Failed to load trends");
}

export async function getProfile(): Promise<ProfilePayload> {
  return apiFetch<ProfilePayload>("/profile/me", undefined, "Failed to load profile");
}

export async function featureMarket(
  marketId: string,
  payload: { is_featured?: boolean; is_pinned?: boolean }
): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>(
    `/markets/${marketId}/feature`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update market"
  );
}
