"use client";

import { TradeRow } from "../lib/types";

export function LiveTape({ trades, researchMode }: { trades: TradeRow[]; researchMode: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 h-[360px] overflow-auto">
      <h3 className="font-semibold mb-2">Live Agent Activity</h3>
      <div className="space-y-2 text-xs">
        {trades.map((trade) => (
          <div key={`${trade.market_id}-${trade.id}-${trade.created_at}`} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex justify-between text-zinc-400">
              <span>{trade.agent_title || trade.agent_id}</span>
              <span className={trade.direction === "bullish" ? "text-emerald-300" : "text-rose-300"}>{trade.direction || "trade"}</span>
            </div>
            <div className="mt-2">
              Belief moved from {(trade.pre_probability * 100).toFixed(1)}% to {(trade.post_probability * 100).toFixed(1)}% with {(trade.confidence * 100).toFixed(0)}% confidence.
            </div>
            <div className="text-zinc-500 mt-1 line-clamp-3">{trade.rationale}</div>
            {researchMode ? <div className="mt-1 text-zinc-600">Round {trade.round_index} | Spend {trade.spend.toFixed(2)} | Shares {Number(trade.shares_delta || 0).toFixed(2)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
