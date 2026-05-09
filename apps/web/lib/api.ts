import { DashboardPayload } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function getDashboard(): Promise<DashboardPayload> {
  const res = await fetch(`${API_BASE}/dashboard`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load dashboard");
  }
  return res.json();
}

export async function getMarketDetail(marketId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/markets/${marketId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load market detail");
  }
  return res.json();
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
  const res = await fetch(`${API_BASE}/markets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Failed to create market");
  }
  return res.json();
}
