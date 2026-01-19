import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function RealTimeMarketTicker({ watchlist = [] }) {
  const [marketData, setMarketData] = useState({
    sp500: null,
    userStocks: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Take top 3 stocks from user's watchlist
  const topStocks = watchlist.slice(0, 3);
  const symbols = ['QQQ', ...topStocks]; // QQQ = Nasdaq-100 ETF

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setIsLoading(true);
        
        // Using Finnhub API with your key
        const apiKey = 'd5n7s19r01qh5ppc5ln0d5n7s19r01qh5ppc5lng';
        
        const promises = symbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
            );
            
            if (!response.ok) {
              console.error(`API error for ${symbol}: ${response.status}`);
              return null;
            }
            
            const data = await response.json();
            
            // Validate data exists
            if (!data || data.c === undefined || data.c === null) {
              console.error(`No price data for ${symbol}`);
              return null;
            }
            
            return {
              symbol,
              price: data.c, // current price
              change: data.d || 0, // change
              changePercent: data.dp || 0, // change percent
            };
          } catch (err) {
            console.error(`Error fetching ${symbol}:`, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const validResults = results.filter(Boolean);

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
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">{data.symbol}</span>
        
        {isFlat ? (
          <Minus className="h-4 w-4 text-slate-400" />
        ) : isPositive ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
        
        <span className={`font-medium ${
          isFlat ? 'text-slate-600' : 
          isPositive ? 'text-green-600' : 
          'text-red-600'
        }`}>
          ${data.price.toFixed(2)}
        </span>
        
        <span className={`text-sm ${
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
      color: 'text-slate-600'
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-slate-300 rounded-full animate-pulse" />
          <span className="text-sm text-slate-400">Loading market data...</span>
        </div>
      </div>
    );
  }

  // If API failed completely, show fallback
  if (!marketData.sp500 && marketData.userStocks.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 bg-slate-400 rounded-full" />
        <span className="text-sm text-slate-600">Neutral</span>
        <span className="text-sm text-slate-500">Markets trading sideways</span>
        {topStocks.length > 0 && (
          <span className="text-sm text-slate-400 ml-4">
            (API key required for live prices)
          </span>
        )}
      </div>
    );
  }

  const sentiment = getSP500Sentiment();

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* S&P 500 Sentiment */}
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${
          sentiment.label === 'Bullish' || sentiment.label === 'Positive' ? 'bg-green-500' :
          sentiment.label === 'Bearish' || sentiment.label === 'Negative' ? 'bg-red-500' :
          'bg-slate-400'
        }`} />
        <span className={`font-medium ${sentiment.color}`}>
          {sentiment.label}
        </span>
        <span className="text-slate-500 text-sm">
          {sentiment.description}
        </span>
      </div>

      {/* Divider */}
      {marketData.userStocks.length > 0 && (
        <div className="h-4 w-px bg-slate-200" />
      )}

      {/* User's Top Stocks */}
      <div className="flex items-center gap-4">
        {marketData.userStocks.map((stock) => (
          <React.Fragment key={stock.symbol}>
            {renderTicker(stock)}
          </React.Fragment>
        ))}
      </div>

      {/* Show "Add stocks" hint if no watchlist */}
      {topStocks.length === 0 && (
        <span className="text-sm text-slate-400 italic">
          Add stocks to your watchlist in Settings
        </span>
      )}
    </div>
  );
}