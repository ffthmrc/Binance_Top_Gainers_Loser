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
