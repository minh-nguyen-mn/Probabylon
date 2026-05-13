export type MarketRow = {
  id: string;
  question: string;
  description?: string;
  category: string;
  probability: number;
  momentum: number;
  volatility: number;
  volume: number;
  status: string;
  expires_at: string;
  confidence?: number;
  activity?: number;
  participating_agents?: string[];
  narratives?: string[];
  is_featured?: boolean;
  is_pinned?: boolean;
  source?: string;
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

export type TradeNotification = {
  id: number;
  market_id: string;
  market_question?: string;
  agent_title: string;
  direction: "bullish" | "bearish";
  probability: number;
  spend: number;
  created_at: string;
};

export type AgentRow = {
  id: string;
  persona: string;
  capital: number;
  reputation: number;
  calibration_score: number;
  archetype?: string;
  conviction?: number;
  specialization?: string;
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

export type CategorySnapshot = {
  slug: string;
  name: string;
  market_count: number;
  avg_probability: number;
  sentiment: string;
  volume: number;
  volatility: number;
  featured_markets: MarketRow[];
};

export type SystemStats = {
  total_markets: number;
  active_markets: number;
  resolved_markets: number;
  total_volume: number;
  average_volatility: number;
  total_trades: number;
  active_agents: number;
  live_simulations: number;
  pending_submissions?: number;
};

export type SentimentOverview = {
  uncertainty_index: number;
  consensus_stability: number;
  calibration_quality: number;
  market_sentiment: number;
  live_simulations: number;
  total_predictions: number;
  active_agents: number;
};

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  reputation: number;
  badges: string[];
  submitted_markets: number;
  forecast_count: number;
};

export type ForecastSummary = {
  id: string;
  question: string;
  category: string;
  probability: number;
  confidence: number;
  created_at: string;
};

export type HomeSnapshot = {
  featured_markets: MarketRow[];
  trending_markets: MarketRow[];
  probability_movers: MarketRow[];
  live_activity: TradeRow[];
  categories: CategorySnapshot[];
  top_agents: AgentRow[];
  top_users: UserSummary[];
  volatility_heatmap: { category: string; volatility: number; volume: number }[];
  emerging_narratives: string[];
  system_stats: SystemStats;
  sentiment_overview: SentimentOverview;
  recent_forecasts: ForecastSummary[];
};

export type ExplorePayload = {
  markets: MarketRow[];
  categories: CategorySnapshot[];
  stats: SentimentOverview;
  watchlist: MarketRow[];
  bookmarks: MarketRow[];
  top_users: UserSummary[];
};

export type CategoryDetailPayload = {
  category: {
    slug: string;
    name: string;
    market_count: number;
    avg_probability: number;
    volume: number;
    volatility: number;
    sentiment: string;
    narratives: string[];
  };
  markets: MarketRow[];
  top_agents: AgentRow[];
  activity: TradeRow[];
};

export type ForecastResult = {
  id: string;
  probability: number;
  confidence: number;
  summary: string;
  key_uncertainty_drivers: string[];
  disagreement_summary: string;
  supporting_evidence: { title: string; snippet: string; market_id?: string }[];
  related_markets: MarketRow[];
  agent_views: { agent_id: string; persona: string; probability: number; stance: string; summary: string }[];
};

export type MarketDetailPayload = {
  market: {
    id: string;
    question: string;
    description?: string;
    category: string;
    resolution_criteria?: string;
    probability: number;
    status: string;
    expires_at: string;
    volume: number;
    volatility: number;
    confidence: number;
    narratives?: string[];
    source?: string;
    is_featured?: boolean;
    is_pinned?: boolean;
  };
  probability_history: {
    trade_id: number;
    round_index: number;
    post_probability: number;
    confidence: number;
    agent_id: string;
    created_at: string;
  }[];
  trades: Array<TradeRow & { research_history?: Array<Record<string, string>> }>;
  agents: AgentRow[];
  confidence_distribution: { bucket: string; count: number }[];
  related_markets: MarketRow[];
  top_agents: Array<AgentRow & { activity_count?: number; average_confidence?: number }>;
  evidence_sources: { title: string; snippet: string }[];
  timeline_replay: { label: string; probability: number; summary: string; created_at: string }[];
  market_history: { timestamp: string; probability: number; confidence: number }[];
  sentiment_overview: {
    confidence_shift: number;
    activity_level: number;
    bullish_share: number;
    disagreement_score: number;
  };
};

export type AgentHubPayload = {
  agents: AgentRow[];
  leaderboards: {
    accuracy: AgentRow[];
    profitability: AgentRow[];
    conviction: AgentRow[];
    contrarian: AgentRow[];
    activity: AgentRow[];
  };
};

export type InsightsPayload = {
  market_health: SentimentOverview;
  disagreement_clusters: MarketRow[];
  probability_shifts: MarketRow[];
  volatility_events: MarketRow[];
  collective_intelligence_metrics: {
    consensus_stability: number;
    calibration_quality: number;
    agent_ecosystem_health: number;
    submission_pressure: number;
  };
  recent_forecasts: ForecastSummary[];
};

export type TrendsPayload = {
  beliefs: { headline: string; summary: string; category: string }[];
  trending_markets: MarketRow[];
  sentiment_map: CategorySnapshot[];
};

export type ProposalRow = {
  id: string;
  question: string;
  description?: string;
  category: string;
  status: string;
  moderation_notes?: string;
  expires_at?: string;
  created_at: string;
};

export type ProfilePayload = {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    role: string;
    avatar_url?: string | null;
    reputation: number;
    badges: string[];
  };
  metrics: {
    submitted_markets: number;
    private_forecasts: number;
    watchlist_count: number;
    accuracy_score: number;
    leaderboard_position: number;
  };
  submitted_markets: ProposalRow[];
  forecast_history: ForecastSummary[];
};
