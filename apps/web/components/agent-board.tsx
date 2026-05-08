"use client";

import { AgentRow } from "../lib/types";

export function AgentBoard({ agents }: { agents: AgentRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 h-[360px] overflow-auto">
      <h3 className="font-semibold mb-2">Agent Ecosystem</h3>
      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="p-2 rounded bg-zinc-950 border border-zinc-800 text-xs">
            <div className="flex justify-between">
              <span className="font-medium">{a.id}</span>
              <span className="text-emerald-400">capital {a.capital.toFixed(2)}</span>
            </div>
            <div className="text-zinc-400 line-clamp-1">{a.persona}</div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <span>risk {(a.risk_profile?.risk ?? 0.5).toFixed(2)}</span>
              <span>rep {a.reputation.toFixed(2)}</span>
              <span>cal {a.calibration_score.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
