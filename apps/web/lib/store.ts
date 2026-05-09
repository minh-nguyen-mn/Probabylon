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
      if (event.type === "market_created") {
        if (state.markets.some((market) => market.id === event.market_id)) return state;
        return {
          ...state,
          markets: [
            {
              id: event.market_id,
              question: event.question || "New market",
              category: event.category || "general",
              probability: Number(event.probability ?? 0.5),
              momentum: 0,
              volatility: 0,
              volume: 0,
              status: event.status || "open",
              expires_at: event.expires_at || new Date().toISOString(),
            },
            ...state.markets,
          ],
        };
      }

      if (event.type === "simulation_completed") {
        return {
          ...state,
          markets: state.markets.map((market) =>
            market.id === event.market_id
              ? { ...market, probability: Number(event.final_probability ?? market.probability), status: "open" }
              : market
          ),
        };
      }

      if (event.type === "simulation_started") {
        return {
          ...state,
          markets: state.markets.map((market) =>
            market.id === event.market_id ? { ...market, status: "running" } : market
          ),
        };
      }

      if (event.type !== "trade") return state;

      let found = false;
      const markets = state.markets.map((market) => {
        if (market.id !== event.market_id) return market;
        found = true;
        return {
          ...market,
          probability: Number(event.probability ?? market.probability),
          volume: Number(market.volume || 0) + Number(event.spend || 0),
          momentum: Number(event.probability ?? market.probability) - Number(event.pre_probability ?? market.probability),
          volatility: Math.abs(Number(event.probability ?? market.probability) - Number(event.pre_probability ?? market.probability)),
          status: "running",
        };
      });

      const trade: TradeRow = {
        id: Date.now(),
        market_id: event.market_id,
        agent_id: event.agent_id,
        agent_title: event.agent_title,
        confidence: Number(event.confidence || 0),
        estimated_probability: Number(event.estimated_probability ?? event.probability ?? 0.5),
        spend: Number(event.spend || 0),
        pre_probability: Number(event.pre_probability ?? event.probability ?? 0.5),
        post_probability: Number(event.probability ?? 0.5),
        rationale: event.rationale || "",
        round_index: Number(event.round || 0),
        created_at: new Date().toISOString(),
        shares_delta: Number(event.shares_delta || 0),
        direction: event.direction,
      };

      return {
        ...state,
        markets: found
          ? markets
          : [
              {
                id: event.market_id,
                question: event.question || event.market_id,
                category: "general",
                probability: Number(event.probability ?? 0.5),
                momentum: 0,
                volatility: 0,
                volume: Number(event.spend || 0),
                status: "running",
                expires_at: new Date().toISOString(),
              },
              ...markets,
            ],
        trades: [trade, ...state.trades].slice(0, 300),
      };
    }),
  setWsState: (wsState) => set({ wsState }),
}));
