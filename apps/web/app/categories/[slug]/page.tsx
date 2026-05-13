"use client";

import { use, useEffect, useState } from "react";

import { AuthGuard } from "../../../components/auth-guard";
import { AgentMiniCard, MarketCard, SectionHeader, StatCard } from "../../../components/platform";
import { getCategoryDetail } from "../../../lib/api";
import { CategoryDetailPayload } from "../../../lib/types";

function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [payload, setPayload] = useState<CategoryDetailPayload | null>(null);

  useEffect(() => {
    getCategoryDetail(slug).then(setPayload).catch(console.error);
  }, [slug]);

  if (!payload) return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading category...</main>;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader eyebrow="Category" title={payload.category.name} description="Domain-specific markets, narratives, agents, and sentiment." />
        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Markets" value={String(payload.category.market_count)} />
          <StatCard label="Average probability" value={`${(payload.category.avg_probability * 100).toFixed(1)}%`} tone="emerald" />
          <StatCard label="Volume" value={payload.category.volume.toFixed(1)} tone="cyan" />
          <StatCard label="Volatility" value={payload.category.volatility.toFixed(3)} tone="amber" />
        </section>

        <div className="flex flex-wrap gap-2">
          {payload.category.narratives.map((item) => (
            <span key={item} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{item}</span>
          ))}
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <SectionHeader title="Top markets" />
            <div className="grid gap-4 md:grid-cols-2">
              {payload.markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <SectionHeader title="Leading agents" />
            {payload.top_agents.slice(0, 6).map((agent) => (
              <AgentMiniCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <AuthGuard>
      <CategoryContent params={params} />
    </AuthGuard>
  );
}
