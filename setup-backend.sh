#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       🚀 AlphaHunter Backend Setup Script                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Create directories
echo "📁 Creating directory structure..."
mkdir -p backend/src/services backend/src/utils

# ============================================================
# package.json
# ============================================================
echo "📝 Creating package.json..."
cat > backend/package.json << 'EOF'
{
  "name": "binance-monitor-backend",
  "version": "1.0.0",
  "description": "24/7 Binance Crypto Monitor with Telegram Alerts",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "watch": "tsc -w"
  },
  "keywords": ["binance", "crypto", "monitoring", "telegram"],
  "author": "ffthmrc",
  "license": "MIT",
  "dependencies": {
    "ws": "^8.16.0",
    "axios": "^1.6.5",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# ============================================================
# tsconfig.json
# ============================================================
echo "📝 Creating tsconfig.json..."
cat > backend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# ============================================================
# .env.example
# ============================================================
echo "📝 Creating .env.example..."
cat > backend/.env.example << 'EOF'
# Telegram Configuration
TELEGRAM_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Alert Settings
ALERT_THRESHOLD=1.0
ALERT_COOLDOWN_MS=10000

# AI Features (Optional)
ENABLE_AI=false
GEMINI_API_KEY=your_gemini_api_key_here
EOF

# ============================================================
# blacklist.txt
# ============================================================
echo "📝 Creating blacklist.txt..."
cat > backend/blacklist.txt << 'EOF'
FLOW
1000WHYUSDT
DYDX
EOF

# ============================================================
# Dockerfile
# ============================================================
echo "📝 Creating Dockerfile..."
cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY blacklist.txt ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Run the application
CMD ["node", "dist/index.js"]
EOF

# ============================================================
# .gitignore for backend
# ============================================================
echo "📝 Creating .gitignore..."
cat > backend/.gitignore << 'EOF'
node_modules/
dist/
.env
*.log
.DS_Store
EOF

# ============================================================
# src/types.ts
# ============================================================
echo "📝 Creating src/types.ts..."
cat > backend/src/types.ts << 'EOF'
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
EOF

# ============================================================
# src/config.ts
# ============================================================
echo "📝 Creating src/config.ts..."
cat > backend/src/config.ts << 'EOF'
import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export const config: Config = {
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  alertThreshold: parseFloat(process.env.ALERT_THRESHOLD || '1.0'),
  alertCooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS || '10000'),
  enableAI: process.env.ENABLE_AI === 'true',
  geminiApiKey: process.env.GEMINI_API_KEY,
};

// Validate required config
if (!config.telegramToken || !config.telegramChatId) {
  console.warn('⚠️  WARNING: Telegram credentials not set. Alerts will be logged only.');
}

if (config.enableAI && !config.geminiApiKey) {
  console.warn('⚠️  WARNING: AI enabled but no Gemini API key found. AI features disabled.');
  config.enableAI = false;
}

export const BINANCE_WS_URL = 'wss://fstream.binance.com/ws/!ticker@arr';
export const BLACKLIST_FILE = './blacklist.txt';
EOF

echo "📝 Creating src/utils/logger.ts..."
cat > backend/src/utils/logger.ts << 'EOF'
export class Logger {
  private static formatTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  static info(message: string, ...args: any[]): void {
    console.log(`[${this.formatTime()}] ℹ️  ${message}`, ...args);
  }

  static success(message: string, ...args: any[]): void {
    console.log(`[${this.formatTime()}] ✅ ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[${this.formatTime()}] ⚠️  ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`[${this.formatTime()}] ❌ ${message}`, ...args);
  }

  static alert(symbol: string, change: number, classification: string): void {
    const emoji = change > 0 ? '🚀' : '⚠️';
    console.log(
      `[${this.formatTime()}] ${emoji} ALERT: ${symbol} ${change > 0 ? '+' : ''}${change.toFixed(2)}% [${classification}]`
    );
  }
}
EOF

echo "📝 Creating src/utils/blacklist.ts..."
cat > backend/src/utils/blacklist.ts << 'EOF'
import fs from 'fs';
import { Logger } from './logger';
import { BLACKLIST_FILE } from '../config';

export class BlacklistManager {
  private blacklist: Set<string> = new Set();

  constructor() {
    this.loadBlacklist();
    // Reload blacklist every 30 seconds
    setInterval(() => this.loadBlacklist(), 30000);
  }

  private loadBlacklist(): void {
    try {
      if (fs.existsSync(BLACKLIST_FILE)) {
        const content = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
        const coins = content
          .split(/[\n,]+/)
          .map(coin => coin.trim().toUpperCase())
          .filter(coin => coin.length > 0);
        
        this.blacklist = new Set(coins);
        Logger.info(`Blacklist loaded: ${this.blacklist.size} coins`);
      } else {
        Logger.warn('blacklist.txt not found, starting without blacklist');
      }
    } catch (error) {
      Logger.error('Failed to load blacklist:', error);
    }
  }

  isBlacklisted(symbol: string): boolean {
    const pureSym = symbol.replace('USDT', '').toUpperCase();
    return this.blacklist.has(pureSym);
  }

  getBlacklistSize(): number {
    return this.blacklist.size;
  }
}
EOF

echo "📝 Creating src/services/telegramService.ts..."
cat > backend/src/services/telegramService.ts << 'EOF'
import axios from 'axios';
import { Logger } from '../utils/logger';
import { config } from '../config';

export class TelegramService {
  private readonly apiUrl: string;
  private messageQueue: string[] = [];
  private isSending = false;

  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  }

  async sendAlert(message: string): Promise<void> {
    if (!config.telegramToken || !config.telegramChatId) {
      Logger.warn('Telegram not configured, alert logged only:', message);
      return;
    }

    this.messageQueue.push(message);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isSending || this.messageQueue.length === 0) return;

    this.isSending = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        await axios.post(this.apiUrl, {
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        }, {
          timeout: 5000
        });

        // Rate limiting: Wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.data?.parameters?.retry_after || 5;
          Logger.warn(`Telegram rate limit, retrying after ${retryAfter}s`);
          
          // Put message back and wait
          this.messageQueue.unshift(message);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else {
          Logger.error('Telegram send failed:', error.message);
        }
      }
    }

    this.isSending = false;
  }

  formatAlert(
    symbol: string,
    change: number,
    price: number,
    openPrice: number,
    classification: string
  ): string {
    const pureSym = symbol.replace('USDT', '');
    const formattedChange = change.toFixed(2);
    const formattedPrice = price.toFixed(6).replace(/\.?0+$/, '');
    const formattedOpen = openPrice.toFixed(6).replace(/\.?0+$/, '');
    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return `<b>#${pureSym}</b>   %${formattedChange}  <b>${classification}</b>  <b>${timeStr}</b>\nOPEN: $${formattedOpen} LAST: $${formattedPrice}`;
  }
}
EOF

echo "📝 Creating src/services/binanceService.ts..."
cat > backend/src/services/binanceService.ts << 'EOF'
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
EOF

echo "📝 Creating src/index.ts..."
cat > backend/src/index.ts << 'EOF'
import { BinanceMonitor } from './services/binanceService';
import { Logger } from './utils/logger';
import { config } from './config';

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Shutting down gracefully...');
  process.exit(0);
});

// ASCII Art Banner
console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗               ║
║    ██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗              ║
║    ███████║██║     ██████╔╝███████║███████║              ║
║    ██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║              ║
║    ██║  ██║███████╗██║     ██║  ██║██║  ██║              ║
║    ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝              ║
║                                                           ║
║            BINANCE 24/7 MONITORING SYSTEM                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

Logger.info('═══════════════════════════════════════════════════');
Logger.info('          AlphaHunter Backend Started');
Logger.info('═══════════════════════════════════════════════════');
Logger.info(`Alert Threshold: ${config.alertThreshold}%`);
Logger.info(`Alert Cooldown: ${config.alertCooldownMs / 1000}s`);
Logger.info(`Telegram Alerts: ${config.telegramToken ? '✅ Enabled' : '❌ Disabled'}`);
Logger.info(`AI Insights: ${config.enableAI ? '✅ Enabled' : '❌ Disabled'}`);
Logger.info('═══════════════════════════════════════════════════');

// Start monitoring
const monitor = new BinanceMonitor();
monitor.start();

Logger.success('System initialized successfully! Monitoring in progress...');
Logger.info('Press Ctrl+C to stop');
EOF

echo "📝 Creating README.md..."
cat > backend/README.md << 'EOF'
# 🚀 AlphaHunter Backend - 24/7 Binance Monitor

## 🎯 Kurulum

### 1. Dependencies Yükleyin
```bash
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

### 3. Lokal Test
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
npm start
```

## 🌐 Render.com Deployment

1. https://render.com > New > Web Service
2. Root Directory: `backend`
3. Environment: Docker
4. Environment Variables ekleyin
5. Deploy!

## 📊 Özellikler

- ✅ 24/7 monitoring
- ✅ Telegram alerts
- ✅ Auto-reconnect
- ✅ Blacklist support
- ✅ Low memory footprint (~50MB)

**Made with ⚡ by ffthmrc**
EOF

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  ✅ Setup Complete!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Backend structure created at: ./backend/"
echo ""
echo "🚀 Next steps:"
echo "   1. cd backend"
echo "   2. npm install"
echo "   3. cp .env.example .env"
echo "   4. Edit .env with your credentials"
echo "   5. npm run dev"
echo ""
echo "📚 Full documentation: ./backend/README.md"
echo ""