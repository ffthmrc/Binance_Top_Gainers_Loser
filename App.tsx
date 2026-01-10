
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Settings as SettingsIcon,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  Rocket,
  Target,
  Info,
  ChevronRight,
  Activity,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Megaphone,
  BarChart3,
  BrainCircuit,
  Zap,
  Bell,
  Layout,
  Globe,
  ShieldOff,
  History as HistoryIcon,
  Clock,
  Plus,
  GripVertical
} from 'lucide-react';
import { Settings, TickerData, PricePoint, Alert, RsiData } from './types';
import { sendTelegramAlert } from './services/telegramService';
import { getMarketInsight } from './services/geminiService';

const ALERT_1M_THRESHOLD = 1.0; 
const ALERT_COOLDOWN_MS = 10000; 

const getSystemTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'Etc/UTC';
  }
};

const DEFAULT_SETTINGS: Settings = {
  telegramToken: '',
  telegramChatId: '',
  alertThreshold: 1.0,
  windowSize: 60,
  autoAlert: true,
  enableAiInsights: true,
  rsiHighThreshold: 75,
  rsiLowThreshold: 25,
  timezone: getSystemTimezone(),
  blacklist: [],
};

const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: '1W' },
];

const TradingViewChart = ({ symbol, interval, timezone }: { symbol: string, interval: string, timezone: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useMemo(() => `tv_chart_${symbol.toLowerCase()}`, [symbol]);

  useEffect(() => {
    let tvWidget: any = null;

    if (containerRef.current && (window as any).TradingView) {
      containerRef.current.innerHTML = `<div id="${containerId}" style="height:100%;width:100%"></div>`;

      tvWidget = new (window as any).TradingView.widget({
        autosize: true,
        symbol: `BINANCE:${symbol}USDT.P`,
        interval,
        timezone,
        theme: "dark",
        style: "1",
        locale: "en",
        container_id: containerId,

        studies: [
          "Moving Average Exponential@tv-basicstudies",
          "Moving Average Exponential@tv-basicstudies"
        ],

        studies_overrides: {
          "moving average exponential.length": 10,
          "moving average exponential.plot.color": "#FFD700",
          "moving average exponential.plot.linewidth": 2,

          "moving average exponential.length@2": 20,
          "moving average exponential.plot.color@2": "#2196F3",
          "moving average exponential.plot.linewidth@2": 2
        }
      });
    }

    return () => {
      if (tvWidget) {
        tvWidget.remove();
        tvWidget = null;
      }
    };
  }, [symbol, interval, timezone, containerId]);

  return <div ref={containerRef} className="w-full h-full bg-black" />;
};


const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('pump_command_center_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) { console.error("Settings load failed", e); }
    return DEFAULT_SETTINGS;
  });

  const [fileBlacklist, setFileBlacklist] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<Alert[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [alphaCoin, setAlphaCoin] = useState<TickerData | null>(null);

  const alphaHistory = useMemo(() => {
    if (!alphaCoin) return [];
    return priceAlerts.filter(a => a.symbol.replace('USDT', '') === alphaCoin.symbol);
  }, [priceAlerts, alphaCoin]);

  const [alphaVerdict, setAlphaVerdict] = useState<{text: string, sources: any[]} | null>(null);
  const [isAnalyzingAlpha, setIsAnalyzingAlpha] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState('1');
  const [moverTab, setMoverTab] = useState<'gainers' | 'losers' | 'volume'>('gainers');
  const [marketSnapshot, setMarketSnapshot] = useState<{ gainers: any[], losers: any[], volume: any[] }>({ gainers: [], losers: [], volume: [] });
  const [newsTickerContent, setNewsTickerContent] = useState<string>("");
  const [activeMobileTab, setActiveMobileTab] = useState<'market' | 'terminal' | 'feed'>('market');
  const [newBlacklistCoin, setNewBlacklistCoin] = useState('');

  const [marketWidth, setMarketWidth] = useState(224); 
  const [historyWidth, setHistoryWidth] = useState(256); 
  const [feedWidth, setFeedWidth] = useState(320); 
  const [isResizing, setIsResizing] = useState(false);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  const isMonitoringIntentRef = useRef(false);
  const candleOpenPricesRef = useRef<Record<string, { price: number, minute: number }>>({});
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const allTickersBufferRef = useRef<Record<string, any>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const currentAnalyzingSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
  const fetchBlacklist = async () => {
    try {
      // GitHub Pages için doğru yol
      const response = await fetch(`${import.meta.env.BASE_URL}blacklist.txt`);
      if (response.ok) {
        const text = await response.text();
        const list = text
          .split(/[\n,]+/)
          .map(item => item.trim().toUpperCase())
          .filter(item => item !== "");
        setFileBlacklist(list);
        console.log(`✅ Blacklist loaded: ${list.length} coins`);
      } else {
        console.warn("⚠️ blacklist.txt not found, continuing without external blacklist");
      }
    } catch (e) {
      console.warn("⚠️ External blacklist sync failed:", e);
    }
  };
  fetchBlacklist();
  const interval = setInterval(fetchBlacklist, 30000);
  return () => clearInterval(interval);
}, []);

  useEffect(() => {
    localStorage.setItem('pump_command_center_v1', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      const priceData = Object.values(allTickersBufferRef.current) as any[];
      if (priceData.length === 0) return;
      
      const gainers = [...priceData].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 30);
      const losers = [...priceData].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, 30);
      const volume = [...priceData].sort((a, b) => b.volume1m - a.volume1m).slice(0, 30);
      
      setMarketSnapshot({ gainers, losers, volume });

      const tickerItems: string[] = [];
      gainers.slice(0, 5).forEach(t => tickerItems.push(`🚀 ${t.symbol.replace('USDT', '')} SURGING: +${t.priceChangePercent.toFixed(1)}%`));
      losers.slice(0, 5).forEach(t => tickerItems.push(`⚠️ ${t.symbol.replace('USDT', '')} DROPPING: ${t.priceChangePercent.toFixed(1)}%`));
      volume.slice(0, 3).forEach(t => tickerItems.push(`💎 ${t.symbol.replace('USDT', '')} VOLUME: $${(t.volume1m / 1000000).toFixed(1)}M`));
      
      setNewsTickerContent(tickerItems.join("  ||  "));
    }, 2000);
    return () => clearInterval(interval);
  }, [isMonitoring]); 

  const isBlacklisted = useCallback((symbol: string) => {
    const pureSym = symbol.replace('USDT', '').toUpperCase();
    return fileBlacklist.includes(pureSym) || settings.blacklist.map(s => s.toUpperCase()).includes(pureSym);
  }, [fileBlacklist, settings.blacklist]);

  const handleAlert = useCallback(async (symbol: string, currentPrice: number, openPrice: number, change: number, classificationTag: string) => {
    if (isBlacklisted(symbol)) return;

    const now = Date.now();
    if (now - (lastAlertTimeRef.current[symbol] || 0) < ALERT_COOLDOWN_MS) return;
    lastAlertTimeRef.current[symbol] = now;
    
    const pureSym = symbol.replace('USDT', '');
    const timeStr = new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const formattedChange = change.toFixed(2);
    const formattedPrice = currentPrice.toFixed(6).replace(/\.?0+$/, '');
    const formattedOpen = openPrice.toFixed(6).replace(/\.?0+$/, '');
    
    const newAlert: Alert = { 
      id: `${symbol}-${now}`, 
      symbol, 
      direction: change > 0 ? 'UP' : 'DOWN', 
      change, 
      price: currentPrice, 
      previousPrice: openPrice,
      timestamp: now, 
      status: 'processing',
      insight: classificationTag
    };
    
    setPriceAlerts(prev => [newAlert, ...prev].slice(0, 500)); 
    
    if (settings.autoAlert && settings.telegramToken && settings.telegramChatId) {
      const message = `<b>#${pureSym}</b>   %${formattedChange}  <b>${classificationTag}</b>  <b>${timeStr}</b>\nOPEN: $${formattedOpen} LAST: $${formattedPrice}`;
      sendTelegramAlert(settings.telegramToken, settings.telegramChatId, message);
    }
  }, [settings.autoAlert, settings.telegramToken, settings.telegramChatId, isBlacklisted]);

  const connectWS = useCallback(() => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    setConnectionStatus('connecting');
    const ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
    ws.onopen = () => { setConnectionStatus('connected'); setIsMonitoring(true); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!Array.isArray(data)) return;
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);

      data.forEach((item: any) => {
        const symbol = item.s; if (!symbol.endsWith('USDT')) return;
        const price = parseFloat(item.c); 
        const change24h = parseFloat(item.P); 
        const volumeQuote = parseFloat(item.q);
        
        if (!candleOpenPricesRef.current[symbol] || candleOpenPricesRef.current[symbol].minute !== currentMinute) {
          candleOpenPricesRef.current[symbol] = { price, minute: currentMinute };
        }
        const openPrice = candleOpenPricesRef.current[symbol].price;
        const candleChangePct = ((price - openPrice) / openPrice) * 100;
        
        let trend = 'stable';
        if (candleChangePct >= 1.0) trend = 'up';
        else if (candleChangePct <= -1.0) trend = 'down';
        
        allTickersBufferRef.current[symbol] = { symbol, priceChangePercent: change24h, lastPrice: price, volume1m: volumeQuote, trend };
        
        if (Math.abs(candleChangePct) >= ALERT_1M_THRESHOLD && volumeQuote > 5000) {
          const allData = Object.values(allTickersBufferRef.current);
          const sorted = [...allData].sort((a: any, b: any) => b.priceChangePercent - a.priceChangePercent);
          const isTop30Gainer = sorted.slice(0, 30).some((t: any) => t.symbol === symbol);
          const isTop30Loser = [...sorted].reverse().slice(0, 30).some((t: any) => t.symbol === symbol);
          
          let tag = "VOLATILITY";
          if (isTop30Gainer) tag = "GAINERS";
          else if (isTop30Loser) tag = "LOSERS";
          
          handleAlert(symbol, price, openPrice, candleChangePct, tag);
        }
      });
    };
    ws.onclose = () => { setConnectionStatus('disconnected'); if (isMonitoringIntentRef.current) setTimeout(connectWS, 2000); };
    wsRef.current = ws;
  }, [handleAlert]);

  const handleFocusCoin = (symbol: string, price: number) => {
    const symbolStr = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
    if (alphaCoin?.symbol === symbolStr) { setActiveMobileTab('terminal'); return; }
    setAlphaCoin({ symbol: symbolStr, price, change1m: 0, lastUpdate: Date.now(), volume1m: 0, avgVolume: 0, pumpScore: 0 });
    setAlphaVerdict(null); setIsAnalyzingAlpha(false); setActiveMobileTab('terminal');
  };

  const triggerManualAnalysis = async () => {
    if (!alphaCoin || isAnalyzingAlpha) return;
    setIsAnalyzingAlpha(true);
    const symbolStr = alphaCoin.symbol;
    currentAnalyzingSymbolRef.current = symbolStr;
    const v = await getMarketInsight(symbolStr, 0, alphaCoin.price);
    if (currentAnalyzingSymbolRef.current === symbolStr) { setAlphaVerdict(v); setIsAnalyzingAlpha(false); }
  };

  const handleAddBlacklist = () => {
    const coin = newBlacklistCoin.trim().toUpperCase();
    if (coin && !settings.blacklist.includes(coin)) {
      setSettings(prev => ({ ...prev, blacklist: [...prev.blacklist, coin] }));
      setNewBlacklistCoin('');
    }
  };

  const handleRemoveBlacklist = (coin: string) => {
    setSettings(prev => ({ ...prev, blacklist: prev.blacklist.filter(c => c !== coin) }));
  };

  const startResizing = useCallback((target: 'market' | 'history' | 'feed') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.pageX;
    const startWidth = target === 'market' ? marketWidth : target === 'history' ? historyWidth : feedWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      if (target === 'market') {
        setMarketWidth(Math.max(120, Math.min(500, startWidth + delta)));
      } else if (target === 'history') {
        setHistoryWidth(Math.max(150, Math.min(600, startWidth - delta)));
      } else if (target === 'feed') {
        setFeedWidth(Math.max(200, Math.min(800, startWidth - delta)));
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [marketWidth, historyWidth, feedWidth]);

  return (
    <div className="h-screen bg-[#0b0e11] text-[#eaecef] flex flex-col font-sans overflow-hidden select-none">
      {isResizing && <div className="fixed inset-0 z-[9999] cursor-col-resize" />}

      <header className="flex-none flex flex-col bg-[#1e2329] border-b border-white/5 z-50">
        <div className="flex items-center justify-between px-4 py-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-[#facc15] p-1 rounded"><Target size={16} className="text-black" /></div>
              <div>
                <h1 className="text-xs lg:text-sm font-black uppercase italic tracking-tighter text-white leading-none">Alpha<span className="text-[#facc15]">Hunter</span></h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-1 h-1 rounded-full ${connectionStatus === 'connected' ? 'bg-[#03a66d]' : 'bg-red-500'}`} />
                  <span className="text-[7px] text-[#848e9c] font-black uppercase tracking-widest">{connectionStatus}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => isMonitoring ? (isMonitoringIntentRef.current = false, setIsMonitoring(false), wsRef.current?.close()) : (isMonitoringIntentRef.current = true, connectWS())} className={`px-3 py-1 rounded-md font-black text-[9px] uppercase transition-all ${isMonitoring ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-[#facc15] text-black hover:scale-105'}`}>{isMonitoring ? 'Stop' : 'Engage'}</button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 bg-white/5 rounded-md hover:bg-white/10 border border-white/10 transition-colors"><SettingsIcon size={16} /></button>
          </div>
        </div>
        <div className="bg-black/60 border-t border-white/10 h-6 flex items-center px-4 overflow-hidden relative shadow-inner">
          <div className="flex-none flex items-center gap-2 text-[#facc15] text-[9px] font-black uppercase tracking-[0.2em] mr-6 z-10">
            <Megaphone size={10} className="animate-bounce" /> MOVERS:
          </div>
          <div className="flex-1 h-full overflow-hidden relative flex items-center">
            {newsTickerContent ? (
              <div className="ticker-container w-full whitespace-nowrap">
                <div className="ticker-scroll flex items-center gap-8">
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-wide">
                    {newsTickerContent}
                  </span>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-wide" aria-hidden="true">
                    || {newsTickerContent}
                  </span>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-wide" aria-hidden="true">
                    || {newsTickerContent}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-[9px] font-bold text-white/30 uppercase tracking-widest italic animate-pulse">
                Awaiting market volatility data...
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative pb-16 lg:pb-0">
        <aside 
          style={{ width: isDesktop ? `${marketWidth}px` : '100%' }}
          className={`${activeMobileTab === 'market' ? 'flex' : 'hidden'} lg:flex flex-none border-r border-white/5 flex flex-col bg-[#0b0e11] z-40 h-full overflow-hidden relative`}
        >
          <div className="p-2 border-b border-white/5 bg-black/20 flex-none">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#facc15] mb-2 flex items-center gap-1.5">
              <BarChart3 size={14} /> Market Dashboard
            </h2>
            <div className="flex bg-white/5 p-0.5 rounded-md">
              {['gainers', 'losers', 'volume'].map(tab => (
                <button key={tab} onClick={() => setMoverTab(tab as any)} className={`flex-1 py-1 text-[9px] font-black uppercase rounded transition-all ${moverTab === tab ? 'bg-[#facc15] text-black shadow-inner' : 'text-[#848e9c] hover:text-white hover:bg-white/5'}`}>{tab}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar select-text">
            {marketSnapshot[moverTab].map((t, idx) => (
              <div key={t.symbol} onClick={() => handleFocusCoin(t.symbol, t.lastPrice)} className={`px-2.5 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5 transition-colors flex items-center group relative ${alphaCoin?.symbol === t.symbol.replace('USDT', '') ? 'bg-[#facc15]/10 border-l-4 border-l-[#facc15]' : ''}`}>
                <div className="flex-none w-5 text-[9px] font-black text-[#474d57] shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black text-white group-hover:text-[#facc15] transition-colors leading-none uppercase">{t.symbol.replace('USDT', '')}</span>
                    <div className="shrink-0 h-4">
                      {t.trend === 'up' ? <ArrowUp size={12} className="text-[#03a66d]" strokeWidth={3} /> : t.trend === 'down' ? <ArrowDown size={12} className="text-[#cf304a]" strokeWidth={3} /> : null}
                    </div>
                  </div>
                  <div className="text-[11px] font-black text-[#eaecef] font-mono mt-0.5">${t.lastPrice.toFixed(8).replace(/\.?0+$/, '')}</div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className={`text-[12px] font-black leading-none ${t.priceChangePercent >= 0 ? 'text-[#03a66d]' : 'text-[#cf304a]'}`}>
                    {t.priceChangePercent >= 0 ? '+' : ''}{t.priceChangePercent.toFixed(1)}%
                  </div>
                  <div className="text-[7px] text-[#474d57] font-black uppercase mt-1">VOL: {(t.volume1m / 1000000).toFixed(1)}M</div>
                </div>
              </div>
            ))}
          </div>
          <div onMouseDown={startResizing('market')} className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#facc15]/40 active:bg-[#facc15] z-[60] transition-colors group">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/5 group-hover:bg-[#facc15]/50" />
          </div>
        </aside>

        <section className={`${activeMobileTab === 'terminal' ? 'flex' : 'hidden'} lg:flex flex-1 flex flex-col min-w-0 bg-[#14181d] h-full`}>
          <div className="flex-none p-1.5 lg:p-2 border-b border-white/5 bg-[#1e2329]/80 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-[#facc15] text-black px-2.5 py-1 rounded shadow-lg">
                <div className="text-sm font-black italic tracking-tighter leading-none">{alphaCoin ? alphaCoin.symbol : '---'}</div>
              </div>
              {alphaCoin && <div className="text-xs font-black font-mono text-white">${alphaCoin.price.toLocaleString()}</div>}
            </div>
            <div className="flex items-center gap-0.5 bg-black/20 p-0.5 rounded-md overflow-x-auto no-scrollbar">
               {TIMEFRAMES.map(tf => (
                 <button key={tf.value} onClick={() => setSelectedInterval(tf.value)} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all whitespace-nowrap ${selectedInterval === tf.value ? 'bg-[#facc15] text-black' : 'text-[#848e9c] hover:bg-white/5'}`}>{tf.label}</button>
               ))}
            </div>
          </div>
          <div className="flex-1 bg-black relative min-h-0">
            {!alphaCoin ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#474d57] animate-pulse">
                <Activity size={32} className="mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Select an asset</p>
              </div>
            ) : <TradingViewChart symbol={alphaCoin.symbol} interval={selectedInterval} timezone={settings.timezone} />}
          </div>
          <div className="flex-none h-20 border-t border-white/5 bg-[#0b0e11] p-1.5 flex gap-3 overflow-hidden">
             <div className="flex-none flex flex-col items-center justify-center border-r border-white/5 pr-3">
               <button onClick={triggerManualAnalysis} disabled={!alphaCoin || isAnalyzingAlpha} className={`p-1.5 rounded-full transition-all ${isAnalyzingAlpha ? 'bg-[#facc15]/20 animate-pulse text-[#facc15]' : 'bg-[#facc15] text-black shadow-lg disabled:opacity-50'}`}>
                 {isAnalyzingAlpha ? <BrainCircuit size={14} className="animate-spin" /> : <Info size={14} />}
               </button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-center select-text">
               {isAnalyzingAlpha ? (
                 <div className="text-[8px] font-black uppercase text-[#facc15] tracking-[0.1em] animate-pulse">Thinking...</div>
               ) : alphaVerdict ? (
                 <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
                   <p className="text-[9px] leading-tight text-[#eaecef] font-medium italic border-l border-[#facc15] pl-2 bg-white/5 py-0.5 line-clamp-2">"{alphaVerdict.text}"</p>
                 </div>
               ) : (
                 <div className="h-full flex flex-col justify-center">
                   <h3 className="text-[8px] font-black uppercase text-[#474d57]">Analysis Ready</h3>
                   {alphaCoin && <button onClick={triggerManualAnalysis} className="self-start mt-0.5 text-[7px] font-black uppercase text-black bg-[#facc15] px-2 py-0.5 rounded">Generate</button>}
                 </div>
               )}
             </div>
          </div>
        </section>

        <div className={`${activeMobileTab === 'feed' ? 'flex flex-row flex-1' : 'hidden'} lg:flex-none lg:flex lg:flex-row h-full overflow-hidden`}>
          <aside 
            style={{ width: isDesktop ? `${historyWidth}px` : '50%' }}
            className="flex-none border-l border-white/5 bg-[#0b0e11] flex flex-col h-full overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative"
          >
            <div onMouseDown={startResizing('history')} className="hidden lg:block absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[#facc15]/40 active:bg-[#facc15] z-[60] transition-colors group">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/5 group-hover:bg-[#facc15]/50" />
            </div>
            <div className="p-2 border-b border-white/5 bg-[#1e2329]/50 flex items-center justify-between flex-none">
              <div className="flex items-center gap-2 overflow-hidden">
                <HistoryIcon size={14} className="text-[#facc15]" />
                <h2 className="text-[9px] font-black text-[#eaecef] tracking-[0.1em] uppercase italic truncate">
                  {alphaCoin ? `#${alphaCoin.symbol} HISTORY` : 'HISTORY'}
                </h2>
              </div>
              {alphaCoin && (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-[#facc15]/10 border border-[#facc15]/20 rounded shrink-0">
                  <Clock size={10} className="text-[#facc15]" />
                  <span className="text-[8px] font-black text-[#facc15]">{alphaHistory.length}</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1.5 select-text">
              {!alphaCoin ? (
                <div className="h-full flex flex-col items-center justify-center text-[#474d57]/30 text-center px-4">
                  <Target size={24} className="mb-2" />
                  <p className="text-[9px] font-black uppercase tracking-tighter">Focus a coin</p>
                </div>
              ) : alphaHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#474d57]/30 text-center px-4">
                  <Activity size={24} className="mb-2" />
                  <p className="text-[9px] font-black uppercase tracking-tighter">No volatility recorded</p>
                </div>
              ) : (
                alphaHistory.map(a => {
                  const pureSym = a.symbol.replace('USDT', '');
                  const timeStr = new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                  const typeTag = a.insight || "VOLATILITY";
                  const statusColorClass = typeTag === 'GAINERS' ? 'bg-[#03a66d]/30 text-[#03a66d]' : 
                                          typeTag === 'LOSERS' ? 'bg-[#cf304a]/30 text-[#cf304a]' : 
                                          'bg-[#facc15]/20 text-[#facc15]';
                  const borderColorClass = typeTag === 'GAINERS' ? 'border-[#03a66d]/40' : 
                                          typeTag === 'LOSERS' ? 'border-[#cf304a]/40' : 
                                          'border-[#facc15]/40';
                  return (
                    <div key={a.id} className={`p-1.5 sm:p-2 rounded border-l-2 sm:border-l-4 bg-white/[0.03] transition-all hover:bg-white/[0.08] group ${borderColorClass}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 overflow-hidden min-w-0">
                          <span className="text-[9px] sm:text-xs font-black text-white uppercase shrink-0">#{pureSym}</span>
                          <span className={`text-[9px] sm:text-xs font-black shrink-0 ${a.direction === 'UP' ? 'text-[#03a66d]' : 'text-[#cf304a]'}`}>%{a.change?.toFixed(2)}</span>
                          <span className={`text-[7px] sm:text-[9px] font-black uppercase px-1 py-0.5 rounded shrink-0 ${statusColorClass}`}>{typeTag}</span>
                          <span className="text-[8px] sm:text-[10px] font-mono font-bold text-white uppercase ml-auto shrink-0">{timeStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[7px] sm:text-[10px] font-black font-mono leading-tight text-white/50 overflow-hidden">
                          <span className="shrink-0">OPEN: <span className="text-white/80 font-normal">${a.previousPrice?.toFixed(6).replace(/\.?0+$/, '')}</span></span>
                          <span className="shrink-0">LAST: <span className="text-white font-bold">${a.price.toFixed(6).replace(/\.?0+$/, '')}</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <aside 
            style={{ width: isDesktop ? `${feedWidth}px` : '50%' }}
            className="flex-none border-l border-white/5 bg-[#0b0e11] flex flex-col h-full overflow-hidden shadow-[inset_10px_0_15px_-10px_rgba(0,0,0,0.5)] relative"
          >
            <div onMouseDown={startResizing('feed')} className="hidden lg:block absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[#facc15]/40 active:bg-[#facc15] z-[60] transition-colors group">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/5 group-hover:bg-[#facc15]/50" />
            </div>
            <div className="p-2 border-b border-white/5 bg-[#1e2329]/50 flex items-center justify-between flex-none">
              <h2 className="text-[9px] font-black text-[#848e9c] tracking-[0.1em] uppercase">Global Feed</h2>
              <button onClick={() => setPriceAlerts([])} className="text-[#474d57] hover:text-white transition-colors"><Trash2 size={12}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1.5 pb-20 lg:pb-2 select-text">
               {priceAlerts.map(a => {
                  const pureSym = a.symbol.replace('USDT', '');
                  const timeStr = new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                  const typeTag = a.insight || "VOLATILITY";
                  const containerColorClass = typeTag === 'GAINERS' ? 'bg-[#1b2c1b]/40 border-[#03a66d]' : 
                                              typeTag === 'LOSERS' ? 'bg-[#2c1b1b]/40 border-[#cf304a]' : 
                                              'bg-[#2c2a1b]/40 border-[#facc15]';
                  const tagColorClass = typeTag === 'GAINERS' ? 'bg-[#03a66d]/30 text-[#03a66d]' : 
                                        typeTag === 'LOSERS' ? 'bg-[#cf304a]/30 text-[#cf304a]' : 
                                        'bg-[#facc15]/30 text-[#facc15]';
                  return (
                    <div key={a.id} onClick={() => handleFocusCoin(a.symbol, a.price)} className={`p-1.5 sm:p-2 rounded border-l-2 sm:border-l-4 shadow-xl transition-all hover:brightness-110 cursor-pointer ${containerColorClass}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 overflow-hidden min-w-0">
                          <span className="text-[9px] sm:text-xs font-black text-white uppercase shrink-0">#{pureSym}</span>
                          <span className={`text-[9px] sm:text-xs font-bold shrink-0 ${a.direction === 'UP' ? 'text-[#03a66d]' : 'text-[#cf304a]'}`}>%{a.change?.toFixed(2)}</span>
                          <span className={`text-[7px] sm:text-[9px] font-black uppercase px-1 py-0.5 rounded shrink-0 ${tagColorClass}`}>{typeTag}</span>
                          <span className="text-[8px] sm:text-[10px] text-white font-mono font-bold uppercase ml-auto shrink-0">{timeStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[7px] sm:text-[10px] font-black font-mono leading-tight text-white/50 overflow-hidden">
                          <span className="shrink-0">OPEN: <span className="text-white/80 font-normal">${a.previousPrice?.toFixed(6).replace(/\.?0+$/, '')}</span></span>
                          <span className="shrink-0">LAST: <span className="text-white font-bold">${a.price.toFixed(6).replace(/\.?0+$/, '')}</span></span>
                        </div>
                      </div>
                    </div>
                  );
               })}
            </div>
          </aside>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#1e2329] border-t border-white/10 flex lg:hidden z-50 px-2 py-1">
          <button onClick={() => setActiveMobileTab('market')} className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${activeMobileTab === 'market' ? 'text-[#facc15] bg-white/5' : 'text-[#848e9c]'}`}><Layout size={20} /><span className="text-[8px] font-black uppercase">Market</span></button>
          <button onClick={() => setActiveMobileTab('terminal')} className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${activeMobileTab === 'terminal' ? 'text-[#facc15] bg-white/5' : 'text-[#848e9c]'}`}><Activity size={20} /><span className="text-[8px] font-black uppercase">Terminal</span></button>
          <button onClick={() => setActiveMobileTab('feed')} className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${activeMobileTab === 'feed' ? 'text-[#facc15] bg-white/5' : 'text-[#848e9c]'}`}><div className="relative"><Bell size={20} />{priceAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#facc15] border-2 border-[#1e2329] rounded-full" />}</div><span className="text-[8px] font-black uppercase">Feed</span></button>
        </nav>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e2329] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
              <h3 className="text-sm font-black uppercase text-white italic tracking-wider">Configuration Panel</h3>
              <button onClick={() => setShowSettings(false)} className="text-[#848e9c] hover:text-white transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Zap size={14} className="text-[#facc15]" />
                  <h4 className="text-[10px] font-black uppercase text-[#848e9c]">Telegram Connection</h4>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-[#474d57]">Bot Token</label>
                  <input type="password" value={settings.telegramToken} onChange={e => setSettings({...settings, telegramToken: e.target.value})} className="w-full bg-[#0b0e11] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#facc15] transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-[#474d57]">Chat ID</label>
                  <input type="text" value={settings.telegramChatId} onChange={e => setSettings({...settings, telegramChatId: e.target.value})} className="w-full bg-[#0b0e11] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#facc15] transition-colors" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <ShieldOff size={14} className="text-red-400" />
                  <h4 className="text-[10px] font-black uppercase text-[#848e9c]">Blacklist Management</h4>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="BTC, ETH..." value={newBlacklistCoin} onChange={e => setNewBlacklistCoin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddBlacklist()} className="flex-1 bg-[#0b0e11] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#facc15] transition-colors" />
                  <button onClick={handleAddBlacklist} className="bg-[#facc15] text-black px-3 py-2 rounded-lg hover:scale-105 transition-transform"><Plus size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-black/20 rounded-lg">
                  {settings.blacklist.length === 0 ? <span className="text-[9px] text-[#474d57] italic uppercase">No custom coins blacklisted</span> : settings.blacklist.map(coin => (
                    <div key={coin} className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-md group hover:border-[#facc15]/30 transition-colors">
                      <span className="text-[10px] font-black text-[#eaecef] uppercase">{coin}</span>
                      <button onClick={() => handleRemoveBlacklist(coin)} className="text-[#474d57] hover:text-red-400 transition-colors"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-black/30 rounded-lg border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Globe size={10} className="text-[#facc15]" />
                    <span className="text-[8px] font-bold text-[#facc15] uppercase tracking-wider">System Blacklist:</span>
                  </div>
                  <div className="text-[9px] text-white/40 font-mono italic leading-relaxed break-words px-1">{fileBlacklist.length > 0 ? fileBlacklist.join(', ') : 'None'}</div>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full bg-[#facc15] text-black py-3 rounded-xl font-black uppercase text-xs shadow-xl hover:brightness-110 active:scale-95 transition-all mt-2">Apply & Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 2px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #facc15; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }

        .ticker-container {
          width: 100%;
          overflow: hidden;
          background: rgba(0,0,0,0.3);
        }

        .ticker-scroll {
          display: inline-flex;
          animation: scroll-ticker 40s linear infinite;
          padding-left: 20px;
          white-space: nowrap;
        }

        .ticker-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default App;
