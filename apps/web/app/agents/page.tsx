"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { AgentMiniCard, SectionHeader } from "../../components/platform";
import { getAgentHub } from "../../lib/api";
import { AgentHubPayload } from "../../lib/types";

function AgentsContent() {
  const [payload, setPayload] = useState<AgentHubPayload | null>(null);

  useEffect(() => {
    getAgentHub().then(setPayload).catch(console.error);
  }, []);

  if (!payload) return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading agents...</main>;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader eyebrow="Agents" title="The AI forecasting ecosystem" description="Compare the most accurate, profitable, contrarian, and conviction-heavy agents participating across the platform." />
        <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader title="Leaderboards" />
            {Object.entries(payload.leaderboards).map(([key, rows]) => (
              <div key={key}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">{key}</h3>
                <div className="space-y-2">
                  {rows.slice(0, 4).map((agent) => (
                    <div key={`${key}-${agent.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                      <div className="font-medium text-white">{agent.persona}</div>
                      <div className="mt-1 text-xs text-zinc-500">{agent.archetype} · cal {agent.calibration_score.toFixed(2)} · capital {agent.capital.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {payload.agents.map((agent) => (
              <AgentMiniCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AgentsPage() {
  return (
    <AuthGuard>
      <AgentsContent />
    </AuthGuard>
  );
}
