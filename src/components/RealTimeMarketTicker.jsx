import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// API keys (consider moving to env: VITE_FINNHUB_API_KEY, VITE_FINLIGHT_API_KEY)
const FINNHUB_API_KEY = 'd5n7s19r01qh5ppc5ln0d5n7s19r01qh5ppc5lng';
const FINLIGHT_API_KEY = import.meta.env.VITE_FINLIGHT_API_KEY || '';

export default function RealTimeMarketTicker({ watchlist = [] }) {
  const [marketData, setMarketData] = useState({
    sp500: null,
    userStocks: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Take top 3 stocks from user's watchlist
  const topStocks = watchlist.slice(0, 3);
  const symbols = ['QQQ', ...topStocks]; // QQQ = Nasdaq-100 ETF

  console.log("🎯 Ticker received watchlist:", watchlist);
  console.log("🎯 topStocks (first 3):", topStocks);
  console.log("🎯 symbols to fetch:", symbols);

  // Fetch quote with Finnhub primary, Finlight fallback
  async function fetchQuoteWithFallback(symbol) {
    // Try Finnhub first (free tier, 60/min)
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      
      if (response.status === 429) {
        console.warn(`⚠️ Finnhub rate limit (429) for ${symbol}, trying Finlight fallback...`);
        return await fetchFinlightQuote(symbol);
      }
      
      if (!response.ok) {
        console.error(`Finnhub error for ${symbol}: ${response.status}`);
        return await fetchFinlightQuote(symbol);
      }
      
      const data = await response.json();
      
      if (!data || data.c === undefined || data.c === null) {
        console.error(`No Finnhub price data for ${symbol}, trying Finlight...`);
        return await fetchFinlightQuote(symbol);
      }
      
      return {
        symbol,
        price: data.c,
        change: data.d || 0,
        changePercent: data.dp || 0,
        provider: 'finnhub'
      };
    } catch (err) {
      console.error(`Finnhub fetch failed for ${symbol}:`, err.message);
      return await fetchFinlightQuote(symbol);
    }
  }

  // Finlight fallback (premium, 100/min, 10k/month on Pro Light)
  async function fetchFinlightQuote(symbol) {
    if (!FINLIGHT_API_KEY) {
      console.warn(`⚠️ No Finlight API key configured, skipping fallback for ${symbol}`);
      return null;
    }
    
    try {
      const response = await fetch(
        `https://finlight.me/api/stock/realtime/${symbol}`,
        {
          headers: {
            'X-API-KEY': FINLIGHT_API_KEY
          }
        }
      );
      
      if (!response.ok) {
        console.error(`Finlight error for ${symbol}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // Map Finlight response to our format (adjust based on actual response)
      const price = data.price || data.close || data.c || 0;
      const change = data.change || data.d || 0;
      const changePercent = data.changePercent || data.dp || data.changePercentage || 0;
      
      if (!price) {
        console.error(`No Finlight price data for ${symbol}`);
        return null;
      }
      
      console.log(`✅ Using Finlight fallback for ${symbol}`);
      return {
        symbol,
        price,
        change,
        changePercent,
        provider: 'finlight'
      };
    } catch (err) {
      console.error(`Finlight fetch failed for ${symbol}:`, err.message);
      return null;
    }
  }

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setIsLoading(true);
        
        const promises = symbols.map(symbol => fetchQuoteWithFallback(symbol));

        const results = await Promise.all(promises);
        const validResults = results.filter(Boolean);

        console.log("🎯 validResults:", validResults);
        console.log("🎯 userStocks filtered:", validResults.filter(d => d.symbol !== 'QQQ'));

        setMarketData({
          sp500: validResults.find(d => d.symbol === 'QQQ'), // Using QQQ for Nasdaq
          userStocks: validResults.filter(d => d.symbol !== 'QQQ')
        });
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMarketData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMarketData, 30000);
    
    return () => clearInterval(interval);
  }, [symbols.join(',')]);

  const renderTicker = (data) => {
    if (!data || !data.price || data.price === 0) return null;

    const isPositive = data.change >= 0;
    const isFlat = Math.abs(data.change) < 0.01;
    
    return (
      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
        <span className="font-semibold text-slate-700 text-xs md:text-base">{data.symbol}</span>
        
        {isFlat ? (
          <Minus className="h-3 w-3 md:h-4 md:w-4 text-slate-400 flex-shrink-0" />
        ) : isPositive ? (
          <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 flex-shrink-0" />
        ) : (
          <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600 flex-shrink-0" />
        )}
        
        <span className={`font-medium text-xs md:text-base ${
          isFlat ? 'text-slate-600' : 
          isPositive ? 'text-green-600' : 
          'text-red-600'
        }`}>
          ${data.price.toFixed(2)}
        </span>
        
        <span className={`text-[10px] md:text-sm ${
          isFlat ? 'text-slate-500' : 
          isPositive ? 'text-green-600' : 
          'text-red-600'
        }`}>
          {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
        </span>
      </div>
    );
  };

  const getSP500Sentiment = () => {
    if (!marketData.sp500) return { label: 'Neutral', description: 'Markets trading sideways' };
    
    const change = marketData.sp500.changePercent;
    
    if (change > 1) return { 
      label: 'Bullish', 
      description: 'Nasdaq rallying higher',
      color: 'text-green-600'
    };
    if (change > 0.3) return { 
      label: 'Positive', 
      description: 'Nasdaq trending up',
      color: 'text-green-600'
    };
    if (change < -1) return { 
      label: 'Bearish', 
      description: 'Nasdaq under pressure',
      color: 'text-red-600'
    };
    if (change < -0.3) return { 
      label: 'Negative', 
      description: 'Nasdaq trending down',
      color: 'text-red-600'
    };
    
    return { 
      label: 'Neutral', 
      description: 'Nasdaq trading sideways',
      color: 'text-amber-600'
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-slate-300 rounded-full animate-pulse" />
          <span className="text-xs md:text-sm text-slate-400">Loading market data...</span>
        </div>
      </div>
    );
  }

  // If API failed completely, show fallback
  if (!marketData.sp500 && marketData.userStocks.length === 0) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-2 w-2 bg-amber-500 rounded-full" />
        <span className="text-xs md:text-sm text-amber-600">Neutral</span>
        <span className="text-xs md:text-sm text-amber-600/90">Markets trading sideways</span>
        {topStocks.length > 0 && (
          <span className="text-[10px] md:text-sm text-slate-400 ml-2 md:ml-4">
            (API key required for live prices)
          </span>
        )}
      </div>
    );
  }

  const sentiment = getSP500Sentiment();

  return (
    <div className="flex items-center gap-3 md:gap-6 flex-wrap">
      {/* Nasdaq Sentiment */}
      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
        <div className={`h-2 w-2 rounded-full ${
          sentiment.label === 'Bullish' || sentiment.label === 'Positive' ? 'bg-green-500' :
          sentiment.label === 'Bearish' || sentiment.label === 'Negative' ? 'bg-red-500' :
          'bg-amber-500'
        }`} />
        <span className={`font-medium text-xs md:text-base ${sentiment.color}`}>
          {sentiment.label}
        </span>
        <span className="text-slate-500 text-[10px] md:text-sm hidden sm:inline">
          {sentiment.description}
        </span>
      </div>

      {/* Divider */}
      {marketData.userStocks.length > 0 && (
        <div className="h-3 md:h-4 w-px bg-slate-200 flex-shrink-0" />
      )}

      {/* User's Top 3 Stocks */}
      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
        {marketData.userStocks.map((stock) => (
          <React.Fragment key={stock.symbol}>
            {renderTicker(stock)}
          </React.Fragment>
        ))}
      </div>

      {/* Show "Add stocks" hint if no watchlist */}
      {topStocks.length === 0 && (
        <span className="text-xs md:text-sm text-slate-400 italic">
          Add stocks to your watchlist in Settings
        </span>
      )}
    </div>
  );
}