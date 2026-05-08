"use client";

import { FormEvent, useState } from "react";
import { createMarket } from "../lib/api";

export function MarketCreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      await createMarket({
        question: String(fd.get("question") || ""),
        description: String(fd.get("description") || ""),
        category: String(fd.get("category") || "general"),
        resolution_criteria: String(fd.get("resolution_criteria") || ""),
        expires_at: String(fd.get("expires_at") || new Date(Date.now() + 14 * 86400000).toISOString()),
        initial_probability: Number(fd.get("initial_probability") || 0.5),
        rounds: Number(fd.get("rounds") || 8),
        max_agents: Number(fd.get("max_agents") || 16),
        lmsr_b: Number(fd.get("lmsr_b") || 75),
      });
      e.currentTarget.reset();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create market");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/70">
      <input name="question" required placeholder="Market question" className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <input name="category" placeholder="Category" defaultValue="general" className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <textarea name="description" placeholder="Description" className="p-2 rounded bg-zinc-950 border border-zinc-800 md:col-span-2" />
      <textarea name="resolution_criteria" required placeholder="Resolution criteria" className="p-2 rounded bg-zinc-950 border border-zinc-800 md:col-span-2" />
      <input name="expires_at" type="datetime-local" required className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <input name="initial_probability" type="number" step="0.01" min="0.01" max="0.99" defaultValue={0.5} className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <input name="rounds" type="number" min="1" max="200" defaultValue={8} className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <input name="max_agents" type="number" min="2" max="1000" defaultValue={16} className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <input name="lmsr_b" type="number" min="2" defaultValue={75} className="p-2 rounded bg-zinc-950 border border-zinc-800" />
      <button disabled={loading} className="p-2 rounded bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-60">
        {loading ? "Creating..." : "Create and Launch Market"}
      </button>
      {error ? <p className="md:col-span-2 text-red-400 text-sm">{error}</p> : null}
    </form>
  );
}
