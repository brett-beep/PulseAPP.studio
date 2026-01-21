// ============================================================
// refreshNewsCache.js - Base44 Function (OPTIMIZED)
// Runs every 15 minutes (via cron or manual trigger)
// Fetches from multiple APIs with TOPIC-TARGETED calls
// Stays within free tier limits
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
}

function normalizeHeadline(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s) {
  const stop = new Set([
    "the","a","an","and","or","but","to","of","in","on","for","with","as","at","by",
    "from","is","are","was","were","be","been","it","this","that","these","those",
    "after","before","over","under","into","about","amid","says","say","report","reports",
    "news","update","latest","today","week","year"
  ]);

  return new Set(
    normalizeHeadline(s)
      .split(" ")
      .filter((w) => w && w.length > 2 && !stop.has(w))
  );
}

function jaccard(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const union = aSet.size + bSet.size - inter;
  return union ? inter / union : 0;
}

function isNearDuplicate(a, b) {
  const aText = `${a?.headline || a?.title || ""} ${a?.summary || ""}`;
  const bText = `${b?.headline || b?.title || ""} ${b?.summary || ""}`;
  const sim = jaccard(tokenSet(aText), tokenSet(bText));
  return sim >= 0.55;
}

function detectCategory(headline, summary) {
  const text = `${headline} ${summary}`.toLowerCase();

  if (text.match(/crypto|bitcoin|ethereum|btc|eth|blockchain|defi|nft|coinbase|binance/)) return "crypto";
  if (text.match(/real estate|housing|mortgage|property|rent|home price|reits|homebuilder/)) return "real estate";
  if (text.match(/oil|gold|silver|commodity|commodities|wheat|corn|natural gas|copper|lithium/)) return "commodities";
  if (text.match(/tech|software|ai|artificial intelligence|chip|semiconductor|apple|google|microsoft|meta|amazon|nvidia|saas/)) return "technology";
  if (text.match(/fed|inflation|gdp|unemployment|interest rate|economy|economic|recession|jobs report|cpi|ppi|fomc/)) return "economy";
  if (text.match(/stock|market|s&p|nasdaq|dow|earnings|ipo|merger|acquisition|etf|index/)) return "markets";

  return "markets";
}

function categoryImageUrl(categoryRaw) {
  const cat = safeText(categoryRaw, "default").toLowerCase();
  const map = {
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

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

// ============================================================
// API FETCHERS - OPTIMIZED FOR TOPIC COVERAGE + FREE TIER
// ============================================================

/**
 * FINNHUB - 60 calls/min limit (very generous)
 * Strategy: Multiple category calls to get diverse topics
 * Categories available: general, forex, crypto, merger
 */
async function fetchFinnhub(apiKey) {
  const categories = ["general", "crypto", "merger"];
  const allArticles = [];
  
  for (const category of categories) {
    try {
      console.log(`📡 Finnhub: Fetching ${category}...`);
      const response = await fetch(
        `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`
      );
      
      if (!response.ok) {
        console.error(`❌ Finnhub ${category} error:`, response.status);
        continue;
      }
      
      const data = await response.json();
      const articles = (data || []).slice(0, 15).map(article => ({
        headline: article.headline,
        summary: article.summary,
        url: article.url,
        source: article.source || "Finnhub",
        datetime: article.datetime ? new Date(article.datetime * 1000).toISOString() : new Date().toISOString(),
        image: article.image,
        provider: "finnhub",
        topic: category
      }));
      
      allArticles.push(...articles);
      console.log(`✅ Finnhub ${category}: ${articles.length} articles`);
      
      // Small delay between calls to be nice to the API
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`❌ Finnhub ${category} error:`, error.message);
    }
  }
  
  console.log(`📊 Finnhub total: ${allArticles.length} articles`);
  return allArticles;
}

/**
 * NEWSAPI - 100 calls/day limit (strict!)
 * Strategy: ONE broad call only to conserve quota
 * 4 calls/hour × 24 hours = 96 calls/day (just under limit)
 */
async function fetchNewsAPI(apiKey) {
  try {
    console.log("📡 NewsAPI: Fetching business headlines (1 call to conserve quota)...");
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=30&apiKey=${apiKey}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ NewsAPI error:", response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    const articles = (data?.articles || []).map(article => ({
      headline: article.title,
      summary: article.description || article.content,
      url: article.url,
      source: article.source?.name || "NewsAPI",
      datetime: article.publishedAt || new Date().toISOString(),
      image: article.urlToImage,
      provider: "newsapi",
      topic: "business"
    }));
    
    console.log(`✅ NewsAPI: ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error("❌ NewsAPI fetch error:", error.message);
    return [];
  }
}

/**
 * MARKETAUX - 100 calls/day limit
 * Strategy: 2-3 targeted topic calls per refresh
 * ~3 calls × 4/hour × 24 hours = 288 - TOO MUCH
 * Better: 2 calls per refresh = 192/day - still over
 * Safe: 1 call with multiple topics = 96/day ✓
 */
async function fetchMarketaux(apiKey) {
  try {
    console.log("📡 Marketaux: Fetching financial news...");
    // Use one call but filter for finance-related content
    const response = await fetch(
      `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&limit=30&api_token=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ Marketaux error:", response.status);
      return [];
    }
    
    const data = await response.json();
    const articles = (data?.data || []).map(article => ({
      headline: article.title,
      summary: article.description || article.snippet,
      url: article.url,
      source: article.source || "Marketaux",
      datetime: article.published_at || new Date().toISOString(),
      image: article.image_url,
      provider: "marketaux",
      topic: "finance"
    }));
    
    console.log(`✅ Marketaux: ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error("❌ Marketaux fetch error:", error.message);
    return [];
  }
}

/**
 * POLYGON - 5 calls/min free tier
 * Strategy: ONE broad call
 */
async function fetchPolygon(apiKey) {
  try {
    console.log("📡 Polygon: Fetching market news...");
    const response = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=25&apiKey=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ Polygon error:", response.status);
      return [];
    }
    
    const data = await response.json();
    const articles = (data?.results || []).map(article => ({
      headline: article.title,
      summary: article.description,
      url: article.article_url,
      source: article.publisher?.name || "Polygon",
      datetime: article.published_utc || new Date().toISOString(),
      image: article.image_url,
      provider: "polygon",
      topic: "markets"
    }));
    
    console.log(`✅ Polygon: ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error("❌ Polygon fetch error:", error.message);
    return [];
  }
}

// ============================================================
// RANKING & DEDUPLICATION
// ============================================================

function scoreArticle(article) {
  let score = 0;
  const now = Date.now();
  const articleTime = new Date(article.datetime).getTime();
  const ageMinutes = (now - articleTime) / (1000 * 60);
  
  // Recency score (newer = higher) - THIS IS THE BIGGEST FACTOR
  if (ageMinutes < 15) score += 120;       // Just broke
  else if (ageMinutes < 30) score += 100;  // Very fresh
  else if (ageMinutes < 60) score += 80;   // Fresh
  else if (ageMinutes < 120) score += 60;  // Recent
  else if (ageMinutes < 240) score += 40;  // Few hours old
  else if (ageMinutes < 480) score += 20;  // Half day
  else score += 5;                          // Old news
  
  // Source credibility bonus
  const premiumSources = [
    "reuters", "bloomberg", "wsj", "cnbc", "financial times", 
    "wall street journal", "associated press", "ap", "barrons",
    "marketwatch", "ft", "economist", "yahoo finance"
  ];
  const sourceLower = (article.source || "").toLowerCase();
  if (premiumSources.some(s => sourceLower.includes(s))) {
    score += 35;
  }
  
  // Has image bonus
  if (article.image) score += 10;
  
  // Has substantial summary
  if (article.summary && article.summary.length > 100) score += 15;
  if (article.summary && article.summary.length > 200) score += 10;
  
  // Market hours bonus (more weight during trading hours EST)
  const hour = new Date().getUTCHours() - 5; // EST
  if (hour >= 6 && hour <= 9) score += 15;   // Pre-market
  if (hour >= 9 && hour <= 16) score += 10;  // Market hours
  
  return score;
}

function pickTopDiverseArticles(articles, targetCount = 25) {
  // Sort by score descending
  const scored = articles
    .filter(a => a.headline && a.headline.length > 10) // Filter out junk
    .map(a => ({ ...a, score: scoreArticle(a) }));
  scored.sort((a, b) => b.score - a.score);
  
  const picked = [];
  const categoryCount = {};
  
  for (const article of scored) {
    if (picked.length >= targetCount) break;
    
    // Check for duplicates
    let isDuplicate = false;
    for (const p of picked) {
      if (isNearDuplicate(article, p)) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;
    
    // Category diversity: limit any single category to ~40% of results
    const category = detectCategory(article.headline || "", article.summary || "");
    const maxPerCategory = Math.ceil(targetCount * 0.4);
    
    if ((categoryCount[category] || 0) >= maxPerCategory) {
      // Skip if this category is overrepresented, unless we're running low
      const remaining = scored.length - scored.indexOf(article);
      if (remaining > targetCount - picked.length + 5) continue;
    }
    
    picked.push({ ...article, category });
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  
  // Log category distribution
  console.log("📊 Category distribution:", categoryCount);
  
  return picked;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log("🔄 [refreshNewsCache] Starting optimized cache refresh...");
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    const base44 = createClientFromRequest(req);
    
    // Get API keys from environment
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    const newsapiKey = Deno.env.get("NEWSAPI_API_KEY");
    const marketauxKey = Deno.env.get("MARKETAUX_API_KEY");
    const polygonKey = Deno.env.get("POLYGON_API_KEY");
    
    const configuredApis = {
      finnhub: !!finnhubKey,
      newsapi: !!newsapiKey,
      marketaux: !!marketauxKey,
      polygon: !!polygonKey
    };
    
    console.log("🔑 API Keys configured:", configuredApis);
    
    // Count how many APIs we have
    const apiCount = Object.values(configuredApis).filter(Boolean).length;
    if (apiCount === 0) {
      return Response.json({ 
        error: "No API keys configured. Add at least one: FINNHUB_API_KEY, NEWSAPI_API_KEY, MARKETAUX_API_KEY, or POLYGON_API_KEY" 
      }, { status: 500 });
    }
    
    // Fetch from all available sources
    // Using Promise.allSettled so one failure doesn't kill the whole thing
    const fetchPromises = [];
    const sourceNames = [];
    
    if (finnhubKey) {
      fetchPromises.push(fetchFinnhub(finnhubKey));
      sourceNames.push("finnhub");
    }
    if (newsapiKey) {
      fetchPromises.push(fetchNewsAPI(newsapiKey));
      sourceNames.push("newsapi");
    }
    if (marketauxKey) {
      fetchPromises.push(fetchMarketaux(marketauxKey));
      sourceNames.push("marketaux");
    }
    if (polygonKey) {
      fetchPromises.push(fetchPolygon(polygonKey));
      sourceNames.push("polygon");
    }
    
    const results = await Promise.allSettled(fetchPromises);
    
    // Collect successful results
    const allArticles = [];
    const successfulSources = [];
    
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allArticles.push(...result.value);
        successfulSources.push(sourceNames[index]);
      } else if (result.status === "rejected") {
        console.error(`❌ ${sourceNames[index]} failed:`, result.reason);
      }
    });
    
    console.log(`📊 Total articles fetched: ${allArticles.length} from ${successfulSources.length} sources`);
    
    if (allArticles.length === 0) {
      return Response.json({ 
        error: "No articles returned from any source",
        sources_attempted: sourceNames,
        sources_succeeded: []
      }, { status: 500 });
    }
    
    // Pick top 25-30 diverse, deduplicated articles
    const topArticles = pickTopDiverseArticles(allArticles, 30);
    console.log(`🏆 Selected ${topArticles.length} diverse stories for cache`);
    
    // Format for storage
    const formattedStories = topArticles.map((article, index) => {
      return {
        id: randomId(),
        title: safeText(article.headline, "Breaking News"),
        what_happened: safeText(article.summary, "Details emerging..."),
        why_it_matters: "", // Enhanced per-user by fetchNewsCards
        href: safeText(article.url, "#"),
        imageUrl: article.image || categoryImageUrl(article.category),
        outlet: safeText(article.source, "Unknown"),
        category: article.category,
        datetime: article.datetime,
        provider: article.provider,
        topic: article.topic,
        score: article.score,
        rank: index + 1
      };
    });
    
    // Store in NewsCache entity
    try {
      const oldCache = await base44.entities.NewsCache.filter({});
      for (const entry of oldCache) {
        await base44.entities.NewsCache.delete(entry.id);
      }
      console.log(`🗑️ Deleted ${oldCache.length} old cache entries`);
    } catch (e) {
      console.log("No existing cache to delete or error:", e.message);
    }
    
    // Create new cache entry
    const cacheEntry = await base44.entities.NewsCache.create({
      stories: JSON.stringify(formattedStories),
      refreshed_at: new Date().toISOString(),
      sources_used: successfulSources.join(","),
      total_fetched: allArticles.length,
      articles_selected: formattedStories.length
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [refreshNewsCache] Complete in ${elapsed}ms`);
    
    // Log top 5 headlines for verification
    console.log("📰 Top 5 headlines:");
    formattedStories.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.category}] ${s.title.slice(0, 60)}...`);
    });
    
    return Response.json({
      success: true,
      message: "News cache refreshed",
      stories_cached: formattedStories.length,
      total_fetched: allArticles.length,
      sources_used: successfulSources,
      sources_failed: sourceNames.filter(s => !successfulSources.includes(s)),
      refreshed_at: cacheEntry.refreshed_at,
      elapsed_ms: elapsed,
      category_breakdown: formattedStories.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {}),
      top_headlines: formattedStories.slice(0, 5).map(s => s.title)
    });
    
  } catch (error) {
    console.error("❌ [refreshNewsCache] Error:", error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
});