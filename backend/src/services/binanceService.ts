import WebSocket from 'ws';
import { Logger } from '../utils/logger';
import { BlacklistManager } from '../utils/blacklist';
import { TelegramService } from './telegramService';
import { config, BINANCE_WS_URL } from '../config';
import { BinanceTickerResponse, TickerData, CandleData } from '../types';

export class BinanceMonitor {
  private ws: WebSocket | null = null;
  private blacklist: BlacklistManager;
  private telegram: TelegramService;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  // Data storage
  private candleData = new Map<string, CandleData>();
  private lastAlertTime = new Map<string, number>();
  private allTickers = new Map<string, TickerData>();

  constructor() {
    this.blacklist = new BlacklistManager();
    this.telegram = new TelegramService();
  }

  start(): void {
    Logger.info('🚀 Starting Binance Monitor...');
    this.connect();

    // Health check every 60 seconds
    setInterval(() => {
      Logger.info(`📊 Monitoring ${this.allTickers.size} pairs`);
    }, 60000);
  }

  private connect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    Logger.info('Connecting to Binance WebSocket...');
    this.ws = new WebSocket(BINANCE_WS_URL);

    this.ws.on('open', () => {
      Logger.success('Connected to Binance');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('error', (error) => {
      Logger.error('WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      Logger.warn('Disconnected from Binance');
      this.reconnect();
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Logger.error('Max reconnection attempts reached. Exiting...');
      process.exit(1);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    Logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  private handleMessage(data: string): void {
    try {
      const tickers: BinanceTickerResponse[] = JSON.parse(data);
      if (!Array.isArray(tickers)) return;

      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);

      for (const ticker of tickers) {
        const symbol = ticker.s;
        if (!symbol.endsWith('USDT')) continue;
        if (this.blacklist.isBlacklisted(symbol)) continue;

        const price = parseFloat(ticker.c);
        const change24h = parseFloat(ticker.P);
        const quoteVolume = parseFloat(ticker.q);

        // Update ticker data
        this.allTickers.set(symbol, {
          symbol,
          lastPrice: price,
          priceChangePercent: change24h,
          volume: 0,
          quoteVolume
        });

        // Initialize candle data for new minute
        if (!this.candleData.has(symbol) || this.candleData.get(symbol)!.minute !== currentMinute) {
          this.candleData.set(symbol, {
            symbol,
            openPrice: price,
            currentPrice: price,
            changePercent: 0,
            minute: currentMinute
          });
        }

        // Update current candle
        const candle = this.candleData.get(symbol)!;
        candle.currentPrice = price;
        candle.changePercent = ((price - candle.openPrice) / candle.openPrice) * 100;

        // Check for alert conditions
        if (Math.abs(candle.changePercent) >= config.alertThreshold && quoteVolume > 5000) {
          this.checkAndSendAlert(symbol, price, candle.openPrice, candle.changePercent);
        }
      }
    } catch (error) {
      Logger.error('Error parsing message:', error);
    }
  }

  private checkAndSendAlert(symbol: string, price: number, openPrice: number, change: number): void {
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(symbol) || 0;

    // Cooldown check
    if (now - lastAlert < config.alertCooldownMs) return;

    this.lastAlertTime.set(symbol, now);

    // Classify the alert
    const classification = this.classifyAlert(symbol, change);

    // Log alert
    Logger.alert(symbol, change, classification);

    // Send Telegram alert
    const message = this.telegram.formatAlert(symbol, change, price, openPrice, classification);
    this.telegram.sendAlert(message);
  }

  private classifyAlert(symbol: string, change: number): 'GAINERS' | 'LOSERS' | 'VOLATILITY' {
    const sorted = Array.from(this.allTickers.values())
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent);

    const top30Gainers = sorted.slice(0, 30);
    const top30Losers = sorted.slice(-30);

    const isGainer = top30Gainers.some(t => t.symbol === symbol);
    const isLoser = top30Losers.some(t => t.symbol === symbol);

    if (isGainer) return 'GAINERS';
    if (isLoser) return 'LOSERS';
    return 'VOLATILITY';
  }
}
