"use client";

import { useEffect, useState } from "react";
import { AgentBoard } from "../components/agent-board";
import { DashboardPanels } from "../components/dashboard-panels";
import { LiveTape } from "../components/live-tape";
import { MarketCreateForm } from "../components/market-create-form";
import { getDashboard } from "../lib/api";
import { useAppStore } from "../lib/store";

export default function Page() {
  const { markets, trades, agents, wsState, setDashboard, applyTradeEvent, setWsState } = useAppStore();
  const [researchMode, setResearchMode] = useState(false);

  async function refresh() {
    const payload = await getDashboard();
    setDashboard(payload);
  }

  useEffect(() => {
    let disposed = false;
    refresh().catch(console.error);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/markets";
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;

    const connect = () => {
      if (disposed) return;
      setWsState("connecting");
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsState("connected");
      ws.onclose = () => {
        if (disposed) return;
        setWsState("disconnected");
        retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => setWsState("disconnected");
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          console.log("[Probabylon WS event]", payload);
          applyTradeEvent(payload);
          if (payload.type === "market_created") {
            refresh().catch(console.error);
          }
        } catch {}
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [applyTradeEvent, setDashboard, setWsState]);

  useEffect(() => {
    console.log("[Probabylon Dashboard] markets", markets);
  }, [markets]);

  useEffect(() => {
    console.log(
      "[Probabylon Agents]",
      agents.map((agent) => ({
        id: agent.id,
        persona: agent.persona,
        capital: agent.capital,
        reputation: agent.reputation,
        calibration_score: agent.calibration_score,
      }))
    );
  }, [agents]);

  useEffect(() => {
    if (!trades.length) return;
    console.log("[Probabylon Trades]", trades.slice(0, 10));
  }, [trades]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(180deg,_#09090b,_#111827_50%,_#020617)] text-zinc-100 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Probabylon</h1>
          <p className="text-zinc-400">Watch a society of AI minds compete to price uncertainty in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setResearchMode((value) => !value)} className={`text-xs px-3 py-1 rounded-full border ${researchMode ? "border-cyan-400 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}>
            {researchMode ? "Research Mode On" : "Research Mode Off"}
          </button>
          <div className={`text-xs px-3 py-1 rounded-full border ${wsState === "connected" ? "border-emerald-500 text-emerald-400" : "border-amber-500 text-amber-300"}`}>
            WS {wsState}
          </div>
        </div>
      </div>

      <MarketCreateForm onCreated={refresh} researchMode={researchMode} />

      <DashboardPanels markets={markets} researchMode={researchMode} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <LiveTape trades={trades} researchMode={researchMode} />
        <AgentBoard agents={agents} researchMode={researchMode} />
      </section>
    </main>
  );
}
