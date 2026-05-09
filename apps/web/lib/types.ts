export type MarketRow = {
  id: string;
  question: string;
  category: string;
  probability: number;
  momentum: number;
  volatility: number;
  volume: number;
  status: string;
  expires_at: string;
};

export type TradeRow = {
  id: number;
  market_id: string;
  agent_id: string;
  agent_title?: string;
  confidence: number;
  estimated_probability: number;
  spend: number;
  pre_probability: number;
  post_probability: number;
  rationale: string;
  round_index: number;
  created_at: string;
  shares_delta?: number;
  direction?: "bullish" | "bearish";
};

export type AgentRow = {
  id: string;
  persona: string;
  capital: number;
  reputation: number;
  calibration_score: number;
  risk_profile: {
    risk?: number;
    style?: string;
    worldview?: string;
    reflexivity?: number;
    contrarian?: number;
  };
};

export type DashboardPayload = {
  markets: MarketRow[];
  recent_trades: TradeRow[];
  active_agents: AgentRow[];
};
