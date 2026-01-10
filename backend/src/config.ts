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
