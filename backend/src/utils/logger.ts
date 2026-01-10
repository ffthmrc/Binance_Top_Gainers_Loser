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
