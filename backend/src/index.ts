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
