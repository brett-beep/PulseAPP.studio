// ============================================================
// refreshNewsCache.ts - Base44 Function (v6 - Raw Storage)
// Runs every 5 minutes (0 LLM credits)
// Fetches 50 articles from Alpha Vantage across all PulseApp sectors
// Scores by urgency/relevance, caches top 30 RAW articles
// LLM analysis happens in generateCategoryCards instead
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// CONFIGURATION
// ============================================================

const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

// Topics mapped to PulseApp sectors
const PULSEAPP_TOPICS = [
  "technology",           // Tech Stocks
  "blockchain",           // Crypto
  "financial_markets",    // Markets
  "economy_macro",        // Economy
  "economy_monetary",     // Fed/Interest Rates
  "real_estate",          // Real Estate
  "energy_transportation", // Commodities (oil, energy)
  "earnings",             // Earnings reports
  "mergers_and_acquisitions", // M&A activity
  "manufacturing",        // Industrial/Manufacturing
];

// Map Alpha Vantage topics to PulseApp categories
const TOPIC_TO_CATEGORY: Record<string, string> = {
  "technology": "technology",
  "blockchain": "crypto",
  "financial_markets": "markets",
  "economy_macro": "economy",
  "economy_monetary": "economy",
  "economy_fiscal": "economy",
  "real_estate": "real estate",
  "energy_transportation": "commodities",
  "earnings": "markets",
  "mergers_and_acquisitions": "markets",
  "manufacturing": "markets",
  "finance": "markets",
  "life_sciences": "technology",
  "retail_wholesale": "markets",
  "ipo": "markets",
};

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

function getTimeFromHoursAgo(hours: number): string {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  // Alpha Vantage format: YYYYMMDDTHHMM
  return date.toISOString().replace(/[-:]/g, "").slice(0, 13);
}

function parseAlphaVantageDate(dateStr: string): string {
  // Input: "20240126T143000" -> ISO string
  if (!dateStr) return new Date().toISOString();
  try {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const hour = dateStr.slice(9, 11) || "00";
    const min = dateStr.slice(11, 13) || "00";
    const sec = dateStr.slice(13, 15) || "00";
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
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
// DUPLICATE DETECTION
// ============================================================

function isNearDuplicate(a: any, b: any): boolean {
  const aHeadline = normalizeHeadline(a?.title || "");
  const bHeadline = normalizeHeadline(b?.title || "");
  
  if (!aHeadline || !bHeadline) return false;
  
  // Extract significant words
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
  return overlapRatio > 0.6;
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
  
  // 1. RECENCY (0-100 points) - Most important factor
  const articleTime = new Date(article.datetime).getTime();
  const ageHours = (nowTimestamp - articleTime) / (1000 * 60 * 60);
  
  if (ageHours <= 0.5) score += 100;      // Last 30 min
  else if (ageHours <= 1) score += 90;    // Last hour
  else if (ageHours <= 2) score += 75;    // Last 2 hours
  else if (ageHours <= 4) score += 55;    // Last 4 hours
  else if (ageHours <= 8) score += 35;    // Last 8 hours
  else if (ageHours <= 12) score += 20;   // Last 12 hours
  else score += 5;                         // Older
  
  // 2. SENTIMENT STRENGTH (0-30 points) - Strong sentiment = more urgent
  const sentimentScore = Math.abs(article.sentiment_score || 0);
  score += Math.round(sentimentScore * 30);
  
  // 3. HIGH-IMPACT KEYWORDS (0-50 points)
  const text = `${article.title} ${article.what_happened}`.toLowerCase();
  
  const BREAKING_KEYWORDS = [
    // Fed/Monetary - Highest priority
    { keywords: ["fed", "powell", "fomc", "federal reserve"], points: 50 },
    { keywords: ["rate cut", "rate hike", "basis points", "bps"], points: 45 },
    { keywords: ["inflation", "cpi", "ppi", "core inflation"], points: 40 },
    
    // Major Economic Data
    { keywords: ["jobs report", "unemployment", "payroll", "jobless"], points: 40 },
    { keywords: ["gdp", "recession", "economic growth"], points: 35 },
    
    // Market Events
    { keywords: ["crash", "surge", "plunge", "selloff"], points: 45 },
    { keywords: ["record high", "record low", "all-time"], points: 35 },
    { keywords: ["volatility", "vix", "circuit breaker"], points: 40 },
    
    // Earnings/Company News
    { keywords: ["earnings", "revenue", "guidance", "outlook"], points: 25 },
    { keywords: ["layoffs", "restructuring", "bankruptcy"], points: 35 },
    
    // Geopolitical
    { keywords: ["tariff", "trade war", "sanctions"], points: 40 },
    { keywords: ["trump", "biden", "white house"], points: 30 },
    
    // Crypto-specific
    { keywords: ["bitcoin", "btc", "ethereum", "eth"], points: 20 },
    { keywords: ["crypto crash", "crypto surge"], points: 35 },
  ];
  
  for (const { keywords, points } of BREAKING_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) {
      score += points;
      break; // Only count highest matching category
    }
  }
  
  // 4. SOURCE CREDIBILITY (0-20 points)
  const source = (article.outlet || "").toLowerCase();
  const premiumSources = [
    "reuters", "bloomberg", "wsj", "wall street journal", "cnbc",
    "financial times", "ft", "associated press", "ap", "barrons",
    "marketwatch", "yahoo finance", "economist"
  ];
  if (premiumSources.some(s => source.includes(s))) {
    score += 20;
  }
  
  // 5. CATEGORY PRIORITY (0-15 points)
  const category = (article.category || "").toLowerCase();
  if (category === "economy") score += 15;
  else if (category === "markets") score += 12;
  else if (category === "technology") score += 8;
  else if (category === "crypto") score += 8;
  
  return score;
}

// ============================================================
// ALPHA VANTAGE NEWS FETCHER
// ============================================================

async function fetchAlphaVantageNews(apiKey: string): Promise<any[]> {
  const allArticles: any[] = [];
  const timeFrom = getTimeFromHoursAgo(12); // Last 12 hours
  
  // Fetch news with multiple topic queries for diversity
  const topicGroups = [
    "technology,blockchain",                    // Tech & Crypto
    "financial_markets,economy_macro",          // Markets & Economy
    "economy_monetary,earnings",                // Fed/Rates & Earnings
    "real_estate,energy_transportation",        // Real Estate & Commodities
    "mergers_and_acquisitions,manufacturing",   // M&A & Industrial
  ];
  
  for (const topics of topicGroups) {
    try {
      console.log(`📡 Alpha Vantage: Fetching topics [${topics}]...`);
      
      const url = new URL(ALPHA_VANTAGE_BASE_URL);
      url.searchParams.set("function", "NEWS_SENTIMENT");
      url.searchParams.set("topics", topics);
      url.searchParams.set("time_from", timeFrom);
      url.searchParams.set("sort", "LATEST");
      url.searchParams.set("limit", "15"); // 15 per group × 5 groups = 75 max
      url.searchParams.set("apikey", apiKey);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`❌ Alpha Vantage error for [${topics}]:`, response.status);
        continue;
      }
      
      const data = await response.json();
      
      if (data.Note || data.Information) {
        console.warn(`⚠️ Alpha Vantage rate limit:`, data.Note || data.Information);
        continue;
      }
      
      const feed = data.feed || [];
      console.log(`✅ Alpha Vantage [${topics}]: ${feed.length} articles`);
      
      for (const item of feed) {
        // Determine primary category from topics
        const itemTopics = (item.topics || []).map((t: any) => t.topic?.toLowerCase());
        let category = "markets";
        for (const topic of itemTopics) {
          if (TOPIC_TO_CATEGORY[topic]) {
            category = TOPIC_TO_CATEGORY[topic];
            break;
          }
        }
        
        // Get overall sentiment
        const sentimentScore = parseFloat(item.overall_sentiment_score) || 0;
        
        allArticles.push({
          title: item.title || "Breaking News",
          summary: item.summary || "",
          url: item.url || "#",
          source: item.source || "Alpha Vantage",
          datetime: parseAlphaVantageDate(item.time_published),
          image: item.banner_image || null,
          topics: itemTopics,
          category,
          sentiment_score: sentimentScore,
          sentiment_label: item.overall_sentiment_label || "Neutral",
          provider: "alphavantage",
          tickers: (item.ticker_sentiment || []).map((t: any) => t.ticker),
        });
      }
      
      // Small delay between requests to respect rate limits
      await new Promise(r => setTimeout(r, 300));
      
    } catch (error: any) {
      console.error(`❌ Alpha Vantage fetch error [${topics}]:`, error.message);
    }
  }
  
  console.log(`📊 Alpha Vantage total: ${allArticles.length} articles`);
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
  targetCount: number = 30
): ScoredArticle[] {
  const now = Date.now();
  
  console.log(`\n🎯 Selecting top ${targetCount} stories from ${newArticles.length} new articles...`);
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
  
  // 5. Pick top stories with diversity
  const selected: ScoredArticle[] = [];
  const categoryCount: Record<string, number> = {};
  const maxPerCategory = Math.ceil(targetCount * 0.4); // Max 40% per category
  
  for (const article of allCandidates) {
    if (selected.length >= targetCount) break;
    
    // Skip duplicates
    if (selected.some(s => isNearDuplicate(s, article))) continue;
    
    // Category limit check
    const cat = article.category || "markets";
    if ((categoryCount[cat] || 0) >= maxPerCategory) {
      // Only skip if we have plenty of candidates left
      if (allCandidates.indexOf(article) < targetCount * 2) {
        continue;
      }
    }
    
    // Format the article
    const formattedArticle: ScoredArticle = {
      id: article.id || randomId(),
      title: safeText(article.title, "Breaking News"),
      what_happened: safeText(article.summary, "Details emerging..."),
      why_it_matters: "", // Will be filled by LLM or fetchNewsCards
      href: safeText(article.url, "#"),
      imageUrl: article.image || categoryImageUrl(article.category),
      outlet: safeText(article.source, "Unknown"),
      category: cat,
      datetime: article.datetime,
      provider: article.provider || "alphavantage",
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
    console.log("🔄 [refreshNewsCache] Starting v5 (Alpha Vantage Premium)...");
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log("=".repeat(60));
    
    const base44 = createClientFromRequest(req);
    
    // Get Alpha Vantage API key from Base44 secrets
    let alphaVantageKey: string;
    try {
      alphaVantageKey = await base44.asServiceRole.getSecret("ALPHA_VANTAGE_API_KEY");
      if (!alphaVantageKey) {
        throw new Error("ALPHA_VANTAGE_API_KEY is empty");
      }
      console.log("🔑 Alpha Vantage API key retrieved from Base44 secrets ✓");
    } catch (error: any) {
      console.error("❌ Failed to retrieve ALPHA_VANTAGE_API_KEY:", error.message);
      return Response.json({ 
        error: "ALPHA_VANTAGE_API_KEY not configured in Base44 secrets" 
      }, { status: 500 });
    }
    
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
    
    // Fetch from Alpha Vantage
    const rawArticles = await fetchAlphaVantageNews(alphaVantageKey);
    const allArticles = filterLowQualityArticles(rawArticles);
    
    if (allArticles.length === 0) {
      console.log("⚠️ No articles fetched from Alpha Vantage (or all filtered out)");
      return Response.json({ 
        error: "No articles fetched from Alpha Vantage",
        hint: "Check API key and rate limits"
      }, { status: 500 });
    }
    
    // Select top stories with persistence
    const topStories = selectTopStories(allArticles, previousTopStories, 30);
    
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
      sources_used: "alphavantage",
      total_fetched: allArticles.length,
      articles_selected: enhancedStories.length,
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(60));
    console.log(`✅ COMPLETE in ${elapsed}ms`);
    console.log(`📰 Cached ${enhancedStories.length} raw stories (0 LLM credits)`);
    console.log("=".repeat(60) + "\n");
    
    return Response.json({
      success: true,
      message: "News cache refreshed (v6 - Raw Storage, 0 LLM credits)",
      stories_cached: enhancedStories.length,
      total_fetched: allArticles.length,
      source: "alphavantage",
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