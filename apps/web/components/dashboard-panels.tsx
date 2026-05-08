"use client";

import Link from "next/link";
import { MarketRow } from "../lib/types";

export function DashboardPanels({ markets }: { markets: MarketRow[] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {markets.map((m) => (
        <Link key={m.id} href={`/markets/${m.id}`} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 hover:border-emerald-400 transition-colors">
          <div className="text-sm text-zinc-400">{m.category}</div>
          <h3 className="font-semibold line-clamp-2">{m.question}</h3>
          <div className="mt-3 h-2 rounded bg-zinc-800 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.round(m.probability * 100)}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-4 text-xs">
            <span>P {Math.round(m.probability * 100)}%</span>
            <span>M {m.momentum.toFixed(3)}</span>
            <span>V {m.volatility.toFixed(3)}</span>
            <span>Vol {m.volume.toFixed(1)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
