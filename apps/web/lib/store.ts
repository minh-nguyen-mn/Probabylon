import { create } from "zustand";
import { DashboardPayload, MarketRow, TradeRow } from "./types";

type WSState = "connecting" | "connected" | "disconnected";

type AppState = {
  wsState: WSState;
  markets: MarketRow[];
  trades: TradeRow[];
  agents: DashboardPayload["active_agents"];
  setDashboard: (payload: DashboardPayload) => void;
  applyTradeEvent: (payload: any) => void;
  setWsState: (state: WSState) => void;
};

export const useAppStore = create<AppState>((set) => ({
  wsState: "connecting",
  markets: [],
  trades: [],
  agents: [],
  setDashboard: (payload) => set({ markets: payload.markets, trades: payload.recent_trades, agents: payload.active_agents }),
  applyTradeEvent: (event) =>
    set((state) => {
      if (event.type !== "trade") return state;
      const markets = state.markets.map((m) =>
        m.id === event.market_id
          ? {
              ...m,
              probability: event.probability,
              volume: m.volume + (event.spend || 0),
            }
          : m
      );
      const newTrade: TradeRow = {
        id: Date.now(),
        market_id: event.market_id,
        agent_id: event.agent_id,
        confidence: event.confidence,
        estimated_probability: event.estimated_probability || event.probability,
        spend: event.spend || 0,
        pre_probability: event.pre_probability || event.probability,
        post_probability: event.probability,
        rationale: event.rationale || "",
        round_index: event.round || 0,
        created_at: new Date().toISOString(),
        shares_delta: event.shares_delta || 0,
      };
      return {
        ...state,
        markets,
        trades: [newTrade, ...state.trades].slice(0, 300),
      };
    }),
  setWsState: (wsState) => set({ wsState }),
}));
