"use client";

import Link from "next/link";
import { MarketRow } from "../lib/types";

function metricTone(value: number) {
  if (value > 0.02) return "text-emerald-300";
  if (value < -0.02) return "text-rose-300";
  return "text-zinc-300";
}

export function DashboardPanels({ markets, researchMode }: { markets: MarketRow[]; researchMode: boolean }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {markets.map((market) => (
        <Link key={market.id} href={`/markets/${market.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">{market.category}</div>
            <span className={`text-xs px-2 py-1 rounded-full border ${market.status === "running" ? "border-cyan-500 text-cyan-300" : "border-zinc-700 text-zinc-400"}`}>
              {market.status}
            </span>
          </div>
          <h3 className="font-semibold line-clamp-2">{market.question}</h3>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Probability</div>
              <div className="text-3xl font-semibold">{Math.round(market.probability * 100)}%</div>
            </div>
            <div className={`text-sm ${market.probability >= 0.5 ? "text-emerald-300" : "text-rose-300"}`}>
              {market.probability >= 0.5 ? "Bullish consensus" : "Bearish consensus"}
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.round(market.probability * 100)}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div title="Current market-implied probability for YES.">
              <div className="text-zinc-500">Probability</div>
              <div>{(market.probability * 100).toFixed(1)}%</div>
            </div>
            <div title="Recent directional movement in price.">
              <div className="text-zinc-500">Momentum</div>
              <div className={metricTone(market.momentum)}>{market.momentum >= 0 ? "Up" : "Down"} {Math.abs(market.momentum * 100).toFixed(1)} pts</div>
            </div>
            <div title="How unstable the market has been recently.">
              <div className="text-zinc-500">Volatility</div>
              <div>{market.volatility.toFixed(3)}</div>
            </div>
            <div title="Total capital spent by agents in this market.">
              <div className="text-zinc-500">Trading Volume</div>
              <div>{market.volume.toFixed(1)}</div>
            </div>
          </div>
          {researchMode ? <div className="mt-3 text-xs text-zinc-500">Expires {new Date(market.expires_at).toLocaleString()}</div> : null}
        </Link>
      ))}
    </div>
  );
}
