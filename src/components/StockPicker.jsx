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

  // Search stocks (local filtering for now, can add API later)
  useEffect(() => {
    if (searchTerm.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    const term = searchTerm.toUpperCase();
    
    // Filter popular stocks
    const filtered = POPULAR_STOCKS.filter(stock => 
      stock.symbol.includes(term) || 
      stock.name.toUpperCase().includes(term)
    );

    // If exact match not found, add manual entry option
    const exactMatch = filtered.find(s => s.symbol === term);
    if (!exactMatch && term.length > 0) {
      filtered.unshift({ symbol: term, name: 'Add custom ticker', isCustom: true });
    }

    setSearchResults(filtered);
    setShowDropdown(true);
    setIsSearching(false);
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