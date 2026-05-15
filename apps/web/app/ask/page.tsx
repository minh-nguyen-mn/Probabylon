"use client";

import { FormEvent, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { SectionHeader, StatCard } from "../../components/platform";
import { askForecast } from "../../lib/api";
import { ForecastResult } from "../../lib/types";

function AskContent() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("ai");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await askForecast({ question, category, context }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate forecast.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionHeader
          eyebrow="Private Forecasting"
          title="Ask the forecast engine"
          description="Submit a forward-looking question and receive a structured probability assessment with evidence, agent rationale, confidence, contradictions, and traceable source metadata."
        />

        <form onSubmit={onSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="grid gap-4">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Will AGI arrive before 2035?" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-lg text-white" />
            <div className="grid gap-4 md:grid-cols-[0.4fr_1fr]">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white">
                <option value="ai">AI</option>
                <option value="finance">Finance</option>
                <option value="technology">Technology</option>
                <option value="science">Science</option>
                <option value="society">Society</option>
                <option value="absurdity">Absurdity</option>
              </select>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Add assumptions, timeframe, or constraints that should shape the forecast." className="min-h-28 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
            </div>
            <button disabled={loading || !question.trim()} className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60">
              {loading ? "Generating forecast..." : "Generate private forecast"}
            </button>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
          </div>
        </form>

        {result ? (
          <div className="space-y-6">
            <section className="grid gap-3 md:grid-cols-3">
              <StatCard label="Probability" value={`${Math.round(result.probability * 100)}%`} tone="emerald" />
              <StatCard label="Confidence" value={`${Math.round(result.confidence_score * 100)}%`} tone="cyan" />
              <StatCard label="Disagreement" value={`${Math.round((1 - result.confidence_score) * 100)}%`} tone="amber" />
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <SectionHeader title="Consensus summary" description={result.summary} />
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-200">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Final prediction</div>
                <div className="mt-2 text-lg font-semibold text-white">{result.final_prediction}</div>
                <div className="mt-3 text-xs text-zinc-500">
                  Timestamp: {new Date(result.timestamp).toLocaleString()} | Model: {result.model_version}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Supporting evidence</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {result.supporting_evidence.map((item) => (
                    <li key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Contradictory signals</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {result.contradictory_signals.map((item) => (
                    <li key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <SectionHeader title="Agent-by-agent reasoning" description="Each agent contributes a concise rationale without exposing hidden chain-of-thought." />
              <div className="mt-4 grid gap-3">
                {result.agent_reasoning.map((item) => (
                  <div key={`${item.agent}-${item.stance}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white">{item.agent}</div>
                      <div className="text-sm text-zinc-400">
                        {item.stance} | {Math.round(item.confidence * 100)}%
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-300">{item.reasoning}</p>
                    <div className="mt-3 text-xs text-zinc-500">Evidence: {item.supporting_evidence.join(" | ") || "None attached"}</div>
                    <div className="mt-2 text-xs text-zinc-500">Contradictions: {item.contradictory_signals.join(" | ") || "None attached"}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <SectionHeader title="Source traceability" description="Every source shows origin type, freshness, and the evidence detail used for this run." />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {result.data_sources_used.map((source) => (
                  <div key={`${source.label}-${source.timestamp}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="font-medium text-white">{source.label}</div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {source.source_type} | {source.status} | {new Date(source.timestamp).toLocaleString()}
                    </div>
                    <div className="mt-3 text-sm text-zinc-300">{source.detail}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function AskPage() {
  return (
    <AuthGuard>
      <AskContent />
    </AuthGuard>
  );
}
