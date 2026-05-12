"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { CategoryCard, MarketCard, SectionHeader } from "../../components/platform";
import { getTrends } from "../../lib/api";
import { TrendsPayload } from "../../lib/types";

function TrendsContent() {
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  useEffect(() => {
    getTrends().then(setPayload).catch(console.error);
  }, []);
  if (!payload) return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading trends...</main>;
  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader eyebrow="Trends" title="What the ecosystem believes right now" description="A narrative-level view of how public markets and agents are repricing the future." />
        <section className="grid gap-4 xl:grid-cols-3">
          {payload.beliefs.map((belief) => (
            <div key={belief.headline} className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">{belief.category}</div>
              <h3 className="mt-2 text-xl font-semibold text-white">{belief.headline}</h3>
              <p className="mt-3 text-sm text-zinc-400">{belief.summary}</p>
            </div>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SectionHeader title="Trending markets" />
            <div className="grid gap-4 md:grid-cols-2">
              {payload.trending_markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <SectionHeader title="Sentiment map" />
            {payload.sentiment_map.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function TrendsPage() {
  return (
    <AuthGuard>
      <TrendsContent />
    </AuthGuard>
  );
}
