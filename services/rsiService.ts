
/**
 * Standard RSI-14 calculation using Wilder's Smoothing Method
 */
export function calculateRSI(closes: number[]): number {
  if (closes.length < 15) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < 15; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / 14;
  let avgLoss = losses / 14;

  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * 13 + currentGain) / 14;
    avgLoss = (avgLoss * 13 + currentLoss) / 14;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export async function fetchRsiForSymbol(symbol: string): Promise<{ m5: number; m15: number; h1: number; h4: number; price: number } | null> {
  const timeframes = ['5m', '15m', '1h', '4h'];
  const results: Record<string, number> = {};
  let lastPrice = 0;

  try {
    const promises = timeframes.map(async (tf) => {
      const resp = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=30`);
      const data = await resp.json();
      if (!Array.isArray(data)) return;
      
      const closes = data.map(d => parseFloat(d[4]));
      results[tf] = calculateRSI(closes);
      if (tf === '5m') lastPrice = closes[closes.length - 1];
    });

    await Promise.all(promises);
    
    return {
      m5: results['5m'],
      m15: results['15m'],
      h1: results['1h'],
      h4: results['4h'],
      price: lastPrice
    };
  } catch (e) {
    console.error(`RSI Fetch Error for ${symbol}:`, e);
    return null;
  }
}
