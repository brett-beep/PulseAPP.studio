// ============================================================
// refreshNewsCache.js - Base44 Function
// Runs every 15 minutes (via cron or manual trigger)
// Fetches from multiple news APIs, deduplicates, ranks, and caches top 5
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
  return sim >= 0.55; // Slightly more aggressive dedup for cross-source
}

function detectCategory(headline, summary) {
  const text = `${headline} ${summary}`.toLowerCase();

  if (text.match(/crypto|bitcoin|ethereum|btc|eth|blockchain|defi|nft/)) return "crypto";
  if (text.match(/real estate|housing|mortgage|property|rent|home price/)) return "real estate";
  if (text.match(/oil|gold|silver|commodity|commodities|wheat|corn|natural gas/)) return "commodities";
  if (text.match(/tech|software|ai|artificial intelligence|chip|semiconductor|apple|google|microsoft|meta|amazon|nvidia/)) return "technology";
  if (text.match(/fed|inflation|gdp|unemployment|interest rate|economy|economic|recession|jobs report/)) return "economy";
  if (text.match(/stock|market|s&p|nasdaq|dow|earnings|ipo|merger|acquisition/)) return "markets";

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
// API FETCHERS
// ============================================================

async function fetchFinnhub(apiKey) {
  try {
    console.log("📡 Fetching from Finnhub...");
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ Finnhub error:", response.status);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Finnhub returned ${data?.length || 0} articles`);
    
    return (data || []).map(article => ({
      headline: article.headline,
      summary: article.summary,
      url: article.url,
      source: article.source || "Finnhub",
      datetime: article.datetime ? new Date(article.datetime * 1000).toISOString() : new Date().toISOString(),
      image: article.image,
      provider: "finnhub"
    }));
  } catch (error) {
    console.error("❌ Finnhub fetch error:", error);
    return [];
  }
}

async function fetchNewsAPI(apiKey) {
  try {
    console.log("📡 Fetching from NewsAPI...");
    // Business/finance news from top sources
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20&apiKey=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ NewsAPI error:", response.status);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ NewsAPI returned ${data?.articles?.length || 0} articles`);
    
    return (data?.articles || []).map(article => ({
      headline: article.title,
      summary: article.description || article.content,
      url: article.url,
      source: article.source?.name || "NewsAPI",
      datetime: article.publishedAt || new Date().toISOString(),
      image: article.urlToImage,
      provider: "newsapi"
    }));
  } catch (error) {
    console.error("❌ NewsAPI fetch error:", error);
    return [];
  }
}

async function fetchMarketaux(apiKey) {
  try {
    console.log("📡 Fetching from Marketaux...");
    const response = await fetch(
      `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&api_token=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ Marketaux error:", response.status);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Marketaux returned ${data?.data?.length || 0} articles`);
    
    return (data?.data || []).map(article => ({
      headline: article.title,
      summary: article.description || article.snippet,
      url: article.url,
      source: article.source || "Marketaux",
      datetime: article.published_at || new Date().toISOString(),
      image: article.image_url,
      provider: "marketaux"
    }));
  } catch (error) {
    console.error("❌ Marketaux fetch error:", error);
    return [];
  }
}

async function fetchPolygon(apiKey) {
  try {
    console.log("📡 Fetching from Polygon...");
    const response = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=20&apiKey=${apiKey}`
    );
    
    if (!response.ok) {
      console.error("❌ Polygon error:", response.status);
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Polygon returned ${data?.results?.length || 0} articles`);
    
    return (data?.results || []).map(article => ({
      headline: article.title,
      summary: article.description,
      url: article.article_url,
      source: article.publisher?.name || "Polygon",
      datetime: article.published_utc || new Date().toISOString(),
      image: article.image_url,
      provider: "polygon"
    }));
  } catch (error) {
    console.error("❌ Polygon fetch error:", error);
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
  
  // Recency score (newer = higher)
  if (ageMinutes < 30) score += 100;
  else if (ageMinutes < 60) score += 80;
  else if (ageMinutes < 120) score += 60;
  else if (ageMinutes < 240) score += 40;
  else if (ageMinutes < 480) score += 20;
  else score += 5;
  
  // Source credibility bonus
  const premiumSources = ["reuters", "bloomberg", "wsj", "cnbc", "financial times", "wall street journal", "associated press", "ap"];
  const sourceLower = (article.source || "").toLowerCase();
  if (premiumSources.some(s => sourceLower.includes(s))) {
    score += 30;
  }
  
  // Has image bonus
  if (article.image) score += 10;
  
  // Has substantial summary
  if (article.summary && article.summary.length > 100) score += 15;
  
  // Market hours bonus (more weight during trading hours EST)
  const hour = new Date().getUTCHours() - 5; // EST
  if (hour >= 9 && hour <= 16) score += 10;
  
  return score;
}

function pickTop5Diverse(articles) {
  // Sort by score descending
  const scored = articles.map(a => ({ ...a, score: scoreArticle(a) }));
  scored.sort((a, b) => b.score - a.score);
  
  const picked = [];
  const usedCategories = new Set();
  
  for (const article of scored) {
    if (picked.length >= 5) break;
    
    // Check for duplicates
    let isDuplicate = false;
    for (const p of picked) {
      if (isNearDuplicate(article, p)) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;
    
    // Category diversity: try to get different categories for first 3
    const category = detectCategory(article.headline || "", article.summary || "");
    if (picked.length < 3 && usedCategories.has(category)) {
      // Skip if we already have this category in top 3, unless we're running low
      const remaining = scored.filter(a => !picked.includes(a)).length;
      if (remaining > 10) continue;
    }
    
    picked.push(article);
    usedCategories.add(category);
  }
  
  // If we didn't get 5, backfill without category restriction
  if (picked.length < 5) {
    for (const article of scored) {
      if (picked.length >= 5) break;
      if (picked.some(p => p.url === article.url)) continue;
      
      let isDuplicate = false;
      for (const p of picked) {
        if (isNearDuplicate(article, p)) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        picked.push(article);
      }
    }
  }
  
  return picked;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  try {
    console.log("🔄 [refreshNewsCache] Starting cache refresh...");
    
    const base44 = createClientFromRequest(req);
    
    // Get API keys from environment
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    const newsapiKey = Deno.env.get("NEWSAPI_API_KEY");
    const marketauxKey = Deno.env.get("MARKETAUX_API_KEY");
    const polygonKey = Deno.env.get("POLYGON_API_KEY");
    
    console.log("🔑 API Keys configured:", {
      finnhub: !!finnhubKey,
      newsapi: !!newsapiKey,
      marketaux: !!marketauxKey,
      polygon: !!polygonKey
    });
    
    // Fetch from all available sources in parallel
    const fetchPromises = [];
    
    if (finnhubKey) fetchPromises.push(fetchFinnhub(finnhubKey));
    if (newsapiKey) fetchPromises.push(fetchNewsAPI(newsapiKey));
    if (marketauxKey) fetchPromises.push(fetchMarketaux(marketauxKey));
    if (polygonKey) fetchPromises.push(fetchPolygon(polygonKey));
    
    if (fetchPromises.length === 0) {
      return Response.json({ 
        error: "No API keys configured. Please add at least one: FINNHUB_API_KEY, NEWSAPI_API_KEY, MARKETAUX_API_KEY, or POLYGON_API_KEY" 
      }, { status: 500 });
    }
    
    // Wait for all fetches to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten all articles into one array
    const allArticles = results.flat();
    console.log(`📊 Total articles fetched: ${allArticles.length}`);
    
    if (allArticles.length === 0) {
      return Response.json({ 
        error: "No articles returned from any source",
        sources_attempted: fetchPromises.length
      }, { status: 500 });
    }
    
    // Pick top 5 diverse, deduplicated articles
    const top5 = pickTop5Diverse(allArticles);
    console.log(`🏆 Selected top ${top5.length} stories`);
    
    // Format for storage
    const formattedStories = top5.map((article, index) => {
      const category = detectCategory(article.headline || "", article.summary || "");
      return {
        id: randomId(),
        title: safeText(article.headline, "Breaking News"),
        what_happened: safeText(article.summary, "Details emerging..."),
        why_it_matters: "", // Will be enhanced by LLM when fetched by user
        href: safeText(article.url, "#"),
        imageUrl: article.image || categoryImageUrl(category),
        outlet: safeText(article.source, "Unknown"),
        category: category,
        datetime: article.datetime,
        provider: article.provider,
        score: article.score,
        rank: index + 1
      };
    });
    
    // Store in NewsCache entity
    // First, delete old cache entries
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
      sources_used: [
        finnhubKey ? "finnhub" : null,
        newsapiKey ? "newsapi" : null,
        marketauxKey ? "marketaux" : null,
        polygonKey ? "polygon" : null
      ].filter(Boolean).join(","),
      total_fetched: allArticles.length,
      articles_selected: formattedStories.length
    });
    
    console.log("✅ [refreshNewsCache] Cache updated successfully");
    
    return Response.json({
      success: true,
      message: "News cache refreshed",
      stories_cached: formattedStories.length,
      total_fetched: allArticles.length,
      sources_used: cacheEntry.sources_used,
      refreshed_at: cacheEntry.refreshed_at,
      top_headlines: formattedStories.map(s => s.title)
    });
    
  } catch (error) {
    console.error("❌ [refreshNewsCache] Error:", error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
});