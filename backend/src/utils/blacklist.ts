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
