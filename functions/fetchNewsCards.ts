// ============================================================
// fetchNewsCards.ts - Base44 Function (v5 - Ticker-Personalized)
// STRATEGY: Ticker-specific news via Finlight → UserNewsCache (3h TTL)
//           Falls back to category-based NewsCardCache if ticker fetch fails
// Uses 0 LLM credits. Per-ticker Finlight calls when UserNewsCache is stale.
// Returns: { market_news, portfolio_news }
// MANUALLY REDEPLOY V2 TO INJECT API!! 
// PORTFOLIO vs MARKET/BREAKING NEWS (different sources):
// - market_news: from NewsCardCache (MARKET_*) / NewsCache — general market/breaking.
// - portfolio_news: from UserNewsCache (Finlight ticker:AAPL|GOOGL|...) — holdings-specific.
//
// SHARED TICKER CACHE: TickerNewsCache (per-ticker, shared across users). Create in Base44:
//   - ticker: string (e.g. "AAPL")
//   - stories: string (JSON array of raw Finlight articles)
//   - fetched_at: string (ISO date). TTL 3h; Finlight only called when stale or force_refresh.
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function safeText(input: unknown, fallback: string = ""): string {
  const s = typeof input === "string" ? input.trim() : "";
  return s || fallback;
}

function getTimeVariant(): string {
  const hour = new Date().getUTCHours();
  // Adjust for US Eastern (UTC-5 or UTC-4 DST)
  const etHour = (hour - 5 + 24) % 24;

  if (etHour >= 4 && etHour < 12) return "MORNING";
  if (etHour >= 12 && etHour < 18) return "AFTERNOON";
  return "EVENING";
}

// Filter junk when serving fallback (raw NewsCache) so we never show blog thank-yous or low-quality sources
function isJunkStory(story: any): boolean {
  const href = (story.href || story.url || "").toLowerCase();
  const outlet = (story.outlet || story.source || "").toLowerCase();
  const title = (story.title || "").toLowerCase();
  const body = (story.what_happened || story.summary || "").toLowerCase();
  const combined = `${title} ${body}`.slice(0, 600);

  if (/blogspot|wordpress\.com|tumblr\.com|patreon|ko-fi|substack\.com\/thank/i.test(href) || /blogspot|wordpress|tumblr|patreon|ko-fi/i.test(outlet)) {
    return true;
  }
  if (/thank\s+you\s+for\s+(your\s+)?(superbly\s+)?(generous\s+)?subscription/i.test(combined)) return true;
  if (/thank\s+you\s+.*\s+subscription\s+to\s+this\s+site/i.test(combined)) return true;
  if (/greatly\s+honored\s+by\s+your\s+support/i.test(combined)) return true;
  if (/^\s*thank\s+you[,.]/i.test(combined)) return true;

  return false;
}

// ============================================================
// PORTFOLIO CATEGORY DETECTION
// ============================================================

const TECH_TICKERS = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "INTC", "AMD", "CRM", "ORCL", "ADBE", "CSCO"];
const GROWTH_TICKERS = ["TSLA", "SHOP", "SQ", "ABNB", "UBER", "LYFT", "PLTR", "SNOW", "RBLX", "DKNG", "HOOD", "RIVN", "LCID", "SOFI"];
const ENERGY_TICKERS = ["XLE", "CVX", "XOM", "COP", "SLB", "OXY", "HAL", "MPC", "PSX", "VLO", "EOG", "PXD"];
const CRYPTO_TICKERS = ["COIN", "MARA", "RIOT", "MSTR", "CLSK", "HUT", "BITF", "HIVE"];

function classifyHolding(ticker: string): string {
  const t = ticker.toUpperCase();
  if (TECH_TICKERS.includes(t)) return "TECH";
  if (GROWTH_TICKERS.includes(t)) return "GROWTH";
  if (ENERGY_TICKERS.includes(t)) return "ENERGY";
  if (CRYPTO_TICKERS.includes(t)) return "CRYPTO";
  return "MIXED";
}

function determineUserPortfolioCategory(holdings: any[]): string {
  if (!holdings || holdings.length === 0) return "MIXED";

  const categoryCounts: Record<string, number> = {
    TECH: 0,
    GROWTH: 0,
    ENERGY: 0,
    CRYPTO: 0,
    MIXED: 0,
  };

  for (const holding of holdings) {
    const ticker = typeof holding === "string" ? holding : holding?.symbol || holding?.ticker || "";
    if (!ticker) continue;

    // Check if holding already has a portfolio_category field
    const existingCategory = holding?.portfolio_category;
    if (existingCategory && categoryCounts[existingCategory] !== undefined) {
      categoryCounts[existingCategory]++;
    } else {
      // Classify based on ticker
      const category = classifyHolding(ticker);
      categoryCounts[category]++;
    }
  }

  // Crypto gets priority if user has 2+ crypto holdings (they're probably a crypto investor)
  if (categoryCounts.CRYPTO >= 2) return "CRYPTO";

  // Otherwise return the most common category
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0] || "MIXED";
}

// ============================================================
// TICKER-SPECIFIC NEWS (Finlight API)
// ============================================================

const FINLIGHT_API_BASE = "https://api.finlight.me";
const USER_CACHE_TTL_HOURS = 3;
const MARKETAUX_API_BASE = "https://api.marketaux.com/v1/news/all";
const NEWSAPI_API_BASE = "https://newsapi.org/v2/everything";

function randomId(): string {
  try { return crypto.randomUUID(); }
  catch { return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
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

function extractTickers(holdings: any[]): string[] {
  if (!holdings || !Array.isArray(holdings)) return [];
  return holdings
    .map((h: any) => {
      if (typeof h === "string") return h.toUpperCase().trim();
      return (h?.symbol || h?.ticker || "").toUpperCase().trim();
    })
    .filter(Boolean);
}

function getDateFromHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const TICKER_CATEGORY_KEYWORDS: Record<string, string[]> = {
  markets: ["stock", "market", "trading", "wall street", "nasdaq", "dow", "s&p", "equity", "index"],
  crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "nft", "defi", "web3"],
  economy: ["fed", "interest rate", "inflation", "gdp", "unemployment", "economy", "recession"],
  technology: ["tech", "ai", "software", "chip", "semiconductor", "saas", "cloud"],
  "real estate": ["housing", "real estate", "mortgage", "property", "reits"],
  commodities: ["oil", "gold", "silver", "commodity", "energy", "natural gas"],
};

function categorizeByKeywords(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  for (const [category, keywords] of Object.entries(TICKER_CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return category;
  }
  return "markets";
}

function categoryImageUrl(categoryRaw: string): string {
  const cat = safeText(categoryRaw, "default").toLowerCase();
  const map: Record<string, string> = {
    markets: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=70",
    crypto: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=70",
    economy: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
    technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=70",
    "real estate": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=70",
    commodities: "https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?auto=format&fit=crop&w=1200&q=70",
    default: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=70",
  };
  return map[cat] || map.default;
}

function sentimentToScore(sentiment: string | undefined, confidence: number | undefined): number {
  const c = Math.max(0, Math.min(1, confidence || 0));
  if (sentiment === "positive") return c * 0.5;
  if (sentiment === "negative") return -c * 0.5;
  return 0;
}

function getCategoryMessage(category: string): string {
  const messages: Record<string, string> = {
    markets: "Could impact portfolio performance and market sentiment.",
    crypto: "May signal shifts in digital asset valuations.",
    economy: "Affects broader market conditions and strategies.",
    technology: "Could influence tech sector valuations.",
    "real estate": "May impact real estate investments.",
    commodities: "Could affect commodity prices and hedging.",
  };
  return messages[category] || "Worth monitoring for portfolio implications.";
}

/** Company names for text matching (title/summary) so we surface obviously relevant stories first. */
const TICKER_TO_NAMES: Record<string, string[]> = {
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
};

function storyRelevanceToTickers(story: any, userTickers: string[]): number {
  const text = `${story.title || ""} ${story.what_happened || ""}`.toLowerCase();
  if (story.matched_tickers && story.matched_tickers.length > 0) return 100;
  let score = 0;
  for (const ticker of userTickers) {
    if (text.includes(ticker.toLowerCase())) score += 50;
    const names = TICKER_TO_NAMES[ticker] || [ticker.toLowerCase()];
    if (names.some((n) => text.includes(n))) score += 40;
  }
  return score;
}

/** Prefer tier-1 outlets when relevance is tied (no LLM, just sort). */
const PREMIUM_OUTLETS = ["bloomberg", "reuters", "financial times", "ft.com", "wsj", "wall street journal", "cnbc", "ap news", "associated press"];
function sourceQualityScore(outlet: string): number {
  const o = (outlet || "").toLowerCase();
  return PREMIUM_OUTLETS.some((p) => o.includes(p)) ? 10 : 0;
}

/** Down-rank generic roundups / vague headlines so specific stories surface first. */
const ROUNDUP_PENALTY = 35;
const ROUNDUP_TITLE_PATTERNS = [
  "the week in",
  "week in review",
  "breakingviews",
  "weekend round-up",
  "weekend roundup",
  "round-up:",
  "roundup:",
  "morning roundup",
  "week in",
  "and more:",
  "shooting for the moon", // vague editorial headline
];
function roundupPenalty(story: any): number {
  const title = (story.title || "").toLowerCase();
  return ROUNDUP_TITLE_PATTERNS.some((p) => title.includes(p)) ? ROUNDUP_PENALTY : 0;
}

function transformFinlightArticle(article: any, userTickers: string[]): any {
  const title = (article.title || "Breaking News").trim();
  const summary = (article.summary || "").trim();
  const category = categorizeByKeywords(title, summary);

  // Match article's company tickers against user's holdings
  const articleTickers: string[] = (article.companies || [])
    .map((c: any) => (c.ticker || "").toUpperCase())
    .filter(Boolean);
  const matchedTickers = articleTickers.filter((t: string) => userTickers.includes(t));

  // Build personalized "why it matters" without LLM
  let whyItMatters = "";
  if (matchedTickers.length > 0) {
    whyItMatters = `Directly relevant to your holding${matchedTickers.length > 1 ? "s" : ""}: ${matchedTickers.join(", ")}. `;
  }
  whyItMatters += getCategoryMessage(category);

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
    topics: [],
    sentiment_score: sentimentToScore(article.sentiment, article.confidence),
    matched_tickers: matchedTickers,
  };
}

function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const aWords = new Set(normalize(a).split(" ").filter(w => w.length > 3));
  const bWords = new Set(normalize(b).split(" ").filter(w => w.length > 3));
  if (aWords.size < 3 || bWords.size < 3) return false;
  let overlap = 0;
  for (const w of aWords) { if (bWords.has(w)) overlap++; }
  return overlap / Math.min(aWords.size, bWords.size) > 0.5;
}

/** 24h on weekdays, 48h on weekends (more coverage when markets are closed). */
function getTickerNewsWindowHours(): number {
  const day = new Date().getUTCDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6 ? 48 : 24;
}

/**
 * Fetch ticker news from Finlight for one or more tickers.
 * @param hoursAgo - 24 weekdays, 48 weekends (call getTickerNewsWindowHours()).
 */
async function fetchFinlightTickerNews(
  apiKey: string,
  tickers: string[],
  options: { hoursAgo: number; pageSize?: number } = { hoursAgo: 24, pageSize: 25 }
): Promise<any[]> {
  const { hoursAgo, pageSize = 25 } = options;
  const tickerQuery = tickers.map((t) => `ticker:${t}`).join(" OR ");
  const fromDate = getDateFromHoursAgo(hoursAgo);
  const toDate = new Date().toISOString().slice(0, 10);

  console.log(`🔍 Finlight ticker query: ${tickerQuery} (${hoursAgo}h window, pageSize ${pageSize})`);

  const response = await fetch(`${FINLIGHT_API_BASE}/v2/articles`, {
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
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Finlight ticker query failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const articles = data.articles || [];
  console.log(`✅ Finlight returned ${articles.length} ticker-specific articles`);
  return articles;
}

function fallbackImportanceScore(article: any, ticker: string): number {
  const title = (article?.title || "").toLowerCase();
  const summary = (article?.summary || "").toLowerCase();
  const text = `${title} ${summary}`;
  const outlet = (article?.source || article?.outlet || "").toLowerCase();
  const ts = new Date(article?.publishDate || article?.published_at || 0).getTime();
  const ageHours = ts > 0 ? (Date.now() - ts) / (1000 * 60 * 60) : 72;

  let score = 0;
  if (text.includes(ticker.toLowerCase())) score += 60;
  const names = TICKER_TO_NAMES[ticker] || [];
  if (names.some((n) => text.includes(n))) score += 45;

  const highSignal = [
    "earnings", "revenue", "guidance", "profit", "forecast",
    "merger", "acquisition", "deal", "takeover",
    "downgrade", "upgrade", "rating", "target",
    "sec", "regulator", "lawsuit", "antitrust", "investigation",
    "ceo", "cfo", "buyback", "dividend",
  ];
  if (highSignal.some((k) => text.includes(k))) score += 25;

  score += sourceQualityScore(outlet) * 2;

  if (ageHours <= 6) score += 25;
  else if (ageHours <= 24) score += 15;
  else if (ageHours <= 48) score += 8;

  return score;
}

async function fetchMarketauxTickerNews(
  apiKey: string,
  ticker: string,
  hoursAgo: number
): Promise<any[]> {
  const publishedAfter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
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
    const companies = entities
      .map((e: any) => ({ ticker: safeText(e?.symbol || e?.ticker, "").toUpperCase() }))
      .filter((e: any) => e.ticker);
    if (!companies.some((c: any) => c.ticker === ticker)) companies.push({ ticker });

    return {
      title: safeText(row?.title, "Breaking News"),
      summary: safeText(row?.description || row?.snippet, ""),
      link: safeText(row?.url, "#"),
      images: row?.image_url ? [row.image_url] : [],
      source: safeText(row?.source || row?.source_name || row?.domain, "Marketaux"),
      publishDate: safeText(row?.published_at || row?.publishedAt, new Date().toISOString()),
      sentiment: safeText(row?.sentiment, ""),
      confidence: 0.6,
      companies,
      _provider: "marketaux",
    };
  });
}

async function fetchNewsApiTickerNews(
  apiKey: string,
  ticker: string,
  hoursAgo: number
): Promise<any[]> {
  const from = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const names = TICKER_TO_NAMES[ticker] || [];
  const nameClause = names.length > 0 ? names.map((n) => `"${n}"`).join(" OR ") : "";
  const query = nameClause ? `("${ticker}" OR ${nameClause})` : `"${ticker}"`;

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
    title: safeText(row?.title, "Breaking News"),
    summary: safeText(row?.description || row?.content, ""),
    link: safeText(row?.url, "#"),
    images: row?.urlToImage ? [row.urlToImage] : [],
    source: safeText(row?.source?.name, "NewsAPI"),
    publishDate: safeText(row?.publishedAt, new Date().toISOString()),
    sentiment: "",
    confidence: 0.5,
    companies: [{ ticker }],
    _provider: "newsapi",
  }));
}

async function fetchFallbackTickerNews(
  ticker: string,
  hoursAgo: number,
  marketauxKey: string,
  newsApiKey: string
): Promise<any[]> {
  let candidates: any[] = [];

  if (marketauxKey) {
    try {
      const marketaux = await fetchMarketauxTickerNews(marketauxKey, ticker, hoursAgo);
      if (marketaux.length > 0) {
        candidates = marketaux;
        console.log(`🟡 Fallback Marketaux returned ${marketaux.length} for ${ticker}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Marketaux fallback failed for ${ticker}: ${e.message}`);
    }
  }

  if (candidates.length === 0 && newsApiKey) {
    try {
      const newsapi = await fetchNewsApiTickerNews(newsApiKey, ticker, hoursAgo);
      if (newsapi.length > 0) {
        candidates = newsapi;
        console.log(`🟠 Fallback NewsAPI returned ${newsapi.length} for ${ticker}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ NewsAPI fallback failed for ${ticker}: ${e.message}`);
    }
  }

  // Requirement: for fallback providers, keep only 1-2 most important stories per ticker.
  const top = candidates
    .sort((a, b) => fallbackImportanceScore(b, ticker) - fallbackImportanceScore(a, ticker))
    .slice(0, 2);

  return top;
}

/** Max tickers to query (5 articles each) per user — limits Finlight API calls. */
const MAX_TICKERS_FOR_FETCH = 5;
const ARTICLES_PER_TICKER = 20;

/**
 * Fetch 5 articles per ticker, combine, dedupe by link, sort by publishDate DESC.
 * Gives a mix of different ticker news ranked by recency (importance).
 */
async function fetchFinlightTickerNewsPerTicker(
  apiKey: string,
  userTickers: string[],
  hoursAgo: number
): Promise<any[]> {
  const tickersToFetch = userTickers.slice(0, MAX_TICKERS_FOR_FETCH);
  const allArticles: any[] = [];

  for (const ticker of tickersToFetch) {
    try {
      const articles = await fetchFinlightTickerNews(apiKey, [ticker], {
        hoursAgo,
        pageSize: ARTICLES_PER_TICKER,
      });
      for (const a of articles) allArticles.push({ ...a, _fetchedForTicker: ticker });
    } catch (e: any) {
      console.warn(`⚠️ Finlight fetch for ${ticker} failed: ${e.message}`);
    }
  }

  const seen = new Set<string>();
  const deduped = allArticles.filter((a) => {
    const key = (a.link || a.title || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const tA = new Date(a.publishDate || 0).getTime();
    const tB = new Date(b.publishDate || 0).getTime();
    return tB - tA;
  });

  console.log(`✅ Combined ${deduped.length} articles (${ARTICLES_PER_TICKER} per ticker, deduped, sorted by date)`);
  return deduped;
}

/** TTL for shared TickerNewsCache (per-ticker). Same as user cache. */
const TICKER_CACHE_TTL_HOURS = 3;

/**
 * Get portfolio articles using SHARED ticker-level cache so users with the same
 * tickers (e.g. 4 users with AAPL) share cached Apple news. Finlight is only
 * called when a ticker has no fresh cache or when user force_refresh.
 * Returns raw Finlight-style articles (merge + dedupe + sort by caller).
 */
async function getTickerNewsWithSharedCache(
  base44: any,
  finlightApiKey: string,
  marketauxApiKey: string,
  newsApiKey: string,
  userTickers: string[],
  forceRefresh: boolean
): Promise<any[]> {
  const hoursAgo = getTickerNewsWindowHours();
  const tickersToUse = userTickers.slice(0, MAX_TICKERS_FOR_FETCH);
  const allArticles: any[] = [];

  for (const ticker of tickersToUse) {
    let articles: any[] = [];
    let fromCache = false;

    if (!forceRefresh) {
      try {
        const entries = await base44.asServiceRole.entities.TickerNewsCache.filter({ ticker });
        if (entries && entries.length > 0) {
          const latest = entries.sort(
            (a: any, b: any) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
          )[0];
          const ageHours = (Date.now() - new Date(latest.fetched_at).getTime()) / (1000 * 60 * 60);
          if (ageHours < TICKER_CACHE_TTL_HOURS) {
            articles = typeof latest.stories === "string" ? JSON.parse(latest.stories) : (latest.stories || []);
            fromCache = true;
          }
        }
      } catch (e: any) {
        // TickerNewsCache may not exist yet
      }
    }

    if (!fromCache && articles.length === 0) {
      if (finlightApiKey) {
        try {
          articles = await fetchFinlightTickerNews(finlightApiKey, [ticker], {
            hoursAgo,
            pageSize: ARTICLES_PER_TICKER,
          });
        } catch (e: any) {
          console.warn(`⚠️ Finlight fetch for ${ticker} failed: ${e.message}`);
        }
      }

      // Finlight returned no ticker coverage -> fallback to broader providers.
      if (articles.length === 0) {
        const fallback = await fetchFallbackTickerNews(ticker, hoursAgo, marketauxApiKey, newsApiKey);
        if (fallback.length > 0) {
          articles = fallback;
          console.log(`✅ Using fallback coverage for ${ticker}: ${fallback.length} top stories`);
        }
      }

      if (articles.length > 0 && !forceRefresh) {
        // Only write to shared cache when filling a miss or TTL expiry — NOT on force_refresh.
        // Otherwise one user constantly refreshing would overwrite cache; others might not have seen older news yet.
        try {
          const old = await base44.asServiceRole.entities.TickerNewsCache.filter({ ticker });
          for (const o of old) await base44.asServiceRole.entities.TickerNewsCache.delete(o.id);
          await base44.asServiceRole.entities.TickerNewsCache.create({
            ticker,
            stories: JSON.stringify(articles),
            fetched_at: new Date().toISOString(),
          });
          console.log(`💾 Cached ${articles.length} articles for ticker ${ticker} (shared)`);
        } catch (e: any) {
          console.warn(`⚠️ TickerNewsCache write failed for ${ticker}: ${e.message}`);
        }
      } else if (articles.length > 0 && forceRefresh) {
        console.log(`🔄 Fresh fetch for ${ticker} (force_refresh); not updating shared cache`);
      }
    }

    for (const a of articles) allArticles.push({ ...a, _fetchedForTicker: ticker });
  }

  const seen = new Set<string>();
  const deduped = allArticles.filter((a: any) => {
    const key = (a.link || a.title || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a: any, b: any) => {
    const tA = new Date(a.publishDate || 0).getTime();
    const tB = new Date(b.publishDate || 0).getTime();
    return tB - tA;
  });

  return deduped;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  try {
    console.log("📰 [fetchNewsCards] Function started (v5 - Ticker-Personalized)");

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences || {};
    const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];
    const forceRefresh = Boolean(body?.force_refresh);

    const timeVariant = getTimeVariant();
    const portfolioCategory = determineUserPortfolioCategory(userHoldings);

    console.log(`⏰ Time variant: ${timeVariant}`);
    console.log(`📊 User portfolio category: ${portfolioCategory}`);
    console.log(`📈 User holdings: ${userHoldings.length} items`);

    // =========================================================
    // FETCH MARKET NEWS (same for everyone)
    // =========================================================
    const marketCacheKey = `MARKET_${timeVariant}`;
    let marketNews: any = null;

    try {
      const marketCache = await base44.entities.NewsCardCache.filter({
        category: marketCacheKey,
      });

      if (marketCache && marketCache.length > 0) {
        const latest = marketCache.sort(
          (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        marketNews = {
          summary: latest.summary,
          stories: typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories,
          updated_at: latest.updated_at,
        };
        console.log(`✅ Market news: "${marketNews.summary}" (${marketNews.stories?.length || 0} stories)`);
      }
    } catch (e: any) {
      console.error("❌ Failed to fetch market news:", e.message);
    }

    // =========================================================
    // FETCH PORTFOLIO NEWS
    // Strategy: ticker-specific (Finlight) → UserNewsCache → category fallback
    // =========================================================
    let portfolioNews: any = null;
    const userTickers = extractTickers(userHoldings);

    console.log(`🎯 User tickers: ${userTickers.join(", ") || "none"}`);
    if (forceRefresh) console.log("🔄 Force refresh: skipping UserNewsCache, fetching live from Finlight");

    // ---------------------------------------------------------
    // STRATEGY 1: Ticker-specific news from UserNewsCache / Finlight
    // ---------------------------------------------------------
    if (userTickers.length > 0) {
      const tickersKey = userTickers.slice().sort().join(",");
      const tickersHash = simpleHash(tickersKey);

      // 1a. Check UserNewsCache for a fresh hit (skip when user clicked Refresh)
      if (!forceRefresh) {
        try {
          const userCacheEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
            user_email: user.email,
          });

          if (userCacheEntries && userCacheEntries.length > 0) {
            const latest = userCacheEntries.sort(
              (a: any, b: any) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
            )[0];

            const cacheAgeHours = (Date.now() - new Date(latest.fetched_at).getTime()) / (1000 * 60 * 60);
            const tickersMatch = latest.tickers_hash === tickersHash;

            if (cacheAgeHours < USER_CACHE_TTL_HOURS && tickersMatch) {
              const allStories = typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories;
              if (allStories && allStories.length >= 2) {
                const storiesForResponse = allStories.slice(0, 5);
                portfolioNews = {
                  summary: `News for ${userTickers.slice(0, 5).join(", ")}${userTickers.length > 5 ? ` +${userTickers.length - 5} more` : ""}`,
                  stories: storiesForResponse,
                  updated_at: latest.fetched_at,
                  source: "ticker_cache",
                };
                console.log(`✅ Portfolio news from UserNewsCache (${cacheAgeHours.toFixed(1)}h old, ${storiesForResponse.length} of ${allStories.length} stories)`);
              }
            } else {
              console.log(`⏰ UserNewsCache stale (${cacheAgeHours.toFixed(1)}h) or tickers changed`);
            }
          }
        } catch (e: any) {
          // Expected if UserNewsCache entity doesn't exist yet — graceful degradation
          console.log(`⚠️ UserNewsCache read skipped: ${e.message}`);
        }
      }

      // 1b. No UserNewsCache hit (or force refresh) → use shared TickerNewsCache + Finlight
      //     Per-ticker cache is shared: e.g. 4 users with AAPL share one cached AAPL feed until refresh.
      if (!portfolioNews) {
        const finlightKey = Deno.env.get("FINLIGHT_API_KEY");
        const marketauxKey = Deno.env.get("MARKETAUX_API_KEY") || Deno.env.get("MARKETAUX_KEY") || "";
        const newsApiKey = Deno.env.get("NEWSAPI_API_KEY") || Deno.env.get("NEWS_API_KEY") || "";

        if (finlightKey || marketauxKey || newsApiKey) {
          try {
            const rawArticles = await getTickerNewsWithSharedCache(
              base44,
              finlightKey,
              marketauxKey,
              newsApiKey,
              userTickers,
              forceRefresh
            );

            if (rawArticles.length > 0) {
              const transformed = rawArticles
                .map((a: any) => transformFinlightArticle(a, userTickers))
                .filter((s: any) => !isJunkStory(s));

              const deduped: any[] = [];
              for (const story of transformed) {
                if (!deduped.some((existing: any) => isSimilarTitle(existing.title, story.title))) {
                  deduped.push(story);
                }
              }

              // Sort: relevance first (minus roundup penalty), then premium outlets, then newest
              deduped.sort((a: any, b: any) => {
                const relA = storyRelevanceToTickers(a, userTickers) - roundupPenalty(a);
                const relB = storyRelevanceToTickers(b, userTickers) - roundupPenalty(b);
                if (relB !== relA) return relB - relA;
                const srcA = sourceQualityScore(a.outlet);
                const srcB = sourceQualityScore(b.outlet);
                if (srcB !== srcA) return srcB - srcA;
                const tA = new Date(a.datetime || 0).getTime();
                const tB = new Date(b.datetime || 0).getTime();
                return tB - tA;
              });

              const allStories = deduped;
              const displayCap = 5;
              const storiesForResponse = allStories.slice(0, displayCap);

              if (allStories.length >= 2) {
                portfolioNews = {
                  summary: `Latest on ${userTickers.slice(0, 5).join(", ")}${userTickers.length > 5 ? ` +${userTickers.length - 5} more` : ""}`,
                  stories: storiesForResponse,
                  updated_at: new Date().toISOString(),
                  source: "ticker_live",
                };

                try {
                  const oldEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
                    user_email: user.email,
                  });
                  for (const entry of oldEntries) {
                    await base44.asServiceRole.entities.UserNewsCache.delete(entry.id);
                  }

                  await base44.asServiceRole.entities.UserNewsCache.create({
                    user_email: user.email,
                    tickers_hash: tickersHash,
                    tickers_list: userTickers.join(","),
                    stories: JSON.stringify(allStories),
                    fetched_at: new Date().toISOString(),
                  });
                  console.log(`💾 Cached ${allStories.length} ticker stories (5 per ticker, mix) for ${user.email}`);
                } catch (cacheWriteError: any) {
                  console.warn(`⚠️ UserNewsCache write failed: ${cacheWriteError.message}`);
                }

                console.log(`✅ Portfolio news: ${storiesForResponse.length} stories (live Finlight, ${hoursAgo}h window)`);
              } else {
                console.log(`⚠️ Only ${allStories.length} usable ticker stories, falling back to category`);
              }
            } else {
              console.log(`⚠️ Finlight returned 0 articles for tickers, falling back to category`);
            }
          } catch (fetchError: any) {
            console.error(`❌ Finlight ticker fetch failed: ${fetchError.message}`);
          }
        } else {
          console.log(`⚠️ No FINLIGHT_API_KEY / MARKETAUX_API_KEY / NEWSAPI_API_KEY, skipping ticker-specific fetch`);
        }
      }
    }

    // ---------------------------------------------------------
    // STRATEGY 2 (FALLBACK): Category-based from NewsCardCache
    // ---------------------------------------------------------
    if (!portfolioNews) {
      console.log(`📂 Falling back to category-based portfolio news (${portfolioCategory})`);
      const portfolioCacheKey = `${portfolioCategory}_PORTFOLIO_${timeVariant}`;

      try {
        const portfolioCache = await base44.entities.NewsCardCache.filter({
          category: portfolioCacheKey,
        });

        if (portfolioCache && portfolioCache.length > 0) {
          const latest = portfolioCache.sort(
            (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
          const rawStories = typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories;
          const storiesTop5 = (rawStories || []).slice(0, 5);
          portfolioNews = {
            summary: latest.summary,
            stories: storiesTop5,
            updated_at: latest.updated_at,
            source: "category",
          };
          console.log(`✅ Portfolio news (${portfolioCategory}): "${portfolioNews.summary}" (${portfolioNews.stories?.length || 0} stories)`);
        }
      } catch (e: any) {
        console.error("❌ Failed to fetch category portfolio news:", e.message);
      }
    }

    // =========================================================
    // FALLBACK: If NewsCardCache is empty, fall back to NewsCache
    // When on fallback you get RAW Alpha Vantage summaries (short, 1–2 sentences)
    // and generic "Why It Matters". Run generateCategoryCards on a schedule to get
    // LLM-written 400–500 char descriptions and 150–200 char takeaways instead.
    // =========================================================
    if (!marketNews || !portfolioNews) {
      console.log("⚠️ NewsCardCache not populated, falling back to NewsCache...");

      try {
        const cacheEntries = await base44.entities.NewsCache.filter({});
        if (cacheEntries && cacheEntries.length > 0) {
          const latestCache = cacheEntries.sort(
            (a: any, b: any) => new Date(b.refreshed_at).getTime() - new Date(a.refreshed_at).getTime()
          )[0];

          let allStories = JSON.parse(latestCache.stories || "[]");
          const before = allStories.length;
          allStories = allStories.filter((s: any) => !isJunkStory(s));
          if (before !== allStories.length) {
            console.log(`🧹 Fallback: filtered ${before - allStories.length} junk stories → ${allStories.length} remaining`);
          }

          if (!marketNews && allStories.length >= 5) {
            marketNews = {
              summary: "Today's top market stories",
              stories: allStories.slice(0, 5),
              updated_at: latestCache.refreshed_at,
              fallback: true,
            };
          }

          if (!portfolioNews && allStories.length >= 10) {
            portfolioNews = {
              summary: "Stories relevant to your portfolio",
              stories: allStories.slice(5, 10),
              updated_at: latestCache.refreshed_at,
              fallback: true,
            };
          }

          console.log("✅ Fallback to NewsCache successful");
        }
      } catch (fallbackError: any) {
        console.error("❌ Fallback failed:", fallbackError.message);
      }
    }

    // =========================================================
    // RETURN RESPONSE
    // =========================================================
    if (!marketNews && !portfolioNews) {
      return Response.json(
        {
          success: false,
          error: "News cards not yet generated. Please wait a few minutes.",
          hint: "Run generateCategoryCards to populate the cache.",
        },
        { status: 503 }
      );
    }

    console.log(`✅ [fetchNewsCards] Returning news (0 LLM credits)`);

    return Response.json({
      success: true,
      time_variant: timeVariant,
      portfolio_category: portfolioCategory,
      portfolio_source: portfolioNews?.source || "category",
      market_news: marketNews || {
        summary: "Market news unavailable",
        stories: [],
        updated_at: null,
      },
      portfolio_news: portfolioNews || {
        summary: "Portfolio news unavailable",
        stories: [],
        updated_at: null,
      },
      credits_used: 0,
    });
  } catch (error: any) {
    console.error("❌ [fetchNewsCards] Error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
