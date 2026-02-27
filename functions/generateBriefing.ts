// generateBriefing function - synced Jan 26, 2026 (redeploy for env vars)
// Uses secrets: FINNHUB_API_KEY, FINLIGHT_API_KEY, MARKETAUX_API_KEY, NEWSAPI_API_KEY. Names must match Base44 exactly (no MARKETAUX_KEY / NEWSAPI_KEY). If missing after GitHub deploy → Base44: edit this file (e.g. add newline), Save & Deploy (see DEPLOY.md).
// Adding this line V5 ________________ to manually redeploy on Base44
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";
import { en as numToWords } from "npm:n2words@3.1.0";
// ─── Inlined from staticEconomicCalendar.ts (Base44: no cross-file imports) ───
type StaticEconomicEvent = { event: string; date: string; country?: string; impact?: string; previous?: string; estimate?: string; unit?: string };
type EconomicEventForBriefing = StaticEconomicEvent & { within_3_business_days: boolean; business_days_until?: number };
// Compact economic calendar — generated from known 2026-2027 dates
function buildEconCalendar(): StaticEconomicEvent[] {
  const events: StaticEconomicEvent[] = [];
  const add = (e: string, dates: string[], impact: string) => {
    for (const d of dates) events.push({ event: e, date: d, country: "US", impact });
  };
  add("FOMC meeting", ["2026-03-17","2026-04-28","2026-06-16","2026-07-28","2026-09-15","2026-10-27","2026-12-08"], "high");
  add("CPI (Consumer Price Index)", ["2026-02-11","2026-03-11","2026-04-10","2026-05-12","2026-06-11","2026-07-11","2026-08-12","2026-09-11","2026-10-11","2026-11-12","2026-12-11"], "high");
  add("Non-Farm Payrolls (Employment Situation)", ["2026-02-06","2026-03-06","2026-04-03","2026-05-01","2026-06-05","2026-07-03","2026-08-07","2026-09-04","2026-10-02","2026-11-06","2026-12-04"], "high");
  add("GDP (advance)", ["2026-04-30","2026-07-30","2026-10-29","2027-01-28"], "high");
  add("PCE (Personal Consumption Expenditures)", ["2026-02-27","2026-03-27","2026-04-30","2026-05-29","2026-06-27","2026-07-31","2026-08-28","2026-09-30","2026-10-30","2026-11-25","2026-12-23"], "high");
  add("Consumer Confidence (Conference Board)", ["2026-02-25","2026-03-25","2026-04-28","2026-05-27","2026-06-25","2026-07-28","2026-08-26","2026-09-30","2026-10-28","2026-11-25","2026-12-30"], "medium");
  add("ISM Manufacturing PMI", ["2026-02-02","2026-03-02","2026-04-01","2026-05-01","2026-06-02","2026-07-01","2026-08-03","2026-09-01","2026-10-01","2026-11-02","2026-12-01"], "medium");
  add("Retail Sales", ["2026-02-13","2026-03-13","2026-04-14","2026-05-14","2026-06-12","2026-07-15","2026-08-14","2026-09-15","2026-10-15","2026-11-16","2026-12-15"], "medium");
  return events;
}
const ECONOMIC_CALENDAR_US: StaticEconomicEvent[] = buildEconCalendar();
function getUpcomingEconomicEvents(): EconomicEventForBriefing[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const HIGH_IMPACT_DAYS = 14;
  const MEDIUM_IMPACT_DAYS = 7;
  const result: EconomicEventForBriefing[] = [];
  for (const e of ECONOMIC_CALENDAR_US) {
    const parts = e.date.split("-").map(Number);
    if (parts.length !== 3) continue;
    const eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(eventDate.getTime()) || eventDate < today) continue;
    const calendarDaysUntil = Math.round((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const isHigh = e.impact === "high";
    if (calendarDaysUntil > (isHigh ? HIGH_IMPACT_DAYS : MEDIUM_IMPACT_DAYS)) continue;
    const businessDaysUntil = getBusinessDaysUntil(today, eventDate);
    result.push({ ...e, within_3_business_days: businessDaysUntil >= 0 && businessDaysUntil <= 3, business_days_until: businessDaysUntil });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
function isWeekendEconomic(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}
function getBusinessDaysUntil(today: Date, eventDate: Date): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  if (e < t) return -1;
  if (e.getTime() === t.getTime()) return 0;
  let count = 0;
  const cur = new Date(t);
  cur.setDate(cur.getDate() + 1);
  while (cur <= e) {
    if (!isWeekendEconomic(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
// ─── End inlined economic calendar ───

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

/**
 * Converts numbers and currency in script text to natural spoken form for TTS only.
 * Transcript/DB keeps original numbers; call this only on the copy sent to ElevenLabs.
 * Uses n2words for "two hundred and five", "zero point one seven", etc.
 */
function numbersToSpokenForm(script: string): string {
  if (!script || typeof script !== "string") return script;
  const replacements: { start: number; end: number; text: string }[] = [];

  // Currency: $205.14, $717 billion, $713.2 billion, $1.5 million
  const currencyRe = /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\s*(billion|million|trillion)?/gi;
  let m;
  while ((m = currencyRe.exec(script)) !== null) {
    const full = m[0];
    const intPart = (m[1] || "").replace(/,/g, "");
    const decPart = m[2];
    const scale = (m[3] || "").toLowerCase();
    let spoken = "";
    try {
      if (scale) {
        const n = parseInt(intPart, 10);
        if (Number.isFinite(n)) {
          spoken = `${numToWords(n)} ${scale} dollars`;
        }
      } else if (decPart !== undefined && decPart !== "") {
        const dollars = parseInt(intPart, 10);
        const centsStr = decPart.length >= 2 ? decPart.slice(0, 2) : decPart.padEnd(2, "0");
        const cents = parseInt(centsStr, 10);
        if (Number.isFinite(dollars) && Number.isFinite(cents)) {
          const d = numToWords(dollars);
          const c = numToWords(cents);
          spoken = cents === 0 ? `${d} dollars` : `${d} dollars and ${c} cents`;
        }
      } else {
        const n = parseInt(intPart, 10);
        if (Number.isFinite(n)) {
          spoken = `${numToWords(n)} dollars`;
        }
      }
      if (spoken) replacements.push({ start: m.index, end: m.index + full.length, text: spoken });
    } catch (_) {
      // leave original if conversion fails
    }
  }

  // Percentages: 0.17%, 1.55%, 3.64%
  const percentRe = /(-?\d+(?:\.\d+)?)\s*%/g;
  while ((m = percentRe.exec(script)) !== null) {
    const full = m[0];
    const n = parseFloat(m[1] || "0");
    if (!Number.isFinite(n)) continue;
    try {
      const spoken = `${numToWords(n)} percent`;
      replacements.push({ start: m.index, end: m.index + full.length, text: spoken });
    } catch (_) {}
  }

  if (replacements.length === 0) return script;
  // Apply from end to start so indices stay valid
  replacements.sort((a, b) => b.start - a.start);
  let out = script;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  return out;
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

// Runtime cache for dynamically resolved company names.
// Persists as long as the Deno isolate stays warm, so repeat
// briefings (same or different users) benefit from prior lookups.
const companyNameCache: Map<string, string> = new Map();

// Resolve a human-readable company name for any ticker.
// Lookup order: hardcoded map → runtime cache → Finnhub /stock/profile2.
// The profile2 result is cached so each unknown ticker costs only one API call ever
// (per warm isolate). Falls back to raw ticker symbol on any failure.
async function resolveCompanyName(ticker: string): Promise<string> {
  // 1. Check hardcoded map (instant, zero cost)
  if (TICKER_TO_COMPANY[ticker]) return TICKER_TO_COMPANY[ticker];

  // 2. Check runtime cache (previously resolved in this isolate)
  if (companyNameCache.has(ticker)) return companyNameCache.get(ticker)!;

  // 3. Fetch from Finnhub /stock/profile2 (one-time cost per unknown ticker)
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY;
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${finnhubKey}`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn(`⚠️ [resolveCompanyName] Rate limit for ${ticker}, using raw symbol`);
      return ticker;
    }

    if (!response.ok) {
      console.warn(`⚠️ [resolveCompanyName] Finnhub profile2 error for ${ticker}: ${response.status}`);
      return ticker;
    }

    const profile = await response.json();

    // Finnhub profile2 returns { name, ticker, country, currency, ... }
    const name = profile?.name;
    if (name && typeof name === "string" && name.trim().length > 0) {
      // Clean up corporate suffixes for a more natural spoken name
      const cleaned = name
        .replace(/\s*(,?\s*Inc\.?|,?\s*Corp\.?|,?\s*Ltd\.?|,?\s*LLC|,?\s*PLC|,?\s*N\.?V\.?|,?\s*S\.?A\.?|,?\s*AG|,?\s*Co\.?|,?\s*& Co\.?|,?\s*Group|,?\s*Holdings?|,?\s*International|,?\s*Enterprises?)$/i, "")
        .trim();

      const finalName = cleaned || name.trim();
      companyNameCache.set(ticker, finalName);
      console.log(`✅ [resolveCompanyName] ${ticker} → "${finalName}" (cached)`);
      return finalName;
    }

    console.warn(`⚠️ [resolveCompanyName] No name in profile2 for ${ticker}`);
    companyNameCache.set(ticker, ticker); // cache the miss too so we don't retry
    return ticker;
  } catch (err: any) {
    console.error(`❌ [resolveCompanyName] Failed for ${ticker}: ${err.message}`);
    return ticker;
  }
}

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

// Fetch quote — Finnhub PRIMARY (Finlight /api/stock/realtime returns 404 for SPY/QQQ/DIA)
async function fetchQuoteWithFallback(symbol: string, finnhubKey: string, finlightKey: string) {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn(`⚠️ Finnhub rate limit (429) for ${symbol}, trying Finlight...`);
      return await fetchFinlightQuote(symbol, finlightKey);
    }

    if (!response.ok) {
      console.error(`Finnhub error for ${symbol}: ${response.status}`);
      return await fetchFinlightQuote(symbol, finlightKey);
    }

    const data = await response.json();
    const changePct = data.dp ?? 0;

    if (data.c === undefined || data.c === null) {
      return await fetchFinlightQuote(symbol, finlightKey);
    }

    return {
      symbol,
      change_pct: `${changePct > 0 ? "+" : ""}${Number(changePct).toFixed(1)}%`,
      provider: "finnhub",
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
    
    console.log(`✅ [Market snapshot] Finlight real-time: ${symbol}`);
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
  BA: ["boeing"],
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      
      const marketauxKey = Deno.env.get("MARKETAUX_API_KEY") ?? "";
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
              const newsApiKey = Deno.env.get("NEWSAPI_API_KEY") ?? "";
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

// =========================================================
// STAGE 1: Finnhub calendar (earnings only)
// Run in parallel with 1A+1B. Economic calendar is Finnhub premium — use static US calendar if needed.
// =========================================================

const MAJOR_TICKERS_CALENDAR = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

async function fetchEarningsCalendar(
  userHoldings: string[],
  finnhubKey: string
): Promise<Array<{ ticker: string; date: string; estimated_eps?: number; quarter?: number; year?: number; hour?: string }>> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${thirtyDaysOut}&token=${finnhubKey}`
    );
    const data = await response.json();
    if (!response.ok) {
      console.warn(`⚠️ [Stage 1] Earnings calendar API error: ${response.status}`);
      return [];
    }

    const relevantTickers = [...new Set([...userHoldings.map((t) => t.toUpperCase()), ...MAJOR_TICKERS_CALENDAR])];
    const relevant = (data.earningsCalendar || [])
      .filter((e: any) => relevantTickers.includes((e.symbol || "").toUpperCase()))
      .map((e: any) => ({
        ticker: (e.symbol || "").toUpperCase(),
        date: e.date || "",
        estimated_eps: e.epsEstimate != null ? Number(e.epsEstimate) : undefined,
        quarter: e.quarter,
        year: e.year,
        hour: e.hour,
      }));

    const forUser = relevant.filter((e: any) => userHoldings.map((t) => t.toUpperCase()).includes(e.ticker)).length;
    console.log(`📅 [Stage 1] Earnings calendar: ${relevant.length} upcoming events (${forUser} for user holdings)`);
    return relevant;
  } catch (err: any) {
    console.error(`❌ [Stage 1] Earnings calendar failed:`, err?.message);
    return [];
  }
}

// =========================================================
// STAGE 1A: Per-ticker market data (Finnhub /quote)
// Returns a structured quote object for a single ticker.
// This is the foundation for the per-ticker data packages
// defined in the pipeline architecture spec (Section 1C).
// Only pulls /quote for now; fundamentals + earnings will
// be added in Step 1C once the Data Depth Calendar exists.
// =========================================================

interface TickerQuote {
  current_price: number | null;
  change_pct: number;
  change_dollar: number;
  daily_high: number | null;
  daily_low: number | null;
  open: number | null;
  previous_close: number | null;
}

interface TickerMarketData {
  ticker: string;
  company_name: string;
  quote: TickerQuote;
  provider: "finnhub" | "none";
  /** True when Finnhub returns 403 (e.g. unsupported exchange like GC.NE). */
  ticker_unsupported?: boolean;
}

async function fetchTickerMarketData(ticker: string): Promise<TickerMarketData> {
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY;
  const companyName = await resolveCompanyName(ticker);

  const emptyQuote: TickerQuote = {
    current_price: null,
    change_pct: 0,
    change_dollar: 0,
    daily_high: null,
    daily_low: null,
    open: null,
    previous_close: null,
  };

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${finnhubKey}`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn(`⚠️ [fetchTickerMarketData] Finnhub rate limit (429) for ${ticker}`);
      return { ticker, company_name: companyName, quote: emptyQuote, provider: "none" };
    }

    if (response.status === 403) {
      console.warn(`⚠️ [fetchTickerMarketData] Finnhub 403 for ${ticker} (unsupported ticker/exchange)`);
      return { ticker, company_name: companyName, quote: emptyQuote, provider: "none", ticker_unsupported: true };
    }

    if (!response.ok) {
      console.error(`❌ [fetchTickerMarketData] Finnhub error for ${ticker}: ${response.status}`);
      return { ticker, company_name: companyName, quote: emptyQuote, provider: "none" };
    }

    const data = await response.json();

    // Finnhub /quote response fields:
    //   c = current price, d = dollar change, dp = percent change,
    //   h = daily high, l = daily low, o = open, pc = previous close, t = timestamp
    if (data.c == null || data.c === 0) {
      console.warn(`⚠️ [fetchTickerMarketData] No price data for ${ticker} (c=${data.c})`);
      return { ticker, company_name: companyName, quote: emptyQuote, provider: "none" };
    }

    const quote: TickerQuote = {
      current_price: Number(data.c),
      change_pct: Number(data.dp ?? 0),
      change_dollar: Number(data.d ?? 0),
      daily_high: data.h != null ? Number(data.h) : null,
      daily_low: data.l != null ? Number(data.l) : null,
      open: data.o != null ? Number(data.o) : null,
      previous_close: data.pc != null ? Number(data.pc) : null,
    };

    console.log(
      `✅ [fetchTickerMarketData] ${ticker}: $${quote.current_price?.toFixed(2)} ` +
      `(${quote.change_pct >= 0 ? "+" : ""}${quote.change_pct.toFixed(2)}%)`
    );

    return { ticker, company_name: companyName, quote, provider: "finnhub" };
  } catch (err: any) {
    console.error(`❌ [fetchTickerMarketData] Fetch failed for ${ticker}: ${err.message}`);
    return { ticker, company_name: companyName, quote: emptyQuote, provider: "none" };
  }
}

// Fetch market data for ALL user holdings in parallel.
// Returns a map keyed by ticker for easy lookup.
async function fetchAllTickerMarketData(
  tickers: string[]
): Promise<Record<string, TickerMarketData>> {
  if (!tickers || tickers.length === 0) return {};

  console.log(`\n📊 [Stage 1A] Fetching market data for ${tickers.length} holdings: ${tickers.join(", ")}`);

  const results = await Promise.all(tickers.map((t) => fetchTickerMarketData(t)));

  const map: Record<string, TickerMarketData> = {};
  for (const r of results) {
    map[r.ticker] = r;
  }

  const withPrice = results.filter((r) => r.quote.current_price != null).length;
  console.log(`📊 [Stage 1A] Got real price data for ${withPrice}/${tickers.length} tickers\n`);

  return map;
}

// =========================================================
// STAGE 1B: Macro/Market News Candidates
// Runs 4 Finlight queries (5 on weekends) to build a pool
// of 15-20 macro/market news candidates for Stage 2 to
// select the best 3 Rapid Fire stories from.
// Falls back to MarketAux + NewsAPI if < 5 usable stories.
// =========================================================

const SECTOR_QUERY_MAP: Record<string, string> = {
  "Technology":        '"tech" OR "AI" OR "software" OR "semiconductor" OR "cloud computing"',
  "Healthcare":        '"healthcare" OR "pharma" OR "biotech" OR "FDA" OR "drug approval"',
  "Real Estate":       '"real estate" OR "housing market" OR "REIT" OR "mortgage rates" OR "home sales"',
  "Crypto":            '"bitcoin" OR "ethereum" OR "crypto" OR "blockchain" OR "SEC crypto"',
  "Energy":            '"oil price" OR "natural gas" OR "OPEC" OR "renewable energy" OR "solar"',
  "Finance":           '"banking" OR "financial sector" OR "JPMorgan" OR "Goldman Sachs" OR "fintech"',
  "Consumer Goods":    '"retail sales" OR "consumer spending" OR "CPG" OR "e-commerce"',
  "Commodities":       '"gold price" OR "copper" OR "commodities" OR "futures" OR "agriculture"',
  "ESG/Sustainable":   '"ESG" OR "sustainable investing" OR "green bonds" OR "climate regulation"',
  "Emerging Markets":  '"emerging markets" OR "China economy" OR "India GDP" OR "Brazil economy" OR "BRICS"',
  "Dividends":         '"dividend" OR "dividend yield" OR "dividend aristocrat" OR "income investing"',
  "ETFs":              '"ETF" OR "index fund" OR "Vanguard" OR "BlackRock" OR "fund flows"',
};

function buildSectorQuery(userInterests: string[]): string {
  const topTwo = (userInterests || []).slice(0, 2);
  const parts = topTwo
    .map((s) => SECTOR_QUERY_MAP[s])
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" OR ") : "";
}

interface MacroCandidate {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_query: "editorial_net" | "targeted_macro" | "market_movers" | "sector_interest" | "weekend_outlook" | "fallback_marketaux" | "fallback_newsapi";
  published_at: string;
  age_hours: number;
  sentiment: string;
  sentiment_confidence: number;
  category: string;
  entities: string[];
  matches_user_sector: boolean;
  matched_sectors: string[];
  href: string;
  imageUrl: string;
}

// Single Finlight POST query — returns raw articles array
async function finlightQuery(
  apiKey: string,
  params: {
    query?: string;
    sources?: string[];
    from: string;
    pageSize: number;
  }
): Promise<any[]> {
  const body: any = {
    language: "en",
    order: "DESC",
    includeEntities: true,
    from: params.from,
    pageSize: params.pageSize,
  };
  if (params.query) body.query = params.query;
  if (params.sources && params.sources.length > 0) body.sources = params.sources;

  const response = await fetch(`${FINLIGHT_NEWS_API}/v2/articles`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.warn(`⚠️ [Finlight Query] Failed (${response.status}): ${errText.slice(0, 200)}`);
    return [];
  }

  const data = await response.json();
  return data.articles || [];
}

// Transform a raw Finlight article into a MacroCandidate
function toMacroCandidate(
  article: any,
  sourceQuery: MacroCandidate["source_query"],
  userInterests: string[],
  nowMs: number
): MacroCandidate {
  const title = (article.title || "").trim();
  const summary = (article.summary || article.description || "").trim();
  const publishedAt = article.publishDate
    ? new Date(article.publishDate).toISOString()
    : new Date().toISOString();
  const ageHours = (nowMs - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  const entities: string[] = (article.companies || [])
    .map((c: any) => c.name || c.ticker || "")
    .filter(Boolean);

  const textLower = `${title} ${summary}`.toLowerCase();
  const matchedSectors: string[] = [];
  for (const interest of userInterests) {
    const terms = SECTOR_QUERY_MAP[interest];
    if (!terms) continue;
    const keywords = terms
      .replace(/"/g, "")
      .split(" OR ")
      .map((k) => k.trim().toLowerCase());
    if (keywords.some((kw) => textLower.includes(kw))) {
      matchedSectors.push(interest);
    }
  }

  return {
    id: `macro_${simpleHash(article.link || title)}`,
    title,
    summary,
    source: article.source || "Unknown",
    source_query: sourceQuery,
    published_at: publishedAt,
    age_hours: Math.round(ageHours * 10) / 10,
    sentiment: article.sentiment || "neutral",
    sentiment_confidence: article.confidence ?? 0,
    category: categorizeByKw(title, summary),
    entities,
    matches_user_sector: matchedSectors.length > 0,
    matched_sectors: matchedSectors,
    href: article.link || "#",
    imageUrl:
      article.images && article.images.length > 0
        ? article.images[0]
        : categoryImageUrl(categorizeByKw(title, summary)),
  };
}

// Deduplicate candidates by title similarity (reuses existing isSimilarTitle)
function deduplicateCandidates(candidates: MacroCandidate[]): MacroCandidate[] {
  const deduped: MacroCandidate[] = [];
  for (const c of candidates) {
    if (!deduped.some((existing) => isSimilarTitle(existing.title, c.title))) {
      deduped.push(c);
    }
  }
  return deduped;
}

// Filter out junk and roundup articles
function filterJunk(candidates: MacroCandidate[]): MacroCandidate[] {
  return candidates.filter((c) => {
    const textLower = `${c.title} ${c.summary}`.toLowerCase();
    if (/thank\s+you\s+for\s+(your\s+)?subscription/i.test(textLower)) return false;
    if (/blogspot|wordpress\.com|tumblr\.com/i.test(c.href)) return false;
    if (c.summary.length < 30 && c.title.length < 20) return false;
    if (ROUNDUP_TITLE_PATTERNS_BRIEFING.some((p) => c.title.toLowerCase().includes(p))) return false;
    return true;
  });
}

// MarketAux fallback for macro news (broad market terms, not ticker-specific)
async function fetchMarketauxMacroFallback(hoursAgo: number): Promise<MacroCandidate[]> {
  const marketauxKey = Deno.env.get("MARKETAUX_API_KEY") ?? "";
  if (!marketauxKey) {
    console.log("⚠️ [Stage 1B Fallback] No MARKETAUX_API_KEY available");
    return [];
  }

  const MARKETAUX_API_BASE = "https://api.marketaux.com/v1/news/all";
  const publishedAfter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "");

  const url = new URL(MARKETAUX_API_BASE);
  url.searchParams.set("language", "en");
  url.searchParams.set("filter_entities", "true");
  url.searchParams.set("limit", "10");
  url.searchParams.set("published_after", publishedAfter);
  url.searchParams.set("api_token", marketauxKey);

  try {
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
      console.warn(`⚠️ [Stage 1B Fallback] Marketaux error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const rows = Array.isArray(data?.data) ? data.data : [];
    const nowMs = Date.now();

    return rows.map((row: any) => {
      const publishedAt = row?.published_at || new Date().toISOString();
      const ageHours = (nowMs - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
      return {
        id: `macro_mx_${simpleHash(row?.url || row?.title || "")}`,
        title: (row?.title || "").trim(),
        summary: (row?.description || row?.snippet || "").trim(),
        source: row?.source || "Marketaux",
        source_query: "fallback_marketaux" as const,
        published_at: publishedAt,
        age_hours: Math.round(ageHours * 10) / 10,
        sentiment: row?.sentiment || "neutral",
        sentiment_confidence: 0,
        category: categorizeByKw(row?.title || "", row?.description || ""),
        entities: [],
        matches_user_sector: false,
        matched_sectors: [],
        href: row?.url || "#",
        imageUrl: row?.image_url || categoryImageUrl("markets"),
      };
    });
  } catch (err: any) {
    console.warn(`⚠️ [Stage 1B Fallback] Marketaux fetch failed: ${err.message}`);
    return [];
  }
}

// NewsAPI fallback for macro news (broad market terms)
async function fetchNewsApiMacroFallback(hoursAgo: number): Promise<MacroCandidate[]> {
  const newsApiKey = Deno.env.get("NEWSAPI_API_KEY") ?? "";
  if (!newsApiKey) {
    console.log("⚠️ [Stage 1B Fallback] No NEWSAPI_API_KEY available");
    return [];
  }

  const NEWSAPI_BASE = "https://newsapi.org/v2/everything";
  const from = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const url = new URL(NEWSAPI_BASE);
  url.searchParams.set("q", '"stock market" OR "Federal Reserve" OR "Wall Street" OR "S&P 500" OR "economy"');
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("from", from);
  url.searchParams.set("apiKey", newsApiKey);

  try {
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
      console.warn(`⚠️ [Stage 1B Fallback] NewsAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const rows = Array.isArray(data?.articles) ? data.articles : [];
    const nowMs = Date.now();

    return rows.map((row: any) => {
      const publishedAt = row?.publishedAt || new Date().toISOString();
      const ageHours = (nowMs - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
      return {
        id: `macro_na_${simpleHash(row?.url || row?.title || "")}`,
        title: (row?.title || "").trim(),
        summary: (row?.description || row?.content || "").trim(),
        source: row?.source?.name || "NewsAPI",
        source_query: "fallback_newsapi" as const,
        published_at: publishedAt,
        age_hours: Math.round(ageHours * 10) / 10,
        sentiment: "neutral",
        sentiment_confidence: 0,
        category: categorizeByKw(row?.title || "", row?.description || ""),
        entities: [],
        matches_user_sector: false,
        matched_sectors: [],
        href: row?.url || "#",
        imageUrl: row?.urlToImage || categoryImageUrl("markets"),
      };
    });
  } catch (err: any) {
    console.warn(`⚠️ [Stage 1B Fallback] NewsAPI fetch failed: ${err.message}`);
    return [];
  }
}

// Main Stage 1B entry point
async function fetchMacroCandidates(
  userInterests: string[]
): Promise<MacroCandidate[]> {
  const finlightKey = Deno.env.get("FINLIGHT_API_KEY");
  if (!finlightKey) {
    console.warn("⚠️ [Stage 1B] No FINLIGHT_API_KEY — skipping Finlight queries, going straight to fallbacks");
    // Go directly to fallbacks
    const fallbacks = [
      ...(await fetchMarketauxMacroFallback(24)),
      ...(await fetchNewsApiMacroFallback(24)),
    ];
    const filtered = filterJunk(deduplicateCandidates(fallbacks));
    console.log(`📰 [Stage 1B] Fallbacks returned ${filtered.length} candidates (no Finlight key)`);
    return filtered;
  }

  const nowMs = Date.now();
  const dayOfWeek = new Date().getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Time windows: wider on weekends
  const editorialFrom = new Date(nowMs - (isWeekend ? 5 * 24 : 6) * 60 * 60 * 1000).toISOString().slice(0, 10);
  const macroFrom = new Date(nowMs - (isWeekend ? 7 * 24 : 24) * 60 * 60 * 1000).toISOString().slice(0, 10);

  console.log(`\n📰 [Stage 1B] Fetching macro candidates (${isWeekend ? "weekend" : "weekday"} mode)...`);

  // ── Query 1: Editorial Net (no keyword filter, premium sources only) ──
  const q1Promise = finlightQuery(finlightKey, {
    sources: [
      "www.reuters.com", "www.bloomberg.com", "www.cnbc.com",
      "www.wsj.com", "www.ft.com", "www.barrons.com",
    ],
    from: editorialFrom,
    pageSize: isWeekend ? 20 : 15,
  }).then((articles) => {
    console.log(`   Q1 [editorial_net]: ${articles.length} articles`);
    return articles.map((a) => toMacroCandidate(a, "editorial_net", userInterests, nowMs));
  });

  // ── Query 2: Targeted Macro (Fed, inflation, GDP, etc.) ──
  const q2Promise = finlightQuery(finlightKey, {
    query: '"Federal Reserve" OR "inflation" OR "jobs report" OR "GDP" OR "interest rate" OR "Treasury" OR "tariff" OR "trade war"',
    from: macroFrom,
    pageSize: 10,
  }).then((articles) => {
    console.log(`   Q2 [targeted_macro]: ${articles.length} articles`);
    return articles.map((a) => toMacroCandidate(a, "targeted_macro", userInterests, nowMs));
  });

  // ── Query 3: Market Movers (rally, selloff, surge, etc.) ──
  const q3Promise = finlightQuery(finlightKey, {
    query: '"market" AND ("rally" OR "selloff" OR "surge" OR "crash" OR "record high" OR "sector rotation" OR "correction")',
    from: macroFrom,
    pageSize: 10,
  }).then((articles) => {
    console.log(`   Q3 [market_movers]: ${articles.length} articles`);
    return articles.map((a) => toMacroCandidate(a, "market_movers", userInterests, nowMs));
  });

  // ── Query 4: Sector Interest (personalized to user's top 2 sectors) ──
  const sectorQuery = buildSectorQuery(userInterests);
  const q4Promise = sectorQuery
    ? finlightQuery(finlightKey, {
        query: sectorQuery,
        from: macroFrom,
        pageSize: 10,
      }).then((articles) => {
        console.log(`   Q4 [sector_interest]: ${articles.length} articles (query: ${sectorQuery.slice(0, 80)}...)`);
        return articles.map((a) => toMacroCandidate(a, "sector_interest", userInterests, nowMs));
      })
    : Promise.resolve([] as MacroCandidate[]);

  // ── Query 5 (weekends only): Forward-looking content ──
  const q5Promise = isWeekend
    ? finlightQuery(finlightKey, {
        query: '"week ahead" OR "preview" OR "outlook" OR "earnings week" OR "what to watch"',
        from: macroFrom,
        pageSize: 10,
      }).then((articles) => {
        console.log(`   Q5 [weekend_outlook]: ${articles.length} articles`);
        return articles.map((a) => toMacroCandidate(a, "weekend_outlook", userInterests, nowMs));
      })
    : Promise.resolve([] as MacroCandidate[]);

  // Run all queries in parallel
  const [q1, q2, q3, q4, q5] = await Promise.all([q1Promise, q2Promise, q3Promise, q4Promise, q5Promise]);
  const allRaw = [...q1, ...q2, ...q3, ...q4, ...q5];

  console.log(`   Total raw articles from Finlight: ${allRaw.length}`);

  // Deduplicate, filter junk
  let candidates = filterJunk(deduplicateCandidates(allRaw));
  console.log(`   After dedup + junk filter: ${candidates.length} candidates`);

  // ── Fallbacks if < 5 usable stories ──
  if (candidates.length < 5) {
    console.log(`⚠️ [Stage 1B] Only ${candidates.length} candidates — running fallbacks...`);

    const marketauxFallback = await fetchMarketauxMacroFallback(isWeekend ? 48 : 24);
    if (marketauxFallback.length > 0) {
      console.log(`   MarketAux fallback: ${marketauxFallback.length} articles`);
      candidates = deduplicateCandidates([...candidates, ...filterJunk(marketauxFallback)]);
    }

    if (candidates.length < 5) {
      const newsApiFallback = await fetchNewsApiMacroFallback(isWeekend ? 48 : 24);
      if (newsApiFallback.length > 0) {
        console.log(`   NewsAPI fallback: ${newsApiFallback.length} articles`);
        candidates = deduplicateCandidates([...candidates, ...filterJunk(newsApiFallback)]);
      }
    }
  }

  // Sort: premium source + recency + sector relevance
  candidates.sort((a, b) => {
    const premiumA = PREMIUM_SOURCES_BRIEFING.some((p) => a.source.toLowerCase().includes(p)) ? 20 : 0;
    const premiumB = PREMIUM_SOURCES_BRIEFING.some((p) => b.source.toLowerCase().includes(p)) ? 20 : 0;
    const sectorA = a.matches_user_sector ? 15 : 0;
    const sectorB = b.matches_user_sector ? 15 : 0;
    const recencyA = a.age_hours < 6 ? 10 : a.age_hours < 12 ? 5 : 0;
    const recencyB = b.age_hours < 6 ? 10 : b.age_hours < 12 ? 5 : 0;
    const scoreA = premiumA + sectorA + recencyA;
    const scoreB = premiumB + sectorB + recencyB;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.age_hours - b.age_hours;
  });

  console.log(`📰 [Stage 1B] Final: ${candidates.length} macro candidates ready for Stage 2`);
  candidates.slice(0, 5).forEach((c, i) => {
    console.log(
      `   ${i + 1}. [${c.source_query}] [${c.age_hours}h] [${c.source}] ` +
      `${c.matches_user_sector ? "⭐ " : ""}${c.title.slice(0, 60)}...`
    );
  });

  return candidates;
}

// =========================================================
// STAGE 1C: Per-Ticker Data Package
// For each ticker in the user's portfolio, pull BOTH market
// data (reuses Stage 1A) AND news articles via a multi-step
// Finlight cascade with aggressive fallbacks.
// The depth of data pulled is governed by the Data Relevance
// Calendar so we don't dump fundamentals every single day.
// =========================================================

// ── COMPANY_ALIASES ──
// Critical for mid-cap and small-cap coverage. The multi-step
// Finlight cascade uses these to search by company name,
// key people, and products — not just raw ticker symbols.
// Extend this map as users add new holdings.
const COMPANY_ALIASES: Record<string, {
  name: string;
  aliases: string[];
  sector_terms: string[];
}> = {
  AAPL: {
    name: "Apple",
    aliases: ["Apple", "Tim Cook", "iPhone", "Apple Inc"],
    sector_terms: ["smartphone", "consumer electronics", "App Store"],
  },
  MSFT: {
    name: "Microsoft",
    aliases: ["Microsoft", "Satya Nadella", "Azure", "Windows", "Copilot"],
    sector_terms: ["cloud computing", "enterprise software", "AI"],
  },
  GOOGL: {
    name: "Alphabet",
    aliases: ["Alphabet", "Google", "Sundar Pichai", "YouTube", "Gemini"],
    sector_terms: ["search engine", "digital advertising", "AI"],
  },
  GOOG: {
    name: "Alphabet",
    aliases: ["Alphabet", "Google", "Sundar Pichai", "YouTube", "Gemini"],
    sector_terms: ["search engine", "digital advertising", "AI"],
  },
  AMZN: {
    name: "Amazon",
    aliases: ["Amazon", "Andy Jassy", "AWS", "Prime"],
    sector_terms: ["e-commerce", "cloud computing", "logistics"],
  },
  META: {
    name: "Meta",
    aliases: ["Meta", "Facebook", "Mark Zuckerberg", "Instagram", "WhatsApp", "Threads"],
    sector_terms: ["social media", "digital advertising", "metaverse", "AI"],
  },
  NVDA: {
    name: "NVIDIA",
    aliases: ["NVIDIA", "Jensen Huang", "Blackwell", "H100", "CUDA"],
    sector_terms: ["AI chips", "GPU", "data center chips"],
  },
  TSLA: {
    name: "Tesla",
    aliases: ["Tesla", "Elon Musk", "Cybertruck", "Model Y", "Gigafactory"],
    sector_terms: ["electric vehicles", "EV", "autonomous driving", "battery"],
  },
  TSM: {
    name: "TSMC",
    aliases: ["TSMC", "Taiwan Semiconductor", "Taiwan Semi", "Morris Chang"],
    sector_terms: ["chip foundry", "semiconductor manufacturing", "wafer fabrication"],
  },
  "BRK.B": {
    name: "Berkshire Hathaway",
    aliases: ["Berkshire Hathaway", "Warren Buffett", "Charlie Munger", "Berkshire"],
    sector_terms: ["conglomerate", "insurance", "value investing"],
  },
  "BRK.A": {
    name: "Berkshire Hathaway",
    aliases: ["Berkshire Hathaway", "Warren Buffett", "Charlie Munger", "Berkshire"],
    sector_terms: ["conglomerate", "insurance", "value investing"],
  },
  SHOP: {
    name: "Shopify",
    aliases: ["Shopify", "Tobi Lutke", "Shopify Inc"],
    sector_terms: ["e-commerce platform", "online retail", "merchant services"],
  },
  NFLX: {
    name: "Netflix",
    aliases: ["Netflix", "Ted Sarandos", "Netflix Inc"],
    sector_terms: ["streaming", "entertainment", "content"],
  },
  WBD: {
    name: "Warner Bros. Discovery",
    aliases: ["Warner Bros", "Warner Bros Discovery", "David Zaslav", "Max streaming", "HBO"],
    sector_terms: ["streaming", "entertainment", "media"],
  },
  DIS: {
    name: "Disney",
    aliases: ["Disney", "Walt Disney", "Bob Iger", "Disney+", "Marvel", "Pixar"],
    sector_terms: ["entertainment", "streaming", "theme parks"],
  },
  JPM: {
    name: "JPMorgan Chase",
    aliases: ["JPMorgan", "JP Morgan", "Jamie Dimon", "Chase"],
    sector_terms: ["banking", "investment banking", "financial services"],
  },
  V: {
    name: "Visa",
    aliases: ["Visa", "Visa Inc"],
    sector_terms: ["payments", "fintech", "credit card"],
  },
  MA: {
    name: "Mastercard",
    aliases: ["Mastercard", "Mastercard Inc"],
    sector_terms: ["payments", "fintech", "credit card"],
  },
  COIN: {
    name: "Coinbase",
    aliases: ["Coinbase", "Brian Armstrong", "Coinbase Global"],
    sector_terms: ["crypto exchange", "cryptocurrency", "digital assets"],
  },
  CRM: {
    name: "Salesforce",
    aliases: ["Salesforce", "Marc Benioff", "Salesforce Inc"],
    sector_terms: ["cloud CRM", "enterprise software", "SaaS"],
  },
  ADBE: {
    name: "Adobe",
    aliases: ["Adobe", "Adobe Inc", "Photoshop", "Creative Cloud"],
    sector_terms: ["software", "creative tools", "SaaS"],
  },
  UBER: {
    name: "Uber",
    aliases: ["Uber", "Dara Khosrowshahi", "Uber Technologies"],
    sector_terms: ["ride-sharing", "food delivery", "gig economy"],
  },
  ABNB: {
    name: "Airbnb",
    aliases: ["Airbnb", "Brian Chesky", "Airbnb Inc"],
    sector_terms: ["short-term rentals", "travel", "hospitality"],
  },
  TGT: {
    name: "Target",
    aliases: ["Target", "Target Corporation", "Brian Cornell"],
    sector_terms: ["retail", "consumer goods", "discount stores"],
  },
  WMT: {
    name: "Walmart",
    aliases: ["Walmart", "Walmart Inc", "Doug McMillon"],
    sector_terms: ["retail", "consumer goods", "grocery"],
  },
  BAC: {
    name: "Bank of America",
    aliases: ["Bank of America", "BofA", "Brian Moynihan"],
    sector_terms: ["banking", "financial services", "consumer banking"],
  },
  GS: {
    name: "Goldman Sachs",
    aliases: ["Goldman Sachs", "David Solomon", "Goldman"],
    sector_terms: ["investment banking", "trading", "financial services"],
  },
  PLTR: {
    name: "Palantir",
    aliases: ["Palantir", "Palantir Technologies", "Alex Karp"],
    sector_terms: ["data analytics", "AI", "government technology"],
  },
  AMD: {
    name: "AMD",
    aliases: ["AMD", "Advanced Micro Devices", "Lisa Su"],
    sector_terms: ["semiconductor", "CPU", "GPU", "AI chips"],
  },
  INTC: {
    name: "Intel",
    aliases: ["Intel", "Intel Corporation", "Pat Gelsinger"],
    sector_terms: ["semiconductor", "chip manufacturing", "CPU"],
  },
  AVGO: {
    name: "Broadcom",
    aliases: ["Broadcom", "Broadcom Inc", "Hock Tan"],
    sector_terms: ["semiconductor", "networking", "infrastructure software"],
  },
  ORCL: {
    name: "Oracle",
    aliases: ["Oracle", "Oracle Corporation", "Larry Ellison", "Safra Catz"],
    sector_terms: ["cloud computing", "enterprise software", "database"],
  },
};

// Resolve company aliases for any ticker.
// Falls back to resolveCompanyName() for unknown tickers.
function getCompanyAliases(ticker: string): { name: string; aliases: string[]; sector_terms: string[] } {
  if (COMPANY_ALIASES[ticker]) return COMPANY_ALIASES[ticker];
  const name = TICKER_TO_COMPANY[ticker] || ticker;
  return { name, aliases: [name], sector_terms: [] };
}

// ── DATA RELEVANCE CALENDAR ──
type DataDepth =
  | "daily"
  | "weekly"
  | "monthly"
  | "earnings_ramp"
  | "earnings_day"
  | "earnings_aftermath"
  | "weekend";

function getDataDepth(
  today: Date,
  earningsDate: string | null
): { depth: DataDepth; reason: string } {
  const dayOfWeek = today.getUTCDay();
  const dayOfMonth = today.getUTCDate();
  const isFirstMondayOfMonth = dayOfWeek === 1 && dayOfMonth <= 7;
  const isMonday = dayOfWeek === 1;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (earningsDate) {
    const earningsMs = new Date(earningsDate).getTime();
    const todayMs = today.getTime();
    const diffDays = Math.ceil((earningsMs - todayMs) / (1000 * 60 * 60 * 24));
    const daysSince = Math.ceil((todayMs - earningsMs) / (1000 * 60 * 60 * 24));

    if (diffDays === 0)
      return { depth: "earnings_day", reason: `Earnings today` };
    if (daysSince >= 0 && daysSince <= 2)
      return { depth: "earnings_aftermath", reason: `Earnings were ${daysSince} day${daysSince !== 1 ? "s" : ""} ago` };
    if (diffDays > 0 && diffDays <= 7)
      return { depth: "earnings_ramp", reason: `Earnings in ${diffDays} day${diffDays !== 1 ? "s" : ""}` };
  }

  if (isFirstMondayOfMonth)
    return { depth: "monthly", reason: "First Monday of the month" };
  if (isMonday)
    return { depth: "weekly", reason: "Monday — weekly review" };
  if (isWeekend)
    return { depth: "weekend", reason: "Weekend — markets closed" };
  return { depth: "daily", reason: "Standard weekday" };
}

// ── TICKER NEWS ARTICLE INTERFACE ──
// relevance_type classifies how directly the article relates to the ticker:
//   "direct"     — article is specifically about this company (mentions name/ticker in title/summary)
//   "tangential" — article mentions the company in passing (listicle, roundup, Buffett mention)
//   "sector"     — article is about the sector, not the company specifically
type ArticleRelevance = "direct" | "tangential" | "sector";

interface TickerNewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  age_hours: number;
  sentiment: string;
  sentiment_confidence: number;
  is_sector_level: boolean;
  relevance_type: ArticleRelevance;
  href: string;
  /** 1-10 LLM-assigned material impact (Portfolio Impact Gate). */
  llm_impact_score?: number;
  /** Brief reason from LLM (max 8 words). */
  llm_impact_reason?: string;
}

// Classify how directly an article relates to a specific ticker.
// Uses company name, raw ticker symbol, and aliases from COMPANY_ALIASES.
function classifyRelevance(
  title: string,
  summary: string,
  ticker: string,
  isSectorLevel: boolean
): ArticleRelevance {
  if (isSectorLevel) return "sector";

  const aliasInfo = getCompanyAliases(ticker);
  const titleLower = title.toLowerCase();
  const summaryLower = summary.toLowerCase();
  const text = `${titleLower} ${summaryLower}`;

  // Check if title directly mentions company name or ticker
  const companyLower = aliasInfo.name.toLowerCase();
  const tickerLower = ticker.toLowerCase();

  // Direct: company name or ticker appears in the TITLE
  // (Title mention = the article is *about* the company, not just mentioning it)
  if (titleLower.includes(companyLower) || titleLower.includes(tickerLower)) {
    return "direct";
  }

  // Also direct if Finlight entity-tagged it AND company name is in the body
  if (text.includes(companyLower) || text.includes(tickerLower)) {
    // Check if title contains strong company-specific signals
    const DIRECT_SIGNALS = [
      "earnings", "revenue", "profit", "loss", "guidance",
      "upgrade", "downgrade", "price target", "analyst",
      "CEO", "CFO", "acquisition", "merger", "lawsuit",
      "dividend", "buyback", "layoff", "restructur",
    ];
    if (DIRECT_SIGNALS.some((s) => text.includes(s))) {
      return "direct";
    }
  }

  // Check aliases in the title for direct classification
  for (const alias of aliasInfo.aliases) {
    if (alias.length >= 4 && titleLower.includes(alias.toLowerCase())) {
      return "direct";
    }
  }

  // If company name or ticker appears anywhere in text but didn't qualify as direct
  if (text.includes(companyLower) || text.includes(tickerLower)) {
    return "tangential";
  }
  for (const alias of aliasInfo.aliases) {
    if (alias.length >= 4 && text.includes(alias.toLowerCase())) {
      return "tangential";
    }
  }

  // Default: tangential (it was returned by our query, so it's at least loosely related)
  return "tangential";
}

// Minimum target: try to get at least this many articles per ticker
const MIN_ARTICLES_TARGET = 5;

// Speed optimization 3A: cap Stage 2 input size to reduce LLM latency (doc: pre-filter before Stage 2)
const STAGE2_MACRO_CAP = 15;
const STAGE2_ARTICLES_PER_TICKER_CAP = 5;

// ── TICKER PACKAGE INTERFACE ──
interface TickerPackage {
  ticker: string;
  company_name: string;
  data_depth: DataDepth;
  data_depth_reason: string;
  quote: TickerQuote;
  fundamentals: null; // Placeholder for Phase 2
  earnings: null;     // Placeholder for Phase 2
  news_articles: TickerNewsArticle[];
  news_coverage: "strong" | "moderate" | "thin" | "none";
  fallback_sources_used: string[];
  /** True when Finnhub returned 403 for this ticker (unsupported exchange). */
  ticker_unsupported?: boolean;
}

// =========================================================
// STAGE 1D — RAW INTELLIGENCE PACKAGE
// Bundles all Stage 1 outputs into a single object for Stage 2.
// No new API calls — pure aggregation of 1A, 1B, 1C results.
// =========================================================

interface RawIntelligencePackage {
  generated_at: string;
  user_context: {
    user_name: string;
    interests: string[];
    holdings: string[];
    time_zone: string;
  };
  ticker_packages: TickerPackage[];
  macro_candidates: MacroCandidate[];
  /** Set when Stage 1 calendar fetch runs (earnings + economic). Optional for backward compatibility. */
  upcoming_events?: {
    earnings: Array<{ ticker: string; date: string; estimated_eps?: number; quarter?: number; year?: number; hour?: string }>;
    economic: Array<{ event: string; date: string; country?: string; impact?: string; previous?: string; estimate?: string; unit?: string; within_3_business_days?: boolean; business_days_until?: number }>;
  };
  metadata: {
    ticker_count: number;
    macro_candidate_count: number;
    total_ticker_articles: number;
    tickers_with_strong_coverage: number;
    tickers_with_moderate_coverage: number;
    tickers_with_thin_coverage: number;
    tickers_with_no_coverage: number;
    avg_articles_per_ticker: number;
    direct_article_pct: number;
    pipeline_duration_ms: number;
  };
}

function buildRawIntelligencePackage(
  tickerPackages: TickerPackage[],
  macroCandidates: MacroCandidate[],
  userContext: { user_name: string; interests: string[]; holdings: string[]; time_zone: string },
  pipelineStartMs: number,
): RawIntelligencePackage {
  const totalArticles = tickerPackages.reduce((sum, p) => sum + p.news_articles.length, 0);
  const directArticles = tickerPackages.reduce(
    (sum, p) => sum + p.news_articles.filter((a) => a.relevance_type === "direct").length, 0
  );

  const coverageCounts = { strong: 0, moderate: 0, thin: 0, none: 0 };
  for (const pkg of tickerPackages) {
    coverageCounts[pkg.news_coverage]++;
  }

  return {
    generated_at: new Date().toISOString(),
    user_context: userContext,
    ticker_packages: tickerPackages,
    macro_candidates: macroCandidates,
    metadata: {
      ticker_count: tickerPackages.length,
      macro_candidate_count: macroCandidates.length,
      total_ticker_articles: totalArticles,
      tickers_with_strong_coverage: coverageCounts.strong,
      tickers_with_moderate_coverage: coverageCounts.moderate,
      tickers_with_thin_coverage: coverageCounts.thin,
      tickers_with_no_coverage: coverageCounts.none,
      avg_articles_per_ticker: tickerPackages.length > 0
        ? Math.round((totalArticles / tickerPackages.length) * 10) / 10
        : 0,
      direct_article_pct: totalArticles > 0
        ? Math.round((directArticles / totalArticles) * 100)
        : 0,
      pipeline_duration_ms: Date.now() - pipelineStartMs,
    },
  };
}

// =========================================================
// STAGE 2: THE ANALYST DESK — Interfaces & Schema
// A dedicated LLM call that thinks about the data: selects
// stories, extracts insights, flags gaps, and sets market energy.
// Input: Raw Intelligence Package from Stage 1
// Output: Analyzed Brief for Stage 3 (Scriptwriter)
// =========================================================

interface MacroSelection {
  rank: number;
  story_key?: string;
  source_id: string;
  source_query: string;
  hook: string;
  facts: string[];
  so_what: string;
  plain_english_bridge: string;
  confidence: "high" | "medium" | "low";
  transition_suggestion: string;
  is_sector_personalized?: boolean;
  matched_sector?: string;
}

interface PortfolioSelection {
  ticker: string;
  story_key?: string;
  company_name: string;
  data_depth: string;
  source_type: "news" | "market_data_only";
  source_id: string | null;
  hook: string;
  facts: string[];
  so_what: string;
  confidence: "high" | "medium" | "low";
  quote_context: {
    current_price: number | null;
    change_today_pct: number;
  };
  data_gap_note?: string;
  transition_suggestion: string;
}

interface WatchItem {
  event: string;
  date: string;
  importance: "high" | "medium" | "low";
  affects_holdings: string[];
  why_it_matters: string;
  is_future_event: boolean;
}

interface DataQualityFlag {
  ticker: string;
  issue: string;
  recommendation: string;
}

type MarketEnergy = "volatile_up" | "volatile_down" | "mixed_calm" | "breakout" | "quiet";

interface AnalyzedBrief {
  macro_selections: MacroSelection[];
  portfolio_selections: PortfolioSelection[];
  watch_items: {
    primary: WatchItem | null;
    secondary: WatchItem | null;
  };
  data_quality_flags: DataQualityFlag[];
  market_energy: MarketEnergy;
}

// JSON schema for invokeLLM structured output
const ANALYST_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    macro_selections: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rank: { type: "number" },
          story_key: { type: "string" },
          source_id: { type: "string" },
          source_query: { type: "string" },
          hook: { type: "string" },
          facts: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
          so_what: { type: "string" },
          plain_english_bridge: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          transition_suggestion: { type: "string" },
          is_sector_personalized: { type: "boolean" },
          matched_sector: { type: "string" },
        },
        required: ["rank", "source_id", "hook", "facts", "so_what", "plain_english_bridge", "confidence", "transition_suggestion"],
      },
    },
    portfolio_selections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string" },
          story_key: { type: "string" },
          company_name: { type: "string" },
          data_depth: { type: "string" },
          source_type: { type: "string", enum: ["news", "market_data_only"] },
          source_id: { type: ["string", "null"] },
          hook: { type: "string" },
          facts: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
          so_what: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          quote_context: {
            type: "object",
            additionalProperties: false,
            properties: {
              current_price: { type: ["number", "null"] },
              change_today_pct: { type: "number" },
            },
            required: ["current_price", "change_today_pct"],
          },
          data_gap_note: { type: "string" },
          transition_suggestion: { type: "string" },
        },
        required: ["ticker", "company_name", "data_depth", "source_type", "hook", "facts", "so_what", "confidence", "quote_context", "transition_suggestion"],
      },
    },
    watch_items: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            event: { type: "string" },
            date: { type: "string" },
            importance: { type: "string", enum: ["high", "medium", "low"] },
            affects_holdings: { type: "array", items: { type: "string" } },
            why_it_matters: { type: "string" },
            is_future_event: { type: "boolean" },
          },
          required: ["event", "date", "importance", "affects_holdings", "why_it_matters", "is_future_event"],
        },
        secondary: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            event: { type: "string" },
            date: { type: "string" },
            importance: { type: "string", enum: ["high", "medium", "low"] },
            affects_holdings: { type: "array", items: { type: "string" } },
            why_it_matters: { type: "string" },
            is_future_event: { type: "boolean" },
          },
          required: ["event", "date", "importance", "affects_holdings", "why_it_matters", "is_future_event"],
        },
      },
      required: ["primary", "secondary"],
    },
    data_quality_flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string" },
          issue: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["ticker", "issue", "recommendation"],
      },
    },
    market_energy: {
      type: "string",
      enum: ["volatile_up", "volatile_down", "mixed_calm", "breakout", "quiet"],
    },
  },
  required: ["macro_selections", "portfolio_selections", "watch_items", "data_quality_flags", "market_energy"],
};

// Fix 3C: Schemas for parallel Stage 2 (macro-only and portfolio-only) so we can run two LLM calls in parallel.
const ANALYST_MACRO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    macro_selections: ANALYST_OUTPUT_SCHEMA.properties.macro_selections,
    market_energy: ANALYST_OUTPUT_SCHEMA.properties.market_energy,
    watch_items: ANALYST_OUTPUT_SCHEMA.properties.watch_items,
  },
  required: ["macro_selections", "market_energy", "watch_items"],
};

const ANALYST_PORTFOLIO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    portfolio_selections: ANALYST_OUTPUT_SCHEMA.properties.portfolio_selections,
    data_quality_flags: ANALYST_OUTPUT_SCHEMA.properties.data_quality_flags,
  },
  required: ["portfolio_selections", "data_quality_flags"],
};

// Smart Gate: LLM pre-screening for macro candidates (market-moving relevance)
const SMART_GATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          pass: { type: "boolean" },
          impact: { type: "number" },
          reason: { type: "string" },
        },
        required: ["id", "pass", "impact", "reason"],
      },
    },
  },
  required: ["evaluations"],
};

/**
 * Pre-screen macro candidates with an LLM: keep only stories that have meaningful
 * potential to move markets, affect investor sentiment, or impact portfolio holdings.
 * On LLM failure, falls back to hasFinancialRelevance() keyword filter.
 */
async function screenMacroCandidates(
  base44: any,
  candidates: MacroCandidate[],
  userInterests: string[],
  userHoldings: string[]
): Promise<MacroCandidate[]> {
  if (!candidates || candidates.length === 0) return [];

  const startMs = Date.now();
  const SUMMARY_MAX = 180;

  const compact = candidates.map((c) => ({
    id: c.id,
    title: (c.title || "").slice(0, 120),
    summary: (c.summary || "").slice(0, SUMMARY_MAX),
    source: c.source || "",
    age_hours: Math.round(c.age_hours * 10) / 10,
  }));

  const prompt = `You are a financial news gatekeeper. For each story below, decide: Does it have meaningful potential to move markets, affect investor sentiment, or impact portfolio holdings?

PASS (include): Fed/rates, trade policy/tariffs, geopolitical crises with economic impact, sector trends, M&A, political decisions with clear economic consequences (debt ceiling, fiscal policy), major earnings/guidance from bellwethers, inflation/jobs data, regulatory actions affecting markets.

FAIL (exclude): Local news, minor single-company news with no market angle, pure social/political with no economic angle, celebrity gossip, sports, entertainment, human-interest fluff.

For each story output: pass (true/false), impact (1-10; 10 = Fed rate decision, major tariff announcement; 1 = tangential), reason (max 8 words).

User interests (for sector relevance): ${(userInterests || []).slice(0, 5).join(", ") || "general"}.
User holdings (for context only): ${(userHoldings || []).slice(0, 8).join(", ") || "none"}.

Stories (JSON array):
${JSON.stringify(compact)}

Return a single JSON object with key "evaluations": an array of objects, one per story in the SAME ORDER, each with keys: id, pass, impact, reason.`;

  try {
    const result = await invokeLLM(base44, prompt, false, SMART_GATE_SCHEMA);
    const evaluations: Array<{ id: string; pass: boolean; impact: number; reason: string }> =
      result?.evaluations || [];

    const byId = new Map(evaluations.map((e) => [e.id, e]));
    const passedWithImpact: Array<{ c: MacroCandidate; impact: number; reason: string }> = [];
    for (const c of candidates) {
      const e = byId.get(c.id);
      if (e && e.pass) passedWithImpact.push({ c, impact: e.impact, reason: e.reason || "" });
    }
    passedWithImpact.sort((a, b) => b.impact - a.impact);
    const passed = passedWithImpact.map((x) => x.c);

    const failed = candidates.filter((c) => !passed.find((p) => p.id === c.id));
    const failedWithReasons = failed.map((c) => ({
      title: c.title,
      reason: byId.get(c.id)?.reason ?? "no eval",
    }));

    if (passed.length < 3) {
      const passedIds = new Set(passed.map((p) => p.id));
      for (const c of candidates) {
        if (passedIds.has(c.id)) continue;
        passed.push(c);
        passedIds.add(c.id);
        if (passed.length >= 3) break;
      }
      console.log(`🚪 [Smart Gate] Fewer than 3 passed, added fallback from original list → ${passed.length} total`);
    }

    const elapsed = Date.now() - startMs;
    console.log(`🚪 [Smart Gate] ${candidates.length} → ${passed.length} passed in ${elapsed}ms`);
    passedWithImpact.slice(0, 5).forEach(({ c, impact }, i) => {
      console.log(`   ${i + 1}. [impact:${impact}] ${(c.title || "").slice(0, 55)}...`);
    });
    failedWithReasons.slice(-3).forEach((f) => {
      console.log(`   filtered: "${(f.title || "").slice(0, 45)}..." — ${f.reason}`);
    });

    return passed;
  } catch (err: any) {
    console.warn(`⚠️ [Smart Gate] LLM failed (${err?.message ?? err}), using keyword filter fallback`);
    const fallback = candidates.filter((c) =>
      hasFinancialRelevance({ title: c.title, what_happened: c.summary })
    );
    const elapsed = Date.now() - startMs;
    console.log(`🚪 [Smart Gate] Fallback: ${candidates.length} → ${fallback.length} passed (${elapsed}ms)`);
    return fallback.length >= 3 ? fallback : candidates.slice(0, Math.max(3, candidates.length));
  }
}

// Build the Analyst prompt from the Raw Intelligence Package
function buildAnalystPrompt(
  rawIntelligence: RawIntelligencePackage,
  isWeekend: boolean,
  marketSnapshot?: { sp500_pct: string; nasdaq_pct: string; dow_pct: string } | null,
): string {
  const userCtx = rawIntelligence.user_context;
  const holdings = userCtx.holdings;
  const interests = userCtx.interests;

  const weekendBlock = `
WEEKEND MODE: Markets are closed. Do NOT select stories framed as live
market moves ("stocks rallied today", "the S&P gained"). Instead:

WEEK IN REVIEW: Select the 2-3 biggest stories of the WEEK — the
narratives that defined the past 5 trading days. Frame them as a recap,
not breaking news. "This week was defined by..."

WEEK AHEAD: Identify upcoming events from the earnings calendar and
economic calendar. Earnings dates, CPI reports, Fed meetings, etc.

PORTFOLIO: For each holding, summarize the WEEKLY performance (not daily).
"Your NVIDIA position had a strong week — up 7% on the back of..."

DO NOT report Friday's closing prices as if they're fresh news. The
listener already heard Friday's briefing. Weekend is about perspective
and preparation, not play-by-play.
`;

  const weekdayBlock = `
HARD RULE — macro_selections must be TRUE MACRO news, NOT portfolio-company stories:
- Macro = Fed, inflation, interest rates, sector rotation, indices, regulatory, geopolitical, broad market themes.
- Do NOT select stories that are primarily about ${holdings.join(", ")} or any of the listener's holdings.
  Examples of WRONG macro picks: "Amazon rebounds", "Nvidia-Meta deal", "Boeing job shift".
  Those belong in portfolio_selections. Keep macro and portfolio strictly separated.

DEDUPLICATION RULE: Before finalizing your 3 macro selections, check if any two stories
cover the same underlying event (e.g., two articles about Fed minutes, two articles about
the same earnings report). If so, MERGE them into one selection — combine the best facts
from both sources. Then pick a genuinely different story for the remaining slot. Selecting
two stories about the same event is a critical failure.

STORY_KEY (required for each macro and portfolio selection): For each story you select, output a "story_key" — a short snake_case identifier (max 40 chars) for the underlying EVENT, not the article. Macro: use the theme (e.g. "fed_rate_path", "tariff_consumer_impact"). Portfolio: prefix with ticker (e.g. "ba_vietnam_orders", "nvda_q4_earnings"). The key must be STABLE: if tomorrow's story is about the same Boeing Vietnam deal, use the same key "ba_vietnam_orders". Different events, different keys: "ba_vietnam_orders" vs "ba_starliner_issues" vs "ba_q4_earnings".

Story 1: ALWAYS the biggest market-moving headline of the day — Fed, inflation, indices, regulatory.
Prefer "editorial_net" or "targeted_macro". Must NOT be about a portfolio holding.

Story 2: Second macro story — rates, sector rotation, broad market theme.
Check matches_user_sector: true for sector relevance, but still macro (not single-holding news).

Story 3: Sector-interest story that is macro-level (e.g. "AI sector resilience", "credit market convergence").
User interests: ${interests.join(", ")}.
If the best sector story is about a portfolio company, skip it — pick true macro instead.
Never put portfolio-company news (Amazon, Nvidia, etc.) in macro_selections.
`;

  return `You are a senior financial analyst preparing a research brief for an audio
scriptwriter. Your job is to ANALYZE, not write a script. Be precise,
data-driven, and honest about gaps.

You will receive a Raw Intelligence Package containing:
- Market data per ticker (real-time quotes from Finnhub)
- Macro/market news candidates (tagged with source_query and sector relevance)
- Per-ticker data packages (quote data, news articles with relevance types)
- Each ticker has a data_depth level that controls how much detail to include

Your task:
1. SELECT the 3 best macro stories for a rapid-fire segment
2. SELECT the best story (or data angle) for each portfolio holding
3. EXTRACT the core insight for each selected story
4. FLAG any holdings with insufficient coverage

═══════════════════════════════════════
${isWeekend ? "WEEKEND EDITION — DIFFERENT SELECTION LOGIC" : "RAPID FIRE STORY ALLOCATION (3 stories)"}
═══════════════════════════════════════

${isWeekend ? weekendBlock : weekdayBlock}

GENERAL SELECTION CRITERIA:
- Market-moving impact > political noise
- Macro themes > single-stock news
- Fresh (< 12 hours) > stale
- Actionable intelligence > general interest
- DROP: pure politics with no market impact, weak macro, aviation/logistics minutiae

═══════════════════════════════════════
PORTFOLIO STORY SELECTION
═══════════════════════════════════════

ARTICLE IMPACT SCORES: Each article in ticker_packages may have "llm_impact_score" (1-10) and "llm_impact_reason" from a separate LLM evaluation of material impact on that company.
PRIORITIZATION: When choosing which article to use for a holding's portfolio_selection:
- Score 7-10: HIGH PRIORITY — materially significant. Always prefer these.
- Score 4-6: MODERATE — use if no high-priority articles exist.
- Score 1-3: LOW — only as last resort; if these are the only articles, treat as "no significant company-specific news" (see QUIET DAY below).
Do NOT ignore a score-8 article just because relevance_type is "tangential". Impact score overrides relevance_type.

QUIET DAY RULE: If ALL articles for a holding have llm_impact_score 3 or below (or there are no articles), this is a quiet news day for that holding. Then:
- Set source_type to "news" if there IS an article worth mentioning (even low-impact), or "market_data_only" if truly nothing.
- In "hook", frame honestly. Examples: "No major headlines for Boeing today, but there's one thing worth flagging…" / "Quiet day for your Shopify position — here's a quick sector note…" / "Nothing market-moving for Disney right now, though…"
- Pick the BEST available low-scoring article and present it with honest framing. Set confidence to "low" and data_gap_note: "No high-impact news today; surfacing best available."
- If there is literally zero news AND no meaningful price move, keep it to 1-2 sentences max using market_data_only. The listener appreciates candor over manufactured urgency.

SELECTION CRITERIA:
- Specific news with numbers > vague commentary
- Analyst actions (upgrades/downgrades/price targets) = high priority
- Earnings-related = high priority
- Articles tagged relevance_type "direct" should be preferred over "tangential" or "sector" when impact scores are tied.
- If NO news articles exist for a holding, use the quote data to create a
  "market_data_only" angle. Be explicit that this is data-driven, not news-driven.
- If articles are flagged is_sector_level: true, frame the insight at the sector
  level and connect it to the specific holding — don't pretend it's company-specific news.
- NEVER fabricate news. If there's nothing, say so.
- For each portfolio selection, include a story_key (snake_case, ticker-prefixed, e.g. "amzn_antitrust_california", "nvda_q4_earnings"). Same event across days = same key.

FACTS INTEGRITY RULE: Every item in the "facts" array MUST be a specific, verifiable data
point that comes directly from the source articles or market data provided. Examples of valid facts:
- "Current price: $48.35, up 3.64% today"
- "Q1 revenue of $21.8 million vs $18.55 million expected"
- "Stock hit daily high of $48.57"
- "Macy's announcing 65 store closures over the next 18 months"

Examples of INVALID facts (never include these):
- "Investors are watching for potential entry points" ← speculation
- "The sector is showing growth momentum" ← vague commentary
- "Technical setups suggest opportunity" ← not from any source
- "Market conditions are favorable" ← filler

If you cannot find 2-3 specific facts from the provided articles and market data for a holding,
include only the facts you can verify and set confidence to "low". Do NOT pad with generated commentary.

CROSS-REFERENCE RULE: For each portfolio holding, you are given MULTIPLE articles. Before writing
the "facts" array, read ALL articles for that holding and combine the most specific data points
from across them. For example, if Article A says "Amazon overtook Walmart by revenue" and Article B
says "Amazon reported $717 billion in global sales" — combine both: the narrative from A and the
specific number from B. If multiple articles cite DIFFERENT numbers for the same metric, use the
number from the most authoritative source (Reuters/Bloomberg over a blog) or the most recent article.
Flag the discrepancy in data_gap_note. If NO article provides a specific figure for a claim, simply
drop that data point from the facts array entirely. Do not mention the absence. Do not estimate or
invent numbers from your own knowledge. Only include numbers that appear in the provided source articles.

═══════════════════════════════════════
DATA DEPTH RULES
═══════════════════════════════════════

Each ticker has a data_depth field. Respect it:

- "daily" → Keep it brief. Price + change + one news insight (if any). No fundamentals.
- "weekly" (Mondays) → Include week-in-review context, key technical levels,
  upcoming catalysts within 14 days.
- "monthly" (1st Monday) → Full position review. Include fundamentals, sector context,
  performance recap. This is the "state of your portfolio" moment.
- "earnings_ramp" (7 days before) → Focus on the upcoming earnings. Build anticipation.
  Include estimates and last quarter's result.
- "earnings_day" → Lead with this holding. Full earnings preview. Make it the top
  portfolio story regardless of other news.
- "earnings_aftermath" (0-2 days after) → Lead with results vs expectations and market reaction.
- "weekend" → Light touch. Week-in-review angle. Preview next week.

The data_depth for each holding is provided in the ticker_packages.

═══════════════════════════════════════
EXTRACTION FORMAT
═══════════════════════════════════════

FOR EACH SELECTED STORY, EXTRACT:
a) HOOK: One sentence that creates tension or curiosity
b) FACTS: 2-3 specific data points (numbers, dates, names)
c) SO_WHAT: One sentence connecting it to the listener's portfolio or market outlook
d) PLAIN_ENGLISH_BRIDGE: A one-liner that translates the concept into simple terms
   (e.g. "In simple terms — borrowing money stays expensive")
e) CONFIDENCE: "high" (strong source, specific data), "medium" (decent source,
   some specifics), "low" (thin sourcing, mostly data-driven)

OUTPUT FORMAT: Return valid JSON only. No markdown, no commentary.

═══════════════════════════════════════
MARKET ENERGY CLASSIFICATION — use the index data provided, not your judgment:
═══════════════════════════════════════
- volatile_up: ALL major indices UP by 1%+ → strong rally
- volatile_down: ALL major indices DOWN by 1%+ → significant selloff
- mixed_calm: Indices are split (some up, some down) OR all moves < 0.5%
- quiet: All moves < 0.3% in either direction
- breakout: Any single index moved 2%+ in either direction, OR a major unexpected event

If ALL indices are DOWN (even modestly), market_energy CANNOT be "volatile_up".
If ALL indices are UP (even modestly), market_energy CANNOT be "volatile_down".

${!isWeekend && marketSnapshot ? `Today's data: S&P ${marketSnapshot.sp500_pct} | Nasdaq ${marketSnapshot.nasdaq_pct} | Dow ${marketSnapshot.dow_pct}\nBased on this data, classify market_energy accordingly.` : "Today's data: N/A (weekend or unavailable). Use market_energy: quiet or mixed_calm."}

${(() => {
  const ue = (rawIntelligence as any).upcoming_events;
  const hasEarnings = ue?.earnings?.length > 0;
  const hasEconomic = ue?.economic?.length > 0;
  if (!ue || (!hasEarnings && !hasEconomic)) return "\n(No calendar data for this run. Populate watch_items from news/context as before.)\n";
  const earningsBlock = hasEarnings
    ? "EARNINGS DATES:\n" + (ue.earnings || []).map((e: any) =>
        `${e.ticker}: ${e.date} (${e.hour === "bmo" ? "before market open" : e.hour === "amc" ? "after market close" : e.hour || "time TBD"})${e.estimated_eps != null ? ` — EPS estimate: $${e.estimated_eps}` : ""}`
      ).join("\n")
    : "";
  const economicBlock = hasEconomic
    ? (earningsBlock ? "\n\n" : "") + "ECONOMIC EVENTS:\n" + (ue.economic || []).map((e: any) => {
        const daysStr = e.business_days_until != null ? ` (in ${e.business_days_until} business day${e.business_days_until !== 1 ? "s" : ""})` : "";
        const cadence = e.within_3_business_days ? " — ALWAYS mention (within 3 business days)" : " — Mention selectively (before 3-business-day window)";
        return `${e.date}: ${e.event} [${e.impact || "—"} impact]${daysStr}${cadence}${e.estimate != null ? ` — estimate: ${e.estimate}${e.unit || ""}` : ""}${e.previous != null ? ` (previous: ${e.previous})` : ""}`;
      }).join("\n")
    : "";
  return `
═══════════════════════════════════════
UPCOMING EVENTS (structured calendar — use these for watch_items)
═══════════════════════════════════════

${earningsBlock}${economicBlock}

WATCH ITEMS RANKING (strict — you have exactly 2 slots: primary and secondary):

1) HARD RULE — Within 3 business days:
   Any event (earnings or economic) marked "ALWAYS mention (within 3 business days)" MUST get one of the two slots. If multiple events are within 3 business days, use both slots for them (e.g. two earnings = primary + secondary; or one earnings + one economic).

2) IMPORTANCE ORDER (when filling slots):
   Earnings for user holdings > FOMC / CPI / NFP / PCE / GDP (high-impact economic) > other economic (ISM, Retail Sales, Consumer Confidence) > breaking macro/news not on the calendar.
   When no earnings need to be mentioned, FOMC or the next high-impact economic can take primary.

3) SECONDARY SLOT — Economic vs. breaking macro:
   - If an economic event (e.g. CPI, PCE) is within 3 business days, it MUST get a slot (primary or secondary). No exception.
   - If no economic is within 3 days: prefer "this week" economic (in 4–5 business days) for secondary unless the breaking macro story is clearly major (Fed/policy, big regulatory, geopolitical, or directly about the listener's holdings). For economic "next week or later" (e.g. in 10+ business days), a major macro story may take secondary.
   - When in doubt, prefer the closer economic event so the listener gets a clear "what's coming" reminder.

4) TWO EARNINGS IN WINDOW:
   If two or more holdings have earnings within 3 business days (e.g. NVDA and AMZN), use BOTH slots for those earnings (primary = one, secondary = the other). Do not give a slot to economic in that case when earnings fill both slots.

5) TRULY MAJOR MACRO:
   If a breaking macro story is clearly more important than a routine calendar event that is far out (e.g. 2 weeks), you may use a slot for that story. Still respect the 3-business-day rule: anything within 3 days must get a slot.

6) FALLBACK:
   If no major watch items from the calendar, pick the CLOSEST upcoming economic event and give one light reminder with a brief "why it matters". Do not list every economic event — at most 2 items (primary and secondary).
`;
})()}

═══════════════════════════════════════
RAW INTELLIGENCE PACKAGE
═══════════════════════════════════════

${JSON.stringify(rawIntelligence)}

═══════════════════════════════════════
TASK
═══════════════════════════════════════

Analyze this intelligence package for listener "${userCtx.user_name}" who holds
${holdings.join(", ")} with sector interests in ${interests.join(", ")}.
Select stories and extract insights now. Return valid JSON only.`;
}

// Fix 3C: Macro-only Analyst prompt (for parallel Stage 2). Output: macro_selections, market_energy, watch_items.
function buildAnalystPromptMacro(
  rawIntelligence: RawIntelligencePackage,
  isWeekend: boolean,
  marketSnapshot?: { sp500_pct: string; nasdaq_pct: string; dow_pct: string } | null,
): string {
  const userCtx = rawIntelligence.user_context;
  const holdings = userCtx.holdings;
  const interests = userCtx.interests;

  const weekendBlock = `
WEEKEND MODE: Markets are closed. Do NOT select stories framed as live market moves. Select 2-3 biggest stories of the WEEK; frame as recap. WEEK AHEAD: Identify upcoming events from calendar. Do NOT report Friday's close as fresh news.
`;

  const weekdayBlock = `
HARD RULE — macro_selections must be TRUE MACRO news, NOT portfolio-company stories. Do NOT select stories about ${holdings.join(", ")}.
DEDUPLICATION: Merge stories covering the same event into one; pick different stories for remaining slots.
STORY_KEY: For each macro selection output story_key (snake_case, e.g. "fed_rate_path", "tariff_consumer_impact").
Story 1: Biggest market-moving headline — Fed, inflation, indices, regulatory. Must NOT be about a portfolio holding.
Story 2: Second macro story — rates, sector rotation. Story 3: Sector-interest story (macro-level). User interests: ${interests.join(", ")}. Never put portfolio-company news in macro_selections.
`;

  const upcomingBlock = (() => {
    const ue = (rawIntelligence as any).upcoming_events;
    const hasEarnings = ue?.earnings?.length > 0;
    const hasEconomic = ue?.economic?.length > 0;
    if (!ue || (!hasEarnings && !hasEconomic)) return "\n(No calendar data. Set watch_items.primary and .secondary to null if nothing to watch.)\n";
    const earningsBlock = hasEarnings
      ? "EARNINGS:\n" + (ue.earnings || []).map((e: any) =>
          `${e.ticker}: ${e.date} (${e.hour === "bmo" ? "BMO" : e.hour === "amc" ? "AMC" : e.hour || "TBD"})`
        ).join("\n")
      : "";
    const economicBlock = hasEconomic
      ? (earningsBlock ? "\n" : "") + "ECONOMIC:\n" + (ue.economic || []).map((e: any) => {
          const daysStr = e.business_days_until != null ? ` (in ${e.business_days_until} bdays)` : "";
          const cadence = e.within_3_business_days ? " — ALWAYS mention" : " — Mention selectively";
          return `${e.date}: ${e.event} [${e.impact || "—"}]${daysStr}${cadence}`;
        }).join("\n")
      : "";
    return `UPCOMING EVENTS (use for watch_items):\n${earningsBlock}${economicBlock}\n\nFill primary and secondary from these; respect 3-business-day rule. At most 2 items.`;
  })();

  return `You are a senior financial analyst. This call is MACRO ONLY. Your output must contain ONLY:
1. macro_selections — exactly 3 macro/market stories (use macro_candidates in the package; ignore ticker_packages).
2. market_energy — one of: volatile_up, volatile_down, mixed_calm, breakout, quiet (use index data below).
3. watch_items — { primary, secondary } from the upcoming events; null if none.

Do NOT output portfolio_selections or data_quality_flags.

═══════════════════════════════════════
${isWeekend ? "WEEKEND" : "RAPID FIRE (3 stories)"}
═══════════════════════════════════════
${isWeekend ? weekendBlock : weekdayBlock}

GENERAL: Market-moving impact > noise; macro themes > single-stock; fresh > stale. DROP pure politics, weak macro.

EXTRACTION PER MACRO STORY: hook, facts (2-3), so_what, plain_english_bridge, confidence (high/medium/low), transition_suggestion, story_key, is_sector_personalized if applicable.

═══════════════════════════════════════
MARKET ENERGY (use index data only)
═══════════════════════════════════════
volatile_up: all indices UP 1%+. volatile_down: all DOWN 1%+. mixed_calm: split or all <0.5%. quiet: all <0.3%. breakout: any index 2%+ or major event.
${!isWeekend && marketSnapshot ? `Today: S&P ${marketSnapshot.sp500_pct} | Nasdaq ${marketSnapshot.nasdaq_pct} | Dow ${marketSnapshot.dow_pct}. Classify market_energy accordingly.` : "Weekend/unavailable → market_energy: quiet or mixed_calm."}

${upcomingBlock}

═══════════════════════════════════════
RAW INTELLIGENCE PACKAGE (use macro_candidates and user_context; ignore ticker_packages for this task)
═══════════════════════════════════════
${JSON.stringify(rawIntelligence)}

TASK: For listener "${userCtx.user_name}" (holdings: ${holdings.join(", ")}, interests: ${interests.join(", ")}), select 3 macro stories, set market_energy, fill watch_items. Return valid JSON only.`;
}

// Fix 3C: Portfolio-only Analyst prompt (for parallel Stage 2). Output: portfolio_selections, data_quality_flags.
function buildAnalystPromptPortfolio(
  rawIntelligence: RawIntelligencePackage,
  isWeekend: boolean,
): string {
  const userCtx = rawIntelligence.user_context;
  const holdings = userCtx.holdings;
  const interests = userCtx.interests;
  const tickerPackages = rawIntelligence.ticker_packages || [];
  const requiredTickers = tickerPackages.map((p: TickerPackage) => p.ticker);

  return `You are a senior financial analyst. This call is PORTFOLIO ONLY. Your output must contain ONLY:
1. portfolio_selections — you MUST output exactly ${requiredTickers.length} selection(s), one for EACH of these tickers: ${requiredTickers.join(", ")}. Never omit a holding.
2. data_quality_flags — flag any holding where coverage is thin or articles are not company-specific (optional; can be empty).

Do NOT output macro_selections, market_energy, or watch_items.

HARD RULE — ONE SELECTION PER HOLDING: For every ticker in ticker_packages you must output one portfolio_selection. If a holding has no suitable company-specific news (e.g. only tangential/sector/supplier articles), output one selection with source_type: "market_data_only", hook/facts from the quote data only, so_what brief, confidence: "low", and data_gap_note: "Insufficient company-specific news; using price data." That way the listener still gets a segment for that holding.

═══════════════════════════════════════
PORTFOLIO STORY SELECTION
═══════════════════════════════════════

ARTICLE IMPACT SCORES: Each article in ticker_packages may have "llm_impact_score" (1-10) and "llm_impact_reason" from a separate LLM evaluation of material impact on that company.
PRIORITIZATION: When choosing which article to use for a holding's portfolio_selection:
- Score 7-10: HIGH PRIORITY — materially significant. Always prefer these.
- Score 4-6: MODERATE — use if no high-priority articles exist.
- Score 1-3: LOW — only as last resort; if these are the only articles, treat as "no significant company-specific news" (see QUIET DAY below).
Do NOT ignore a score-8 article just because relevance_type is "tangential". Impact score overrides relevance_type.

QUIET DAY RULE: If ALL articles for a holding have llm_impact_score 3 or below (or there are no articles), this is a quiet news day for that holding. Then:
- Set source_type to "news" if there IS an article worth mentioning (even low-impact), or "market_data_only" if truly nothing.
- In "hook", frame honestly. Examples: "No major headlines for Boeing today, but there's one thing worth flagging…" / "Quiet day for your Shopify position — here's a quick sector note…" / "Nothing market-moving for Disney right now, though…"
- Pick the BEST available low-scoring article and present it with honest framing. Set confidence to "low" and data_gap_note: "No high-impact news today; surfacing best available."
- If there is literally zero news AND no meaningful price move, keep it to 1-2 sentences max using market_data_only. The listener appreciates candor over manufactured urgency.

- Specific news with numbers > vague commentary. Analyst actions (upgrades/downgrades/price targets) = high priority.
- Prefer relevance_type "direct" over "tangential" or "sector" when impact scores are tied. When articles exist but none are clearly about the company's own performance/outlook (e.g. only supplier or industry news), still output one selection with source_type: "market_data_only" and data_gap_note explaining.
- is_sector_level: true → frame at sector level, connect to holding. NEVER fabricate news.
- story_key per selection: ticker-prefixed snake_case (e.g. "amzn_antitrust_california", "nvda_q4_earnings", "ba_market_data_only").

FACTS: Every "facts" item must be a verifiable data point from the provided articles or market data. No speculation or filler. For market_data_only, use only quote data (e.g. "Current price: $X, up Y% today").
CROSS-REFERENCE: Combine specific data from ALL articles for each holding when using news; use most authoritative or most recent when numbers differ. Flag discrepancies in data_gap_note.

DATA DEPTH (from each ticker_package): daily → brief (price + one insight). weekly → week-in-review. monthly → full review. earnings_ramp/earnings_day/earnings_aftermath → focus on earnings. weekend → light.

EXTRACTION PER HOLDING: ticker, company_name, data_depth, source_type (news|market_data_only), source_id, hook, facts (1-4), so_what, confidence, quote_context (current_price, change_today_pct), data_gap_note, transition_suggestion, story_key.

═══════════════════════════════════════
RAW INTELLIGENCE PACKAGE (use ticker_packages and user_context; ignore macro_candidates for this task)
═══════════════════════════════════════
${JSON.stringify(rawIntelligence)}

TASK: For listener "${userCtx.user_name}" (holdings: ${holdings.join(", ")}), output exactly ${requiredTickers.length} portfolio_selections — one per ticker. For holdings with no company-specific news, use market_data_only. Then add any data_quality_flags. Return valid JSON only.`;
}

// =========================================================
// STAGE 3: THE ANCHOR DESK — Scriptwriter Prompt + Schema
// A dedicated LLM call that takes the Analyzed Brief and
// writes the final audio script with voice, tone, personality.
// Input: Analyzed Brief from Stage 2 + user context + voice pref
// Output: Final JSON with metadata + audio script
// =========================================================

interface ScriptwriterInput {
  analyzedBrief: AnalyzedBrief;
  name: string;
  naturalDate: string;
  timeGreeting: string;
  holidayGreeting: string | null;
  isWeekend: boolean;
  isMonday: boolean;
  isFriday: boolean;
  userHoldingsStr: string;
  userSectorInterests: string[];
  marketSnapshot: { sp500_pct: string; nasdaq_pct: string; dow_pct: string; sector_hint?: string };
  userVoicePreference: string;
  dayName: string;
  /** Tickers excluded from briefing (unsupported + no coverage). Script says one neutral line. */
  skipped_tickers?: string[];
}

function buildScriptwriterPrompt(input: ScriptwriterInput): string {
  const {
    analyzedBrief, name, naturalDate, timeGreeting, holidayGreeting,
    isWeekend, isMonday, isFriday, userHoldingsStr, userSectorInterests,
    marketSnapshot, userVoicePreference, dayName, skipped_tickers = [],
  } = input;

  // Single default word target (briefing length option removed from product)
  const wordTarget = "450-600 words (~3-4 minutes)";

  // Briefing style (voice) is linked to generation: userVoicePreference drives tone blocks below
  console.log(`📝 [Stage 3] Voice mode block injected: ${userVoicePreference}`);

  // Watch item history — not yet implemented; will be wired in a future stage
  const watchItemHistory = {};

  const prompt = `SYSTEM: You host "Pulse" — a personalized financial audio briefing for ONE person (name, portfolio, interests). Pre-analyzed brief is provided; turn it into a compelling 3-4 min audio script that sounds natural. Useful + enjoyable.

LISTENER: ${name} | ${naturalDate} | ${timeGreeting}${holidayGreeting ? ` | ${holidayGreeting}` : ""}${isWeekend ? " | Weekend" : ""}${isMonday ? " | Monday" : ""}${isFriday ? " | Friday" : ""}. Holdings: ${userHoldingsStr}. Sectors: ${userSectorInterests.join(", ")}
MARKET: S&P ${marketSnapshot.sp500_pct} | Nasdaq ${marketSnapshot.nasdaq_pct} | Dow ${marketSnapshot.dow_pct}. Energy: ${analyzedBrief.market_energy}

VOICE: ${userVoicePreference}. Sound like a real person, not a textbook or anchor. Difference = how much jargon you assume.
${userVoicePreference === "professional" ? `Professional: sharp friend in finance. Use "hawkish", "repriced", basis points without explaining — but say it like over drinks, not a press release. Contractions, dashes, short sentences. Confident, efficient.` : ""}
${userVoicePreference === "conversational" ? `Conversational: translate jargon with a one-line "what that means for you." Use plain_english_bridge for 1-2 macro stories only. Warm, clear; not bubbly or uncertain.` : ""}
${userVoicePreference === "hybrid" ? `Hybrid: lead with terminology, quick plain-English bridge for concepts that need it. Natural aside, not a lesson.` : ""}

PERSONALITY: Talk to ${name}; use name 2-3x (opening, mid, sign-off). Reference reminder_context naturally. Match energy: volatile_up→celebratory, volatile_down→reassuring, mixed_calm→efficient, breakout→urgent, quiet→brief. "We're watching" not "investors should watch." Show personality 1-2x (surprise, humor, emphasis, candor).
VOICE & TTS: Contractions; short sentences + dashes; opinions not hedging; no filler; "your [COMPANY] position"; company names. Spell abbreviations first; "$X billion", "1.9 percent"; no exchange-prefixed tickers.

SCRIPT STRUCTURE
${isWeekend ? `
WEEKEND: 350-450 words. No live markets. 1) Opening: warm, acknowledge weekend; no index numbers. 2) Week in review: one cohesive theme + 1-2 portfolio highlights. 3) Week ahead: calendar (earnings, CPI, Fed); use watch_items. 4) One interesting thing (optional). 5) Sign-off: relaxed, see you Monday.

` : `WEEKDAY (exact order):`}

1) Opening (50-80w): greeting + each index ONCE + what's driving it; match market_energy; end "Here's your Pulse." 2) Rapid fire (80-140w): 3 macro_selections only; transitions "First up," "Meanwhile," "And finally,". Do NOT mention calendar watch items (PCE, earnings, CPI, Consumer Confidence, etc.) in Rapid Fire — reserve those for section 4 only. No portfolio names here.

3) Portfolio (200-280w): portfolio_selections. Per holding: hook (1) → facts + numbers (1-2) → context/color (1, optional) → so_what (1). If market_data_only: brief, honest. Transitions: "Looking at your [company]," "Shifting to [company]," etc.
${skipped_tickers.length > 0 ? `Skipped tickers ${skipped_tickers.join(", ")}: one neutral sentence at end of portfolio; do not speculate.` : ""}

4) What to watch (40-70w): Put ALL watch items (primary and secondary from analyzed_brief.watch_items) in this section only — one block after portfolio. Do not split them (e.g. one in Rapid Fire and one later). Cover both primary and secondary here; use reminder_context for catch-up/freshen. End with forward pull. 5) Sign-off (15-25w): Vary by market_energy (good/volatile/catalyst/quiet) and day (Friday/Monday); never repeat two days in a row.

KILL RULES: No invented news; no fabricated ratings/targets/dates. Low confidence→brief. No generic filler; every holding sentence has a specific number. Pick 1-2 narrative techniques; Professional→don't over-explain; Conversational→plain-English bridge for complex concepts.
TARGET: ${wordTarget} words. Tight but keep personality.

METADATA: **summary** — 4-6 sentences: market moves, breaking news, portfolio developments (with tickers/numbers), what to watch. **key_highlights** — 3-5 bullets: "**Hook:** fact — implication"; numbers and company names; no vague filler. **market_sentiment** — label (bullish|bearish|neutral|mixed) + one punchy sentence (indices + sector).

USER:

<analyzed_brief>
${JSON.stringify(analyzedBrief)}
</analyzed_brief>

<watch_history>
${JSON.stringify(watchItemHistory)}
</watch_history>

Voice mode: ${userVoicePreference}

REQUIRED OUTPUT FIELDS — do not omit any of these:
- voice_mode_applied: must be "${userVoicePreference}" (not "unknown")
- sign_off_style: must be one of "good_day", "volatile_day", "before_catalyst", "quiet_day", "friday", "monday" (not "unknown")
- watch_items_mentioned: array of events mentioned in the What to Watch section

These fields are required. Do not return "unknown" for any of them.

Write the audio script and metadata (summary, key_highlights, market_sentiment) now. Follow the METADATA section above — summary and key_highlights must be specific and actionable, not generic. Return valid JSON only.`;

  console.log(`📝 [Stage 3] Prompt length: ${prompt.length} chars`);
  if (prompt.length >= 12000) {
    console.warn(`⚠️ [Stage 3] Prompt exceeds 12K target (3B); consider trimming further.`);
  }
  return prompt;
}

const SCRIPTWRITER_OUTPUT_SCHEMA = {
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
    watch_items_mentioned: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          event: { type: "string" },
          date: { type: "string" },
          mention_type: { type: "string" },
        },
        required: ["event", "date", "mention_type"],
      },
    },
    sign_off_style: { type: "string" },
    voice_mode_applied: { type: "string" },
  },
  required: ["metadata", "script"],
};

// ── MULTI-STEP FINLIGHT QUERY CASCADE (per ticker) ──
// Step 1 (PRIMARY): Company name text search (resolveCompanyName — cached).
// Step 2: Company name + high-signal financial terms.
// Step 3 (supplement): ticker: field search. Results deduped across all steps.
async function fetchTickerNewsCascade(
  apiKey: string,
  ticker: string,
  nowMs: number
): Promise<{ articles: TickerNewsArticle[]; fallbacksUsed: string[] }> {
  const companyName = await resolveCompanyName(ticker);
  const aliasInfo = getCompanyAliases(ticker);
  const articles: TickerNewsArticle[] = [];
  const seenTitles: string[] = [];
  const fallbacksUsed: string[] = [];

  const addArticle = (raw: any, isSectorLevel: boolean): boolean => {
    const title = (raw.title || "").trim();
    if (!title || title.length < 10) return false;
    if (seenTitles.some((t) => isSimilarTitle(t, title))) return false;
    seenTitles.push(title);

    const summary = (raw.summary || raw.description || "").trim();
    const publishedAt = raw.publishDate
      ? new Date(raw.publishDate).toISOString()
      : new Date().toISOString();

    articles.push({
      id: `${ticker.toLowerCase()}_${simpleHash(raw.link || title)}`,
      title,
      summary,
      source: raw.source || "Unknown",
      published_at: publishedAt,
      age_hours: Math.round(((nowMs - new Date(publishedAt).getTime()) / (1000 * 60 * 60)) * 10) / 10,
      sentiment: raw.sentiment || "neutral",
      sentiment_confidence: raw.confidence ?? 0,
      is_sector_level: isSectorLevel,
      relevance_type: classifyRelevance(title, summary, ticker, isSectorLevel),
      href: raw.link || "#",
    });
    return true;
  };

  const from24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from48h = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Step 1 (PRIMARY): Company name text search — works for single-letter and mid-caps
  try {
    const step1 = await finlightQuery(apiKey, {
      query: `"${companyName}"`,
      from: from24h,
      pageSize: 10,
    });
    step1.forEach((a) => addArticle(a, false));
    if (step1.length > 0) console.log(`   [${ticker}] Step 1 (company name): ${step1.length} articles`);
  } catch (e: any) {
    console.warn(`   [${ticker}] Step 1 failed: ${e.message}`);
  }

  // Step 2: Company name + high-signal financial terms (48h)
  if (articles.length < MIN_ARTICLES_TARGET) {
    try {
      const nameQuery = `"${companyName}" AND ("earnings" OR "analyst" OR "upgrade" OR "downgrade" OR "price target" OR "revenue" OR "guidance")`;
      const step2 = await finlightQuery(apiKey, {
        query: nameQuery,
        from: from48h,
        pageSize: 10,
      });
      step2.forEach((a) => addArticle(a, false));
      if (step2.length > 0) console.log(`   [${ticker}] Step 2 (company + terms): ${step2.length} articles`);
    } catch (e: any) {
      console.warn(`   [${ticker}] Step 2 failed: ${e.message}`);
    }
  }

  // Step 3 (supplement): ticker-field search — catches articles tagged with symbol (e.g. mega-caps)
  try {
    const step3 = await finlightQuery(apiKey, {
      query: `ticker:${ticker}`,
      from: from48h,
      pageSize: 5,
    });
    step3.forEach((a) => addArticle(a, false));
    if (step3.length > 0) console.log(`   [${ticker}] Step 3 (ticker field): ${step3.length} articles`);
  } catch (e: any) {
    console.warn(`   [${ticker}] Step 3 failed: ${e.message}`);
  }

  // Step 4 (optional): Aliases — key people, products (only if still below target)
  if (articles.length < MIN_ARTICLES_TARGET && aliasInfo.aliases.length > 1) {
    try {
      const aliasQuery = aliasInfo.aliases
        .filter((a) => a !== aliasInfo.name && a !== companyName)
        .slice(0, 4)
        .map((a) => `"${a}"`)
        .join(" OR ");
      if (aliasQuery) {
        const step4 = await finlightQuery(apiKey, {
          query: aliasQuery,
          from: from48h,
          pageSize: 5,
        });
        step4.forEach((a) => addArticle(a, false));
        if (step4.length > 0) console.log(`   [${ticker}] Step 4 (aliases): ${step4.length} articles`);
      }
    } catch (e: any) {
      console.warn(`   [${ticker}] Step 4 failed: ${e.message}`);
    }
  }

  // ── FALLBACK CHAIN (runs until we hit MIN_ARTICLES_TARGET or exhaust all sources) ──
  if (articles.length < MIN_ARTICLES_TARGET) {
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY;
    console.log(`   [${ticker}] ${articles.length} articles after Finlight (target: ${MIN_ARTICLES_TARGET}), running fallbacks...`);

    // Fallback A: Finnhub company news (different sources than Finlight, 7-day window)
    if (articles.length < MIN_ARTICLES_TARGET) {
      try {
        const fromDate = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const toDate = new Date().toISOString().slice(0, 10);
        const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const newsItems = await resp.json();
          const items = Array.isArray(newsItems) ? newsItems.slice(0, 10) : [];
          let added = 0;
          for (const item of items) {
            const mapped = {
              title: item.headline || "",
              summary: item.summary || "",
              link: item.url || "#",
              source: item.source || "Finnhub",
              publishDate: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
            };
            if (addArticle(mapped, false)) added++;
          }
          if (added > 0) {
            console.log(`   [${ticker}] Fallback A (Finnhub company-news): +${added} articles (total: ${articles.length})`);
            fallbacksUsed.push("finnhub_company_news");
          }
        }
      } catch (e: any) {
        console.warn(`   [${ticker}] Fallback A failed: ${e.message}`);
      }
    }

    // Fallback B: MarketAux with FULL company name (72h window)
    if (articles.length < MIN_ARTICLES_TARGET) {
      const marketauxKey = Deno.env.get("MARKETAUX_API_KEY") ?? "";
      if (marketauxKey) {
        try {
          const mxArticles = await fetchMarketauxTickerNewsForBriefing(marketauxKey, ticker, 72);
          let added = 0;
          for (const a of mxArticles) {
            const mapped = {
              title: a.title || "",
              summary: a.what_happened || a.summary || "",
              link: a.href || "#",
              source: a.outlet || "Marketaux",
              publishDate: a.datetime || new Date().toISOString(),
            };
            if (addArticle(mapped, false)) added++;
          }
          if (added > 0) {
            console.log(`   [${ticker}] Fallback B (Marketaux): +${added} articles (total: ${articles.length})`);
            fallbacksUsed.push("marketaux");
          }
        } catch (e: any) {
          console.warn(`   [${ticker}] Fallback B failed: ${e.message}`);
        }
      }
    }

    // Fallback C: NewsAPI with company name (72h window)
    if (articles.length < MIN_ARTICLES_TARGET) {
      const newsApiKey = Deno.env.get("NEWSAPI_API_KEY") ?? "";
      if (newsApiKey) {
        try {
          const naArticles = await fetchNewsApiTickerNewsForBriefing(newsApiKey, ticker, 72, aliasInfo.name);
          let added = 0;
          for (const a of naArticles) {
            const mapped = {
              title: a.title || "",
              summary: a.summary || "",
              link: a.link || "#",
              source: a.source || "NewsAPI",
              publishDate: a.publishDate || new Date().toISOString(),
            };
            if (addArticle(mapped, false)) added++;
          }
          if (added > 0) {
            console.log(`   [${ticker}] Fallback C (NewsAPI): +${added} articles (total: ${articles.length})`);
            fallbacksUsed.push("newsapi");
          }
        } catch (e: any) {
          console.warn(`   [${ticker}] Fallback C failed: ${e.message}`);
        }
      }
    }

    // Fallback D: Sector-level news (use sector_terms from COMPANY_ALIASES)
    if (articles.length < MIN_ARTICLES_TARGET && aliasInfo.sector_terms.length > 0) {
      try {
        const sectorQ = aliasInfo.sector_terms.slice(0, 3).map((t) => `"${t}"`).join(" OR ");
        const sectorArticles = await finlightQuery(apiKey, {
          query: sectorQ,
          from: new Date(nowMs - 48 * 60 * 60 * 1000).toISOString().slice(0, 10),
          pageSize: 5,
        });
        let added = 0;
        for (const a of sectorArticles) {
          if (addArticle(a, true)) added++;
        }
        if (added > 0) {
          console.log(`   [${ticker}] Fallback D (sector-level): +${added} articles (total: ${articles.length})`);
          fallbacksUsed.push("sector_level_search");
        }
      } catch (e: any) {
        console.warn(`   [${ticker}] Fallback D failed: ${e.message}`);
      }
    }

    // Fallback E: Widen Finlight to 72h (re-run ticker search with wider window)
    if (articles.length < MIN_ARTICLES_TARGET) {
      try {
        const step1Wide = await finlightQuery(apiKey, {
          query: `ticker:${ticker}`,
          from: new Date(nowMs - 72 * 60 * 60 * 1000).toISOString().slice(0, 10),
          pageSize: 10,
        });
        let added = 0;
        for (const a of step1Wide) {
          if (addArticle(a, false)) added++;
        }
        if (added > 0) {
          console.log(`   [${ticker}] Fallback E (72h widen): +${added} articles (total: ${articles.length})`);
          fallbacksUsed.push("72h_widen");
        }
      } catch (e: any) {
        console.warn(`   [${ticker}] Fallback E failed: ${e.message}`);
      }
    }
  }

  return { articles, fallbacksUsed };
}

// Determine news_coverage level based on article relevance quality, not just count.
// "strong"   = 2+ direct articles (real company-specific news)
// "moderate"  = 1 direct article OR 3+ tangential articles
// "thin"      = only tangential or sector-level articles, no direct
// "none"      = zero articles of any kind
function assessNewsCoverage(articles: TickerNewsArticle[]): TickerPackage["news_coverage"] {
  const direct = articles.filter((a) => a.relevance_type === "direct");
  const tangential = articles.filter((a) => a.relevance_type === "tangential");
  if (direct.length >= 2) return "strong";
  if (direct.length >= 1 || tangential.length >= 3) return "moderate";
  if (articles.length >= 1) return "thin";
  return "none";
}

// Build one complete TickerPackage for a single holding
async function fetchTickerPackage(
  ticker: string,
  marketData: TickerMarketData,
): Promise<TickerPackage> {
  const finlightKey = Deno.env.get("FINLIGHT_API_KEY") || "";
  const nowMs = Date.now();
  const today = new Date();

  // Earnings date lookup is a Phase 2 feature — pass null for now
  const { depth, reason } = getDataDepth(today, null);

  console.log(`📦 [Stage 1C] ${ticker} (${marketData.company_name}): depth=${depth} — ${reason}`);

  // Fetch news via multi-step cascade + fallbacks
  let newsResult = { articles: [] as TickerNewsArticle[], fallbacksUsed: [] as string[] };
  if (finlightKey) {
    newsResult = await fetchTickerNewsCascade(finlightKey, ticker, nowMs);
  } else {
    console.warn(`   [${ticker}] No FINLIGHT_API_KEY — skipping news cascade`);
  }

  const coverage = assessNewsCoverage(newsResult.articles);

  console.log(
    `   [${ticker}] Result: ${newsResult.articles.length} articles, ` +
    `coverage=${coverage}, fallbacks=[${newsResult.fallbacksUsed.join(", ") || "none"}]`
  );

  return {
    ticker,
    company_name: marketData.company_name,
    data_depth: depth,
    data_depth_reason: reason,
    quote: marketData.quote,
    fundamentals: null,
    earnings: null,
    news_articles: newsResult.articles,
    news_coverage: coverage,
    fallback_sources_used: newsResult.fallbacksUsed,
    ticker_unsupported: marketData.ticker_unsupported,
  };
}

// Fetch ticker packages for ALL user holdings in parallel.
async function fetchAllTickerPackages(
  tickers: string[],
  tickerMarketMap: Record<string, TickerMarketData>
): Promise<TickerPackage[]> {
  if (!tickers || tickers.length === 0) return [];

  console.log(`\n📦 [Stage 1C] Building ticker packages for ${tickers.length} holdings...`);

  const packages = await Promise.all(
    tickers.map((t) => {
      const marketData = tickerMarketMap[t] || {
        ticker: t,
        company_name: t,
        quote: {
          current_price: null,
          change_pct: 0,
          change_dollar: 0,
          daily_high: null,
          daily_low: null,
          open: null,
          previous_close: null,
        },
        provider: "none" as const,
      };
      return fetchTickerPackage(t, marketData);
    })
  );

  const withNews = packages.filter((p) => p.news_coverage !== "none").length;
  console.log(`📦 [Stage 1C] Done: ${withNews}/${tickers.length} tickers have news coverage\n`);

  return packages;
}

// Portfolio Impact Gate: one batch LLM call to score all articles across all holdings for material impact.
const PORTFOLIO_IMPACT_GATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          impact_score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["id", "impact_score", "reason"],
      },
    },
  },
  required: ["evaluations"],
};

const PORTFOLIO_IMPACT_SUMMARY_MAX = 220;

/**
 * One batch LLM call: score every article across all ticker packages for material impact on that company.
 * On failure returns neutral 5 for all so articles still flow through.
 */
async function evaluatePortfolioNewsImpactBatch(
  base44: any,
  tickerPackages: TickerPackage[]
): Promise<Array<{ id: string; impact_score: number; reason: string }>> {
  const allArticles: Array<{ id: string; ticker: string; company_name: string; title: string; summary: string; source: string; age_hours: number; relevance_type: string }> = [];
  for (const pkg of tickerPackages) {
    for (const a of pkg.news_articles) {
      allArticles.push({
        id: a.id,
        ticker: pkg.ticker,
        company_name: pkg.company_name,
        title: (a.title || "").slice(0, 120),
        summary: (a.summary || "").slice(0, PORTFOLIO_IMPACT_SUMMARY_MAX),
        source: a.source || "",
        age_hours: Math.round((a.age_hours || 0) * 10) / 10,
        relevance_type: a.relevance_type || "tangential",
      });
    }
  }
  if (allArticles.length === 0) return [];

  const prompt = `You are a senior financial analyst at a hedge fund. Score each article below for MATERIAL IMPACT on the specific company it is associated with (ticker + company_name). Think: would this move the stock price or change investor sentiment?

SCORING (1-10, integer):
10: Fatal accidents involving products, massive fraud, CEO arrested, fleet grounded, bankruptcy.
8-9: Large lawsuits (class-action, wrongful death), FAA/SEC/DOJ actions, earnings miss/beat >15%, major M&A, product recall, large data breach.
7-8: Analyst upgrade/downgrade from top bank, meaningful contract win/loss, new product launch, regulatory scrutiny, notable guidance change, workforce reduction >5%.
4-6: Minor partnerships, industry trends with indirect impact, routine exec changes, competitor moves.
2-3: Passing mention in broader article, routine updates, analyst reiterations.
1: No meaningful connection to company.

CRITICAL: A lawsuit from a crash victim's family against the company is 8-9, NOT 2-3. A regulatory investigation is 7-9. When in doubt between two scores, choose the higher if it involves legal, safety, or regulatory risk.

Output one evaluation per article. "reason" = max 8 words.

Articles (each has id, ticker, company_name, title, summary, source, age_hours, relevance_type):
${JSON.stringify(allArticles)}

Return a single JSON object with key "evaluations": array of { id, impact_score (integer 1-10), reason } in the same order as the articles above.`;

  const startMs = Date.now();
  try {
    const result = await invokeLLM(base44, prompt, false, PORTFOLIO_IMPACT_GATE_SCHEMA);
    const evaluations: Array<{ id: string; impact_score: number; reason: string }> = result?.evaluations || [];
    const elapsed = Date.now() - startMs;
    const scores = evaluations.map((e) => e.impact_score);
    const min = scores.length ? Math.min(...scores) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    console.log(`📊 [Portfolio Impact Gate] ${allArticles.length} articles → ${evaluations.length} evals in ${elapsed}ms (min=${min} avg=${avg.toFixed(1)} max=${max})`);
    const highExample = evaluations.find((e) => e.impact_score >= 7);
    const lowExample = evaluations.find((e) => e.impact_score <= 3);
    if (highExample) console.log(`   high example: [${highExample.impact_score}] ${highExample.reason} (id=${highExample.id.slice(0, 20)}...)`);
    if (lowExample) console.log(`   low example: [${lowExample.impact_score}] ${lowExample.reason} (id=${lowExample.id.slice(0, 20)}...)`);
    return evaluations;
  } catch (err: any) {
    console.warn(`⚠️ [Portfolio Impact Gate] LLM failed (${err?.message ?? err}), using neutral score 5 for all`);
    return allArticles.map((a) => ({ id: a.id, impact_score: 5, reason: "gate fallback" }));
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};

    // Payload diagnostics (compact)
    console.log("🔍 [Payload] holdings:", JSON.stringify(preferences?.portfolio_holdings || preferences?.holdings));

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

      const scriptForTTS = numbersToSpokenForm(script);
      const audioFile = await generateAudioFile(scriptForTTS, date, elevenLabsApiKey);

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

    let voicePreferenceForLog = safeText(preferences?.preferred_voice, "professional");
    if (voicePreferenceForLog === "energetic") voicePreferenceForLog = "hybrid";
    console.log(`🧑 [Personalization] name="${name}" holdings=${JSON.stringify(prefProfile?.holdings)} voice="${voicePreferenceForLog}"`);

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

    /** Returns { isAbout, matchedTerm } if the story is about one of the user's portfolio companies.
     * Uses word-boundary matching to avoid false positives (e.g. "BA" in "global", "Obama").
     * Short tickers (≤3 chars) match only company name in free text; longer tickers match ticker or company name.
     * Finlight structured story.companies is checked first when present. */
    function isAboutPortfolioCompany(story: any): { isAbout: boolean; matchedTerm?: string } {
      if (earlyTickers.length === 0) return { isAbout: false };
      const title = (story.title || "").trim();
      const summary = (story.summary || story.what_happened || "").trim();
      const text = `${title} ${summary}`;
      const textLower = text.toLowerCase();

      // Structured company data from Finlight — most reliable
      if (story.companies && Array.isArray(story.companies)) {
        const articleTickers = story.companies
          .map((c: any) => (c.ticker || c.symbol || "").toUpperCase().trim())
          .filter(Boolean);
        for (const t of earlyTickers) {
          if (articleTickers.includes(t.toUpperCase())) return { isAbout: true, matchedTerm: `ticker ${t} (structured)` };
        }
      }

      for (const t of earlyTickers) {
        const tickerLower = t.toLowerCase();
        const fullNames = TICKER_TO_NAMES_BRIEFING[t] || [];
        if (t.length <= 3) {
          // Short ticker: match only company name in free text (avoid "BA" in "global", "Obama")
          for (const name of fullNames) {
            const nameRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
            if (nameRegex.test(title) || nameRegex.test(summary)) return { isAbout: true, matchedTerm: name };
          }
          // Also check entities for short tickers (structured)
          const entitiesLower: string[] = (story.entities || []).map((e: string) => String(e).toLowerCase());
          if (entitiesLower.some((e) => e === tickerLower || fullNames.some((n) => e.includes(n.toLowerCase())))) {
            return { isAbout: true, matchedTerm: `${t} (entities)` };
          }
        } else {
          // Longer ticker: word-boundary match on ticker or company name
          const tickerRegex = new RegExp(`\\b${escapeRegex(t)}\\b`, "i");
          if (tickerRegex.test(title) || tickerRegex.test(summary)) return { isAbout: true, matchedTerm: t };
          for (const name of fullNames) {
            const nameRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
            if (nameRegex.test(title) || nameRegex.test(summary)) return { isAbout: true, matchedTerm: name };
          }
        }
      }
      return { isAbout: false };
    }

    const rapidFireCandidates = [...scoredStories]
      .sort((a, b) => {
        if (a._seenToday !== b._seenToday) return a._seenToday ? 1 : -1; // prioritize unseen
        return b.breakingScore - a.breakingScore;
      })
      .filter((s) => hasFinancialRelevance(s))
      .filter((s) => {
        // Exclude portfolio company stories UNLESS they're truly headline-breaking
        const { isAbout, matchedTerm } = isAboutPortfolioCompany(s);
        if (isAbout) {
          if (s.breakingScore >= BREAKING_NEWS_OVERRIDE_THRESHOLD) {
            console.log(`   🔥 Portfolio company in rapid fire (override — score ${s.breakingScore}): "${(s.title || "").slice(0, 50)}"`);
            return true; // Genuinely major breaking news about a holding
          }
          console.log(`   ⛔ Filtered from rapid fire (portfolio overlap: matched "${matchedTerm ?? "portfolio"}" in "${(s.title || "").slice(0, 50)}")`);
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
        .filter((s: any) => !isAboutPortfolioCompany(s).isAbout) // Don't backfill with portfolio stories either
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

    // Pipeline timing — tracks total wall-clock for Stages 1A → 1D
    const pipelineStartMs = Date.now();

    // =========================================================
    // STAGE 1A + 1B + CALENDAR: Run in PARALLEL (independent data sources)
    // 1A: Finnhub per-ticker market data
    // 1B: Finlight macro/market news candidates
    // Calendar: earnings only (30d). Economic calendar is Finnhub premium — use static US calendar if needed.
    // =========================================================
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY;
    console.log(`\n⚡ [Stage 1A+1B+Calendar] Fetching market data, macro news, and earnings calendar in parallel...`);
    const [tickerMarketMap, macroCandidates, earningsCalendar] = await Promise.all([
      fetchAllTickerMarketData(briefingTickers),
      fetchMacroCandidates(userInterests),
      fetchEarningsCalendar(briefingTickers, finnhubKey),
    ]);

    console.log(`📊 [Stage 1A] Got market data for ${briefingTickers.length} holdings`);
    console.log(`📰 [Stage 1B] ${macroCandidates.length} macro candidates`);
    macroCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. [${c.source_query}] [${c.age_hours}h] ${c.title.slice(0, 65)}...`);
    });

    // =========================================================
    // STAGE 1C TEST: Build per-ticker data packages
    // Multi-step Finlight cascade + aggressive fallback chain.
    // This replaces the old single-query portfolio refresh.
    // TODO: Remove test log once pipeline integration is complete.
    // =========================================================
    const tickerPackagesRaw = await fetchAllTickerPackages(briefingTickers, tickerMarketMap);
    const skippedTickers = tickerPackagesRaw
      .filter((p) => p.ticker_unsupported && p.news_coverage === "none")
      .map((p) => p.ticker);
    const tickerPackages = tickerPackagesRaw.filter(
      (p) => !(p.ticker_unsupported && p.news_coverage === "none")
    );
    if (skippedTickers.length > 0) {
      console.log(`📋 [Stage 1D] Excluding unsupported tickers with no coverage: ${skippedTickers.join(", ")}`);
    }
    console.log(`📦 [Stage 1C] ${tickerPackages.length} ticker packages built`);
    for (const pkg of tickerPackages) {
      const directCount = pkg.news_articles.filter((a) => a.relevance_type === "direct").length;
      console.log(`   ${pkg.ticker}: coverage=${pkg.news_coverage}, articles=${pkg.news_articles.length} (${directCount} direct)`);
    }

    // =========================================================
    // PORTFOLIO IMPACT GATE: one batch LLM call to score all articles for material impact
    // =========================================================
    const totalArticles = tickerPackages.reduce((s, p) => s + p.news_articles.length, 0);
    if (totalArticles > 0) {
      const impactEvals = await evaluatePortfolioNewsImpactBatch(base44, tickerPackages);
      const evalMap = new Map(impactEvals.map((e) => [e.id, e]));
      for (const pkg of tickerPackages) {
        for (const article of pkg.news_articles) {
          const ev = evalMap.get(article.id);
          if (ev) {
            article.llm_impact_score = ev.impact_score;
            article.llm_impact_reason = ev.reason;
          }
        }
      }
    }

    // =========================================================
    // SMART GATE: LLM pre-screen macro candidates for market-moving relevance
    // =========================================================
    const gatedCandidates = await screenMacroCandidates(
      base44,
      macroCandidates,
      userInterests,
      briefingTickers
    );

    // =========================================================
    // STAGE 1D: Bundle into Raw Intelligence Package
    // Aggregates 1A (market data), 1B (macro news), 1C (ticker
    // packages) into a single object for Stage 2 consumption.
    // No new API calls — pure aggregation.
    // Fix 3A: Pre-filter to cap Stage 2 input size (smaller prompt → faster Analyst call).
    // =========================================================
    const userName = safeText(preferences?.user_name || user?.name, "");

    // Pre-filter 3A: macro — use gated candidates (Smart Gate output), then cap to N
    const macroForStage2 = gatedCandidates.slice(0, STAGE2_MACRO_CAP);
    if (gatedCandidates.length > STAGE2_MACRO_CAP) {
      console.log(`📉 [Stage 1D] Pre-filter (3A): macro candidates ${gatedCandidates.length} → ${macroForStage2.length} for Stage 2`);
    }

    // Pre-filter 3A: per-ticker articles — prefer LLM impact score (when present), then direct/tangential/sector, then recency; take top 5 per ticker
    const tickerPackagesForStage2 = tickerPackages.map((pkg) => {
      if (pkg.news_articles.length <= STAGE2_ARTICLES_PER_TICKER_CAP) return pkg;
      const relevanceRank = (a: TickerNewsArticle) =>
        a.relevance_type === "direct" ? 0 : a.relevance_type === "tangential" ? 1 : 2;
      const topArticles = [...pkg.news_articles]
        .sort((a, b) => {
          const scoreA = a.llm_impact_score ?? 0;
          const scoreB = b.llm_impact_score ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const rA = relevanceRank(a);
          const rB = relevanceRank(b);
          if (rA !== rB) return rA - rB;
          return a.age_hours - b.age_hours;
        })
        .slice(0, STAGE2_ARTICLES_PER_TICKER_CAP);
      return { ...pkg, news_articles: topArticles };
    });
    const totalBefore = tickerPackages.reduce((s, p) => s + p.news_articles.length, 0);
    const totalAfter = tickerPackagesForStage2.reduce((s, p) => s + p.news_articles.length, 0);
    if (totalBefore > totalAfter) {
      console.log(`📉 [Stage 1D] Pre-filter (3A): ticker articles ${totalBefore} → ${totalAfter} (max ${STAGE2_ARTICLES_PER_TICKER_CAP}/ticker) for Stage 2`);
    }

    const rawIntelligence = buildRawIntelligencePackage(
      tickerPackagesForStage2,
      macroForStage2,
      {
        user_name: userName,
        interests: userInterests,
        holdings: briefingTickers,
        time_zone: timeZone,
      },
      pipelineStartMs,
    );
    const economicCalendar = getUpcomingEconomicEvents();
    rawIntelligence.upcoming_events = {
      earnings: earningsCalendar,
      economic: economicCalendar,
    };

    const meta = rawIntelligence.metadata;
    console.log(`✅ [Stage 1D] Raw Intelligence: user="${userName}" interests=${userInterests.length} holdings=${briefingTickers.length} | tickers=${meta.ticker_count} (strong=${meta.tickers_with_strong_coverage} mod=${meta.tickers_with_moderate_coverage} thin=${meta.tickers_with_thin_coverage} none=${meta.tickers_with_no_coverage}) | macro=${meta.macro_candidate_count} | pipeline=${meta.pipeline_duration_ms}ms`);

    // =========================================================
    // STAGE 2: THE ANALYST DESK (LLM Call)
    // Analyzes the Raw Intelligence Package: selects stories,
    // extracts insights, flags data gaps, sets market energy.
    // Runs SIDE-BY-SIDE with existing script generation for now.
    // Stage 3 will consume this output to replace the combined prompt.
    // =========================================================
    // Await market snapshot before Stage 2 so we can inject today's index data into the analyst prompt (correct market_energy).
    console.log(`📈 [Stage 2] Fetching market snapshot for analyst prompt...`);
    const marketSnapshotForAnalyst = await fetchMarketSnapshot();
    const marketSnapshotPromise = Promise.resolve(marketSnapshotForAnalyst);

    let analyzedBrief: AnalyzedBrief | null = null;
    const analystStartMs = Date.now();
    try {
      // Fix 3C: Run macro and portfolio Analyst calls in parallel, then merge. Fall back to single call on failure.
      let parallelOk = false;
      try {
        console.log(`\n🧠 [Stage 2] Analyst Desk (3C parallel): macro + portfolio...`);
        const macroPrompt = buildAnalystPromptMacro(rawIntelligence, isWeekendDay, marketSnapshotForAnalyst);
        const portfolioPrompt = buildAnalystPromptPortfolio(rawIntelligence, isWeekendDay);
        const [macroResult, portfolioResult] = await Promise.all([
          invokeLLM(base44, macroPrompt, false, ANALYST_MACRO_SCHEMA),
          invokeLLM(base44, portfolioPrompt, false, ANALYST_PORTFOLIO_SCHEMA),
        ]);
        if (macroResult?.macro_selections && Array.isArray(portfolioResult?.portfolio_selections)) {
          const tickerPackages = rawIntelligence.ticker_packages || [];
          const returnedTickers = new Set((portfolioResult.portfolio_selections as PortfolioSelection[]).map((s) => s.ticker));
          let portfolioSelections: PortfolioSelection[] = [...(portfolioResult.portfolio_selections as PortfolioSelection[])];

          // One-per-holding safeguard: if LLM returns fewer selections than tickers (e.g. BA had articles but none company-specific), fill missing with market_data_only so every holding gets a segment.
          for (const pkg of tickerPackages) {
            if (returnedTickers.has(pkg.ticker)) continue;
            const q = pkg.quote;
            const changePct = q?.change_pct ?? 0;
            const price = q?.current_price ?? null;
            portfolioSelections.push({
              ticker: pkg.ticker,
              company_name: pkg.company_name,
              data_depth: pkg.data_depth,
              source_type: "market_data_only",
              source_id: null,
              hook: `Your ${pkg.company_name} position — ${price != null ? `$${price.toFixed(2)}` : "no quote"}${changePct !== 0 ? `, ${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}% today` : ""}.`,
              facts: price != null ? [`Current price: $${price.toFixed(2)}`, changePct !== 0 ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}% today` : "Flat today."].filter(Boolean) : ["No quote data available."],
              so_what: "No company-specific news in this run; keeping an eye on the position.",
              confidence: "low",
              quote_context: { current_price: price, change_today_pct: changePct },
              data_gap_note: "Insufficient company-specific news; using price data.",
              transition_suggestion: "Shifting to",
            });
            console.log(`   [Stage 2] Filled missing portfolio selection for ${pkg.ticker} (market_data_only).`);
          }

          analyzedBrief = {
            macro_selections: macroResult.macro_selections,
            market_energy: (macroResult.market_energy as MarketEnergy) || "quiet",
            watch_items: macroResult.watch_items ?? { primary: null, secondary: null },
            portfolio_selections: portfolioSelections,
            data_quality_flags: Array.isArray(portfolioResult.data_quality_flags) ? portfolioResult.data_quality_flags : [],
          };
          parallelOk = true;
          const analystMs = Date.now() - analystStartMs;
        console.log(`✅ [Stage 2] Parallel (3C) complete (${analystMs}ms)`);
        } else {
          console.warn(`⚠️ [Stage 2] Parallel (3C) returned invalid shape — falling back to single call.`);
        }
      } catch (parallelErr: any) {
        console.warn(`⚠️ [Stage 2] Parallel (3C) failed: ${parallelErr?.message}. Falling back to single Analyst call.`);
      }

      if (!analyzedBrief) {
        console.log(`\n🧠 [Stage 2] Analyst Desk: single-call analysis...`);
        const analystPrompt = buildAnalystPrompt(rawIntelligence, isWeekendDay, marketSnapshotForAnalyst);
        const analystResult = await invokeLLM(base44, analystPrompt, false, ANALYST_OUTPUT_SCHEMA);
        if (analystResult && analystResult.macro_selections) {
          analyzedBrief = analystResult as AnalyzedBrief;
        } else {
          console.warn(`⚠️ [Stage 2] Analyst returned unexpected format, skipping`);
        }
      }

      if (analyzedBrief) {
        const stage2Ms = Date.now() - analystStartMs;
        analyzedBrief.watch_items = analyzedBrief.watch_items ?? { primary: null, secondary: null };
        if (!analyzedBrief.market_energy) {
          const snap = await marketSnapshotPromise;
          const pcts = [snap.sp500_pct, snap.nasdaq_pct, snap.dow_pct].map(
            (p) => parseFloat((p || "0").replace(/[^-0-9.]/g, "")) || 0
          );
          const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
          const maxAbsPct = Math.max(...pcts.map(Math.abs));
          if (maxAbsPct > 1.5 && avg > 0) analyzedBrief.market_energy = "volatile_up";
          else if (maxAbsPct > 1.5 && avg < 0) analyzedBrief.market_energy = "volatile_down";
          else if (maxAbsPct > 0.8) analyzedBrief.market_energy = "mixed_calm";
          else analyzedBrief.market_energy = "quiet";
        }
        console.log(`✅ [Stage 2] Complete (${stage2Ms}ms) energy=${analyzedBrief.market_energy} macro=${analyzedBrief.macro_selections.length} portfolio=${analyzedBrief.portfolio_selections.length}`);
      }
    } catch (analystErr: any) {
      console.error(`❌ [Stage 2] Analyst Desk failed: ${analystErr.message}`);
      console.log(`   Continuing with existing script generation flow...`);
    }
    console.log(""); // blank line separator

    // =========================================================
    // STAGE 3: THE ANCHOR DESK (Scriptwriter)
    // If the Analyst Desk produced a valid analyzedBrief, use
    // the new Stage 3 Scriptwriter. Otherwise fall through to
    // the legacy combined prompt below as a safe fallback.
    // =========================================================
    if (analyzedBrief) {
      console.log(`\n✍️ [Stage 3] The Anchor Desk: generating script from Analyzed Brief...`);
      const stage3StartMs = Date.now();

      // ── Market Snapshot (pre-fetched during Stage 2 — zero extra wait) ──
      console.log("📈 [Stage 3] Awaiting pre-fetched market snapshot...");
      const rawMarketSnapshot3 = await marketSnapshotPromise;
      function humanizePct3(pct: string): string {
        const num = parseFloat(pct.replace(/[^-0-9.]/g, "")) || 0;
        if (Math.abs(num) < 0.05) return "flat";
        return pct;
      }
      const marketSnapshot3 = {
        ...rawMarketSnapshot3,
        sp500_pct: humanizePct3(rawMarketSnapshot3.sp500_pct),
        nasdaq_pct: humanizePct3(rawMarketSnapshot3.nasdaq_pct),
        dow_pct: humanizePct3(rawMarketSnapshot3.dow_pct),
      };
      console.log("✅ [Stage 3] Market snapshot:", marketSnapshot3);

      // ── Time / Date / Greeting ──
      const now3 = new Date();
      const { hour: hour3, dayOfWeek: dayOfWeek3, month: month3, day: day3 } = getZonedParts(timeZone, now3);
      let timeGreeting3 = "Good morning";
      if (hour3 >= 12 && hour3 < 17) timeGreeting3 = "Good afternoon";
      if (hour3 >= 17) timeGreeting3 = "Good evening";

      const isWeekend3 = dayOfWeek3 === 0 || dayOfWeek3 === 6;
      const isMonday3 = dayOfWeek3 === 1;
      const isFriday3 = dayOfWeek3 === 5;

      let holidayGreeting3: string | null = null;
      if (month3 === 1 && day3 === 1) holidayGreeting3 = "Happy New Year";
      if (month3 === 7 && day3 === 4) holidayGreeting3 = "Happy Fourth of July";
      if (month3 === 12 && day3 === 25) holidayGreeting3 = "Merry Christmas";
      if (month3 === 12 && day3 === 31) holidayGreeting3 = "Happy New Year's Eve";
      if (month3 === 11 && day3 >= 22 && day3 <= 28 && dayOfWeek3 === 4) holidayGreeting3 = "Happy Thanksgiving";
      if (month3 === 5 && dayOfWeek3 === 1 && day3 >= 25) holidayGreeting3 = "Happy Memorial Day";
      if (month3 === 9 && dayOfWeek3 === 1 && day3 <= 7) holidayGreeting3 = "Happy Labor Day";

      const userInterestsStr3 = userInterests.length > 0 ? userInterests.join(", ") : "general markets";
      const userHoldingsStr3 = userHoldings.length > 0
        ? userHoldings.map((h: any) => (typeof h === "string" ? h : h?.symbol)).filter(Boolean).join(", ")
        : "not specified";

      const dateObj3 = new Date(date);
      const monthNames3 = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const naturalDate3 = `${monthNames3[dateObj3.getMonth()]} ${dateObj3.getDate()}, ${dateObj3.getFullYear()}`;

      const dayNames3 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName3 = dayNames3[dayOfWeek3];

      // ── Briefing style (Voice Style in app): preferred_voice drives script tone; normalize legacy "energetic" → "hybrid" ──
      let userVoicePreference3 = safeText(preferences?.preferred_voice, "professional");
      if (userVoicePreference3 === "energetic") {
        userVoicePreference3 = "hybrid";
      }
      console.log(`🎤 [Voice] User preference: "${preferences?.preferred_voice ?? ""}" → normalized: "${userVoicePreference3}"`);

      // ── Build Scriptwriter Prompt + LLM (try/catch so 3B prompt or schema issues fall back to legacy, not 500) ──
      let scriptwriterResult: any = null;
      try {
        const scriptwriterPrompt = buildScriptwriterPrompt({
          analyzedBrief,
          name,
          naturalDate: naturalDate3,
          timeGreeting: timeGreeting3,
          holidayGreeting: holidayGreeting3,
          isWeekend: isWeekend3,
          isMonday: isMonday3,
          isFriday: isFriday3,
          userHoldingsStr: userHoldingsStr3,
          userSectorInterests: userInterests,
          marketSnapshot: marketSnapshot3,
          userVoicePreference: userVoicePreference3,
          dayName: dayName3,
          skipped_tickers: skippedTickers,
        });

        console.log(`📝 [Stage 3] Scriptwriter prompt built (voice=${userVoicePreference3}, weekend=${isWeekend3}) — ${analyzedBrief.macro_selections.length} macro, ${analyzedBrief.portfolio_selections.length} portfolio`);

        scriptwriterResult = await invokeLLM(base44, scriptwriterPrompt, false, SCRIPTWRITER_OUTPUT_SCHEMA);
      } catch (stage3LLMErr: any) {
        console.error(`❌ [Stage 3] Scriptwriter LLM failed (falling back to legacy):`, stage3LLMErr?.message ?? stage3LLMErr);
        scriptwriterResult = null;
      }

      // ── Fix 3 Step C: validate required output fields; fallback if LLM returned "unknown"
      if (scriptwriterResult) {
        if (scriptwriterResult.voice_mode_applied === "unknown" || !scriptwriterResult.voice_mode_applied) {
          console.warn("⚠️ [Stage 3] voice_mode_applied came back as unknown — prompt injection may have failed");
          scriptwriterResult.voice_mode_applied = userVoicePreference3;
        }
        if (scriptwriterResult.sign_off_style === "unknown" || !scriptwriterResult.sign_off_style) {
          console.warn("⚠️ [Stage 3] sign_off_style came back as unknown");
        }
      }

      // ── Post-process script ──
      let script3 = sanitizeForAudio(scriptwriterResult?.script || "");
      script3 = replaceTickersWithCompanyNames(script3, userHoldings);
      const wc3 = wordCount(script3);
      const estimatedMinutes3 = Math.max(1, Math.round(wc3 / 150));

      const uiSummary3 = safeText(scriptwriterResult?.metadata?.summary, "");
      const uiHighlights3 = Array.isArray(scriptwriterResult?.metadata?.key_highlights)
        ? scriptwriterResult.metadata.key_highlights.map((x: any) => safeText(x, "")).filter(Boolean)
        : [];
      const uiSentiment3 = scriptwriterResult?.metadata?.market_sentiment || { label: "neutral", description: "" };

      const stage3Ms = Date.now() - stage3StartMs;
      const watchItems = scriptwriterResult?.watch_items_mentioned || [];
      console.log(`✅ [Stage 3] Scriptwriter complete (${stage3Ms}ms) — ${wc3} words (~${estimatedMinutes3} min) voice=${scriptwriterResult?.voice_mode_applied || "?"} sign_off=${scriptwriterResult?.sign_off_style || "?"} highlights=${uiHighlights3.length} sentiment=${uiSentiment3.label}`);
      watchItems.slice(0, 2).forEach((w: any) => console.log(`   watch_item: ${w.event} (${w.date}) [${w.mention_type}]`));

      // ── Word count guard (also catches null result from failed LLM) ──
      if (!scriptwriterResult || wc3 < 50) {
        if (!scriptwriterResult) console.error(`❌ [Stage 3] No scriptwriter result (LLM failed or null). Falling through to legacy prompt.`);
        else console.error(`❌ [Stage 3] Script too short (${wc3} words). Falling through to legacy prompt.`);
      } else {
        // ── Build UI stories from Analyzed Brief ──
        const allowedCats3 = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);
        const truncateTitle3 = (text: any, maxLen: number) => {
          const clean = safeText(text, "");
          if (clean.length <= maxLen) return clean;
          return clean.substring(0, maxLen - 3) + "...";
        };

        const macroStories3 = analyzedBrief.macro_selections.map((sel: MacroSelection, i: number) => ({
          id: sel.source_id || `macro-${i}`,
          href: "#",
          imageUrl: categoryImageUrl("markets"),
          title: truncateTitle3(sel.hook, 80),
          what_happened: sel.facts.join(". "),
          why_it_matters: sel.so_what,
          both_sides: { side_a: sel.so_what, side_b: "" },
          outlet: sel.source_query || "Market News",
          category: "markets" as string,
          datetime: null,
          ageHours: null,
          isRapidFire: true,
          breakingScore: 0,
          relevanceScore: sel.confidence === "high" ? 100 : sel.confidence === "medium" ? 70 : 40,
        }));

        const portfolioStories3 = analyzedBrief.portfolio_selections.map((sel: PortfolioSelection, i: number) => {
          const rawCat = "default";
          const category = allowedCats3.has(rawCat) ? rawCat : "default";
          return {
            id: sel.source_id || `portfolio-${sel.ticker}-${i}`,
            href: "#",
            imageUrl: categoryImageUrl(category),
            title: truncateTitle3(sel.hook, 80),
            what_happened: sel.facts.join(". "),
            why_it_matters: sel.so_what,
            both_sides: { side_a: sel.so_what, side_b: "" },
            outlet: sel.company_name,
            category,
            datetime: null,
            ageHours: null,
            isRapidFire: false,
            breakingScore: 0,
            relevanceScore: sel.confidence === "high" ? 100 : sel.confidence === "medium" ? 70 : 40,
          };
        });

        const allStories3 = [...macroStories3, ...portfolioStories3];

        console.log(`📋 [Stage 3] Built ${allStories3.length} UI cards (${macroStories3.length} macro + ${portfolioStories3.length} portfolio)`);

        // ── Save briefing ──
        const deliveredAtNow3 = new Date().toISOString();
        const baseRecord3 = {
          date,
          created_by: userEmail,
          script: script3,
          summary: uiSummary3,
          market_sentiment: uiSentiment3,
          key_highlights: uiHighlights3,
          news_stories: allStories3,
          duration_minutes: estimatedMinutes3,
          status: skipAudio ? "script_ready" : "writing_script",
          audio_url: null,
          time_zone: timeZone,
          delivered_at: skipAudio ? deliveredAtNow3 : null,
        };

        const saved3 = await base44.entities.DailyBriefing.create(baseRecord3);

        console.log(`🔍 [Stage 3] Created briefing ${saved3.id}: ${wc3} words, ${allStories3.length} stories`);

        // ── Save Briefing Memory & Story Tracker (blocking: await before response so isolate doesn't exit) ──
        console.log("💾 [Memory] Saving briefing memory...");
        try {
          await base44.asServiceRole.functions.invoke("briefingMemory", {
            userId: userEmail,
            briefingDate: date,
            analyzedBrief,
            tickerMarketMap,
            scriptwriterResult,
          });
        } catch (memoryErr: any) {
          console.error("⚠️ [Memory] Failed:", memoryErr?.message, memoryErr?.stack ?? memoryErr);
        }

        if (skipAudio) {
          return Response.json({
            success: true,
            briefing: saved3,
            wordCount: wc3,
            estimatedMinutes: estimatedMinutes3,
            status: "script_ready",
          });
        }

        // ── Async audio generation ──
        console.log("✅ [Stage 3] Starting async audio generation...");
        generateAudioAsync(base44, saved3.id, script3, date, elevenLabsApiKey, timeZone).catch((error) => {
          console.error("❌ Async audio generation failed:", error);
          base44.asServiceRole.entities.DailyBriefing.update(saved3.id, {
            status: "failed",
          }).catch(console.error);
        });

        return Response.json({
          success: true,
          briefing: saved3,
          wordCount: wc3,
          estimatedMinutes: estimatedMinutes3,
          status: "writing_script",
          message: "Hang Tight! We're writing your briefing script...",
        });
      }
    }

    // =========================================================
    // FALLBACK: Legacy combined prompt flow
    // Only reached if Stage 2 failed (analyzedBrief is null)
    // or Stage 3 produced a too-short script.
    // =========================================================
    console.log(`\n📋 [Fallback] Using legacy combined prompt (analyzedBrief=${!!analyzedBrief})`);

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

    // Story matching skipped in legacy fallback — using pre-selected stories directly

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

    console.log(`🔍 [Legacy] Created briefing ${saved.id}: status=${saved.status}`);

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

    // Convert numbers/currency to spoken form for TTS only; transcript (script in DB) stays numeric
    const scriptForTTS = numbersToSpokenForm(script);
    const audioFile = await generateAudioFile(scriptForTTS, date, elevenLabsApiKey);
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