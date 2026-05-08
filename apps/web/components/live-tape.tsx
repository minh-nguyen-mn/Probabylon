"use client";

import { TradeRow } from "../lib/types";

export function LiveTape({ trades }: { trades: TradeRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 h-[360px] overflow-auto">
      <h3 className="font-semibold mb-2">Live Activity Tape</h3>
      <div className="space-y-2 text-xs">
        {trades.map((t) => (
          <div key={`${t.market_id}-${t.id}-${t.created_at}`} className="p-2 rounded bg-zinc-950 border border-zinc-800">
            <div className="flex justify-between text-zinc-400">
              <span>{t.agent_id}</span>
              <span>r{t.round_index}</span>
            </div>
            <div className="mt-1">
              p: {(t.pre_probability * 100).toFixed(1)}% → {(t.post_probability * 100).toFixed(1)}% | conf {(t.confidence * 100).toFixed(0)}% | spend {t.spend.toFixed(2)}
            </div>
            <div className="text-zinc-500 mt-1 line-clamp-2">{t.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
