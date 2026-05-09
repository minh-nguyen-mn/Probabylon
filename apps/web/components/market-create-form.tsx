"use client";

import { FormEvent, useRef, useState } from "react";
import { createMarket } from "../lib/api";

export function MarketCreateForm({ onCreated, researchMode }: { onCreated: () => Promise<void>; researchMode: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) {
      setError("Form is no longer available. Please try again.");
      return;
    }
    const fd = new FormData(form);
    setLoading(true);
    setError("");
    try {
      const payload: {
        question: string;
        description: string;
        category: string;
        resolution_criteria: string;
        expires_at: string;
        initial_probability?: number;
        rounds?: number;
        max_agents?: number;
        lmsr_b?: number;
      } = {
        question: String(fd.get("question") || ""),
        description: String(fd.get("description") || ""),
        category: String(fd.get("category") || "general"),
        resolution_criteria: String(fd.get("resolution_criteria") || ""),
        expires_at: String(fd.get("expires_at") || new Date(Date.now() + 14 * 86400000).toISOString()),
      };

      if (advancedOpen || researchMode) {
        payload.initial_probability = Number(fd.get("initial_probability") || 0.5);
        payload.rounds = Number(fd.get("rounds") || 10);
        payload.max_agents = Number(fd.get("max_agents") || 10);
        payload.lmsr_b = Number(fd.get("lmsr_b") || 48);
      }

      await createMarket(payload);
      formRef.current?.reset();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create market");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Launch a New Market</h2>
        <p className="text-sm text-zinc-400">Describe the question and let the agent society initialize the prior and begin trading.</p>
      </div>
      <input name="question" required placeholder="Market question" className="p-3 rounded-xl bg-zinc-950 border border-zinc-800" />
      <input name="category" placeholder="Category" defaultValue="general" className="p-3 rounded-xl bg-zinc-950 border border-zinc-800" />
      <textarea name="description" placeholder="Why does this market matter?" className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 md:col-span-2 min-h-28" />
      <textarea name="resolution_criteria" required placeholder="How should this market resolve?" className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 md:col-span-2 min-h-24" />
      <label className="grid gap-1 text-sm text-zinc-400">
        Expiration Date
        <input name="expires_at" type="datetime-local" required className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100" />
      </label>
      <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-3 text-sm text-zinc-300">
        <div className="font-medium text-emerald-300">Intelligent defaults enabled</div>
        <p className="mt-1 text-zinc-400">Initial probability, market sensitivity, and simulation depth are handled automatically unless you open advanced settings.</p>
      </div>
      <div className="md:col-span-2">
        <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="text-sm text-cyan-300 hover:text-cyan-200">
          {advancedOpen ? "Hide Advanced Simulation Settings" : "Show Advanced Simulation Settings"}
        </button>
      </div>
      {advancedOpen || researchMode ? (
        <>
          <label className="grid gap-1 text-sm text-zinc-400">
            Initial Probability
            <input name="initial_probability" type="number" step="0.01" min="0.01" max="0.99" defaultValue={0.5} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100" />
          </label>
          <label className="grid gap-1 text-sm text-zinc-400">
            Simulation Rounds
            <input name="rounds" type="number" min="1" max="200" defaultValue={10} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100" />
          </label>
          <label className="grid gap-1 text-sm text-zinc-400">
            Max Agents
            <input name="max_agents" type="number" min="2" max="1000" defaultValue={10} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100" />
          </label>
          <label className="grid gap-1 text-sm text-zinc-400">
            Market Sensitivity
            <input name="lmsr_b" type="number" min="2" defaultValue={48} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100" />
          </label>
        </>
      ) : null}
      <button disabled={loading} className="p-3 rounded-xl bg-emerald-400 text-zinc-950 font-semibold disabled:opacity-60">
        {loading ? "Launching market..." : "Launch Market"}
      </button>
      {error ? <p className="md:col-span-2 text-red-400 text-sm">{error}</p> : null}
    </form>
  );
}
