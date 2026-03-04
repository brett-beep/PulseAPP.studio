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

// Top 200 US ETFs by AUM — searchable alongside stocks
const POPULAR_ETFS = [
  { symbol: 'SPY',  name: 'SPDR S&P 500 ETF' },
  { symbol: 'IVV',  name: 'iShares Core S&P 500' },
  { symbol: 'VOO',  name: 'Vanguard S&P 500 ETF' },
  { symbol: 'VTI',  name: 'Vanguard Total Stock Market' },
  { symbol: 'QQQ',  name: 'Invesco QQQ Trust (Nasdaq 100)' },
  { symbol: 'VEA',  name: 'Vanguard FTSE Developed Markets' },
  { symbol: 'VTV',  name: 'Vanguard Value ETF' },
  { symbol: 'IEFA', name: 'iShares Core MSCI EAFE' },
  { symbol: 'BND',  name: 'Vanguard Total Bond Market' },
  { symbol: 'AGG',  name: 'iShares Core US Aggregate Bond' },
  { symbol: 'VUG',  name: 'Vanguard Growth ETF' },
  { symbol: 'VWO',  name: 'Vanguard FTSE Emerging Markets' },
  { symbol: 'IEMG', name: 'iShares Core MSCI Emerging Markets' },
  { symbol: 'IWF',  name: 'iShares Russell 1000 Growth' },
  { symbol: 'IJR',  name: 'iShares Core S&P Small-Cap' },
  { symbol: 'IJH',  name: 'iShares Core S&P Mid-Cap' },
  { symbol: 'VIG',  name: 'Vanguard Dividend Appreciation' },
  { symbol: 'IWM',  name: 'iShares Russell 2000' },
  { symbol: 'IWD',  name: 'iShares Russell 1000 Value' },
  { symbol: 'GLD',  name: 'SPDR Gold Shares' },
  { symbol: 'EFA',  name: 'iShares MSCI EAFE' },
  { symbol: 'VGT',  name: 'Vanguard Information Technology' },
  { symbol: 'XLK',  name: 'Technology Select Sector SPDR' },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock' },
  { symbol: 'VO',   name: 'Vanguard Mid-Cap ETF' },
  { symbol: 'VB',   name: 'Vanguard Small-Cap ETF' },
  { symbol: 'SCHD', name: 'Schwab US Dividend Equity' },
  { symbol: 'BSV',  name: 'Vanguard Short-Term Bond' },
  { symbol: 'VCSH', name: 'Vanguard Short-Term Corporate Bond' },
  { symbol: 'LQD',  name: 'iShares Investment Grade Corporate Bond' },
  { symbol: 'VCIT', name: 'Vanguard Intermediate-Term Corporate Bond' },
  { symbol: 'TIP',  name: 'iShares TIPS Bond' },
  { symbol: 'XLV',  name: 'Health Care Select Sector SPDR' },
  { symbol: 'XLF',  name: 'Financial Select Sector SPDR' },
  { symbol: 'VYM',  name: 'Vanguard High Dividend Yield' },
  { symbol: 'ITOT', name: 'iShares Core S&P Total US Stock Market' },
  { symbol: 'SCHX', name: 'Schwab US Large-Cap' },
  { symbol: 'SCHF', name: 'Schwab International Equity' },
  { symbol: 'RSP',  name: 'Invesco S&P 500 Equal Weight' },
  { symbol: 'XLE',  name: 'Energy Select Sector SPDR' },
  { symbol: 'XLI',  name: 'Industrial Select Sector SPDR' },
  { symbol: 'XLY',  name: 'Consumer Discretionary Select SPDR' },
  { symbol: 'XLP',  name: 'Consumer Staples Select SPDR' },
  { symbol: 'XLU',  name: 'Utilities Select Sector SPDR' },
  { symbol: 'XLB',  name: 'Materials Select Sector SPDR' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR' },
  { symbol: 'XLC',  name: 'Communication Services Select SPDR' },
  { symbol: 'DIA',  name: 'SPDR Dow Jones Industrial Average' },
  { symbol: 'MDY',  name: 'SPDR S&P MidCap 400' },
  { symbol: 'SLV',  name: 'iShares Silver Trust' },
  { symbol: 'IAU',  name: 'iShares Gold Trust' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF' },
  { symbol: 'ARKG', name: 'ARK Genomic Revolution' },
  { symbol: 'ARKW', name: 'ARK Next Generation Internet' },
  { symbol: 'ARKF', name: 'ARK Fintech Innovation' },
  { symbol: 'ARKQ', name: 'ARK Autonomous Tech & Robotics' },
  { symbol: 'VNQ',  name: 'Vanguard Real Estate ETF' },
  { symbol: 'SCHB', name: 'Schwab US Broad Market' },
  { symbol: 'SCHA', name: 'Schwab US Small-Cap' },
  { symbol: 'SCHE', name: 'Schwab Emerging Markets Equity' },
  { symbol: 'SCHG', name: 'Schwab US Large-Cap Growth' },
  { symbol: 'SCHV', name: 'Schwab US Large-Cap Value' },
  { symbol: 'SPDW', name: 'SPDR Portfolio Developed World' },
  { symbol: 'SPEM', name: 'SPDR Portfolio Emerging Markets' },
  { symbol: 'SPLG', name: 'SPDR Portfolio S&P 500' },
  { symbol: 'SPYG', name: 'SPDR Portfolio S&P 500 Growth' },
  { symbol: 'SPYV', name: 'SPDR Portfolio S&P 500 Value' },
  { symbol: 'VHT',  name: 'Vanguard Health Care ETF' },
  { symbol: 'VIS',  name: 'Vanguard Industrials ETF' },
  { symbol: 'VCR',  name: 'Vanguard Consumer Discretionary' },
  { symbol: 'VDC',  name: 'Vanguard Consumer Staples' },
  { symbol: 'VDE',  name: 'Vanguard Energy ETF' },
  { symbol: 'VFH',  name: 'Vanguard Financials ETF' },
  { symbol: 'VOX',  name: 'Vanguard Communication Services' },
  { symbol: 'VAW',  name: 'Vanguard Materials ETF' },
  { symbol: 'VPU',  name: 'Vanguard Utilities ETF' },
  { symbol: 'NOBL', name: 'ProShares S&P 500 Dividend Aristocrats' },
  { symbol: 'DVY',  name: 'iShares Select Dividend' },
  { symbol: 'SDY',  name: 'SPDR S&P Dividend' },
  { symbol: 'HDV',  name: 'iShares Core High Dividend' },
  { symbol: 'DGRO', name: 'iShares Core Dividend Growth' },
  { symbol: 'IWR',  name: 'iShares Russell Mid-Cap' },
  { symbol: 'IWS',  name: 'iShares Russell Mid-Cap Value' },
  { symbol: 'IWP',  name: 'iShares Russell Mid-Cap Growth' },
  { symbol: 'IWN',  name: 'iShares Russell 2000 Value' },
  { symbol: 'IWO',  name: 'iShares Russell 2000 Growth' },
  { symbol: 'EEM',  name: 'iShares MSCI Emerging Markets' },
  { symbol: 'EWJ',  name: 'iShares MSCI Japan' },
  { symbol: 'EWZ',  name: 'iShares MSCI Brazil' },
  { symbol: 'EWT',  name: 'iShares MSCI Taiwan' },
  { symbol: 'EWY',  name: 'iShares MSCI South Korea' },
  { symbol: 'EWG',  name: 'iShares MSCI Germany' },
  { symbol: 'EWU',  name: 'iShares MSCI United Kingdom' },
  { symbol: 'EWC',  name: 'iShares MSCI Canada' },
  { symbol: 'EWA',  name: 'iShares MSCI Australia' },
  { symbol: 'FXI',  name: 'iShares China Large-Cap' },
  { symbol: 'KWEB', name: 'KraneShares CSI China Internet' },
  { symbol: 'INDA', name: 'iShares MSCI India' },
  { symbol: 'VGK',  name: 'Vanguard FTSE Europe' },
  { symbol: 'VPL',  name: 'Vanguard FTSE Pacific' },
  { symbol: 'MCHI', name: 'iShares MSCI China' },
  { symbol: 'IGSB', name: 'iShares 1-5 Year Investment Grade Corporate Bond' },
  { symbol: 'IGIB', name: 'iShares 5-10 Year Investment Grade Corporate Bond' },
  { symbol: 'HYG',  name: 'iShares iBoxx High Yield Corporate Bond' },
  { symbol: 'JNK',  name: 'SPDR Bloomberg High Yield Bond' },
  { symbol: 'EMB',  name: 'iShares J.P. Morgan USD Emerging Markets Bond' },
  { symbol: 'MUB',  name: 'iShares National Muni Bond' },
  { symbol: 'TLT',  name: 'iShares 20+ Year Treasury Bond' },
  { symbol: 'IEF',  name: 'iShares 7-10 Year Treasury Bond' },
  { symbol: 'SHY',  name: 'iShares 1-3 Year Treasury Bond' },
  { symbol: 'SHV',  name: 'iShares Short Treasury Bond' },
  { symbol: 'GOVT', name: 'iShares US Treasury Bond' },
  { symbol: 'VGSH', name: 'Vanguard Short-Term Treasury' },
  { symbol: 'VGIT', name: 'Vanguard Intermediate-Term Treasury' },
  { symbol: 'VGLT', name: 'Vanguard Long-Term Treasury' },
  { symbol: 'BIL',  name: 'SPDR Bloomberg 1-3 Month T-Bill' },
  { symbol: 'BNDX', name: 'Vanguard Total International Bond' },
  { symbol: 'VMBS', name: 'Vanguard Mortgage-Backed Securities' },
  { symbol: 'MBB',  name: 'iShares MBS ETF' },
  { symbol: 'VTEB', name: 'Vanguard Tax-Exempt Bond' },
  { symbol: 'MINT', name: 'PIMCO Enhanced Short Maturity Active' },
  { symbol: 'USFR', name: 'WisdomTree Floating Rate Treasury' },
  { symbol: 'SGOV', name: 'iShares 0-3 Month Treasury Bond' },
  { symbol: 'TQQQ', name: 'ProShares UltraPro QQQ (3x)' },
  { symbol: 'SQQQ', name: 'ProShares UltraPro Short QQQ (-3x)' },
  { symbol: 'SPXL', name: 'Direxion Daily S&P 500 Bull 3x' },
  { symbol: 'UPRO', name: 'ProShares UltraPro S&P 500 (3x)' },
  { symbol: 'SOXL', name: 'Direxion Daily Semiconductor Bull 3x' },
  { symbol: 'SOXS', name: 'Direxion Daily Semiconductor Bear 3x' },
  { symbol: 'TNA',  name: 'Direxion Daily Small Cap Bull 3x' },
  { symbol: 'UVXY', name: 'ProShares Ultra VIX Short-Term Futures' },
  { symbol: 'VXX',  name: 'iPath Series B S&P 500 VIX' },
  { symbol: 'QLD',  name: 'ProShares Ultra QQQ (2x)' },
  { symbol: 'SSO',  name: 'ProShares Ultra S&P 500 (2x)' },
  { symbol: 'SOXX', name: 'iShares Semiconductor ETF' },
  { symbol: 'SMH',  name: 'VanEck Semiconductor ETF' },
  { symbol: 'XBI',  name: 'SPDR S&P Biotech ETF' },
  { symbol: 'IBB',  name: 'iShares Biotechnology ETF' },
  { symbol: 'HACK', name: 'ETFMG Prime Cyber Security' },
  { symbol: 'BOTZ', name: 'Global X Robotics & AI ETF' },
  { symbol: 'ROBO', name: 'ROBO Global Robotics & Automation' },
  { symbol: 'AIQ',  name: 'Global X Artificial Intelligence & Technology' },
  { symbol: 'CIBR', name: 'First Trust NASDAQ Cybersecurity' },
  { symbol: 'SKYY', name: 'First Trust Cloud Computing' },
  { symbol: 'WCLD', name: 'WisdomTree Cloud Computing' },
  { symbol: 'FINX', name: 'Global X FinTech ETF' },
  { symbol: 'ICLN', name: 'iShares Global Clean Energy' },
  { symbol: 'TAN',  name: 'Invesco Solar ETF' },
  { symbol: 'QCLN', name: 'First Trust NASDAQ Clean Edge Green Energy' },
  { symbol: 'LIT',  name: 'Global X Lithium & Battery Tech' },
  { symbol: 'URA',  name: 'Global X Uranium ETF' },
  { symbol: 'COPX', name: 'Global X Copper Miners' },
  { symbol: 'REMX', name: 'VanEck Rare Earth/Strategic Metals' },
  { symbol: 'GDX',  name: 'VanEck Gold Miners ETF' },
  { symbol: 'GDXJ', name: 'VanEck Junior Gold Miners' },
  { symbol: 'SIL',  name: 'Global X Silver Miners' },
  { symbol: 'XOP',  name: 'SPDR S&P Oil & Gas Exploration' },
  { symbol: 'OIH',  name: 'VanEck Oil Services ETF' },
  { symbol: 'USO',  name: 'United States Oil Fund' },
  { symbol: 'UNG',  name: 'United States Natural Gas Fund' },
  { symbol: 'DBA',  name: 'Invesco DB Agriculture Fund' },
  { symbol: 'DBC',  name: 'Invesco DB Commodity Index' },
  { symbol: 'GSG',  name: 'iShares GSCI Commodity-Indexed Trust' },
  { symbol: 'PDBC', name: 'Invesco Optimum Yield Diversified Commodity' },
  { symbol: 'GBTC', name: 'Grayscale Bitcoin Trust' },
  { symbol: 'IBIT', name: 'iShares Bitcoin Trust' },
  { symbol: 'FBTC', name: 'Fidelity Wise Origin Bitcoin Fund' },
  { symbol: 'BITO', name: 'ProShares Bitcoin Strategy ETF' },
  { symbol: 'ETHE', name: 'Grayscale Ethereum Trust' },
  { symbol: 'ETHA', name: 'iShares Ethereum Trust' },
  { symbol: 'BITB', name: 'Bitwise Bitcoin ETF' },
  { symbol: 'MARA', name: 'Marathon Digital Holdings' },
  { symbol: 'RIOT', name: 'Riot Platforms' },
  { symbol: 'XHB',  name: 'SPDR S&P Homebuilders ETF' },
  { symbol: 'ITB',  name: 'iShares US Home Construction' },
  { symbol: 'IYR',  name: 'iShares US Real Estate' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR' },
  { symbol: 'REM',  name: 'iShares Mortgage Real Estate' },
  { symbol: 'KRE',  name: 'SPDR S&P Regional Banking' },
  { symbol: 'KBE',  name: 'SPDR S&P Bank ETF' },
  { symbol: 'IHI',  name: 'iShares US Medical Devices' },
  { symbol: 'XRT',  name: 'SPDR S&P Retail ETF' },
  { symbol: 'ITA',  name: 'iShares US Aerospace & Defense' },
  { symbol: 'PFF',  name: 'iShares Preferred & Income Securities' },
  { symbol: 'JEPI', name: 'JPMorgan Equity Premium Income' },
  { symbol: 'JEPQ', name: 'JPMorgan Nasdaq Equity Premium Income' },
  { symbol: 'DIVO', name: 'Amplify CWP Enhanced Dividend Income' },
  { symbol: 'XYLD', name: 'Global X S&P 500 Covered Call' },
  { symbol: 'QYLD', name: 'Global X NASDAQ 100 Covered Call' },
  { symbol: 'RYLD', name: 'Global X Russell 2000 Covered Call' },
  { symbol: 'COWZ', name: 'Pacer US Cash Cows 100' },
  { symbol: 'QUAL', name: 'iShares MSCI USA Quality Factor' },
  { symbol: 'MTUM', name: 'iShares MSCI USA Momentum Factor' },
  { symbol: 'USMV', name: 'iShares MSCI USA Min Vol Factor' },
  { symbol: 'VLUE', name: 'iShares MSCI USA Value Factor' },
  { symbol: 'SIZE', name: 'iShares MSCI USA Size Factor' },
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
        const ALL_LOCAL = [...POPULAR_STOCKS, ...POPULAR_ETFS];
        const localRanked = ALL_LOCAL
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
              placeholder="Search stocks & ETFs (e.g., AAPL, SPY, QQQ)..."
              className="pl-10"
              onFocus={() => searchTerm && setShowDropdown(true)}
            />
          </div>

          {/* Dropdown Results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-slate-200 dark:border-neutral-700 max-h-56 md:max-h-64 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  disabled={selectedStocks.includes(stock.symbol)}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors border-b border-slate-100 dark:border-neutral-800 last:border-b-0 ${
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
          <p className="text-[10px] md:text-xs text-slate-500 mb-2">Quick add popular:</p>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {[...POPULAR_STOCKS.slice(0, 6), ...POPULAR_ETFS.slice(0, 4)]
              .filter(stock => !selectedStocks.includes(stock.symbol))
              .slice(0, 10)
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