"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { CategoryCard, MarketCard, SectionHeader, StatCard } from "../../components/platform";
import { getExploreMarkets } from "../../lib/api";
import { ExplorePayload } from "../../lib/types";

const SORTS = [
  ["trending", "Trending"],
  ["newest", "Newest"],
  ["highest_volume", "Highest volume"],
  ["highest_volatility", "Highest volatility"],
  ["ending_soon", "Ending soon"],
  ["controversial", "Most controversial"],
  ["resolved", "Recently resolved"],
] as const;

function MarketsContent() {
  const [payload, setPayload] = useState<ExplorePayload | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("trending");
  const [category, setCategory] = useState("");

  useEffect(() => {
    getExploreMarkets({ search, sort, category }).then(setPayload).catch(console.error);
  }, [search, sort, category]);

  const categories = useMemo(() => payload?.categories || [], [payload]);

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading market explorer...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader
          eyebrow="Markets"
          title="Explore the public forecast layer"
          description="Filter by category, volatility, volume, timing, or controversy to find the highest-signal public prediction markets."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Uncertainty index" value={payload.stats.uncertainty_index.toFixed(1)} />
          <StatCard label="Consensus stability" value={`${payload.stats.consensus_stability.toFixed(1)}%`} tone="emerald" />
          <StatCard label="Calibration quality" value={`${payload.stats.calibration_quality.toFixed(1)}%`} tone="cyan" />
          <StatCard label="Market sentiment" value={`${payload.stats.market_sentiment.toFixed(1)}%`} tone="amber" />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets, narratives, or categories"
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white">
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white">
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <SectionHeader title="Market feed" description={`${payload.markets.length} public markets currently visible`} />
            <div className="grid gap-4 md:grid-cols-2">
              {payload.markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader title="Category map" description="The busiest areas of activity across the platform right now." />
            <div className="space-y-3">
              {payload.categories.slice(0, 6).map((item) => (
                <CategoryCard key={item.slug} category={item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function MarketsPage() {
  return (
    <AuthGuard>
      <MarketsContent />
    </AuthGuard>
  );
}
