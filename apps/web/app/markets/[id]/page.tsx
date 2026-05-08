"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getMarketDetail } from "../../../lib/api";

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    getMarketDetail(id).then(setPayload).catch(console.error);
  }, [id]);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/markets");
    ws.onmessage = (evt) => {
      try {
        const p = JSON.parse(evt.data);
        if (p.type !== "trade" || p.market_id !== id) return;
        setPayload((prev: any) => {
          if (!prev) return prev;
          const trade = {
            id: Date.now(),
            agent_id: p.agent_id,
            confidence: p.confidence,
            estimated_probability: p.estimated_probability,
            spend: p.spend,
            shares_delta: p.shares_delta,
            pre_probability: prev.market.probability,
            post_probability: p.probability,
            rationale: p.rationale || "",
            research_history: [],
            round_index: p.round || 0,
            created_at: new Date().toISOString(),
          };
          return {
            ...prev,
            market: {
              ...prev.market,
              probability: p.probability,
              volume: Number(prev.market.volume || 0) + Number(p.spend || 0),
            },
            trades: [...prev.trades, trade].slice(-1000),
            probability_history: [
              ...prev.probability_history,
              {
                trade_id: trade.id,
                round_index: trade.round_index,
                post_probability: p.probability,
                confidence: p.confidence,
                agent_id: p.agent_id,
                created_at: trade.created_at,
              },
            ].slice(-1000),
          };
        });
      } catch {}
    };
    return () => ws.close();
  }, [id]);

  const chartData = useMemo(
    () =>
      (payload?.probability_history || []).map((p: any) => ({
        x: `${p.round_index}-${p.trade_id}`,
        probability: p.post_probability,
        confidence: p.confidence,
      })),
    [payload]
  );

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Loading market...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6 space-y-4">
      <a href="/" className="text-emerald-400 text-sm">← Back to dashboard</a>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
        <h1 className="text-2xl font-semibold">{payload.market.question}</h1>
        <p className="text-zinc-400 mt-1">{payload.market.description}</p>
        <div className="mt-2 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
          <span>P {(payload.market.probability * 100).toFixed(1)}%</span>
          <span>Volatility {payload.market.volatility.toFixed(3)}</span>
          <span>Volume {payload.market.volume.toFixed(2)}</span>
          <span>Status {payload.market.status}</span>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 h-[320px]">
          <h3 className="font-semibold mb-2">Probability Evolution</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <XAxis dataKey="x" hide />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Line dataKey="probability" stroke="#34d399" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 h-[320px]">
          <h3 className="font-semibold mb-2">Confidence Distribution</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={payload.confidence_distribution}>
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#22d3ee" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
        <h3 className="font-semibold mb-2">Reasoning & Trade Timeline</h3>
        <div className="space-y-2 max-h-[440px] overflow-auto text-xs">
          {payload.trades.slice().reverse().map((t: any) => (
            <div key={t.id} className="p-2 rounded border border-zinc-800 bg-zinc-950">
              <div className="flex justify-between text-zinc-400">
                <span>{t.agent_id}</span>
                <span>round {t.round_index}</span>
              </div>
              <div className="mt-1">
                {(t.pre_probability * 100).toFixed(1)}% → {(t.post_probability * 100).toFixed(1)}% | conf {(t.confidence * 100).toFixed(0)}% | spend {t.spend.toFixed(2)}
              </div>
              <div className="text-zinc-500 mt-1">{t.rationale}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
