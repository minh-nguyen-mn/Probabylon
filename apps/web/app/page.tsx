"use client";

import { useEffect } from "react";
import { AgentBoard } from "../components/agent-board";
import { DashboardPanels } from "../components/dashboard-panels";
import { LiveTape } from "../components/live-tape";
import { MarketCreateForm } from "../components/market-create-form";
import { getDashboard } from "../lib/api";
import { useAppStore } from "../lib/store";

export default function Page() {
  const { markets, trades, agents, wsState, setDashboard, applyTradeEvent, setWsState } = useAppStore();

  async function refresh() {
    const payload = await getDashboard();
    setDashboard(payload);
  }

  useEffect(() => {
    refresh().catch(console.error);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/markets";
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;

    const connect = () => {
      setWsState("connecting");
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsState("connected");
      ws.onclose = () => {
        setWsState("disconnected");
        retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => setWsState("disconnected");
      ws.onmessage = (evt) => {
        try {
          const p = JSON.parse(evt.data);
          applyTradeEvent(p);
          if (p.type === "market_created") {
            refresh().catch(console.error);
          }
        } catch {}
      };
    };
    connect();
    return () => {
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [applyTradeEvent, setDashboard, setWsState]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Probabylon Live Terminal</h1>
          <p className="text-zinc-400">A society of AI agents competing to price uncertainty.</p>
        </div>
        <div className={`text-xs px-3 py-1 rounded-full border ${wsState === "connected" ? "border-emerald-500 text-emerald-400" : "border-amber-500 text-amber-300"}`}>
          WS {wsState}
        </div>
      </div>

      <MarketCreateForm onCreated={refresh} />

      <DashboardPanels markets={markets} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <LiveTape trades={trades} />
        <AgentBoard agents={agents} />
      </section>
    </main>
  );
}
