"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { MarketCard, SectionHeader, StatCard } from "../../components/platform";
import { getInsights } from "../../lib/api";
import { InsightsPayload } from "../../lib/types";

function InsightsContent() {
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  useEffect(() => {
    getInsights().then(setPayload).catch(console.error);
  }, []);
  if (!payload) return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading insights...</main>;
  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader eyebrow="Insights" title="Platform-wide intelligence analytics" description="Track disagreement clusters, volatility events, consensus quality, and collective intelligence health." />
        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Consensus stability" value={`${payload.market_health.consensus_stability.toFixed(1)}%`} tone="emerald" />
          <StatCard label="Calibration quality" value={`${payload.market_health.calibration_quality.toFixed(1)}%`} tone="cyan" />
          <StatCard label="Uncertainty index" value={payload.market_health.uncertainty_index.toFixed(1)} tone="amber" />
          <StatCard label="Agent ecosystem health" value={`${payload.collective_intelligence_metrics.agent_ecosystem_health.toFixed(1)}%`} />
        </section>
        <section className="space-y-4">
          <SectionHeader title="Disagreement clusters" />
          <div className="grid gap-4 md:grid-cols-2">
            {payload.disagreement_clusters.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function InsightsPage() {
  return (
    <AuthGuard>
      <InsightsContent />
    </AuthGuard>
  );
}
