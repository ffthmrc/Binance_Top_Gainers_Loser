export interface Config {
  telegramToken: string;
  telegramChatId: string;
  alertThreshold: number;
  alertCooldownMs: number;
  enableAI: boolean;
  geminiApiKey?: string;
}

export interface TickerData {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
}

export interface CandleData {
  symbol: string;
  openPrice: number;
  currentPrice: number;
  changePercent: number;
  minute: number;
}

export interface Alert {
  symbol: string;
  price: number;
  openPrice: number;
  change: number;
  classification: 'GAINERS' | 'LOSERS' | 'VOLATILITY';
  timestamp: number;
}

export interface BinanceTickerResponse {
  s: string;   // symbol
  c: string;   // close price
  P: string;   // 24h price change percent
  q: string;   // quote volume
}
