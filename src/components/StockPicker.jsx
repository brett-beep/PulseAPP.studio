import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Popular stocks for quick access
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'HD', name: 'Home Depot Inc.' },
  { symbol: 'DIS', name: 'Walt Disney Co.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global' },
  { symbol: 'SQ', name: 'Block Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'ABNB', name: 'Airbnb Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies' },
];

// Keep consistent with existing frontend Finnhub usage in this project.
const FINNHUB_API_KEY = 'd5n7s19r01qh5ppc5ln0d5n7s19r01qh5ppc5lng';
const FINNHUB_SEARCH_LIMIT = 20;

function normalizeText(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function levenshtein(a = '', b = '') {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;

  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function getMatchScore(stock, rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return -Infinity;

  const symbol = normalizeText(stock?.symbol || '');
  const name = normalizeText(stock?.name || '');

  if (symbol === query) return 1000;
  if (name === query) return 980;
  if (symbol.startsWith(query)) return 900 - (symbol.length - query.length);
  if (name.startsWith(query)) return 850 - (name.length - query.length) * 0.5;
  if (symbol.includes(query)) return 760 - (symbol.length - query.length) * 0.5;
  if (name.includes(query)) return 720 - (name.length - query.length) * 0.2;

  const symbolDist = symbol ? levenshtein(query, symbol) : 99;
  const nameDist = name ? levenshtein(query, name) : 99;
  const bestDist = Math.min(symbolDist, nameDist);

  // Typo-tolerance for near matches like "NVDIA" -> NVDA.
  if (bestDist <= 2) return 650 - bestDist * 40;
  if (bestDist <= 3 && query.length >= 5) return 520 - bestDist * 30;

  return -Infinity;
}

function dedupeBySymbol(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const symbol = normalizeText(item?.symbol || '');
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ ...item, symbol: item.symbol.toUpperCase() });
  }
  return out;
}

export default function StockPicker({ selectedStocks = [], onAdd, onRemove, maxStocks = 10 }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search stocks with API-backed results + typo-tolerant fallback.
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);

      try {
        const localRanked = POPULAR_STOCKS
          .map((stock) => ({ stock, score: getMatchScore(stock, term) }))
          .filter((x) => x.score > -Infinity)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.stock);

        let apiResults = [];
        try {
          const resp = await fetch(
            `https://finnhub.io/api/v1/search?q=${encodeURIComponent(term)}&token=${FINNHUB_API_KEY}`
          );
          if (resp.ok) {
            const data = await resp.json();
            const raw = Array.isArray(data?.result) ? data.result : [];

            apiResults = raw
              .filter((item) => item?.symbol && item?.description)
              .map((item) => ({
                symbol: String(item.symbol || '').toUpperCase(),
                name: String(item.description || '').trim(),
                type: item.type || '',
              }))
              .filter((item) => item.symbol.length > 0)
              .filter((item) => item.type !== 'ETP') // avoid ETF spam in type-ahead
              .slice(0, FINNHUB_SEARCH_LIMIT);
          }
        } catch (_) {
          // Network/API issues should not block local fallback.
        }

        const merged = dedupeBySymbol([...localRanked, ...apiResults]);
        const ranked = merged
          .map((stock) => ({ stock, score: getMatchScore(stock, term) }))
          .filter((x) => x.score > -Infinity)
          .sort((a, b) => b.score - a.score)
          .slice(0, FINNHUB_SEARCH_LIMIT)
          .map((x) => x.stock);

        const normalizedTerm = normalizeText(term);
        const hasExactSymbol = ranked.some((s) => normalizeText(s.symbol) === normalizedTerm);
        const results = [...ranked];

        // Keep custom ticker option only when there's no exact symbol match.
        if (!hasExactSymbol && normalizedTerm.length > 0) {
          results.unshift({ symbol: normalizedTerm, name: 'Add custom ticker', isCustom: true });
        }

        setSearchResults(results);
        setShowDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectStock = (stock) => {
    if (selectedStocks.length >= maxStocks) {
      alert(`Maximum ${maxStocks} stocks allowed`);
      return;
    }

    if (!selectedStocks.includes(stock.symbol)) {
      onAdd(stock.symbol);
      setSearchTerm('');
      setShowDropdown(false);
    }
  };

  const canAddMore = selectedStocks.length < maxStocks;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      {canAddMore && (
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stocks (e.g., AAPL, Tesla, NVIDIA)..."
              className="pl-10"
              onFocus={() => searchTerm && setShowDropdown(true)}
            />
          </div>

          {/* Dropdown Results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 max-h-56 md:max-h-64 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  disabled={selectedStocks.includes(stock.symbol)}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                    selectedStocks.includes(stock.symbol) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm md:text-base">
                        {stock.symbol}
                        {stock.isCustom && (
                          <span className="ml-2 text-xs text-amber-600">(Custom)</span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-slate-500 truncate">{stock.name}</div>
                    </div>
                    {selectedStocks.includes(stock.symbol) && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">Added</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Stocks */}
      <div>
        {selectedStocks.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {selectedStocks.map((symbol) => (
              <Badge
                key={symbol}
                variant="secondary"
                className="px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm flex items-center gap-1.5 md:gap-2 bg-amber-50 border-amber-200"
              >
                <TrendingUp className="h-3 w-3 text-amber-600" />
                <span className="font-semibold text-slate-900">{symbol}</span>
                <button 
                  onClick={() => onRemove(symbol)}
                  className="hover:text-red-500 transition-colors ml-0.5 md:ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs md:text-sm text-slate-400 italic">No stocks selected yet. Search to add up to {maxStocks} stocks.</p>
        )}
      </div>

      {/* Quick Add Popular Stocks */}
      {canAddMore && selectedStocks.length < 3 && (
        <div>
          <p className="text-[10px] md:text-xs text-slate-500 mb-2">Quick add popular stocks:</p>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {POPULAR_STOCKS.slice(0, 8)
              .filter(stock => !selectedStocks.includes(stock.symbol))
              .map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  className="px-2.5 md:px-3 py-1 text-[10px] md:text-xs rounded-full border border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-colors text-slate-600 hover:text-amber-700"
                >
                  {stock.symbol}
                </button>
              ))}
          </div>
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs md:text-sm text-amber-600">Maximum {maxStocks} stocks reached</p>
      )}
    </div>
  );
}