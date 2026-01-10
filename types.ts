
export interface PricePoint {
  price: number;
  timestamp: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  change1m: number;
  lastUpdate: number;
  volume1m: number;
  avgVolume: number;
  pumpScore: number;
}

export interface AlertSource {
  title: string;
  uri: string;
}

export interface RsiData {
  symbol: string;
  rsi5m: number;
  rsi15m: number;
  rsi1h: number;
  rsi4h: number;
  lastPrice: number;
  timestamp: number;
}

export interface Alert {
  id: string;
  symbol: string;
  direction: 'UP' | 'DOWN' | 'RSI_HIGH' | 'RSI_LOW' | 'PUMP_START' | 'LEADERBOARD_GAIN' | 'LEADERBOARD_LOSS';
  change?: number;
  price: number;
  previousPrice?: number;
  timestamp: number;
  insight?: string;
  sources?: AlertSource[];
  status: 'sent' | 'failed' | 'processing';
  rsiValues?: {
    m5: number;
    m15: number;
    h1: number;
    h4: number;
  };
}

export interface Settings {
  telegramToken: string;
  telegramChatId: string;
  alertThreshold: number; // percentage for volatility
  windowSize: number; // in seconds
  autoAlert: boolean;
  enableAiInsights: boolean;
  rsiHighThreshold: number;
  rsiLowThreshold: number;
  timezone: string;
  blacklist: string[];
}

export interface InsightResponse {
  text: string;
  sources: AlertSource[];
}
