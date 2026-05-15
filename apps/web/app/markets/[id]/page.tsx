"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AgentMiniCard, MarketCard, SectionHeader, StatCard } from "../../../components/platform";
import { getMarketDetail } from "../../../lib/api";
import { getWebSocketUrl } from "../../../lib/runtime";
import { MarketDetailPayload } from "../../../lib/types";

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payload, setPayload] = useState<MarketDetailPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    setError("");
    getMarketDetail(id)
      .then((nextPayload) => {
        if (!disposed) setPayload(nextPayload);
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : "Failed to load market detail");
      });
    return () => {
      disposed = true;
    };
  }, [id]);

  useEffect(() => {
    const wsUrl = getWebSocketUrl();
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          if (event.type !== "trade" || event.market_id !== id) return;
          setPayload((prev) => {
            if (!prev) return prev;
            const tradeId = Date.now();
            const createdAt = new Date().toISOString();
            return {
              ...prev,
              market: {
                ...prev.market,
                probability: event.probability,
                volume: Number(prev.market.volume || 0) + Number(event.spend || 0),
              },
              trades: [
                ...prev.trades,
                {
                  id: tradeId,
                  market_id: id,
                  agent_id: event.agent_id,
                  confidence: event.confidence,
                  estimated_probability: event.estimated_probability,
                  spend: event.spend,
                  pre_probability: event.pre_probability ?? prev.market.probability,
                  post_probability: event.probability,
                  rationale: event.rationale || "",
                  round_index: event.round || 0,
                  created_at: createdAt,
                  shares_delta: event.shares_delta,
                  direction: event.direction,
                  research_history: [],
                },
              ].slice(-500),
              probability_history: [
                ...prev.probability_history,
                {
                  trade_id: tradeId,
                  round_index: event.round || 0,
                  post_probability: event.probability,
                  confidence: event.confidence,
                  agent_id: event.agent_id,
                  created_at: createdAt,
                },
              ].slice(-1000),
              timeline_replay: [
                ...prev.timeline_replay,
                {
                  label: `Round ${event.round || 0}`,
                  probability: event.probability,
                  summary: event.rationale || "Live repricing event",
                  created_at: createdAt,
                },
              ].slice(-12),
              sentiment_overview: {
                ...prev.sentiment_overview,
                confidence_shift:
                  (prev.probability_history.length
                    ? event.probability - prev.probability_history[0].post_probability
                    : 0),
                activity_level: (prev.sentiment_overview.activity_level || 0) + 1,
              },
            };
          });
        } catch {
          return;
        }
      };
      ws.onerror = () => {
        if (!disposed) setError((current) => current || "Realtime market stream is temporarily unavailable.");
      };
      ws.onclose = () => {
        if (disposed) return;
        retry = setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [id]);

  const probabilitySeries = useMemo(
    () =>
      (payload?.probability_history || []).map((point) => ({
        label: `R${point.round_index}`,
        probability: Number((point.post_probability * 100).toFixed(2)),
        confidence: Number((point.confidence * 100).toFixed(2)),
      })),
    [payload]
  );

  const historySeries = useMemo(
    () =>
      (payload?.market_history || []).map((point, index) => ({
        label: index + 1,
        probability: Number((point.probability * 100).toFixed(2)),
        confidence: Number((point.confidence * 100).toFixed(2)),
      })),
    [payload]
  );

  if (!payload && !error) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-200">Loading market...</main>;
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-semibold">Market unavailable</h1>
          <p className="mt-3 text-sm text-red-100/80">{error}</p>
          <Link href="/markets" className="mt-5 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
            Back to markets
          </Link>
        </div>
      </main>
    );
  }

  const market = payload.market;
  const confidenceBuckets = payload.confidence_distribution.filter((item) => typeof item.count === "number");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(180deg,_#050816,_#0f172a_55%,_#020617)] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/markets" className="text-sm text-emerald-300 transition hover:text-white">
            Back to markets
          </Link>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-zinc-400">
            <span className="rounded-full border border-zinc-700 px-3 py-1">{market.category}</span>
            <span className="rounded-full border border-zinc-700 px-3 py-1">{market.status}</span>
            {market.source ? <span className="rounded-full border border-zinc-700 px-3 py-1">{market.source}</span> : null}
          </div>
        </div>

        <section className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {market.is_featured ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-300">Featured</span> : null}
                {market.is_pinned ? <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">Pinned</span> : null}
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold text-white md:text-4xl">{market.question}</h1>
              <p className="max-w-4xl text-sm leading-7 text-zinc-300">{market.description}</p>
              {market.resolution_criteria ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Resolution Criteria</div>
                  {market.resolution_criteria}
                </div>
              ) : null}
              {market.narratives?.length ? (
                <div className="flex flex-wrap gap-2">
                  {market.narratives.map((narrative) => (
                    <span key={narrative} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-200">
                      {narrative}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <StatCard label="Live probability" value={`${Math.round(market.probability * 100)}%`} tone="emerald" hint="Collective estimate right now" />
              <StatCard label="Confidence" value={`${Math.round(market.confidence * 100)}%`} tone="cyan" hint="Stability of the current pricing" />
              <StatCard label="Volume" value={market.volume.toFixed(1)} tone="amber" hint="Total simulated and collective trading activity" />
              <StatCard label="Volatility" value={market.volatility.toFixed(3)} hint={`Expires ${new Date(market.expires_at).toLocaleString()}`} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Confidence shift" value={`${(payload.sentiment_overview.confidence_shift * 100).toFixed(1)} pts`} tone="emerald" />
          <StatCard label="Activity level" value={String(payload.sentiment_overview.activity_level)} tone="cyan" />
          <StatCard label="Bullish share" value={`${Math.round(payload.sentiment_overview.bullish_share * 100)}%`} tone="amber" />
          <StatCard label="Disagreement" value={`${(payload.sentiment_overview.disagreement_score * 100).toFixed(1)}%`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Probability and confidence" description="Live probability evolution, agent confidence, and how conviction has shifted over time." />
            <div className="mt-5 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={probabilitySeries}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#71717a" />
                  <YAxis stroke="#71717a" domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="probability" stroke="#34d399" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="confidence" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Confidence distribution" description="Where agent conviction clusters across the trade stream." />
            <div className="mt-5 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceBuckets}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" stroke="#71717a" />
                  <YAxis stroke="#71717a" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Timeline replay" description="A concise replay of the recent moments that changed the market." />
            <div className="mt-5 grid gap-3">
              {payload.timeline_replay.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-sm text-emerald-300">{Math.round(item.probability * 100)}%</div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-300">{item.summary}</div>
                  <div className="mt-2 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Market history" description="A compressed history of the market's belief path." />
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historySeries}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#71717a" />
                  <YAxis stroke="#71717a" domain={[0, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="probability" stroke="#34d399" fill="rgba(52, 211, 153, 0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Evidence sources" description="The snippets and source traces influencing recent repricing." />
            <div className="mt-5 space-y-3">
              {payload.evidence_sources.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-2 text-sm text-zinc-300">{item.snippet}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Reasoning and activity tape" description="Every trade, every confidence shift, and the rationale behind it." />
            <div className="mt-5 max-h-[520px] space-y-3 overflow-auto pr-1">
              {payload.trades.slice().reverse().map((trade) => (
                <div key={trade.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <span>{trade.agent_id}</span>
                    <span>{trade.direction || `round ${trade.round_index}`}</span>
                  </div>
                  <div className="mt-3 text-sm text-zinc-200">
                    {(trade.pre_probability * 100).toFixed(1)}% to {(trade.post_probability * 100).toFixed(1)}% with {Math.round(trade.confidence * 100)}% confidence and {trade.spend.toFixed(2)} spend.
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">{trade.rationale || "No rationale provided."}</div>
                  {trade.research_history?.length ? (
                    <div className="mt-3 space-y-2 text-xs text-zinc-500">
                      {trade.research_history.slice(0, 3).map((item, idx) => (
                        <div key={`${trade.id}-${idx}`}>
                          {(item.title || item.source || "Source") as string}: {(item.snippet || item.page_summary || item.url || "No summary") as string}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Top participating agents" description="The agents most active in shaping this market's path." />
            <div className="mt-5 space-y-3">
              {payload.top_agents.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <AgentMiniCard agent={agent} />
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-300">
                    <div>
                      <div className="text-zinc-500">Activity</div>
                      <div>{agent.activity_count ?? 0} actions</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Avg confidence</div>
                      <div>{Math.round((agent.average_confidence ?? 0) * 100)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <SectionHeader title="Related markets" description="Correlated public markets in the same narrative neighborhood." />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {payload.related_markets.map((related) => (
                  <MarketCard key={related.id} market={related} compact />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
