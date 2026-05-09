"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getMarketDetail } from "../../../lib/api";
import { useAppStore } from "../../../lib/store";

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payload, setPayload] = useState<any>(null);
  const pushTradeNotification = useAppStore((state) => state.pushTradeNotification);

  useEffect(() => {
    let disposed = false;
    getMarketDetail(id)
      .then((nextPayload) => {
        if (!disposed) setPayload(nextPayload);
      })
      .catch(console.error);
    return () => {
      disposed = true;
    };
  }, [id]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/markets";
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          if (event.type !== "trade" || event.market_id !== id) return;
          console.log("[Probabylon Market WS trade]", event);
          pushTradeNotification({ ...event, question: payload?.market?.question });
          setPayload((prev: any) => {
            if (!prev) return prev;
            const trade = {
              id: Date.now(),
              agent_id: event.agent_title || event.agent_id,
              confidence: event.confidence,
              estimated_probability: event.estimated_probability,
              spend: event.spend,
              shares_delta: event.shares_delta,
              pre_probability: event.pre_probability ?? prev.market.probability,
              post_probability: event.probability,
              rationale: event.rationale || "",
              research_history: [],
              round_index: event.round || 0,
              created_at: new Date().toISOString(),
              direction: event.direction,
            };
            return {
              ...prev,
              market: {
                ...prev.market,
                probability: event.probability,
                volume: Number(prev.market.volume || 0) + Number(event.spend || 0),
              },
              trades: [...prev.trades, trade].slice(-1000),
              probability_history: [
                ...prev.probability_history,
                {
                  trade_id: trade.id,
                  round_index: trade.round_index,
                  post_probability: event.probability,
                  confidence: event.confidence,
                  agent_id: trade.agent_id,
                  created_at: trade.created_at,
                },
              ].slice(-1000),
            };
          });
        } catch {}
      };
      ws.onclose = () => {
        if (disposed) return;
        retry = setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [id, payload?.market?.question, pushTradeNotification]);

  useEffect(() => {
    if (!payload) return;
    console.log("[Probabylon Market Detail]", {
      market: payload.market,
      agents: payload.agents?.map((agent: any) => ({
        id: agent.id,
        persona: agent.persona,
        capital: agent.capital,
        reputation: agent.reputation,
        calibration_score: agent.calibration_score,
      })),
      latestTrades: payload.trades?.slice(-10),
    });
  }, [payload]);

  const chartData = useMemo(
    () =>
      (payload?.probability_history || []).map((point: any) => ({
        x: `${point.round_index}-${point.trade_id}`,
        probability: point.post_probability,
        confidence: point.confidence,
      })),
    [payload]
  );

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Loading market...</main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_30%),linear-gradient(180deg,_#09090b,_#111827_50%,_#020617)] text-zinc-100 p-4 md:p-6 space-y-4">
      <a href="/" className="text-emerald-400 text-sm">Back to dashboard</a>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h1 className="text-2xl font-semibold">{payload.market.question}</h1>
        <p className="text-zinc-400 mt-1">{payload.market.description}</p>
        <div className="mt-2 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
          <span>Probability {(payload.market.probability * 100).toFixed(1)}%</span>
          <span>Volatility {payload.market.volatility.toFixed(3)}</span>
          <span>Volume {payload.market.volume.toFixed(2)}</span>
          <span>Status {payload.market.status}</span>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 h-[320px]">
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
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 h-[320px]">
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
        <h3 className="font-semibold mb-2">Reasoning & Trade Timeline</h3>
        <div className="space-y-2 max-h-[440px] overflow-auto text-xs">
          {payload.trades.slice().reverse().map((trade: any) => (
            <div key={trade.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="flex justify-between text-zinc-400">
                <span>{trade.agent_id}</span>
                <span>{trade.direction || `round ${trade.round_index}`}</span>
              </div>
              <div className="mt-1">
                {(trade.pre_probability * 100).toFixed(1)}% to {(trade.post_probability * 100).toFixed(1)}% | conf {(trade.confidence * 100).toFixed(0)}% | spend {trade.spend.toFixed(2)}
              </div>
              <div className="text-zinc-500 mt-1">{trade.rationale}</div>
              {trade.research_history?.length ? (
                <div className="mt-2 space-y-1 text-zinc-600">
                  {trade.research_history.slice(0, 3).map((item: any, idx: number) => (
                    <div key={`${trade.id}-${idx}`}>
                      {item.title || item.source}: {item.snippet || item.page_summary || item.url}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
