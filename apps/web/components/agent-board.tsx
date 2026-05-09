"use client";

import { AgentRow } from "../lib/types";

export function AgentBoard({ agents, researchMode }: { agents: AgentRow[]; researchMode: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 h-[360px] overflow-auto">
      <h3 className="font-semibold mb-2">Agent Ecosystem</h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <div key={agent.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
            <div className="flex justify-between">
              <span className="font-medium">{agent.persona}</span>
              <span className="text-emerald-400">capital {agent.capital.toFixed(2)}</span>
            </div>
            <div className="text-zinc-400 mt-1 line-clamp-2">{agent.risk_profile?.worldview || "Adaptive market participant"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-300">
              <span>{(agent.risk_profile?.risk ?? 0.5) >= 0.6 ? "High conviction" : "Measured sizing"}</span>
              <span>{(agent.risk_profile?.contrarian ?? 0.3) >= 0.5 ? "Contrarian" : "Trend-aware"}</span>
            </div>
            {researchMode ? (
              <div className="mt-2 grid grid-cols-3 gap-2 text-zinc-500">
                <span>risk {(agent.risk_profile?.risk ?? 0.5).toFixed(2)}</span>
                <span>rep {agent.reputation.toFixed(2)}</span>
                <span>cal {agent.calibration_score.toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
