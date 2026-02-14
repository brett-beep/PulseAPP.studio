// generateBriefing function - synced Jan 26, 2026 (redeploy for env vars)
// Uses secrets: FINNHUB_API_KEY, FINLIGHT_API_KEY. If missing after GitHub deploy → Base44: edit this file (e.g. add newline), Save & Deploy (see DEPLOY.md).
// Adding this line V3 ________________ to manually redeploy on Base44
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function localISODate(timeZone, input) {
  const s = typeof input === "string" ? input.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY-MM-DD in the user's timezone
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(timeZone, d = new Date()) {
  const weekdayShort = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(d);
  const mdParts = new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric", day: "numeric" }).formatToParts(d);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = map[weekdayShort] ?? 0;

  let month = 1; 
  let day = 1;
  for (const p of mdParts) {
    if (p.type === "month") month = Number(p.value) || 1;
    if (p.type === "day") day = Number(p.value) || 1;
  }

  const hour = Number(hourStr) || 0;

  return { dayOfWeek, hour, month, day };
}

/**
 * Returns a natural-language phrase for when a story happened, in the user's timezone.
 * Uses the story's actual datetime so the script can say "On Friday evening, ..." accurately.
 * e.g. "earlier today", "yesterday afternoon", "on Friday evening"
 */
function getStoryWhenPhrase(storyDatetimeIso, timeZone, ageHours) {
  if (!storyDatetimeIso) return "recently";
  const storyDate = new Date(storyDatetimeIso);
  if (isNaN(storyDate.getTime())) return "recently";

  const fmt = (d, opts) => new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(d);
  const storyWeekday = fmt(storyDate, { weekday: "long" });
  const hour = parseInt(fmt(storyDate, { hour: "2-digit", hour12: false }), 10) || 0;
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  if (ageHours != null && ageHours <= 24) {
    if (ageHours < 12) return `earlier today (${timeOfDay})`;
    return `yesterday (${storyWeekday}) ${timeOfDay}`;
  }
  if (ageHours != null && ageHours <= 48) return `on ${storyWeekday} ${timeOfDay}`;
  if (ageHours != null && ageHours <= 168) return `on ${storyWeekday}`;
  return `on ${storyWeekday}`;
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function sanitizeForAudio(s) {
  if (!s) return "";
  let t = String(s);
  // Remove (NASDAQ:XXX) and (NYSE:XXX) — never read exchange ticker prefixes aloud
  t = t.replace(/\(NASDAQ:\s*\w+\)/gi, "");
  t = t.replace(/\(NYSE:\s*\w+\)/gi, "");
  t = t.replace(/\(AMEX:\s*\w+\)/gi, "");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, "");
  t = t.replace(/[*_`>#]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

const TICKER_TO_COMPANY: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  GOOG: "Alphabet",
  AMZN: "Amazon",
  META: "Meta",
  NVDA: "Nvidia",
  TSLA: "Tesla",
  SHOP: "Shopify",
  NFLX: "Netflix",
  WBD: "Warner Bros. Discovery",
  COIN: "Coinbase",
  CRM: "Salesforce",
  ADBE: "Adobe",
  UBER: "Uber",
  ABNB: "Airbnb",
  JPM: "JPMorgan",
  V: "Visa",
  MA: "Mastercard",
  DIS: "Disney",
};

function replaceTickersWithCompanyNames(text: string, userHoldings: any[] = []): string {
  if (!text) return "";
  let out = text;

  const dynamicMap: Record<string, string> = {};
  for (const h of userHoldings || []) {
    if (typeof h === "object" && h) {
      const symbol = safeText(h.symbol || h.ticker, "").toUpperCase();
      const name = safeText(h.name, "");
      if (symbol && name) dynamicMap[symbol] = name;
    }
  }
  const merged = { ...TICKER_TO_COMPANY, ...dynamicMap };

  for (const [ticker, company] of Object.entries(merged)) {
    const re = new RegExp(`\\b${ticker}\\b`, "g");
    out = out.replace(re, company);
  }

  // Cleanup any accidental double spaces after replacements
  out = out.replace(/[ \t]{2,}/g, " ");
  return out.trim();
}

// Transition phrases used by the LLM to signal story boundaries.
// These MUST stay in sync with transitionPhrases in AudioPlayer.jsx
// so that info cards can detect when each story starts during playback.
// The LLM is instructed to weave these naturally into sentences (not as rigid prefixes).

function normalizeStoryKey(story: any): string {
  const href = String(story?.href || story?.url || story?.link || "").trim().toLowerCase();
  if (href) return `u:${href}`;
  const title = String(story?.title || "").trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  if (title) return `t:${title}`;
  const body = String(story?.what_happened || story?.summary || "").trim().toLowerCase().slice(0, 140);
  return body ? `b:${body}` : "";
}

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
}

function normalizePct(input) {
  const s = String(input ?? "").trim();
  if (!s) return "0.0%";
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return "0.0%";
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return "0.0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function categoryImageUrl(categoryRaw) {
  const cat = safeText(categoryRaw, "default").toLowerCase();
  const map = {
    markets:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=70",
    crypto:
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=70",
    economy:
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
    technology:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=70",
    "real estate":
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=70",
    commodities:
      "https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?auto=format&fit=crop&w=1200&q=70",
    default:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=70",
  };
  return map[cat] || map.default;
}

// =========================================================
// TWO-TIER STORY SELECTION SYSTEM
// =========================================================

// TIER 1: Breaking News Score - identifies urgent macro headlines
function getBreakingScore(story, nowTimestamp) {
  let score = 0;
  
  // Calculate age in hours
  const storyTime = new Date(story.datetime).getTime();
  const ageHours = (nowTimestamp - storyTime) / (1000 * 60 * 60);
  
  // 1. RECENCY BOOST (most important signal)
  if (ageHours <= 1) score += 100;
  else if (ageHours <= 2) score += 80;
  else if (ageHours <= 3) score += 60;
  else if (ageHours <= 6) score += 30;
  else if (ageHours <= 12) score += 10;
  
  // 2. MACRO CATEGORY BOOST
  const category = (story.category || "").toLowerCase();
  if (category === "economy") score += 40;
  if (category === "markets") score += 30;
  
  // 3. HIGH-IMPACT KEYWORDS (Bloomberg/CNBC-style breaking news signals)
  const BREAKING_SIGNALS = [
    // Fed/Monetary Policy
    "fed", "powell", "fomc", "rate cut", "rate hike", "inflation", "deflation",
    "federal reserve", "central bank", "monetary policy", "basis points", "bps",
    
    // Major Economic Data
    "jobs report", "unemployment", "gdp", "cpi", "ppi", "jobless claims",
    "consumer confidence", "retail sales", "manufacturing", "housing starts",
    "payroll", "nonfarm", "initial claims", "core inflation",
    
    // Market Events
    "selloff", "rally", "crash", "surge", "plunge", "record high", "record low",
    "circuit breaker", "volatility", "vix", "correction", "bear market", "bull market",
    "futures", "premarket", "after hours",
    
    // Geopolitical/Policy
    "trump", "biden", "tariff", "trade war", "sanctions", "summit",
    "executive order", "debt ceiling", "shutdown", "stimulus", "tax bill",
    "congress", "treasury", "yellen",
    
    // Corporate Big Events
    "bankruptcy", "merger", "acquisition", "m&a", "ipo", "earnings beat", 
    "earnings miss", "guidance cut", "guidance raise", "ceo", "layoffs",
    "restructuring", "spinoff", "dividend cut", "buyback",
    
    // Crisis/Disaster
    "crisis", "disaster", "emergency", "outbreak", "pandemic", "war", 
    "conflict", "attack", "breach", "hack", "scandal", "investigation",
    "default", "recession"
  ];
  
  const titleLower = (story.title || "").toLowerCase();
  const summaryLower = (story.what_happened || "").toLowerCase();
  const fullText = `${titleLower} ${summaryLower}`;
  
  // Count keyword matches
  const matchCount = BREAKING_SIGNALS.filter(kw => fullText.includes(kw)).length;
  score += matchCount * 12; // Each keyword match adds points
  
  // 4. SOURCE CREDIBILITY BOOST
  const TIER_1_SOURCES = ["bloomberg", "reuters", "wsj", "wall street journal", "financial times", "ft", "cnbc", "associated press", "ap"];
  const outletLower = (story.outlet || "").toLowerCase();
  if (TIER_1_SOURCES.some(s => outletLower.includes(s))) {
    score += 25;
  }
  
  // 5. Original cache rank bonus (already pre-scored by refreshNewsCache)
  const originalRank = story.rank || 999;
  if (originalRank <= 3) score += 20;
  else if (originalRank <= 5) score += 15;
  else if (originalRank <= 10) score += 10;
  
  // 6. Inherit urgency_score from Alpha Vantage pre-scoring (if available)
  if (story.urgency_score) {
    score += Math.round(story.urgency_score * 0.3); // Weight it as a supplemental signal
  }
  
  // 7. Sentiment strength bonus (strong market sentiment = more actionable)
  if (story.sentiment_score) {
    const sentimentStrength = Math.abs(story.sentiment_score);
    if (sentimentStrength > 0.3) score += 15; // Strong sentiment
    else if (sentimentStrength > 0.15) score += 8; // Moderate sentiment
  }

  // 8. PENALIZE COMPANY-SPECIFIC NEWS (should go to personalized, not breaking)
  const COMPANY_SIGNALS = [
    "earnings", "quarterly", "q1", "q2", "q3", "q4", "quarter",
    "guidance", "revenue beat", "revenue miss", "profit",
    "ceo", "cfo", "executive", "management",
    "ipo", "merger", "acquisition", "m&a",
    "layoffs", "restructuring", "spinoff",
    "dividend", "buyback", "stock split"
  ];
  const hasCompanyNews = COMPANY_SIGNALS.some(kw => fullText.includes(kw));
  if (hasCompanyNews) {
    score -= 60; // Strong penalty - we want macro news only
  }

  return { score, ageHours };
}

// TIER 2: Personalization - matches user interests/holdings
const INTEREST_TO_CATEGORIES = {
  "crypto": ["crypto"], "cryptocurrency": ["crypto"], "bitcoin": ["crypto"], "ethereum": ["crypto"],
  "real estate": ["real estate"], "reits": ["real estate"], "housing": ["real estate"],
  "commodities": ["commodities"], "gold": ["commodities"], "oil": ["commodities"],
  "technology": ["technology"], "tech": ["technology"], "ai": ["technology"], "semiconductors": ["technology"],
  "economy": ["economy"], "macro": ["economy"], "federal reserve": ["economy"], "fed": ["economy"],
  "markets": ["markets"], "stocks": ["markets"], "equities": ["markets"], "etfs": ["markets"],
  "growth stocks": ["technology", "markets"], "value investing": ["markets", "economy"],
  "dividends": ["markets", "real estate"], "retirement": ["markets", "economy"],
};

const INTEREST_KEYWORDS = {
  "crypto": ["crypto", "bitcoin", "btc", "ethereum", "eth", "blockchain", "defi", "coinbase", "binance"],
  "real estate": ["real estate", "housing", "mortgage", "property", "rent", "reits", "homebuilder"],
  "commodities": ["oil", "gold", "silver", "commodity", "wheat", "natural gas", "copper", "lithium"],
  "technology": ["tech", "software", "ai", "chip", "semiconductor", "apple", "google", "microsoft", "nvidia", "meta", "amazon"],
  "economy": ["fed", "inflation", "gdp", "unemployment", "interest rate", "recession", "jobs", "cpi", "fomc", "powell"],
  "markets": ["stock", "market", "s&p", "nasdaq", "dow", "earnings", "ipo", "merger", "etf", "rally", "selloff"],
};

function getMatchingCategories(userInterests) {
  const categories = new Set();
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    if (INTEREST_TO_CATEGORIES[interestLower]) {
      INTEREST_TO_CATEGORIES[interestLower].forEach(c => categories.add(c));
    }
    for (const [key, cats] of Object.entries(INTEREST_TO_CATEGORIES)) {
      if (interestLower.includes(key) || key.includes(interestLower)) {
        cats.forEach(c => categories.add(c));
      }
    }
  }
  return Array.from(categories);
}

function getMatchingKeywords(userInterests) {
  const keywords = new Set();
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    keywords.add(interestLower);
    for (const [category, kws] of Object.entries(INTEREST_KEYWORDS)) {
      if (interestLower.includes(category) || category.includes(interestLower)) {
        kws.forEach(k => keywords.add(k));
      }
    }
  }
  return Array.from(keywords);
}

function getPersonalizationScore(story, userCategories, userKeywords, userHoldings) {
  let relevanceScore = 0;
  const storyText = `${story.title} ${story.what_happened}`.toLowerCase();
  const storyCategory = (story.category || "").toLowerCase();
  
  // Category match
  if (userCategories.includes(storyCategory)) relevanceScore += 50;
  
  // Keyword matches
  for (const keyword of userKeywords) {
    if (storyText.includes(keyword)) relevanceScore += 15;
  }
  
  // Holdings match (highest value)
  for (const holding of userHoldings) {
    const symbol = (typeof holding === "string" ? holding : holding?.symbol || "").toLowerCase();
    const name = (typeof holding === "string" ? "" : holding?.name || "").toLowerCase();
    if (symbol && storyText.includes(symbol)) relevanceScore += 100;
    if (name && name.length > 3 && storyText.includes(name)) relevanceScore += 80;
  }

  // BOOST COMPANY-SPECIFIC NEWS (opposite of breaking score)
  const COMPANY_SIGNALS = [
    "earnings", "quarterly", "q1", "q2", "q3", "q4",
    "guidance", "revenue", "profit",
    "ceo", "cfo", "management",
    "ipo", "merger", "acquisition",
    "layoffs", "restructuring",
    "dividend", "buyback"
  ];
  const hasCompanyNews = COMPANY_SIGNALS.some(kw => storyText.includes(kw));
  if (hasCompanyNews) {
    relevanceScore += 40;
  }

  return relevanceScore;
}

function detectRelevantHoldings(story, userHoldings) {
  const storyText = `${story.title} ${story.what_happened}`.toLowerCase();
  const relevantHoldings = [];

  for (const holding of userHoldings) {
    const symbol = (typeof holding === "string" ? holding : holding?.symbol || "").toLowerCase();
    const name = (typeof holding === "string" ? "" : holding?.name || "").toLowerCase();

    if (symbol && storyText.includes(symbol)) {
      relevantHoldings.push(typeof holding === "string" ? holding : holding.symbol);
    } else if (name && name.length > 3 && storyText.includes(name)) {
      relevantHoldings.push(typeof holding === "string" ? holding : holding.symbol || holding.name);
    }
  }

  return relevantHoldings.length > 0 ? relevantHoldings.join(", ") : "none";
}

function generateFallbackWhyItMatters(category) {
  const statements = {
    crypto: "Monitor for potential volatility in crypto holdings.",
    "real estate": "May affect REITs and housing-related investments.",
    commodities: "Could impact commodity ETFs and related positions.",
    technology: "Consider implications for tech sector holdings.",
    economy: "May influence broader market sentiment and Fed policy expectations.",
    markets: "Factor into overall portfolio strategy.",
  };
  return statements[category] || statements.markets;
}

// =========================================================
// FINANCIAL-RELEVANCE GATE (for Tier 1 rapid fire)
// Stories must contain at least one financial keyword to qualify.
// Kills: immigration rulings, election cases, protests, etc.
// =========================================================
const FINANCIAL_KEYWORDS = [
  "market", "stock", "index", "nasdaq", "dow", "s&p", "treasury", "bond",
  "rate", "inflation", "gdp", "earnings", "revenue", "trade", "tariff",
  "fed", "fomc", "dollar", "yield", "deficit", "debt", "fiscal",
  "oil", "gold", "bitcoin", "crypto", "commodity", "futures", "etf",
  "ipo", "merger", "acquisition", "layoffs", "recession", "growth",
  "jobs", "unemployment", "cpi", "payroll", "housing", "retail sales",
  "semiconductor", "chip", "ai spending", "data center", "capex",
  "investor", "hedge fund", "wall street", "sec", "regulation",
  "bank", "lending", "credit", "mortgage", "rally", "selloff", "correction",
];
function hasFinancialRelevance(story: any): boolean {
  const text = `${story.title || ""} ${story.what_happened || ""}`.toLowerCase();
  return FINANCIAL_KEYWORDS.some((kw) => text.includes(kw));
}

// =========================================================
// PORTFOLIO STORY SCORING (for Tier 2 — briefing read-time filter)
// Picks the best 7 from UserNewsCache before sending to LLM.
// =========================================================
const ROUNDUP_TITLE_PATTERNS_BRIEFING = [
  "the week in", "week in review", "breakingviews", "weekend round-up",
  "weekend roundup", "round-up:", "roundup:", "morning roundup",
  "and more:", "what you missed", "here's what",
];
const PREMIUM_SOURCES_BRIEFING = [
  "bloomberg", "reuters", "financial times", "ft.com", "wsj",
  "wall street journal", "cnbc", "ap news", "associated press", "barrons",
];

function portfolioStoryScore(story: any, userHoldings: string[]): number {
  const title = (story.title || "").toLowerCase();
  const summary = (story.what_happened || story.summary || "").toLowerCase();
  const text = `${title} ${summary}`;
  const outlet = (story.outlet || story.source || "").toLowerCase();

  // Kill: roundup articles
  if (ROUNDUP_TITLE_PATTERNS_BRIEFING.some((p) => title.includes(p))) return -999;

  // Kill: no real summary (headline-only fluff)
  if (summary.length < 40) return -500;

  let score = 0;

  // 1. TICKER/COMPANY RELEVANCE (0-100)
  // If Finlight tagged the article with matched_tickers, highest score
  if (story.matched_tickers && story.matched_tickers.length > 0) score += 100;
  for (const h of userHoldings) {
    const ticker = (typeof h === "string" ? h : h?.symbol || "").toLowerCase();
    if (ticker && text.includes(ticker)) score += 60;
  }

  // 2. SOURCE QUALITY (0-20)
  if (PREMIUM_SOURCES_BRIEFING.some((p) => outlet.includes(p))) score += 20;

  // 3. RECENCY (0-30)
  const ageHours = story.ageHours ?? 24;
  if (ageHours <= 4) score += 30;
  else if (ageHours <= 8) score += 25;
  else if (ageHours <= 12) score += 20;
  else if (ageHours <= 24) score += 10;

  // 4. SUMMARY SUBSTANCE (0-15)
  if (summary.length > 200) score += 15;
  else if (summary.length > 100) score += 10;
  else if (summary.length > 60) score += 5;

  return score;
}

async function invokeLLM(base44, prompt, addInternet, schema) {
  return await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: addInternet,
    response_json_schema: schema,
  });
}

async function generateAudioFile(script, date, elevenLabsApiKey) {
  const voiceId = "WZlYpi1yf6zJhNWXih74";

  const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": elevenLabsApiKey,
    },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.38,
          similarity_boost: 0.6,
          style: 0.1,
          use_speaker_boost: true,
        },
        speed: 1.1,
      }),
  });

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text();
    throw new Error(`ElevenLabs TTS failed: ${errorText}`);
  }

  const audioBlob = await ttsResponse.blob();
  return new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });
}

// Fetch quote with Finnhub primary, Finlight fallback
async function fetchQuoteWithFallback(symbol: string, finnhubKey: string, finlightKey: string) {
  // Try Finnhub first (free tier, 60/min)
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;
    const response = await fetch(url);
    
    if (response.status === 429) {
      console.warn(`⚠️ Finnhub rate limit (429) for ${symbol}, trying Finlight fallback...`);
      return await fetchFinlightQuote(symbol, finlightKey);
    }
    
    if (!response.ok) {
      console.error(`Finnhub error for ${symbol}: ${response.status}`);
      return await fetchFinlightQuote(symbol, finlightKey);
    }
    
    const data = await response.json();
    const changePct = data.dp ?? 0;
    
    if (data.c === undefined || data.c === null) {
      console.error(`No Finnhub price data for ${symbol}, trying Finlight...`);
      return await fetchFinlightQuote(symbol, finlightKey);
    }
    
    return {
      symbol,
      change_pct: `${changePct > 0 ? "+" : ""}${Number(changePct).toFixed(1)}%`,
      provider: 'finnhub'
    };
  } catch (err) {
    console.error(`Finnhub fetch failed for ${symbol}:`, err.message);
    return await fetchFinlightQuote(symbol, finlightKey);
  }
}

// Finlight fallback (premium, 100/min, 10k/month on Pro Light)
async function fetchFinlightQuote(symbol: string, apiKey: string) {
  if (!apiKey) {
    console.warn(`⚠️ No Finlight API key, skipping fallback for ${symbol}`);
    return { symbol, change_pct: "0.0%", provider: 'none' };
  }
  
  try {
    const response = await fetch(
      `https://finlight.me/api/stock/realtime/${symbol}`,
      {
        headers: {
          'X-API-KEY': apiKey
        }
      }
    );
    
    if (!response.ok) {
      console.error(`Finlight error for ${symbol}: ${response.status}`);
      return { symbol, change_pct: "0.0%", provider: 'none' };
    }
    
    const data = await response.json();
    
    // Map Finlight response (adjust based on actual response format)
    const changePercent = data.changePercent || data.dp || data.changePercentage || 0;
    
    console.log(`✅ Using Finlight fallback for ${symbol}`);
    return {
      symbol,
      change_pct: `${changePercent > 0 ? "+" : ""}${Number(changePercent).toFixed(1)}%`,
      provider: 'finlight'
    };
  } catch (err) {
    console.error(`Finlight fetch failed for ${symbol}:`, err.message);
    return { symbol, change_pct: "0.0%", provider: 'none' };
  }
}

// =========================================================
// PRE-BRIEFING PORTFOLIO REFRESH (Finlight API)
// Called at briefing time to ensure portfolio news is always fresh.
// =========================================================
const FINLIGHT_NEWS_API = "https://api.finlight.me";

const TICKER_TO_NAMES_BRIEFING: Record<string, string[]> = {
  AAPL: ["apple"],
  GOOGL: ["google", "alphabet", "youtube"],
  GOOG: ["google", "alphabet", "youtube"],
  META: ["meta", "facebook", "zuckerberg"],
  SHOP: ["shopify"],
  AMZN: ["amazon"],
  MSFT: ["microsoft"],
  NVDA: ["nvidia"],
  TSLA: ["tesla", "musk"],
  TSM: ["tsmc", "taiwan semiconductor"],
  JNJ: ["johnson & johnson", "j&j"],
  WBD: ["warner bros", "warner brothers", "discovery"],
  DIS: ["disney"],
  NFLX: ["netflix"],
  JPM: ["jpmorgan", "jp morgan"],
  BAC: ["bank of america"],
  GS: ["goldman sachs"],
  V: ["visa"],
  MA: ["mastercard"],
};

const TICKER_CATEGORY_KW: Record<string, string[]> = {
  markets: ["stock", "market", "trading", "wall street", "nasdaq", "dow", "s&p", "equity", "index"],
  crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "nft", "defi", "web3"],
  economy: ["fed", "interest rate", "inflation", "gdp", "unemployment", "economy", "recession"],
  technology: ["tech", "ai", "software", "chip", "semiconductor", "saas", "cloud"],
  "real estate": ["housing", "real estate", "mortgage", "property", "reits"],
  commodities: ["oil", "gold", "silver", "commodity", "energy", "natural gas"],
};

function categorizeByKw(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  for (const [cat, kws] of Object.entries(TICKER_CATEGORY_KW)) {
    if (kws.some(kw => text.includes(kw))) return cat;
  }
  return "markets";
}

function sentimentToNum(sentiment: string | undefined, confidence: number | undefined): number {
  const c = Math.max(0, Math.min(1, confidence || 0));
  if (sentiment === "positive") return c * 0.5;
  if (sentiment === "negative") return -c * 0.5;
  return 0;
}

function getCatMessage(category: string): string {
  const m: Record<string, string> = {
    markets: "Could impact portfolio performance and market sentiment.",
    crypto: "May signal shifts in digital asset valuations.",
    economy: "Affects broader market conditions and strategies.",
    technology: "Could influence tech sector valuations.",
    "real estate": "May impact real estate investments.",
    commodities: "Could affect commodity prices and hedging.",
  };
  return m[category] || "Worth monitoring for portfolio implications.";
}

function isSimilarTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const aW = new Set(norm(a).split(" ").filter(w => w.length > 3));
  const bW = new Set(norm(b).split(" ").filter(w => w.length > 3));
  if (aW.size < 3 || bW.size < 3) return false;
  let overlap = 0;
  for (const w of aW) { if (bW.has(w)) overlap++; }
  return overlap / Math.min(aW.size, bW.size) > 0.5;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/** Fetch fresh ticker news from Finlight for pre-briefing refresh. */
async function fetchFreshTickerNews(
  apiKey: string,
  tickers: string[],
  hoursAgo: number = 24,
  pageSize: number = 20,
): Promise<any[]> {
  const tickerQuery = tickers.map(t => `ticker:${t}`).join(" OR ");
  const fromDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = new Date().toISOString().slice(0, 10);

  console.log(`🔍 [Pre-briefing refresh] Finlight query: ${tickerQuery} (${hoursAgo}h, pageSize ${pageSize})`);

  const response = await fetch(`${FINLIGHT_NEWS_API}/v2/articles`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      query: tickerQuery,
      from: fromDate,
      to: toDate,
      language: "en",
      orderBy: "publishDate",
      order: "DESC",
      pageSize,
      includeEntities: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Finlight pre-briefing fetch failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const articles = data.articles || [];
  console.log(`✅ [Pre-briefing refresh] Finlight returned ${articles.length} articles`);
  return articles;
}

/** Transform raw Finlight article to app story format. */
function transformArticleForBriefing(article: any, userTickers: string[]): any {
  const title = (article.title || "Breaking News").trim();
  const summary = (article.summary || "").trim();
  const category = categorizeByKw(title, summary);

  const articleTickers: string[] = (article.companies || [])
    .map((c: any) => (c.ticker || "").toUpperCase())
    .filter(Boolean);
  const matchedTickers = articleTickers.filter((t: string) => userTickers.includes(t));

  let whyItMatters = "";
  if (matchedTickers.length > 0) {
    whyItMatters = `Directly relevant to your holding${matchedTickers.length > 1 ? "s" : ""}: ${matchedTickers.join(", ")}. `;
  }
  whyItMatters += getCatMessage(category);

  return {
    id: randomId(),
    title,
    what_happened: summary || title,
    why_it_matters: whyItMatters,
    href: article.link || "#",
    imageUrl: article.images && article.images.length > 0
      ? article.images[0]
      : categoryImageUrl(category),
    outlet: article.source || "Finlight",
    category,
    datetime: article.publishDate
      ? new Date(article.publishDate).toISOString()
      : new Date().toISOString(),
    provider: "finlight",
    matched_tickers: matchedTickers,
    topics: [],
    sentiment_score: sentimentToNum(article.sentiment, article.confidence),
  };
}

function storyRelevanceScore(story: any, userTickers: string[]): number {
  const text = `${story.title || ""} ${story.what_happened || ""}`.toLowerCase();
  if (story.matched_tickers && story.matched_tickers.length > 0) return 100;
  let score = 0;
  for (const ticker of userTickers) {
    if (text.includes(ticker.toLowerCase())) score += 50;
    const names = TICKER_TO_NAMES_BRIEFING[ticker] || [ticker.toLowerCase()];
    if (names.some(n => text.includes(n))) score += 40;
  }
  return score;
}

const ROUNDUP_PATTERNS_REFRESH = [
  "the week in", "week in review", "breakingviews", "weekend round-up",
  "weekend roundup", "round-up:", "roundup:", "morning roundup",
  "and more:", "what you missed", "here's what",
];

function roundupPenaltyRefresh(story: any): number {
  const title = (story.title || "").toLowerCase();
  return ROUNDUP_PATTERNS_REFRESH.some(p => title.includes(p)) ? 35 : 0;
}

/**
 * Fetch ticker news from NewsAPI (fallback when Marketaux returns 0)
 * Uses ticker symbol + optional company name from user holdings for wider search.
 */
async function fetchNewsApiTickerNewsForBriefing(
  apiKey: string,
  ticker: string,
  hoursAgo: number,
  companyName?: string
): Promise<any[]> {
  const NEWSAPI_API_BASE = "https://newsapi.org/v2/everything";
  const from = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  // Build query: always include ticker, add company name if available from holdings
  const query = companyName
    ? `("${ticker}" OR "${companyName}")`
    : `"${ticker}"`;

  const url = new URL(NEWSAPI_API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("from", from);
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NewsAPI failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rows = Array.isArray(data?.articles) ? data.articles : [];
  return rows.map((row: any) => ({
    title: (row?.title || "Breaking News").trim(),
    summary: (row?.description || row?.content || "").trim(),
    link: row?.url || "#",
    source: row?.source?.name || "NewsAPI",
    publishDate: row?.publishedAt || new Date().toISOString(),
    companies: [{ ticker }],
  }));
}

/**
 * Fetch ticker news from Marketaux API (fallback source)
 */
async function fetchMarketauxTickerNewsForBriefing(
  apiKey: string,
  ticker: string,
  hoursAgo: number
): Promise<any[]> {
  const MARKETAUX_API_BASE = "https://api.marketaux.com/v1/news/all";
  // Marketaux requires format: Y-m-d\TH:i:s (no milliseconds, no timezone)
  const publishedAfter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "");
  const url = new URL(MARKETAUX_API_BASE);
  url.searchParams.set("symbols", ticker);
  url.searchParams.set("language", "en");
  url.searchParams.set("filter_entities", "true");
  url.searchParams.set("limit", "8");
  url.searchParams.set("published_after", publishedAfter);
  url.searchParams.set("api_token", apiKey);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Marketaux failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rows = Array.isArray(data?.data) ? data.data : [];
  
  return rows.map((row: any) => {
    const entities = Array.isArray(row?.entities) ? row.entities : [];
    const matchedTickers = entities
      .map((e: any) => (e?.symbol || e?.ticker || "").toUpperCase().trim())
      .filter(Boolean);
    if (!matchedTickers.includes(ticker)) matchedTickers.push(ticker);

    return {
      id: simpleHash(`${row?.url || ""}${row?.title || ""}`),
      title: row?.title || "Breaking News",
      what_happened: row?.description || row?.snippet || "",
      summary: row?.description || row?.snippet || "",
      href: row?.url || "#",
      imageUrl: row?.image_url || "",
      outlet: row?.source || row?.source_name || row?.domain || "Marketaux",
      datetime: row?.published_at || row?.publishedAt || new Date().toISOString(),
      category: "markets",
      sentiment: row?.sentiment || "neutral",
      matched_tickers: matchedTickers,
      _provider: "marketaux",
    };
  });
}

/**
 * Pre-briefing portfolio refresh: Always fetch fresh ticker news from Finlight
 * before generating a briefing, so the content is never stale.
 * If Finlight doesn't have coverage for a ticker, try Marketaux.
 * Updates UserNewsCache for the app as well.
 */
async function refreshPortfolioNewsForBriefing(
  base44: any,
  userEmail: string,
  userHoldings: any[],
): Promise<any[]> {
  const tickers = userHoldings
    .map((h: any) => (typeof h === "string" ? h : h?.symbol || h?.ticker || "").toUpperCase().trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    console.log("⚠️ [Pre-briefing refresh] No tickers in holdings, skipping Finlight fetch");
    return [];
  }

  const finlightKey = Deno.env.get("FINLIGHT_API_KEY");
  if (!finlightKey) {
    console.log("⚠️ [Pre-briefing refresh] No FINLIGHT_API_KEY, falling back to cache");
    return [];
  }

  const day = new Date().getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const hoursAgo = isWeekend ? 48 : 24;

  try {
    const rawArticles = await fetchFreshTickerNews(finlightKey, tickers, hoursAgo, 20);

    if (rawArticles.length === 0) {
      console.log("⚠️ [Pre-briefing refresh] Finlight returned 0 articles, will use cache");
      return [];
    }

    // Transform and dedupe
    const transformed = rawArticles
      .map((a: any) => transformArticleForBriefing(a, tickers))
      .filter((s: any) => {
        const text = `${s.title || ""} ${s.what_happened || ""}`.toLowerCase().slice(0, 600);
        // Filter obvious junk
        if (/thank\s+you\s+for\s+(your\s+)?subscription/i.test(text)) return false;
        if (/blogspot|wordpress\.com|tumblr\.com/i.test(s.href || "")) return false;
        return true;
      });

    const deduped: any[] = [];
    for (const story of transformed) {
      if (!deduped.some(existing => isSimilarTitle(existing.title, story.title))) {
        deduped.push(story);
      }
    }

    // Check which tickers got coverage from Finlight
    const tickerCoverage = new Map<string, number>();
    tickers.forEach(t => tickerCoverage.set(t, 0));
    
    for (const story of deduped) {
      const matchedTickers = story?.matched_tickers || [];
      matchedTickers.forEach((mt: string) => {
        const current = tickerCoverage.get(mt) || 0;
        tickerCoverage.set(mt, current + 1);
      });
    }

    // Log ticker coverage for debugging
    console.log(`📊 [Ticker Coverage Check] Results:`);
    tickers.forEach(t => {
      const count = tickerCoverage.get(t) || 0;
      console.log(`   ${t}: ${count} article${count !== 1 ? 's' : ''}`);
    });

    // Identify tickers with insufficient coverage (< 2 articles)
    const uncoveredTickers = tickers.filter(t => (tickerCoverage.get(t) || 0) < 2);
    
    if (uncoveredTickers.length > 0) {
      console.log(`📉 [Pre-briefing refresh] ${uncoveredTickers.length} tickers with insufficient Finlight coverage: ${uncoveredTickers.join(", ")}`);
      
      const marketauxKey = Deno.env.get("MARKETAUX_API_KEY") || Deno.env.get("MARKETAUX_KEY") || "";
      if (marketauxKey) {
        console.log(`🔄 [Marketaux Fallback] Trying Marketaux for: ${uncoveredTickers.join(", ")}`);
        
        for (const ticker of uncoveredTickers) {
          try {
            const marketauxArticles = await fetchMarketauxTickerNewsForBriefing(marketauxKey, ticker, hoursAgo);
            
            if (marketauxArticles.length > 0) {
              console.log(`✅ [Marketaux Fallback] Found ${marketauxArticles.length} articles for ${ticker}`);
              
              // Transform and add to deduped (avoiding duplicates)
              for (const article of marketauxArticles) {
                const transformed = transformArticleForBriefing(article, tickers);
                if (!deduped.some(existing => isSimilarTitle(existing.title, transformed.title))) {
                  deduped.push(transformed);
                }
              }
            } else {
              console.log(`⚠️ [Marketaux Fallback] No articles found for ${ticker}`);
              // Try NewsAPI when Marketaux returns 0
              const newsApiKey = Deno.env.get("NEWSAPI_API_KEY") || Deno.env.get("NEWSAPI_KEY") || "";
              if (newsApiKey) {
                try {
                  // Look up company name from userHoldings for better NewsAPI search
                  const holdingObj = userHoldings.find((h: any) => {
                    const sym = (typeof h === "string" ? h : h?.symbol || h?.ticker || "").toUpperCase().trim();
                    return sym === ticker;
                  });
                  const holdingName = typeof holdingObj === "object" ? (holdingObj?.name || "") : "";
                  console.log(`🔄 [NewsAPI Fallback] Trying NewsAPI for: ${ticker}${holdingName ? ` ("${holdingName}")` : ""}`);
                  const newsApiArticles = await fetchNewsApiTickerNewsForBriefing(newsApiKey, ticker, hoursAgo, holdingName || undefined);
                  if (newsApiArticles.length > 0) {
                    console.log(`✅ [NewsAPI Fallback] Found ${newsApiArticles.length} articles for ${ticker}`);
                    for (const article of newsApiArticles) {
                      const transformed = transformArticleForBriefing(article, tickers);
                      if (!deduped.some(existing => isSimilarTitle(existing.title, transformed.title))) {
                        deduped.push(transformed);
                      }
                    }
                  } else {
                    console.log(`⚠️ [NewsAPI Fallback] No articles found for ${ticker}`);
                  }
                } catch (newsApiErr: any) {
                  console.warn(`⚠️ [NewsAPI Fallback] Failed for ${ticker}: ${newsApiErr.message}`);
                }
              } else {
                console.log(`⚠️ [NewsAPI Fallback] No NEWSAPI_API_KEY available`);
              }
            }
          } catch (marketauxErr: any) {
            console.warn(`⚠️ [Marketaux Fallback] Failed for ${ticker}: ${marketauxErr.message}`);
          }
        }
      } else {
        console.log(`⚠️ [Marketaux Fallback] No MARKETAUX_API_KEY available`);
      }
    }

    // Sort: relevance first, then source quality, then newest
    deduped.sort((a: any, b: any) => {
      const relA = storyRelevanceScore(a, tickers) - roundupPenaltyRefresh(a);
      const relB = storyRelevanceScore(b, tickers) - roundupPenaltyRefresh(b);
      if (relB !== relA) return relB - relA;
      const srcA = PREMIUM_SOURCES_BRIEFING.some(p => (a.outlet || "").toLowerCase().includes(p)) ? 10 : 0;
      const srcB = PREMIUM_SOURCES_BRIEFING.some(p => (b.outlet || "").toLowerCase().includes(p)) ? 10 : 0;
      if (srcB !== srcA) return srcB - srcA;
      return new Date(b.datetime || 0).getTime() - new Date(a.datetime || 0).getTime();
    });

    console.log(`✅ [Pre-briefing refresh] ${deduped.length} fresh portfolio stories ready`);
    deduped.slice(0, 5).forEach((s, i) => {
      const ageH = ((Date.now() - new Date(s.datetime || 0).getTime()) / (1000 * 60 * 60)).toFixed(1);
      console.log(`   ${i + 1}. [${ageH}h] [${s.outlet}] ${(s.title || "").slice(0, 60)}...`);
    });

    // Write to UserNewsCache so the app also shows fresh stories
    try {
      const tickersKey = tickers.slice().sort().join(",");
      const tickersHash = simpleHash(tickersKey);
      const oldEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
        user_email: userEmail,
      });
      for (const entry of oldEntries) {
        await base44.asServiceRole.entities.UserNewsCache.delete(entry.id);
      }
      await base44.asServiceRole.entities.UserNewsCache.create({
        user_email: userEmail,
        tickers_hash: tickersHash,
        tickers_list: tickers.join(","),
        stories: JSON.stringify(deduped),
        fetched_at: new Date().toISOString(),
      });
      console.log(`💾 [Pre-briefing refresh] Updated UserNewsCache with ${deduped.length} fresh stories`);
    } catch (cacheErr: any) {
      console.warn(`⚠️ [Pre-briefing refresh] UserNewsCache write failed: ${cacheErr.message}`);
    }

    return deduped;
  } catch (fetchErr: any) {
    console.error(`❌ [Pre-briefing refresh] Finlight fetch failed: ${fetchErr.message}`);
    return []; // Caller will fall back to existing cache
  }
}

// Fallback Finnhub key (same as frontend ticker) when Base44 env vars are missing
const FINNHUB_FALLBACK_KEY = "d5n7s19r01qh5ppc5ln0d5n7s19r01qh5ppc5lng";

async function fetchMarketSnapshot() {
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY;
  const finlightKey = Deno.env.get("FINLIGHT_API_KEY");
  
  const symbols = ["SPY", "QQQ", "DIA"];
  
  try {
    const results = await Promise.all(
      symbols.map(symbol => fetchQuoteWithFallback(symbol, finnhubKey, finlightKey || ''))
    );
    
    const snapshot = {
      sp500_pct: results[0].change_pct,
      nasdaq_pct: results[1].change_pct,
      dow_pct: results[2].change_pct,
      sector_hint: "", // filled below
    };

    // Derive sector-leader hint from relative index moves (zero extra API calls)
    const parsePct = (s: string) => parseFloat(s.replace(/[^-0-9.]/g, "")) || 0;
    const sp = parsePct(snapshot.sp500_pct);
    const nq = parsePct(snapshot.nasdaq_pct);
    const dw = parsePct(snapshot.dow_pct);
    if (Math.abs(nq) > Math.abs(sp) + 0.3 && Math.abs(nq) > Math.abs(dw) + 0.3) {
      snapshot.sector_hint = nq > 0 ? "Tech and growth names led the move." : "Tech and growth names led the decline.";
    } else if (Math.abs(dw) > Math.abs(nq) + 0.3 && Math.abs(dw) > Math.abs(sp) + 0.3) {
      snapshot.sector_hint = dw > 0 ? "Industrials and blue-chips led the rally." : "Industrials and blue-chips led the selling.";
    } else if (sp > 0 && nq > 0 && dw > 0) {
      snapshot.sector_hint = "Broad-based rally across sectors.";
    } else if (sp < 0 && nq < 0 && dw < 0) {
      snapshot.sector_hint = "Selling was broad-based across sectors.";
    } else {
      snapshot.sector_hint = "Mixed signals across sectors.";
    }

    console.log("📈 [fetchMarketSnapshot] Result:", snapshot);
    return snapshot;
  } catch (error) {
    console.error("⚠️ Market snapshot failed:", error?.message);
    return { sp500_pct: "0.0%", nasdaq_pct: "0.0%", dow_pct: "0.0%", sector_hint: "" };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};
    const rawTz = safeText(body?.timeZone || body?.time_zone || body?.timezone, "UTC");
    const timeZone = isValidTimeZone(rawTz) ? rawTz : "UTC";

    const date = localISODate(timeZone, body?.date);
    const audioOnly = Boolean(body?.audio_only);
    const skipAudio = Boolean(body?.skip_audio);

    const userEmail = safeText(user?.email);
    if (!userEmail) return Response.json({ error: "User email missing" }, { status: 400 });

    // Hardcoded temporarily while Base44 env vars are broken
    const elevenLabsApiKey = "sk_d95bc50d1ee151866aebf48be5f5d48a8c7c15809e913066";

    // =========================================================
    // AUDIO-ONLY MODE: convert existing script -> audio_url
    // =========================================================
    if (audioOnly) {
      const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
        date,
        created_by: userEmail,
      });

      if (!Array.isArray(existing) || existing.length === 0) {
        return Response.json(
          { error: "No DailyBriefing found for this date. Generate script first." },
          { status: 404 }
        );
      }

    const briefing = [...existing].sort((a, b) => {
      const da = a.delivered_at || a.updated_at || a.created_at;
      const db = b.delivered_at || b.updated_at || b.created_at;
      return new Date(db) - new Date(da);
    })[0];

      const script = safeText(briefing?.script);
      if (!script) {
        return Response.json(
          { error: "DailyBriefing has no script. Generate script first." },
          { status: 400 }
        );
      }

      await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        status: "generating_audio",
      });

      const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);

      const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
        file: audioFile,
      });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri,
        expires_in: 60 * 60 * 24 * 7,
      });

      const deliveredAt = new Date().toISOString();

      const updated = await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        audio_url: signed_url,
        status: "ready",
        delivered_at: deliveredAt,
        time_zone: timeZone,
      });

      return Response.json({ success: true, briefing: updated });
    }

    // =========================================================
    // FULL MODE: generate news-first briefing
    // =========================================================

    const name =
      safeText(preferences?.user_name) ||
      safeText(user?.name) ||
      safeText(user?.full_name) ||
      "there";

    // UPDATED: Map preferences properly including investment_interests
    const prefProfile = {
      risk_tolerance: preferences?.risk_tolerance ?? preferences?.riskLevel ?? null,
      time_horizon: preferences?.time_horizon ?? preferences?.horizon ?? null,
      goals: preferences?.goals ?? preferences?.investment_goals ?? null,
      sectors: preferences?.sectors ?? null,
      regions: preferences?.regions ?? null,
      watchlist: preferences?.watchlist ?? preferences?.tickers ?? null,
      holdings: preferences?.holdings ?? preferences?.portfolio_holdings ?? null,
      interests: preferences?.interests ?? preferences?.investment_interests ?? null,
      constraints: preferences?.constraints ?? null,
    };

    // =========================================================
    // STEP 1: READ FROM NEWSCACHE (0 extra API calls)
    // =========================================================
    console.log("📰 [generateBriefing] Reading from NewsCache...");

    let cachedStories = [];
    try {
      const cacheEntries = await base44.entities.NewsCache.filter({});
      
      if (cacheEntries && cacheEntries.length > 0) {
        const latestCache = cacheEntries.sort((a, b) => 
          new Date(b.refreshed_at) - new Date(a.refreshed_at)
        )[0];
        
        cachedStories = JSON.parse(latestCache.stories || "[]");
        console.log(`✅ [generateBriefing] Found ${cachedStories.length} cached stories (refreshed: ${latestCache.refreshed_at})`);
      } else {
        return Response.json({
          error: "News cache is empty. Please wait a few minutes for the cache to refresh.",
          success: false
        }, { status: 503 });
      }
    } catch (cacheError) {
      console.error("❌ [generateBriefing] Cache read error:", cacheError);
      return Response.json({
        error: "Failed to read news cache: " + cacheError.message,
        success: false
      }, { status: 500 });
    }

    // =========================================================
    // STEP 1A.5: Build "already covered today" set for freshness
    // =========================================================
    const seenStoryKeys = new Set<string>();
    try {
      const todaysBriefings = await base44.asServiceRole.entities.DailyBriefing.filter({
        date,
        created_by: userEmail,
      });
      for (const briefing of todaysBriefings || []) {
        const stories = Array.isArray(briefing?.news_stories)
          ? briefing.news_stories
          : (typeof briefing?.news_stories === "string"
              ? JSON.parse(briefing.news_stories || "[]")
              : []);
        for (const s of stories || []) {
          const key = normalizeStoryKey(s);
          if (key) seenStoryKeys.add(key);
        }
      }
      console.log(`🧠 [Freshness] Found ${seenStoryKeys.size} story keys already covered today`);
    } catch (e: any) {
      console.warn(`⚠️ [Freshness] Could not read prior briefings: ${e.message}`);
    }

    // =========================================================
    // STEP 1B: Score stories for "breaking-ness"
    // =========================================================
    const nowTimestamp = Date.now();
    // Weekends / low-volume: relax age filter to 48h so we always have stories
    const currentDayOfWeek = new Date().getUTCDay(); // 0=Sun, 6=Sat
    const isWeekendDay = currentDayOfWeek === 0 || currentDayOfWeek === 6;
    const maxAgeHours = isWeekendDay ? 48 : 24;

    const scoredStories = cachedStories
      .map(story => {
        const { score, ageHours } = getBreakingScore(story, nowTimestamp);
        const storyKey = normalizeStoryKey(story);
        const seenToday = storyKey ? seenStoryKeys.has(storyKey) : false;
        return { ...story, breakingScore: score, ageHours, _storyKey: storyKey, _seenToday: seenToday };
      })
      .filter(s => s.ageHours <= maxAgeHours);

    console.log(`📅 Age filter: ${maxAgeHours}h (${isWeekendDay ? "weekend" : "weekday"}) → ${scoredStories.length} stories pass`);
    console.log("🔥 [generateBriefing] Top breaking scores:");
    scoredStories
      .sort((a, b) => b.breakingScore - a.breakingScore)
      .slice(0, 5)
      .forEach((s, i) => {
        console.log(`   ${i + 1}. [score: ${s.breakingScore}] [age: ${s.ageHours.toFixed(1)}h] ${(s.title || "").slice(0, 55)}...`);
      });

    // =========================================================
    // STEP 1C: TIER 1 - Select RAPID FIRE candidates (top 6-8)
    // Financial-relevance gate applied. LLM will pick the best 3.
    // Mimics Bloomberg: algorithms narrow the pool, editors make the final call.
    //
    // PORTFOLIO OVERLAP FILTER: Rapid fire = macro/market news.
    // Stories about the user's portfolio companies are excluded UNLESS
    // they have a very high breaking score (genuinely headline-level,
    // e.g. CEO arrested, fraud, massive acquisition — not just earnings/price moves).
    // =========================================================
    const RAPID_FIRE_CANDIDATE_COUNT = 8;
    const BREAKING_NEWS_OVERRIDE_THRESHOLD = 200; // Only truly exceptional stories override the portfolio filter

    // Extract user tickers early for portfolio overlap filtering
    const earlyHoldings = prefProfile?.holdings || [];
    const earlyTickers = earlyHoldings
      .map((h: any) => (typeof h === "string" ? h : h?.symbol || h?.ticker || "").toUpperCase().trim())
      .filter(Boolean);
    const earlyTickerNames: string[] = [];
    for (const t of earlyTickers) {
      earlyTickerNames.push(t.toLowerCase());
      const names = TICKER_TO_NAMES_BRIEFING[t] || [];
      for (const n of names) earlyTickerNames.push(n);
    }

    /** Returns true if the story is about one of the user's portfolio companies. */
    function isAboutPortfolioCompany(story: any): boolean {
      if (earlyTickers.length === 0) return false;
      const text = `${story.title || ""} ${story.what_happened || ""}`.toLowerCase();
      return earlyTickerNames.some(name => text.includes(name));
    }

    const rapidFireCandidates = [...scoredStories]
      .sort((a, b) => {
        if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1; // prioritize unseen
        return b.breakingScore - a.breakingScore;
      })
      .filter((s) => hasFinancialRelevance(s))
      .filter((s) => {
        // Exclude portfolio company stories UNLESS they're truly headline-breaking
        if (isAboutPortfolioCompany(s)) {
          if (s.breakingScore >= BREAKING_NEWS_OVERRIDE_THRESHOLD) {
            console.log(`   🔥 Portfolio company in rapid fire (override — score ${s.breakingScore}): "${(s.title || "").slice(0, 50)}"`);
            return true; // Genuinely major breaking news about a holding
          }
          console.log(`   ⛔ Filtered from rapid fire (portfolio overlap): "${(s.title || "").slice(0, 50)}"`);
          return false;
        }
        return true;
      })
      .slice(0, RAPID_FIRE_CANDIDATE_COUNT);

    // If financial gate + portfolio filter was too aggressive, backfill with top-scored non-portfolio stories
    let rapidFireCandidatesFinal = [...rapidFireCandidates];
    if (rapidFireCandidatesFinal.length < 6) {
      const existingIds = new Set(rapidFireCandidatesFinal.map((s: any) => s.id));
      const backfill = [...scoredStories]
        .sort((a, b) => {
          if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1;
          return b.breakingScore - a.breakingScore;
        })
        .filter((s: any) => !existingIds.has(s.id))
        .filter((s: any) => !isAboutPortfolioCompany(s)) // Don't backfill with portfolio stories either
        .slice(0, Math.min(6 - rapidFireCandidatesFinal.length, 3));
      rapidFireCandidatesFinal = [...rapidFireCandidatesFinal, ...backfill];
    }

    // For UI cards and dedup logic, use top 3 from candidates
    let rapidFireStories = rapidFireCandidatesFinal.slice(0, 3);

    console.log(`\n⚡ [generateBriefing] TIER 1 - RAPID FIRE (${rapidFireCandidatesFinal.length} candidates for LLM to editorialize → pick best 3):`);
    rapidFireCandidatesFinal.forEach((s, i) => {
      console.log(`   ${i + 1}. [score:${s.breakingScore}] [age:${s.ageHours.toFixed(1)}h] [${s.category}] ${(s.title || "").slice(0, 50)}...`);
    });

    // =========================================================
    // STEP 1D: TIER 2 - Select PERSONALIZED stories
    // ALWAYS fetch fresh ticker news from Finlight before generating.
    // The briefing is the premium product — it must have the latest data.
    // Falls back to UserNewsCache only if Finlight fetch fails.
    // =========================================================
    const userInterests = prefProfile?.interests || [];
    const userHoldings = prefProfile?.holdings || [];
    const userCategories = getMatchingCategories(userInterests);
    const userKeywords = getMatchingKeywords(userInterests);

    console.log(`\n📊 [generateBriefing] User interests: ${userInterests.join(", ") || "none"}`);
    console.log(`📊 [generateBriefing] Matching categories: ${userCategories.join(", ") || "all"}`);

    const briefingTickers = userHoldings
      .map((h: any) => (typeof h === "string" ? h : h?.symbol || h?.ticker || "").toUpperCase().trim())
      .filter(Boolean);

    // --- ALWAYS fetch fresh portfolio news from Finlight ---
    console.log(`\n🔄 [Pre-briefing refresh] Fetching fresh ticker news for: ${briefingTickers.join(", ") || "none"}`);
    let tickerCacheStories: any[] = await refreshPortfolioNewsForBriefing(
      base44,
      userEmail,
      userHoldings,
    );

    // --- Fallback to existing UserNewsCache if Finlight returned nothing ---
    if (tickerCacheStories.length === 0 && briefingTickers.length > 0) {
      console.log("📂 [Pre-briefing refresh] Finlight returned 0, falling back to UserNewsCache...");
      try {
        const userCacheEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
          user_email: userEmail,
        });
        if (userCacheEntries && userCacheEntries.length > 0) {
          const latest = userCacheEntries.sort((a: any, b: any) =>
            new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
          )[0];
          const cacheAgeHours = (Date.now() - new Date(latest.fetched_at).getTime()) / (1000 * 60 * 60);
          tickerCacheStories = typeof latest.stories === "string"
            ? JSON.parse(latest.stories)
            : (latest.stories || []);
          console.log(`✅ [Tier 2 fallback] Using cached ${tickerCacheStories.length} stories (${cacheAgeHours.toFixed(1)}h old)`);
        }
      } catch (e: any) {
        console.log(`⚠️ [Tier 2 fallback] UserNewsCache read failed: ${e.message}`);
      }
    }

    // --- Select personalized stories: Score and pick TOP 7 for LLM. ---
    const PORTFOLIO_BATCH_MAX = 7;
    const PORTFOLIO_BATCH_MAX_FALLBACK = 5;
    let personalizedStories: any[];
    let portfolioNewsBatch: any[];

    const briefingHoldings = briefingTickers; // string[] of ticker symbols

    if (tickerCacheStories.length >= 3) {
      console.log(`🎯 [Tier 2] Scoring ${tickerCacheStories.length} ticker-specific stories → picking top ${PORTFOLIO_BATCH_MAX}`);

      // 1. Remove stories already used in rapid fire
      const dedupedTickerStories = tickerCacheStories.filter((ts: any) => {
        return !rapidFireStories.some((rf: any) => {
          const tsTitle = (ts.title || "").toLowerCase();
          const rfTitle = (rf.title || "").toLowerCase();
          const tsWords = new Set(tsTitle.split(/\s+/).filter((w: string) => w.length > 3));
          const rfWords = new Set(rfTitle.split(/\s+/).filter((w: string) => w.length > 3));
          if (tsWords.size < 3 || rfWords.size < 3) return false;
          let overlap = 0;
          for (const w of tsWords) { if (rfWords.has(w)) overlap++; }
          return overlap / Math.min(tsWords.size, rfWords.size) > 0.5;
        });
      });

      // 2. Score each story and add ageHours
      const scoredPortfolio = dedupedTickerStories.map((story: any) => {
        const { ageHours } = getBreakingScore(story, nowTimestamp);
        const pScore = portfolioStoryScore({ ...story, ageHours }, briefingHoldings);
        const storyKey = normalizeStoryKey(story);
        const seenToday = storyKey ? seenStoryKeys.has(storyKey) : false;
        return { ...story, ageHours, _portfolioScore: pScore, _storyKey: storyKey, _seenToday: seenToday };
      });

      // 3. Sort by score desc, filter out killed stories (score < 0), take top 7
      const topPortfolio = scoredPortfolio
        .filter((s: any) => s._portfolioScore > 0)
        .sort((a: any, b: any) => {
          if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1; // prioritize unseen
          return b._portfolioScore - a._portfolioScore;
        })
        .slice(0, PORTFOLIO_BATCH_MAX);

      portfolioNewsBatch = topPortfolio;
      personalizedStories = portfolioNewsBatch.slice(0, 3); // UI cards

      console.log(`   📊 Top portfolio stories:`);
      topPortfolio.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. [pScore:${s._portfolioScore}] [age:${(s.ageHours || 0).toFixed(1)}h] ${(s.title || "").slice(0, 55)}...`);
      });
    } else {
      // FALLBACK: shared NewsCache — financial relevance gated
      console.log(`📂 [Tier 2] Falling back to shared NewsCache (${tickerCacheStories.length} ticker stories < 3 minimum)`);

      const rapidFireIds = new Set(rapidFireStories.map((s: any) => s.id));
      const personalizedCandidates = scoredStories
        .filter((story: any) => !rapidFireIds.has(story.id))
        .filter((story: any) => hasFinancialRelevance(story))
        .sort((a: any, b: any) => {
          if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1;
          return b.breakingScore - a.breakingScore;
        });

      portfolioNewsBatch = personalizedCandidates.slice(0, PORTFOLIO_BATCH_MAX_FALLBACK);
      personalizedStories = portfolioNewsBatch.slice(0, 3);
    }

    console.log(`\n📊 [generateBriefing] TIER 2 - Portfolio batch: ${portfolioNewsBatch.length} stories for LLM (UI cards: first 3)`);

    // =========================================================
    // STEP 1E: Combine into final 6 stories for briefing
    // =========================================================
    let allBriefingStories = [...rapidFireStories, ...personalizedStories];

    // Guarantee enough section cards/context (up to 6) for player/story flow.
    if (allBriefingStories.length < 6) {
      const existingIds = new Set(allBriefingStories.map((s: any) => s.id));
      const fill = [...scoredStories]
        .sort((a, b) => {
          if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1;
          return b.breakingScore - a.breakingScore;
        })
        .filter((s: any) => hasFinancialRelevance(s))
        .filter((s: any) => !existingIds.has(s.id))
        .slice(0, 6 - allBriefingStories.length);
      allBriefingStories = [...allBriefingStories, ...fill];
    }
    
    console.log(`\n✅ [generateBriefing] Selected ${allBriefingStories.length} total stories (3 rapid-fire + 3 personalized)`);

    // Format stories for UI compatibility
    const allowedCats = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);
    
    const truncateTitle = (text, maxLen) => {
      const clean = safeText(text, "");
      if (clean.length <= maxLen) return clean;
      return clean.substring(0, maxLen - 3) + "...";
    };

    // Build ID sets for determining story type
    const rapidFireIds = new Set(rapidFireCandidatesFinal.map((s: any) => s.id));
    
    const allStories = allBriefingStories.map((story, index) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";
      // Determine if this is a rapid fire story by checking if its ID exists in the rapid fire candidates
      const isRapidFire = rapidFireIds.has(story?.id);

      return {
        id: safeText(story?.id, randomId()),
        href: safeText(story?.href, "#"),
        imageUrl: story?.imageUrl || categoryImageUrl(category),
        title: truncateTitle(story?.title, 80),
        what_happened: safeText(story?.what_happened, ""),
        why_it_matters: safeText(story?.why_it_matters, generateFallbackWhyItMatters(category)),
        both_sides: {
          side_a: safeText(story?.why_it_matters, ""),
          side_b: "",
        },
        outlet: safeText(story?.outlet, "Unknown"),
        category,
        datetime: story?.datetime,
        ageHours: story?.ageHours,
        isRapidFire,
        breakingScore: story?.breakingScore,
        relevanceScore: story?.relevanceScore || 0,
      };
    });

    // =========================================================
    // STEP 2: Get Market Snapshot via Finnhub (0 credits)
    // =========================================================
    console.log("📈 [generateBriefing] Fetching market snapshot from Finnhub...");
    const rawMarketSnapshot = await fetchMarketSnapshot();
    
    // Transform "0.0%" / "-0.0%" → "flat" so the LLM and TTS don't say "zero percent"
    function humanizePct(pct: string): string {
      const num = parseFloat(pct.replace(/[^-0-9.]/g, "")) || 0;
      if (Math.abs(num) < 0.05) return "flat";
      return pct;
    }
    const marketSnapshot = {
      ...rawMarketSnapshot,
      sp500_pct: humanizePct(rawMarketSnapshot.sp500_pct),
      nasdaq_pct: humanizePct(rawMarketSnapshot.nasdaq_pct),
      dow_pct: humanizePct(rawMarketSnapshot.dow_pct),
    };
    console.log("✅ [generateBriefing] Market snapshot:", marketSnapshot);

    // =========================================================
    // STEP 3: Generate Combined Metadata + Script (1 credit)
    // =========================================================
    const rapidFireForPrompt = allStories.filter(s => s.isRapidFire);
    const personalizedForPrompt = allStories.filter(s => !s.isRapidFire);

    const now = new Date();
    const { hour, dayOfWeek, month, day } = getZonedParts(timeZone, now);

    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    if (hour >= 17) timeGreeting = "Good evening";

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;
    const isFriday = dayOfWeek === 5;

    let holidayGreeting = null;
    if (month === 1 && day === 1) holidayGreeting = "Happy New Year";
    if (month === 7 && day === 4) holidayGreeting = "Happy Fourth of July";
    if (month === 12 && day === 25) holidayGreeting = "Merry Christmas";
    if (month === 12 && day === 31) holidayGreeting = "Happy New Year's Eve";
    if (month === 11 && day >= 22 && day <= 28 && dayOfWeek === 4) holidayGreeting = "Happy Thanksgiving";
    if (month === 5 && dayOfWeek === 1 && day >= 25) holidayGreeting = "Happy Memorial Day";
    if (month === 9 && dayOfWeek === 1 && day <= 7) holidayGreeting = "Happy Labor Day";

    const userInterestsStr = userInterests.length > 0 ? userInterests.join(", ") : "general markets";
    const userHoldingsStr = userHoldings.length > 0
      ? userHoldings.map(h => (typeof h === "string" ? h : h?.symbol)).filter(Boolean).join(", ")
      : "not specified";

    // Format date naturally for the script
    const dateObj = new Date(date);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const naturalDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

    const breakingNewsRelevance = rapidFireForPrompt.map(story => ({
      ...story,
      relevantToUserHoldings: detectRelevantHoldings(story, userHoldings),
    }));

    // Pass ALL rapid fire candidates to LLM for editorial selection
    const rapidFireCandidatesForPrompt = rapidFireCandidatesFinal.map((story: any, index: number) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";
      return {
        id: safeText(story?.id, randomId()),
        title: safeText(story?.title, "Breaking News"),
        what_happened: safeText(story?.what_happened, ""),
        outlet: safeText(story?.outlet, "Unknown"),
        category,
        datetime: story?.datetime,
        ageHours: story?.ageHours,
        breakingScore: story?.breakingScore,
        relevantToUserHoldings: detectRelevantHoldings(story, userHoldings),
      };
    });

    console.log("✍️ [generateBriefing] Generating metadata + script in one call...");

    const combinedPrompt = `
You are the host of "Pulse" — a personalized financial audio briefing that finance professionals look forward to every day. Think: the sharpness of Bloomberg, the accessibility of Snacks Daily, the brevity of Axios. You sound like a smart friend who works in finance — not a news anchor, not a robot.

═══════════════════════════════════════
LISTENER PROFILE
═══════════════════════════════════════
- Name: ${name}
- Date: ${naturalDate}
- Time: ${timeGreeting}
${holidayGreeting ? `- Holiday: ${holidayGreeting}` : ""}
${isWeekend ? "- Context: Weekend — markets closed" : ""}
${isMonday ? "- Context: Monday — start of trading week" : ""}
${isFriday ? "- Context: Friday — end of trading week" : ""}
- Holdings: ${userHoldingsStr}
- Interests: ${userInterestsStr}

═══════════════════════════════════════
MARKET DATA
═══════════════════════════════════════
S&P 500: ${marketSnapshot.sp500_pct} | Nasdaq: ${marketSnapshot.nasdaq_pct} | Dow: ${marketSnapshot.dow_pct}
${marketSnapshot.sector_hint ? `Sector signal: ${marketSnapshot.sector_hint}` : ""}

═══════════════════════════════════════
PART 1: METADATA (for the app UI)
═══════════════════════════════════════

Generate these fields:

**summary**: A holistic 4-6 sentence executive summary of the ENTIRE briefing. Cover:
  1. Market moves (indices, sector color).
  2. What happened across breaking/market news.
  3. Key portfolio developments for ${userHoldingsStr} with specific tickers/numbers.
  4. What to watch and why it matters.
  Think: if someone read only this summary, they'd get the full story. No vague filler.

**key_highlights**: 3-5 bullets. Format each as:
  "**[Bold hook]:** [What happened] — [specific implication for ${userHoldingsStr}]"
  Rules: Must include numbers and specific company names. Avoid raw ticker symbols when possible. No vague filler. No "could potentially" hedging.

**market_sentiment**: { label: "bullish"|"bearish"|"neutral"|"mixed", description: "one punchy sentence" }

═══════════════════════════════════════
PART 2: AUDIO SCRIPT
═══════════════════════════════════════

TARGET: 430-560 words (~3-4 minutes of audio).
Keep it tight and energetic. Do NOT ramble. Hit every section with purpose.
Prioritize fresh intra-day developments. Avoid repeating details already covered earlier today unless there is a materially new update.

──── VOICE & TONE ────
- **Write like you're talking to a finance friend at a bar, not presenting at a conference.**
- Sound like a sharp friend in finance, not a Bloomberg anchor.
- Use contractions: "it's", "don't", "here's", "that's", "you're", "won't".
- Short punchy sentences. Then a longer one for depth. Then short again.
- Have opinions: "This matters because..." not "This could potentially matter..."
- Use dashes for natural pauses: "Apple's spring lineup — iPhone 17e, new iPads, refreshed Macs — is their biggest in two years."
- **Avoid jargon when plain English is clearer:**
  - Say "the market's betting" not "traders are pricing out"
  - Say "won't cut rates anytime soon" not "near-term rate cuts"
  - Say "makes stocks look more attractive" not "shifts the risk calculus"
  - Say "took a hit" not "retreating" or "declining"
- NO filler phrases: "in the current economic landscape", "a factor investors tend to monitor", "worth keeping an eye on"
- NO hedge stacking: "could potentially", "might possibly", "may warrant"
- ONE "could" or "may" per story MAX. State facts. Give insight. Move on.

──── STRUCTURE ────

Write the script in EXACT order: Opening → Step 1 (Rapid Fire) → Step 2 (Portfolio) → One Thing to Watch → Sign-off.

═══════════════════════════════════════
SECTION 1: OPENING — HOOK + MARKET COLOR
═══════════════════════════════════════
(50-80 words total, ONE paragraph)

Combine the greeting, market numbers, and market context into ONE seamless opening.
"${timeGreeting}, ${name}. [Weave market numbers into a natural sentence, then immediately add context.]"
${isWeekend ? 'Add: "Hope the weekend\'s treating you well."' : ""}

Market data: S&P ${marketSnapshot.sp500_pct}, Nasdaq ${marketSnapshot.nasdaq_pct}, Dow ${marketSnapshot.dow_pct}.
${marketSnapshot.sector_hint ? `Sector signal: "${marketSnapshot.sector_hint}"` : ""}

RULES:
- **Mention each index number EXACTLY ONCE. NEVER repeat them.**
- After stating the numbers, immediately tell what's driving it (1-2 sentences of context).
- Connect to holdings if natural.

**GOOD example:**
"${timeGreeting}, ${name}. Markets are holding steady today — the S&P flat, Nasdaq up three-tenths of a percent, and the Dow barely budging. Mixed signals across sectors, but tech is showing resilience — which is good news for your holdings. Here's your Pulse."

═══════════════════════════════════════
STEP 1: WRITE RAPID FIRE SECTION NOW
═══════════════════════════════════════

**CRITICAL: You may ONLY use stories from the MACRO/MARKET candidates below. Do NOT use ANY story from the portfolio data (that comes in Step 2).**

**STYLE: Concise. Punchy. Impactful. Fast-paced.**
- One tight beat per story: what happened + why it matters for market sentiment.
- No deep dives — rapid fire means quick hits.
- Target: 80-120 words total for all 3 stories.

**MANDATORY: Cover exactly 3 stories from the candidates below. Even if all are weak, pick the 3 least weak.**

**HARD RULE: Do NOT mention ${earlyTickers.join(", ") || "any of the listener's portfolio companies"} by name in this section. They are reserved for Step 2 (Portfolio).**
Mentioning Warner Bros. Discovery, Johnson & Johnson, Shopify, Apple, or any other holding by name in this section makes the briefing invalid.

**TRANSITIONS (required for info card sync):**
- Story 1: use "first up" or "first up," (e.g., "First up, gold took a hit after today's strong jobs report...")
- Story 2: use "meanwhile" or "next up" (e.g., "Meanwhile, the House passed legislation...")
- Story 3: use "and finally" or "also today" (e.g., "And finally, cattle futures rallied...")
These phrases MUST appear but should feel natural, not robotic.

──── YOUR MACRO/MARKET CANDIDATES (${rapidFireCandidatesForPrompt.length} available — pick 3) ────

${rapidFireCandidatesForPrompt
  .map(
    (s, i) => {
      const whenPhrase = getStoryWhenPhrase(s.datetime, timeZone, s.ageHours);
      return `
Candidate ${i + 1}:
Title: ${s.title}
What Happened: ${s.what_happened}
Source: ${s.outlet} | Category: ${s.category}
Age: ${(s.ageHours || 0).toFixed(1)} hours ago
When: "${whenPhrase}"
Breaking Score: ${s.breakingScore}
`;
    }
  )
  .join("\n")}

Pick the 3 most important:
- Market-moving impact > political noise (Fed/inflation/jobs > immigration/judges)
- Macro themes > single-stock news (sector rotation > one company's earnings)
- Actionable intelligence > general interest

Drop:
- Pure politics with no market impact (immigration, protests, elections)
- Weak macro (e.g., "Gold opened modestly higher")
- Aviation/logistics minutiae

═══════════════════════════════════════
STEP 2: NOW WRITE PORTFOLIO SECTION
═══════════════════════════════════════

🚨 **CRITICAL ANTI-HALLUCINATION RULES** 🚨
1. You may ONLY write about stories from the PORTFOLIO CANDIDATES list below
2. NEVER make up news, earnings dates, analyst ratings, or price movements
3. NEVER write generic filler like "remains stable" or "faces market volatility" without a specific news event
4. If a candidate list is empty or has fewer than 3 stories, you MUST skip those holdings entirely
5. Every sentence about a company MUST be traceable to a specific candidate story below

**Holdings: ${earlyTickers.join(", ")}**
**Available stories: ${portfolioNewsBatch.length}**

${portfolioNewsBatch.length < 3 ? `
⚠️ WARNING: Only ${portfolioNewsBatch.length} portfolio stories available. 
You MUST write about ${portfolioNewsBatch.length} stories ONLY. 
Do NOT mention holdings that have no stories below.
Do NOT create generic market commentary for missing holdings.
` : ""}

**STYLE: Insightful. Forward-looking. Educational for investors.**
- This is where you go deeper than rapid fire.
- Give context, forward-looking analysis, and actionable takeaways.
- Help the listener understand what this means for their holdings.
- Target: 200-260 words total for all stories.

**Start this section with a clear transition:** "Now turning to your portfolio" or "Shifting to your holdings"

**MANDATORY: Cover ${Math.min(3, portfolioNewsBatch.length)} portfolio stories from the candidates below. Pick the stories that give the listener ACTIONABLE INSIGHT.**

For each story, follow this arc:
a) THE SETUP (1 sentence): Create tension or curiosity. Why should they care?
b) WHAT HAPPENED (1-2 sentences): Hard facts. Numbers. Specifics. No hedging.
c) SO WHAT FOR YOU (1 sentence): Direct connection to their holding. Concrete, not speculative.

**GOOD example:**
"Now turning to your portfolio — Shopify options traders are pricing in a move to $139 after earnings tomorrow. That's an 8% jump from here, and with yesterday's 8.7% surge, your Shopify position is set up nicely heading into the report."

**BAD example (NEVER write like this):**
"The narrative across the streaming sector is shifting positively, particularly in the wake of pandemic recovery. Analysts are anticipating revenue growth, which should reflect favorably on your Warner Bros. Discovery holdings."
Why bad: Zero specifics, zero numbers, pure speculation ("shifting positively"), no concrete insight.

**TRANSITIONS between portfolio stories (required for info card sync):**
- Story 1: already has "Now turning to your portfolio" intro
- Story 2: use "next up for your holdings," or "looking at your [company]," or "shifting gears to [company],"
- Story 3: use similar natural transitions
These phrases MUST appear for card sync.

Say "your [COMPANY] position" naturally (e.g., "your Shopify position"), not raw ticker symbols.

──── YOUR PORTFOLIO CANDIDATES (${portfolioNewsBatch.length} available — pick 3) ────

${portfolioNewsBatch
  .map(
    (s: any, i: number) => {
      const whenPhrase = getStoryWhenPhrase(s.datetime, timeZone, s.ageHours);
      return `
Candidate ${i + 1}:
Title: ${s.title || ""}
Summary: ${s.what_happened || s.summary || ""}
Source: ${s.outlet || s.source || "—"}
When: ${whenPhrase}
Age: ${((Date.now() - new Date(s.datetime || 0).getTime()) / (1000 * 60 * 60)).toFixed(1)}h
`;
    }
  )
  .join("\n")}

═══════════════════════════════════════
FINAL SECTIONS
═══════════════════════════════════════

**ONE THING TO WATCH (30-50 words):**
- One forward-looking item: earnings date, economic report, Fed meeting, etc.
- WHY it matters to their portfolio specifically.
- This creates a reason to tune in again tomorrow.
- CRITICAL: Do NOT recommend watching events that ALREADY HAPPENED. Check story ages.

**SIGN-OFF (15-20 words):**
"That's your Pulse for ${naturalDate}. [Confident, energetic closer], ${name}!"
Examples: "Go crush it today" / "Have a great week" / "Enjoy the rest of your Sunday"

──── KILL RULES (applies to ALL sections) ────
- Stories with ZERO financial market impact (immigration rulings, election cases, protests, social issues)
- Roundup/recap articles ("Week in Review", "Weekend Round-Up")
- Stretched connections: if you'd need to say "this doesn't directly affect your holdings but..." — DROP IT
- Made-up consensus numbers, price targets, or dates
- **NEVER fabricate news stories or make up events that aren't in the candidate lists**
- **NEVER write generic filler like "remains stable" or "seeing increased demand" without a specific news source**
- The phrase "Go crush it today" if it's evening — match the energy to the time of day
- Events that already happened framed as "watch for this" — discuss implications instead

──── ELEVENLABS TTS OPTIMIZATION ────
- Short sentences sound best. Long compound sentences sound robotic.
- Use dashes (—) for pauses, not parentheses or semicolons.
- Spell out abbreviations on first use: "the Federal Reserve" then "the Fed".
- Numbers: "$213 billion" not "$213B". "1.9 percent" or "1.9%" both work.
- Avoid nested clauses. Break them into separate sentences.
- NEVER say "(NASDAQ:GOOGL)" or "(NYSE:AAPL)" or any exchange-prefixed ticker. Prefer company names in spoken output: "Meta", "your Shopify position".
- Prefer company names over ticker symbols in spoken script (say "Shopify", not "SHOP").

═══════════════════════════════════════
RETURN FORMAT (JSON)
═══════════════════════════════════════
{
  "metadata": {
    "summary": "4-6 sentence holistic executive summary of the full briefing (market + portfolio + watch)",
    "key_highlights": ["bullet 1", "bullet 2", "bullet 3"],
    "market_sentiment": { "label": "bullish|bearish|neutral|mixed", "description": "one sentence" }
  },
  "script": "Full audio script here (430-560 words, concise and high-signal)"
}
`;

    const combinedSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        metadata: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            key_highlights: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
            market_sentiment: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                description: { type: "string" },
              },
              required: ["label", "description"],
            },
          },
          required: ["summary", "key_highlights", "market_sentiment"],
        },
        script: { type: "string" },
      },
      required: ["metadata", "script"],
    };

    const combined = await invokeLLM(base44, combinedPrompt, false, combinedSchema);

    const uiSummary = safeText(combined?.metadata?.summary, "");
    const uiHighlights = Array.isArray(combined?.metadata?.key_highlights)
      ? combined.metadata.key_highlights.map((x) => safeText(x, "")).filter(Boolean)
      : [];
    const uiSentiment = combined?.metadata?.market_sentiment || { label: "neutral", description: "" };

    let script = sanitizeForAudio(combined?.script || "");
    script = replaceTickersWithCompanyNames(script, userHoldings);
    const wc = wordCount(script);
    const estimatedMinutes = Math.max(1, Math.round(wc / 150));

    console.log(`✅ [generateBriefing] Generated script: ${wc} words (~${estimatedMinutes} min)`);

    // GUARD: Don't create a briefing with an empty or near-empty script
    if (wc < 50) {
      console.error(`❌ [generateBriefing] Script too short (${wc} words). LLM may have returned empty. Aborting.`);
      console.error(`   Stories fed to prompt: ${allBriefingStories.length} (rapid:${rapidFireForPrompt.length}, personal:${personalizedForPrompt.length})`);
      return Response.json({
        error: `Briefing script was too short (${wc} words). This can happen when news data is stale or the LLM returned an incomplete response. Please try again.`,
        success: false,
        debug: {
          scriptWordCount: wc,
          storiesTotal: allBriefingStories.length,
          rapidFireCount: rapidFireForPrompt.length,
          personalizedCount: personalizedForPrompt.length,
          scoredStoriesCount: scoredStories.length,
        },
      }, { status: 500 });
    }

    // =========================================================
    // STEP 4B: MATCH TRANSCRIPT TO ACTUAL STORIES DISCUSSED
    // Use LLM to identify which 6 stories were actually mentioned in the transcript.
    // This ensures info cards always match what the LLM wrote about.
    // =========================================================
    console.log(`\n🔍 [Story Matching] Identifying which stories were actually discussed in transcript...`);
    
    // Build a candidate pool with all stories the LLM had access to
    const allCandidatesForMatching = [
      ...rapidFireCandidatesFinal.map((s: any) => ({
        id: s.id,
        title: s.title,
        what_happened: s.what_happened || s.summary || "",
        category: s.category,
        outlet: s.outlet,
        type: "rapid_fire"
      })),
      ...portfolioNewsBatch.map((s: any) => ({
        id: s.id,
        title: s.title,
        what_happened: s.what_happened || s.summary || "",
        category: s.category,
        outlet: s.outlet || s.source,
        type: "portfolio"
      }))
    ];

    const matchingPrompt = `You are analyzing an audio briefing transcript to identify which news stories were actually discussed.

TRANSCRIPT:
${script}

CANDIDATE STORIES (with IDs):
${allCandidatesForMatching.map((s, i) => `
[ID: ${s.id}]
Title: ${s.title}
Summary: ${s.what_happened}
Type: ${s.type}
`).join("\n")}

TASK:
Read the transcript carefully and identify which 6 stories from the candidates above were actually discussed.
Return the story IDs in the ORDER they appear in the transcript (first discussed → last discussed).

RULES:
1. Match stories by MEANING, not exact wording (e.g., "Warner Bros" in transcript matches "WBD" in candidate)
2. Return EXACTLY 6 story IDs (the briefing always covers 6 stories: 3 rapid fire + 3 portfolio)
3. If you can only confidently identify 5 stories, include the 5 and pad with the most relevant unused candidate
4. Order matters — the first ID should be the first story discussed, etc.

Return in this JSON format:
{
  "story_ids": ["id1", "id2", "id3", "id4", "id5", "id6"],
  "confidence": "high|medium|low"
}`;

    const matchingSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        story_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 6,
          maxItems: 6
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"]
        }
      },
      required: ["story_ids", "confidence"]
    };

    let matchedStoryIds: string[] = [];
    try {
      const matchResult = await invokeLLM(base44, matchingPrompt, false, matchingSchema);
      matchedStoryIds = matchResult?.story_ids || [];
      const confidence = matchResult?.confidence || "unknown";
      
      console.log(`✅ [Story Matching] LLM identified ${matchedStoryIds.length} stories (confidence: ${confidence})`);
      matchedStoryIds.forEach((id, i) => {
        const story = allCandidatesForMatching.find(s => s.id === id);
        console.log(`   ${i + 1}. ${story ? story.title.slice(0, 60) : `Unknown ID: ${id}`}...`);
      });

      // Validate: ensure all IDs exist in candidates
      const validIds = matchedStoryIds.filter(id => 
        allCandidatesForMatching.some(s => s.id === id)
      );
      
      if (validIds.length < 6) {
        console.warn(`⚠️ [Story Matching] Only ${validIds.length}/6 IDs were valid. Falling back to pre-selected stories.`);
        matchedStoryIds = []; // Trigger fallback
      } else {
        matchedStoryIds = validIds;
      }
    } catch (matchErr: any) {
      console.error(`❌ [Story Matching] LLM matching failed: ${matchErr.message}`);
      console.log(`   Falling back to pre-selected stories (rapid fire top 3 + portfolio top 3)`);
    }

    // Rebuild allBriefingStories using matched IDs (or fall back to original selection)
    if (matchedStoryIds.length === 6) {
      // SUCCESS: Use LLM-matched stories
      const candidateMap = new Map();
      rapidFireCandidatesFinal.forEach((s: any) => candidateMap.set(s.id, s));
      portfolioNewsBatch.forEach((s: any) => candidateMap.set(s.id, s));
      
      allBriefingStories = matchedStoryIds
        .map(id => candidateMap.get(id))
        .filter(Boolean); // Remove any nulls
      
      console.log(`✅ [Story Matching] Using LLM-matched stories for info cards`);
    } else {
      // FALLBACK: Use original pre-selected stories
      console.log(`📋 [Story Matching] Using pre-selected stories (original logic)`);
      // allBriefingStories is already set from line 1327
    }

    // =========================================================
    // STEP 5: Save Briefing (ALWAYS CREATE NEW)
    // - delivered_at is set ONLY when user has access (ready/script_ready)
    // =========================================================
    const deliveredAtNow = new Date().toISOString();

    const baseRecord = {
      date,
      created_by: userEmail,
      script,
      summary: uiSummary,
      market_sentiment: uiSentiment,
      key_highlights: uiHighlights,
      news_stories: allStories,
      duration_minutes: estimatedMinutes,
      status: skipAudio ? "script_ready" : "writing_script",
      audio_url: null,
      time_zone: timeZone,
      delivered_at: skipAudio ? deliveredAtNow : null,
    };

    const saved = await base44.entities.DailyBriefing.create(baseRecord);

    console.log("🔍 [DEBUG] Created briefing with:");
    console.log("  - ID:", saved.id);
    console.log("  - date:", saved.date);
    console.log("  - created_by:", saved.created_by);
    console.log("  - status:", saved.status);
    console.log("  - time_zone:", saved.time_zone);
    console.log("  - delivered_at:", saved.delivered_at);

    if (skipAudio) {
      return Response.json({
        success: true,
        briefing: saved,
        wordCount: wc,
        estimatedMinutes,
        status: "script_ready",
      });
    }

    // =========================================================
    // Return immediately; generate audio async
    // =========================================================
    console.log("✅ Briefing created; starting async audio generation...");

    generateAudioAsync(base44, saved.id, script, date, elevenLabsApiKey, timeZone).catch((error) => {
      console.error("❌ Async audio generation failed:", error);
      base44.asServiceRole.entities.DailyBriefing.update(saved.id, {
        status: "failed",
      }).catch(console.error);
    });

    return Response.json({
      success: true,
      briefing: saved,
      wordCount: wc,
      estimatedMinutes,
      status: "writing_script",
      message: "Hang Tight! We're writing your briefing script...",
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});

// =========================================================
// Async audio generation function
// - sets delivered_at when READY (user can access)
// =========================================================
async function generateAudioAsync(base44Client, briefingId, script, date, elevenLabsApiKey, timeZone) {
  console.log(`🎵 [Async Audio] Starting generation for briefing ${briefingId}...`);

  try {
    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      status: "generating_audio",
    });
    console.log("✅ [Status] Updated to generating_audio");

    const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);
    console.log(`✅ [Async Audio] Audio file generated`);

    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      status: "uploading",
    });
    console.log("✅ [Status] Updated to uploading");

    const { file_uri } = await base44Client.asServiceRole.integrations.Core.UploadPrivateFile({
      file: audioFile,
    });
    console.log(`✅ [Async Audio] File uploaded: ${file_uri}`);

    const { signed_url } = await base44Client.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });
    console.log(`✅ [Async Audio] Signed URL created`);

    const deliveredAt = new Date().toISOString();

    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      audio_url: signed_url,
      status: "ready",
      delivered_at: deliveredAt,
      time_zone: timeZone,
    });

    console.log(`🎉 [Async Audio] Briefing ${briefingId} is now READY with audio! delivered_at=${deliveredAt}`);
  } catch (error) {
    console.error(`❌ [Async Audio] Failed for briefing ${briefingId}:`, error);
    throw error;
  }
}