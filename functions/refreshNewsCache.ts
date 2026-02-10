// ============================================================
// refreshNewsCache.ts - Base44 Function (v13.1 - Entity-Based Clustering)
// Uses secret: FINLIGHT_API_KEY. If missing after GitHub deploy → Base44: edit this file (e.g. add newline), Save & Deploy (see DEPLOY.md).
// Runs every 5 minutes (0 LLM credits)
// Fetches from Finlight (broad financial news). Scores by:
// recency, MACRO/BREAKING first (oil, bitcoin, shutdown, funding deal, broad market),
// single-stock/earnings noise demoted (-40), source + summary quality, topic clustering.
// Never caches "Details emerging...". Summary length loosened (min 12 chars, then headline-only) so more news surfaces; card uses title as fallback when summary empty. Caches top 20 RAW articles (design choice: small high-signal shared pool for breaking/macro; 0 LLM credits — not for saving credits).
// v13: General-purpose entity extraction (people/companies/topics) → clusters ANY person+topic or company+topic combo
// Example: "Cook + inflation", "Musk + Tesla", "nvidia + earnings" all auto-cluster without hardcoded rules
// MANUAL REDEPLOY V2
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// CONFIGURATION
// ============================================================

const FINLIGHT_API_BASE = "https://api.finlight.me";

// Category mapping keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  markets: ["stock", "market", "trading", "wall street", "nasdaq", "dow jones", "s&p", "equity"],
  crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "nft", "defi", "web3"],
  economy: ["fed", "interest rate", "inflation", "gdp", "unemployment", "economy", "recession"],
  technology: ["tech", "ai", "software", "apple", "google", "microsoft", "meta", "tesla"],
  "real estate": ["housing", "real estate", "mortgage", "property", "reits"],
  commodities: ["oil", "gold", "silver", "commodity", "energy", "natural gas"],
};

function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  // Avoid "Olympic Gold" / "World Cup gold" matching commodities
  const isSportsGold = /(olympic|world\s+cup|medal|championship).*gold|gold.*(medal|olympic)/i.test(text);
  const commoditiesKeywords = isSportsGold
    ? CATEGORY_KEYWORDS.commodities.filter(kw => kw !== "gold")
    : CATEGORY_KEYWORDS.commodities;

  const categoriesToCheck: [string, string[]][] = [
    ...Object.entries(CATEGORY_KEYWORDS).filter(([cat]) => cat !== "commodities"),
    ["commodities", commoditiesKeywords],
  ];
  for (const [category, keywords] of categoriesToCheck) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }

  return "markets"; // Default category
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function safeText(input: unknown, fallback: string = ""): string {
  const s = typeof input === "string" ? input.trim() : "";
  return s || fallback;
}

function normalizeHeadline(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function getDateFromHoursAgo(hours: number): string {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD for Finlight from/to
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

// ============================================================
// ENTITY EXTRACTION & TOPIC CLUSTERING – one story per cluster
// ============================================================

// Extract entities (people, companies, topics) from text for smart clustering
function extractEntities(text: string): { people: Set<string>; companies: Set<string>; topics: Set<string> } {
  const lower = text.toLowerCase();
  
  // Extract prominent people
  const people = new Set<string>();
  const peopleNames = [
    // Fed officials
    'powell', 'cook', 'waller', 'bowman', 'barkin', 'jefferson', 'kugler', 'logan', 'williams',
    'bostic', 'collins', 'harker', 'kashkari', 'mester', 'daly', 'evans', 'bullard', 'goolsbee',
    // Politicians  
    'trump', 'biden', 'harris', 'yellen', 'schumer', 'mccarthy', 'pelosi',
    // CEOs
    'musk', 'zuckerberg', 'pichai', 'nadella', 'bezos', 'altman',
  ];
  for (const name of peopleNames) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      people.add(name);
    }
  }
  
  // Extract companies
  const companies = new Set<string>();
  const companyNames = [
    'apple', 'microsoft', 'google', 'amazon', 'meta', 'tesla', 'nvidia', 'netflix',
    'disney', 'walmart', 'jpmorgan', 'goldman', 'wells fargo', 'bank of america', 'citigroup',
  ];
  for (const company of companyNames) {
    if (lower.includes(company)) {
      companies.add(company);
    }
  }
  
  // Extract topics
  const topics = new Set<string>();
  const topicKeywords = [
    'inflation', 'rate cut', 'rate hike', 'monetary policy', 'interest rate',
    'earnings', 'revenue', 'profit', 'guidance',
    'tariff', 'trade war', 'sanctions',
    'unemployment', 'jobs report', 'gdp', 'cpi',
    'bitcoin', 'crypto', 'ethereum',
    'ipo', 'merger', 'acquisition', 'bankruptcy',
  ];
  for (const keyword of topicKeywords) {
    if (lower.includes(keyword)) {
      topics.add(keyword);
    }
  }
  
  return { people, companies, topics };
}

function getTopicCluster(headline: string, summary: string): string | null {
  const text = ((headline || "") + " " + (summary || "")).toLowerCase();
  const entities = extractEntities(text);
  
  // ENTITY-BASED CLUSTERING: Person + Topic
  // Example: "Cook says inflation risk" + "Cook warns on inflation" → "person_cook_inflation"
  if (entities.people.size > 0 && entities.topics.size > 0) {
    const primaryPerson = Array.from(entities.people).sort()[0]; // Alphabetical for consistency
    const primaryTopic = Array.from(entities.topics).sort()[0];
    return `person_${primaryPerson}_${primaryTopic.replace(/\s+/g, '_')}`;
  }
  
  // ENTITY-BASED CLUSTERING: Company + Topic
  // Example: "Nvidia earnings beat" + "Nvidia revenue surge" → "company_nvidia_earnings"
  if (entities.companies.size > 0 && entities.topics.size > 0) {
    const primaryCompany = Array.from(entities.companies).sort()[0];
    const primaryTopic = Array.from(entities.topics).sort()[0];
    return `company_${primaryCompany}_${primaryTopic.replace(/\s+/g, '_')}`;
  }
  
  // FALLBACK: High-impact patterns for stories without clear entities
  const patterns: { pattern: RegExp; cluster: string }[] = [
    { pattern: /rate (cut|hike|decision).*(fed|fomc)/i, cluster: "fed_rates" },
    { pattern: /inflation.*(cpi|report|data)/i, cluster: "inflation_data" },
    { pattern: /jobs report|employment.*(data|report)/i, cluster: "jobs_data" },
    { pattern: /all-time high|all-time low|record high|record low/i, cluster: "ath_atl" },
  ];
  for (const { pattern, cluster } of patterns) {
    if (pattern.test(text)) return cluster;
  }
  
  return null;
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================

// Minimum summary length to cache (loosened so more news surfaces; we can refine + add generated summaries later)
const MIN_SUMMARY_LENGTH = 12;         // ~2–3 words (was 30); avoids totally empty
const MIN_SUMMARY_LENGTH_RELAXED = 0;  // Allow headline-only (use title as fallback on card)
const MIN_ARTICLES_SAFETY = 12;        // If we have fewer than this after filter, relax once
const TRIVIAL_SUMMARY_PATTERN = /^details\s+emerging\.?\.?\.?\s*$/i;

function hasRealSummary(article: any, minLength: number): boolean {
  const s = (article.summary || article.what_happened || "").trim();
  if (TRIVIAL_SUMMARY_PATTERN.test(s)) return false;
  if (minLength === 0) {
    // Allow headline-only: no summary required, but must have a real title
    const title = (article.title || "").trim();
    return title.length >= 8;
  }
  if (!s || s.length < minLength) return false;
  return true;
}

function isNearDuplicate(a: any, b: any): boolean {
  const aHeadline = normalizeHeadline(a?.title || "");
  const bHeadline = normalizeHeadline(b?.title || "");
  
  if (!aHeadline || !bHeadline) return false;
  
  // 1. ENTITY OVERLAP (strongest signal for duplicates)
  const aEntities = extractEntities(aHeadline);
  const bEntities = extractEntities(bHeadline);
  
  // Count shared entities
  let sharedPeople = 0;
  for (const person of aEntities.people) {
    if (bEntities.people.has(person)) sharedPeople++;
  }
  
  let sharedCompanies = 0;
  for (const company of aEntities.companies) {
    if (bEntities.companies.has(company)) sharedCompanies++;
  }
  
  let sharedTopics = 0;
  for (const topic of aEntities.topics) {
    if (bEntities.topics.has(topic)) sharedTopics++;
  }
  
  // If stories share same person/company + same topic → likely duplicate
  // Example: "Cook says inflation" + "Cook warns inflation" → both have Cook + inflation
  if (sharedPeople > 0 && sharedTopics > 0) return true;
  if (sharedCompanies > 0 && sharedTopics > 0) return true;
  
  // 2. WORD OVERLAP (fallback for stories without clear entities)
  const getWords = (text: string) => {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", 
      "with", "as", "at", "by", "from", "is", "are", "was", "were", "be",
      "this", "that", "says", "said", "report", "reports", "news", "update"
    ]);
    return new Set(
      text.split(" ").filter(w => w.length > 2 && !stopWords.has(w))
    );
  };
  
  const aWords = getWords(aHeadline);
  const bWords = getWords(bHeadline);
  
  if (aWords.size < 3 || bWords.size < 3) return false;
  
  let overlap = 0;
  for (const w of aWords) {
    if (bWords.has(w)) overlap++;
  }
  
  const overlapRatio = overlap / Math.min(aWords.size, bWords.size);
  return overlapRatio > 0.5;
}

// ============================================================
// URGENCY SCORING
// ============================================================

interface ScoredArticle {
  id: string;
  title: string;
  what_happened: string;
  why_it_matters: string;
  href: string;
  imageUrl: string;
  outlet: string;
  category: string;
  datetime: string;
  provider: string;
  topics: string[];
  sentiment_score: number;
  urgency_score: number;
  rank?: number;
}

function calculateUrgencyScore(article: any, nowTimestamp: number): number {
  let score = 0;
  
  // 1. RECENCY (0-100 points) – recent preferred, but 12h window stays competitive so "best" can surface
  const articleTime = new Date(article.datetime).getTime();
  const ageHours = (nowTimestamp - articleTime) / (1000 * 60 * 60);
  
  if (ageHours <= 0.5) score += 100;      // Last 30 min
  else if (ageHours <= 1) score += 88;    // Last hour
  else if (ageHours <= 2) score += 75;    // Last 2 hours
  else if (ageHours <= 4) score += 60;    // Last 4 hours
  else if (ageHours <= 8) score += 45;    // Last 8 hours
  else if (ageHours <= 12) score += 30;   // Last 12 hours – enough that best-in-window can win
  else score += 5;                         // Older
  
  // 2. SENTIMENT STRENGTH (0-30 points) - Strong sentiment = more urgent
  const sentimentScore = Math.abs(article.sentiment_score || 0);
  score += Math.round(sentimentScore * 30);
  
  // 3. HIGH-IMPACT KEYWORDS – macro/breaking first (WSJ-style), then general
  const title = (article.title || "").toLowerCase();
  const text = `${title} ${(article.what_happened || "").toLowerCase()}`;
  
  // 3a. MACRO / BREAKING (WSJ-level: oil, bitcoin, shutdown, jobs, M&A, broad market) – highest priority
  const MACRO_BREAKING = [
    { keywords: ["shutdown", "funding deal", "house advances", "government shutdown"], points: 55 },
    { keywords: ["oil jumps", "oil surges", "oil price", "crude oil", "oil rally"], points: 52 },
    { keywords: ["bitcoin drops", "bitcoin plunge", "bitcoin lowest", "btc drops", "crypto crash"], points: 52 },
    { keywords: ["stocks fall", "stocks plunge", "markets wrap", "market selloff", "dow jones", "s&p 500", "nasdaq"], points: 50 },
    { keywords: ["fed", "powell", "fomc", "federal reserve"], points: 50 },
    { keywords: ["rate cut", "rate hike", "basis points", "bps"], points: 45 },
    { keywords: ["inflation", "cpi", "ppi", "core inflation"], points: 42 },
    { keywords: ["jobs report", "unemployment", "payroll", "jobless", "layoffs", "job cuts", "challenger"], points: 48 },
    { keywords: ["merger", "acquisition", "to acquire", "xai", "x.ai", "spacex merger", "musk"], points: 46 },
    { keywords: ["gdp", "recession", "economic growth"], points: 38 },
    { keywords: ["tariff", "trade war", "sanctions"], points: 40 },
    { keywords: ["trump", "biden", "white house"], points: 32 },
    { keywords: ["bitcoin", "btc", "ethereum", "eth"], points: 28 },
  ];
  for (const { keywords, points } of MACRO_BREAKING) {
    if (keywords.some(kw => text.includes(kw))) {
      score += points;
      break;
    }
  }
  
  // 3b. Single-stock / earnings noise DEMOTION – so PennyMac 33%, DaVita soars, “all-time high at $X” don’t beat macro
  const singleStockPatterns = [
    /\bstock\s+(soars?|drops?|surges?|jumps?|falls?|rises?)\s+/i,
    /\b(post[- ]?earnings|beats\s+q[1-4]|q[1-4]\s+results?)\b/i,
    /\ball[- ]?time\s+high\s+at\s+\d/i,
    /\b(inc\.?|corp\.?)\s+(stock|shares?)\s+/i,
    /\d+%\s+(after|post)\s+/i,
    /\b(soars?|drops?|surges?|jumps?)\s+\d+%\s+/i,
    /\bunder\s+scrutiny\s+as\s+stock\s+drops\b/i,
  ];
  const looksLikeSingleStock = singleStockPatterns.some(p => p.test(title));
  if (looksLikeSingleStock) score -= 40;

  // 3b-alt. NON-FINANCE DEMOTION – sports, PR fluff so layoffs/M&A surface
  const nonFinancePatterns = [
    /olympic|olympics|skiing|acl\s+torn|torn\s+acl|world\s+cup/i,
    /soccer|football\s+club|fc\s+announces|inaugural\s+sleeve|sleeve\s+sponsorship/i,
    /prnewswire.*sponsorship|announces\s+inaugural\s+(sleeve|partnership)/i,
  ];
  if (nonFinancePatterns.some(p => p.test(title))) score -= 50;

  // 3d. Other impact keywords (only if no macro match yet)
  const hadMacroMatch = MACRO_BREAKING.some(({ keywords }) => keywords.some(kw => text.includes(kw)));
  if (!hadMacroMatch) {
    const OTHER_KEYWORDS = [
      { keywords: ["crash", "plunge", "selloff"], points: 42 },
      { keywords: ["record high", "record low", "all-time"], points: 32 },
      { keywords: ["volatility", "vix", "circuit breaker"], points: 38 },
      { keywords: ["layoffs", "restructuring", "bankruptcy", "job cuts"], points: 38 },
      { keywords: ["merger", "acquisition", "acquires", "xai", "spacex"], points: 35 },
      { keywords: ["earnings", "revenue", "guidance", "outlook"], points: 22 },
    ];
    for (const { keywords, points } of OTHER_KEYWORDS) {
      if (keywords.some(kw => text.includes(kw))) {
        score += points;
        break;
      }
    }
  }
  
  // 4. SOURCE CREDIBILITY (0-20 points)
  const source = (article.source || article.outlet || "").toLowerCase().trim();
  const premiumSources = [
    "reuters", "bloomberg", "wsj", "wall street journal", "cnbc",
    "financial times", "ft", "associated press", "ap", "barrons",
    "marketwatch", "yahoo finance", "economist", "benzinga", "finnhub",
    "investing.com", "msn", "zacks", "street insider"
  ];
  if (source && source !== "unknown" && source !== "alpha vantage") {
    if (premiumSources.some(s => source.includes(s))) {
      score += 20;
    }
  } else {
    score -= 25; // Demote unknown or missing source
  }

  // 4b. CONTENT QUALITY – prefer articles with real summaries (avoids "Details emerging...")
  const summary = (article.summary || article.what_happened || "").trim();
  if (summary.length > 200) score += 15;
  else if (summary.length > 100) score += 10;
  else if (summary.length > 30) score += 5;
  else if (summary.length === 0) score -= 15;

  // 4c. "BEST" BONUS – premium source + real summary so best-in-12h reliably surfaces
  const hasPremium = source && premiumSources.some((p: string) => source.includes(p));
  if (hasPremium && summary.length > 100) score += 12;

  // 5. CATEGORY PRIORITY (0-15 points)
  const category = (article.category || "").toLowerCase();
  if (category === "economy") score += 15;
  else if (category === "markets") score += 12;
  else if (category === "technology") score += 8;
  else if (category === "crypto") score += 8;
  
  return score;
}

// ============================================================
// FINLIGHT NEWS FETCHER
// ============================================================

function sentimentToScore(sentiment: string, confidence: number): number {
  const c = Math.max(0, Math.min(1, confidence || 0));
  if (sentiment === "positive") return c * 0.5;
  if (sentiment === "negative") return -c * 0.5;
  return 0;
}

async function fetchFinlightNews(apiKey: string): Promise<any[]> {
  // 24-hour window: gives 2 calendar days so Finlight returns more articles (12h often = same day = only a few)
  const fromDate = getDateFromHoursAgo(24);
  const toDate = new Date().toISOString().slice(0, 10);

  const parseResponse = (data: any): any[] => {
    const raw = data.articles || [];
    return raw.map((item: any) => {
      const title = item.title || "Breaking News";
      const summary = (item.summary || "").trim();
      const category = categorizeArticle(title, summary);
      const sentimentScore = sentimentToScore(item.sentiment || "neutral", item.confidence ?? 0);
      return {
        title,
        summary,
        what_happened: summary,
        url: item.link || "#",
        source: item.source || "Finlight",
        datetime: item.publishDate ? new Date(item.publishDate).toISOString() : new Date().toISOString(),
        image: (item.images && item.images[0]) || null,
        topics: [],
        category,
        sentiment_score: sentimentScore,
        sentiment_label: item.sentiment === "positive" ? "Positive" : item.sentiment === "negative" ? "Negative" : "Neutral",
        provider: "finlight",
        tickers: (item.companies || []).map((c: any) => c.ticker).filter(Boolean),
      };
    });
  };

  const fetchPage = async (page: number): Promise<any[]> => {
    const response = await fetch(`${FINLIGHT_API_BASE}/v2/articles`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        from: fromDate,
        to: toDate,
        language: "en",
        orderBy: "publishDate",
        order: "DESC",
        pageSize: 75,
        page,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Finlight error:`, response.status, errText);
      throw new Error(`Finlight API error: ${response.status}`);
    }
    const data = await response.json();
    return parseResponse(data);
  };

  const page1 = await fetchPage(1);
  console.log(`✅ Finlight: ${page1.length} articles (page 1)`);

  // If first page was full, get a second page to have more stories to choose from
  let allArticles = page1;
  if (page1.length >= 75) {
    const page2 = await fetchPage(2);
    console.log(`✅ Finlight: +${page2.length} articles (page 2)`);
    allArticles = [...page1, ...page2];
  }

  console.log(`✅ Finlight total: ${allArticles.length} articles`);
  return allArticles;
}

// ============================================================
// FILTER LOW-QUALITY / JUNK ARTICLES
// ============================================================

const LOW_QUALITY_SOURCES = [
  "blogspot", "wordpress.com", "tumblr.com", "medium.com/personal",
  "substack.com/thank", "patreon.com", "ko-fi.com",
];

const JUNK_OUTLETS = [
  "charleshughsmith", "blogspot", "wordpress", "tumblr", "patreon", "ko-fi",
];

const JUNK_PATTERNS = [
  /thank\s+you\s+for\s+(your\s+)?(superbly\s+)?(generous\s+)?subscription/i,
  /thank\s+you\s+.*\s+subscription\s+to\s+this\s+site/i,
  /greatly\s+honored\s+by\s+your\s+support/i,
  /subscription\s+to\s+this\s+site/i,
  /^\s*thank\s+you[,.]/i,
];

function isLikelyNonEnglish(text: string): boolean {
  if (!text || text.length < 20) return false;
  const sample = text.slice(0, 300);
  const nonLatin = (sample.match(/[^\x00-\x7F\s]/g) || []).length;
  return nonLatin > sample.length * 0.15;
}

function filterLowQualityArticles(articles: any[]): any[] {
  const filtered = articles.filter((article) => {
    const source = (article.source || "").toLowerCase();
    const url = (article.url || article.link || article.href || "").toLowerCase();
    const title = (article.title || "").trim();
    const summary = (article.summary || "").trim();
    const combined = `${title} ${summary}`.slice(0, 500);

    if (LOW_QUALITY_SOURCES.some((d) => source.includes(d) || url.includes(d))) {
      return false;
    }
    if (JUNK_OUTLETS.some((d) => source.includes(d))) {
      return false;
    }
    if (JUNK_PATTERNS.some((p) => p.test(combined))) {
      return false;
    }
    if (isLikelyNonEnglish(title) || isLikelyNonEnglish(summary)) {
      return false;
    }
    return true;
  });
  const removed = articles.length - filtered.length;
  if (removed > 0) {
    console.log(`🧹 Filtered ${removed} low-quality/non-English articles → ${filtered.length} remaining`);
  }
  return filtered;
}

// ============================================================
// STORY SELECTION WITH PERSISTENCE
// ============================================================

function selectTopStories(
  newArticles: any[],
  previousTopStories: any[] = [],
  targetCount: number = 20
): ScoredArticle[] {
  const now = Date.now();
  
  console.log(`\n🎯 Selecting top ${targetCount} stories from ${newArticles.length} new articles (non-empty summary only)...`);
  console.log(`📋 Previous top stories: ${previousTopStories.length}`);
  
  // 1. Score all new articles
  const scoredNew = newArticles.map(article => ({
    ...article,
    urgency_score: calculateUrgencyScore(article, now),
    is_new: true,
  }));
  
  // 2. Re-score previous top stories (recency penalty applies)
  const rescoredPrevious = previousTopStories.map(article => ({
    ...article,
    urgency_score: calculateUrgencyScore(article, now),
    is_new: false,
  }));
  
  // 3. Combine and deduplicate
  const allCandidates = [...scoredNew];
  
  for (const prev of rescoredPrevious) {
    const isDupe = allCandidates.some(a => isNearDuplicate(a, prev));
    if (!isDupe) {
      allCandidates.push(prev);
    }
  }
  
  // 4. Sort by urgency score (highest first)
  allCandidates.sort((a, b) => b.urgency_score - a.urgency_score);

  // 4b. Summary-length analytics (see how many we drop due to word count)
  const summaryLen = (a: any) => (a.summary || a.what_happened || "").trim().length;
  const bucket = (len: number) => (len === 0 ? "0" : len < 12 ? "1-11" : len < 30 ? "12-29" : "30+");
  const byBucket: Record<string, number> = { "0": 0, "1-11": 0, "12-29": 0, "30+": 0 };
  for (const a of allCandidates) {
    byBucket[bucket(summaryLen(a))]++;
  }
  const blockedAt30 = allCandidates.filter(a => !hasRealSummary(a, 30)).length;
  const blockedAt12 = allCandidates.filter(a => !hasRealSummary(a, 12)).length;
  const allowedAt0 = allCandidates.filter(a => hasRealSummary(a, 0)).length;
  console.log(`📊 Summary length: 0 chars=${byBucket["0"]}, 1-11=${byBucket["1-11"]}, 12-29=${byBucket["12-29"]}, 30+=${byBucket["30+"]}`);
  console.log(`📊 If min=30: ${blockedAt30} blocked | If min=12: ${blockedAt12} blocked | If min=0 (title OK): ${allowedAt0} allowed`);
  
  // 5. Pick top stories with diversity (topic clustering + category cap)
  const selected: ScoredArticle[] = [];
  const categoryCount: Record<string, number> = {};
  const usedClusters = new Set<string>();
  const maxPerCategory = Math.ceil(targetCount * 0.35); // Max 35% per category
  let minSummaryLen = MIN_SUMMARY_LENGTH;

  const trySelect = (): void => {
  for (const article of allCandidates) {
    if (selected.length >= targetCount) return;
    
    // Allow short/empty summary when relaxed; "Details emerging..." still blocked
    if (!hasRealSummary(article, minSummaryLen)) continue;
    
    // Skip duplicates
    if (selected.some(s => isNearDuplicate(s, article))) continue;
    
    // Topic cluster: only one story per cluster (avoids 5 similar “all-time high” stories)
    const cluster = getTopicCluster(article.title || "", article.summary || "");
    if (cluster && usedClusters.has(cluster)) continue;
    
    // Category limit check
    const cat = article.category || "markets";
    if ((categoryCount[cat] || 0) >= maxPerCategory) {
      if (allCandidates.indexOf(article) < targetCount * 2) continue;
    }
    
    if (cluster) usedClusters.add(cluster);
    
    // Format the article; use title as fallback when summary is empty/short so cards still show something
    const rawSummary = safeText(article.summary, "");
    const formattedArticle: ScoredArticle = {
      id: article.id || randomId(),
      title: safeText(article.title, "Breaking News"),
      what_happened: rawSummary || safeText(article.title, ""),
      why_it_matters: "", // Will be filled by LLM or fetchNewsCards
      href: safeText(article.url, "#"),
      imageUrl: article.image || categoryImageUrl(article.category),
      outlet: safeText(article.source, "Unknown"),
      category: cat,
      datetime: article.datetime,
      provider: article.provider || "finlight",
      topics: article.topics || [],
      sentiment_score: article.sentiment_score || 0,
      urgency_score: article.urgency_score,
      rank: selected.length + 1,
    };
    
    selected.push(formattedArticle);
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    
    const statusEmoji = article.is_new ? "🆕" : "📌";
    console.log(`${statusEmoji} #${selected.length} [${cat}] (score:${article.urgency_score}) ${article.title?.slice(0, 50)}...`);
  }
  };

  trySelect();
  // Safety: if we dropped too many, relax summary length once (still no "Details emerging...")
  if (selected.length < MIN_ARTICLES_SAFETY && minSummaryLen === MIN_SUMMARY_LENGTH) {
    minSummaryLen = MIN_SUMMARY_LENGTH_RELAXED;
    console.log(`⚠️ Only ${selected.length} articles had summary ≥ ${MIN_SUMMARY_LENGTH} chars; relaxing to allow headline-only (min=0)`);
    trySelect();
  }

  console.log("\n📊 Category distribution:", categoryCount);
  console.log(`📊 New articles: ${selected.filter(s => s.rank === undefined || s.rank <= newArticles.length).length}`);
  
  return selected;
}

// ============================================================
// CATEGORY FALLBACK MESSAGES
// ============================================================

function getCategoryMessage(category: string): string {
  const messages: Record<string, string> = {
    markets: "Could impact portfolio performance and market sentiment.",
    crypto: "May signal shifts in digital asset valuations.",
    economy: "Affects broader market conditions and strategies.",
    technology: "Could influence tech sector valuations.",
    "real estate": "May impact real estate investments.",
    commodities: "Could affect commodity prices and hedging."
  };
  return messages[category] || "Worth monitoring for portfolio implications.";
}

// ============================================================
// LLM HELPER
// ============================================================

async function invokeLLM(base44Client: any, prompt: string): Promise<string> {
  try {
    const response = await base44Client.asServiceRole.functions.invoke("invokeLLM", {
      prompt,
      useStreaming: false,
      context: null,
    });
    
    if (response?.data?.success && response?.data?.response) {
      return response.data.response;
    }
    
    throw new Error(response?.data?.error || "LLM invocation failed");
  } catch (error: any) {
    console.error("❌ LLM Error:", error.message);
    throw error;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔄 [refreshNewsCache] Starting v11 (Finlight - Force Redeploy)...");
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log("=".repeat(60));
    
    const base44 = createClientFromRequest(req);
    
    // Get API key with debug info
    console.log("🔍 Checking for FINLIGHT_API_KEY in environment...");
    const finlightKey = Deno.env.get("FINLIGHT_API_KEY");
    console.log(`🔍 Key exists: ${!!finlightKey}, Length: ${finlightKey?.length || 0}`);
    
    if (!finlightKey) {
      console.error("❌ Missing API key - Available env vars:", Object.keys(Deno.env.toObject()).filter(k => k.includes('API')));
      return Response.json({ 
        error: "FINLIGHT_API_KEY not configured in Base44 secrets",
        hint: "Check Base44 secrets configuration",
        debug_available_keys: Object.keys(Deno.env.toObject()).filter(k => k.includes('API') || k.includes('FINLIGHT'))
      }, { status: 500 });
    }
    
    console.log("🔑 Finlight API key found ✓");
    
    // Get previous cache for persistence logic
    let previousTopStories: any[] = [];
    try {
      const cacheEntries = await base44.asServiceRole.entities.NewsCache.filter({});
      if (cacheEntries && cacheEntries.length > 0) {
        const latestCache = cacheEntries.sort((a: any, b: any) => 
          new Date(b.refreshed_at).getTime() - new Date(a.refreshed_at).getTime()
        )[0];
        previousTopStories = JSON.parse(latestCache.stories || "[]").slice(0, 10);
        console.log(`📋 Loaded ${previousTopStories.length} previous top stories for persistence check`);
      }
    } catch (e) {
      console.log("No previous cache found, starting fresh");
    }
    
    // Fetch from Finlight
    const rawArticles = await fetchFinlightNews(finlightKey);
    console.log(`📊 Total fetched: ${rawArticles.length} articles from Finlight`);
    
    const allArticles = filterLowQualityArticles(rawArticles);
    
    if (allArticles.length === 0) {
      console.log("⚠️ No articles fetched (or all filtered out)");
      return Response.json({ 
        error: "No articles fetched from news sources",
        hint: "Check API keys and rate limits"
      }, { status: 500 });
    }
    
    // Select top stories with persistence
    const topStories = selectTopStories(allArticles, previousTopStories, 20);
    
    // Store RAW articles (0 LLM credits)
    // LLM analysis happens in generateCategoryCards instead
    console.log("\n📦 Storing raw articles (no LLM analysis - 0 credits)...");
    
    const enhancedStories = topStories.map((story) => ({
      ...story,
      why_it_matters: getCategoryMessage(story.category), // Category fallback only
    }));
    
    // Clear old cache
    try {
      const oldCache = await base44.asServiceRole.entities.NewsCache.filter({});
      for (const entry of oldCache) {
        await base44.asServiceRole.entities.NewsCache.delete(entry.id);
      }
      console.log(`🗑️ Cleared ${oldCache.length} old cache entries`);
    } catch (e) {
      console.log("Cache clear note:", e);
    }
    
    // Save new cache
    const cacheEntry = await base44.asServiceRole.entities.NewsCache.create({
      stories: JSON.stringify(enhancedStories),
      refreshed_at: new Date().toISOString(),
      sources_used: "finlight",
      total_fetched: rawArticles.length,
      articles_selected: enhancedStories.length,
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(60));
    console.log(`✅ COMPLETE in ${elapsed}ms`);
    console.log(`📰 Cached ${enhancedStories.length} raw stories (0 LLM credits)`);
    console.log("=".repeat(60) + "\n");
    
    return Response.json({
      success: true,
      message: "News cache refreshed (v10 - Finlight, 0 LLM credits)",
      stories_cached: enhancedStories.length,
      total_fetched: rawArticles.length,
      sources_used: "finlight",
      refreshed_at: cacheEntry.refreshed_at,
      elapsed_ms: elapsed,
      llm_credits_used: 0,
      category_breakdown: enhancedStories.reduce((acc: Record<string, number>, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {}),
      top_5_headlines: enhancedStories.slice(0, 5).map(s => 
        `[${s.category}] (score:${s.urgency_score}) ${s.title}`
      ),
    });
    
  } catch (error: any) {
    console.error("❌ [refreshNewsCache] Error:", error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
});