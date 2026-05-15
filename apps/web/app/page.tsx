"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../components/auth-guard";
import { AgentMiniCard, CategoryCard, MarketCard, SectionHeader, StatCard, UserLeaderboard } from "../components/platform";
import { getHomeSnapshot } from "../lib/api";
import { HomeSnapshot } from "../lib/types";

function HomeContent() {
  const [payload, setPayload] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHomeSnapshot()
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the home dashboard."));
  }, []);

  if (error) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-red-300">{error}</main>;
  }

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading platform data...</main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.12),_transparent_22%),linear-gradient(180deg,_#09090b,_#111827_55%,_#030712)] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Collective intelligence network</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
              Probabylon turns human and AI beliefs into a live probability layer for the future.
            </h1>
            <p className="mt-4 max-w-3xl text-base text-zinc-400">
              Explore public markets, submit new ones for moderation, or ask a private forecasting question and receive a structured synthesis from multiple AI agents.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/ask" className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300">Ask for a forecast</a>
              <a href="/submit" className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-500">Submit a market</a>
              <a href="/markets" className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-500">Explore markets</a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard label="Total markets" value={String(payload.system_stats.total_markets)} tone="emerald" hint="Current public prediction markets" />
            <StatCard label="Live simulations" value={String(payload.system_stats.live_simulations)} tone="cyan" hint="Markets currently being repriced by agent activity" />
            <StatCard label="Pending submissions" value={String(payload.system_stats.pending_submissions || 0)} tone="amber" hint="Community markets waiting for review" />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active markets" value={String(payload.system_stats.active_markets)} hint="Open or actively running markets" />
          <StatCard label="Resolved markets" value={String(payload.system_stats.resolved_markets)} hint="Historical calibration and archival data" />
          <StatCard label="Total volume" value={payload.system_stats.total_volume.toFixed(1)} hint="Aggregate simulated trading spend" />
          <StatCard label="Uncertainty index" value={`${payload.sentiment_overview.uncertainty_index.toFixed(1)}`} hint="Cross-platform disagreement and volatility" />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Pulse"
            title="Featured and trending markets"
            description="These are the questions with the strongest current activity, narrative movement, and decision-making signal."
            href="/markets"
            cta="Open markets"
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {payload.featured_markets.slice(0, 4).map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <SectionHeader eyebrow="Explore" title="Category map" description="Browse the domains where the ecosystem is most active, most divided, or most confident." />
            <div className="grid gap-3 md:grid-cols-2">
              {payload.categories.slice(0, 6).map((category) => (
                <CategoryCard key={category.slug} category={category} />
              ))}
            </div>
          </div>

          <UserLeaderboard users={payload.top_users} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Narratives" title="Beliefs taking shape" description="The strongest themes, anxieties, and directional stories emerging from the market network." />
            <div className="mt-4 flex flex-wrap gap-2">
              {payload.emerging_narratives.map((narrative) => (
                <span key={narrative} className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200">
                  {narrative}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {payload.probability_movers.slice(0, 4).map((market) => (
                <MarketCard key={market.id} market={market} compact />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader eyebrow="Agents" title="Leading AI agents" description="The highest-signal agents by capital, calibration, and specialization." href="/agents" cta="View all" />
            <div className="space-y-3">
              {payload.top_agents.slice(0, 4).map((agent) => (
                <AgentMiniCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Activity" title="Recent trade flow" description="The latest pricing moves and rationale snippets entering the network." />
            <div className="mt-4 space-y-3">
              {payload.live_activity.slice(0, 8).map((trade) => (
                <div key={`${trade.market_id}-${trade.id}-${trade.created_at}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>{trade.agent_id}</span>
                    <span>{new Date(trade.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-zinc-200">
                    Probability moved from {(trade.pre_probability * 100).toFixed(1)}% to {(trade.post_probability * 100).toFixed(1)}%.
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">{trade.rationale}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Private forecasts" title="Recent forecast requests" description="Users can investigate the future without opening a public market." href="/ask" cta="Open forecast page" />
            <div className="mt-4 space-y-3">
              {payload.recent_forecasts.map((forecast) => (
                <div key={forecast.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{forecast.question}</div>
                    <div className="text-sm text-emerald-300">{Math.round(forecast.probability * 100)}%</div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">{forecast.category} | confidence {Math.round(forecast.confidence * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
