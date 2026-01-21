// ============================================================
// refreshNewsCache.js - Base44 Function (v3 - STRICTER DEDUP)
// Runs every 15 minutes
// Now with MUCH stricter duplicate detection to prevent
// multiple stories about the same topic
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
    "news","update","latest","today","week","year","could","would","should","will",
    "have","has","had","being","its","their","there","where","when","what","which"
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

// ============================================================
// STRICTER DUPLICATE DETECTION
// ============================================================

function isNearDuplicate(a, b) {
  const aHeadline = (a?.headline || a?.title || "").toLowerCase();
  const bHeadline = (b?.headline || b?.title || "").toLowerCase();
  const aSummary = (a?.summary || "").toLowerCase();
  const bSummary = (b?.summary || "").toLowerCase();
  
  // 1. Extract key entities (people, organizations, specific terms)
  const extractEntities = (text) => {
    const entities = new Set();
    
    // Named people - common in financial news
    const people = text.match(/\b(powell|trump|biden|yellen|hassett|cook|musk|bezos|buffett|dimon|gensler|lagarde|bailey)\b/gi) || [];
    people.forEach(p => entities.add("person:" + p.toLowerCase()));
    
    // Organizations
    const orgs = [
      { pattern: /\bfed(eral reserve)?\b/gi, key: "org:fed" },
      { pattern: /\bsupreme court\b/gi, key: "org:scotus" },
      { pattern: /\bdoj|department of justice\b/gi, key: "org:doj" },
      { pattern: /\bsec\b/gi, key: "org:sec" },
      { pattern: /\btreasury\b/gi, key: "org:treasury" },
      { pattern: /\bfomc\b/gi, key: "org:fomc" },
    ];
    orgs.forEach(({ pattern, key }) => {
      if (pattern.test(text)) entities.add(key);
    });
    
    // Key event terms
    const events = text.match(/\b(investigation|lawsuit|ruling|hearing|testimony|indictment|resignation|nomination|appointment|impeach|criminal|charged|subpoena)\b/gi) || [];
    events.forEach(e => entities.add("event:" + e.toLowerCase()));
    
    // Tickers/Companies
    const tickers = text.match(/\b(aapl|googl|msft|amzn|nvda|tsla|meta|nflx)\b/gi) || [];
    tickers.forEach(t => entities.add("ticker:" + t.toUpperCase()));
    
    return entities;
  };
  
  const aEntities = extractEntities(aHeadline + " " + aSummary);
  const bEntities = extractEntities(bHeadline + " " + bSummary);
  
  // Count entity overlap
  let entityOverlap = 0;
  const sharedEntities = [];
  for (const e of aEntities) {
    if (bEntities.has(e)) {
      entityOverlap++;
      sharedEntities.push(e);
    }
  }
  
  // If 3+ key entities match, these are about the same topic
  if (entityOverlap >= 3) {
    console.log(`🔄 DUPE (${entityOverlap} entities: ${sharedEntities.join(", ")})`);
    console.log(`   A: "${aHeadline.slice(0,50)}..."`);
    console.log(`   B: "${bHeadline.slice(0,50)}..."`);
    return true;
  }
  
  // 2. Specific combination checks (known duplicate patterns)
  const hasPowellFed = (text) => text.includes("powell") && (text.includes("fed") || text.includes("reserve"));
  const hasScotus = (text) => text.includes("supreme court");
  const hasInvestigation = (text) => text.includes("investigation") || text.includes("criminal") || text.includes("doj");
  
  // Powell + Fed + Investigation = same story cluster
  if (hasPowellFed(aHeadline) && hasPowellFed(bHeadline)) {
    if (hasInvestigation(aHeadline + aSummary) && hasInvestigation(bHeadline + bSummary)) {
      console.log(`🔄 DUPE (Powell+Fed+Investigation pattern)`);
      return true;
    }
    if (hasScotus(aHeadline + aSummary) && hasScotus(bHeadline + bSummary)) {
      console.log(`🔄 DUPE (Powell+Fed+SCOTUS pattern)`);
      return true;
    }
  }
  
  // 3. Headline word overlap check
  const getSignificantWords = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !["this", "that", "with", "from", "have", "been", "will", "could", "would", "about", "after", "their", "there", "which", "what", "when", "says", "said"].includes(w));
  };
  
  const aWords = new Set(getSignificantWords(aHeadline));
  const bWords = new Set(getSignificantWords(bHeadline));
  
  let wordOverlap = 0;
  for (const w of aWords) {
    if (bWords.has(w)) wordOverlap++;
  }
  
  const overlapRatio = wordOverlap / Math.min(aWords.size, bWords.size);
  
  if (overlapRatio > 0.5 && wordOverlap >= 3) {
    console.log(`🔄 DUPE (headline overlap: ${wordOverlap} words, ${(overlapRatio*100).toFixed(0)}%)`);
    return true;
  }
  
  // 4. Full text Jaccard similarity (lower threshold)
  const aText = `${aHeadline} ${aSummary}`;
  const bText = `${bHeadline} ${bSummary}`;
  const sim = jaccard(tokenSet(aText), tokenSet(bText));
  
  if (sim >= 0.40) {
    console.log(`🔄 DUPE (jaccard=${sim.toFixed(2)})`);
    return true;
  }
  
  return false;
}

// ============================================================
// TOPIC CLUSTERING - Prevents multiple stories on same topic
// ============================================================

function getTopicCluster(headline, summary) {
  const text = ((headline || "") + " " + (summary || "")).toLowerCase();
  
  // Specific topic patterns - only 1 article per cluster allowed
  const patterns = [
    { pattern: /powell.*(investigation|criminal|doj|indictment)/i, cluster: "powell_investigation" },
    { pattern: /(investigation|criminal|doj).*(powell|fed chair)/i, cluster: "powell_investigation" },
    { pattern: /supreme court.*(fed|federal reserve|powell)/i, cluster: "scotus_fed" },
    { pattern: /(fed|federal reserve).*(supreme court|independence)/i, cluster: "scotus_fed" },
    { pattern: /trump.*(powell|fed chair|federal reserve)/i, cluster: "trump_fed" },
    { pattern: /powell.*(trump|president)/i, cluster: "trump_fed" },
    { pattern: /bitcoin.*(etf|price|rally|crash)/i, cluster: "bitcoin_price" },
    { pattern: /ethereum.*(etf|price|rally|crash)/i, cluster: "ethereum_price" },
    { pattern: /nvidia.*(earnings|stock|shares|revenue)/i, cluster: "nvidia" },
    { pattern: /apple.*(earnings|stock|shares|revenue|iphone)/i, cluster: "apple" },
    { pattern: /tesla.*(earnings|stock|shares|musk)/i, cluster: "tesla" },
    { pattern: /rate (cut|hike|decision).*(fed|fomc)/i, cluster: "fed_rates" },
    { pattern: /(fed|fomc).*(rate|rates|policy)/i, cluster: "fed_rates" },
    { pattern: /inflation.*(cpi|report|data)/i, cluster: "inflation_data" },
    { pattern: /jobs report|employment.*(data|report)/i, cluster: "jobs_data" },
  ];
  
  for (const { pattern, cluster } of patterns) {
    if (pattern.test(text)) {
      return cluster;
    }
  }
  
  return null; // No specific cluster
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
// API FETCHERS
// ============================================================

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
      
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`❌ Finnhub ${category} error:`, error.message);
    }
  }
  
  console.log(`📊 Finnhub total: ${allArticles.length} articles`);
  return allArticles;
}

async function fetchNewsAPI(apiKey) {
  try {
    console.log("📡 NewsAPI: Fetching business headlines...");
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

async function fetchMarketaux(apiKey) {
  try {
    console.log("📡 Marketaux: Fetching financial news...");
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
// SCORING & SELECTION
// ============================================================

function scoreArticle(article) {
  let score = 0;
  const now = Date.now();
  const articleTime = new Date(article.datetime).getTime();
  const ageMinutes = (now - articleTime) / (1000 * 60);
  
  // Recency (biggest factor)
  if (ageMinutes < 15) score += 120;
  else if (ageMinutes < 30) score += 100;
  else if (ageMinutes < 60) score += 80;
  else if (ageMinutes < 120) score += 60;
  else if (ageMinutes < 240) score += 40;
  else if (ageMinutes < 480) score += 20;
  else score += 5;
  
  // Source credibility
  const premiumSources = [
    "reuters", "bloomberg", "wsj", "cnbc", "financial times", 
    "wall street journal", "associated press", "ap", "barrons",
    "marketwatch", "ft", "economist", "yahoo finance"
  ];
  const sourceLower = (article.source || "").toLowerCase();
  if (premiumSources.some(s => sourceLower.includes(s))) {
    score += 35;
  }
  
  // Content quality
  if (article.image) score += 10;
  if (article.summary && article.summary.length > 100) score += 15;
  if (article.summary && article.summary.length > 200) score += 10;
  
  // Market hours bonus
  const hour = new Date().getUTCHours() - 5;
  if (hour >= 6 && hour <= 9) score += 15;
  if (hour >= 9 && hour <= 16) score += 10;
  
  return score;
}

function pickTopDiverseArticles(articles, targetCount = 25) {
  console.log(`\n🎯 Selecting top ${targetCount} from ${articles.length} articles...`);
  
  // Filter and score
  const scored = articles
    .filter(a => a.headline && a.headline.length > 10)
    .map(a => ({ ...a, score: scoreArticle(a) }));
  scored.sort((a, b) => b.score - a.score);
  
  const picked = [];
  const categoryCount = {};
  const usedClusters = new Set();
  
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
    
    // Check topic cluster - only 1 per cluster
    const cluster = getTopicCluster(article.headline, article.summary);
    if (cluster && usedClusters.has(cluster)) {
      console.log(`⏭️ SKIP (cluster "${cluster}" used): ${article.headline?.slice(0,50)}...`);
      continue;
    }
    
    // Category limits (max 35%)
    const category = detectCategory(article.headline || "", article.summary || "");
    const maxPerCategory = Math.ceil(targetCount * 0.35);
    
    if ((categoryCount[category] || 0) >= maxPerCategory) {
      const remaining = scored.length - scored.indexOf(article);
      if (remaining > targetCount - picked.length + 5) {
        console.log(`⏭️ SKIP (category "${category}" at limit): ${article.headline?.slice(0,50)}...`);
        continue;
      }
    }
    
    // Accept this article
    console.log(`✅ PICK #${picked.length + 1} [${category}] ${cluster ? `(${cluster})` : ""}: ${article.headline?.slice(0,60)}...`);
    picked.push({ ...article, category });
    categoryCount[category] = (categoryCount[category] || 0) + 1;
    if (cluster) usedClusters.add(cluster);
  }
  
  console.log("\n📊 Final category distribution:", categoryCount);
  console.log("📊 Topic clusters covered:", Array.from(usedClusters));
  
  return picked;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔄 [refreshNewsCache] Starting v3 (stricter dedup)...");
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log("=".repeat(60));
    
    const base44 = createClientFromRequest(req);
    
    // Get API keys
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    const newsapiKey = Deno.env.get("NEWSAPI_API_KEY");
    const marketauxKey = Deno.env.get("MARKETAUX_API_KEY");
    const polygonKey = Deno.env.get("POLYGON_API_KEY");
    
    console.log("🔑 APIs configured:", {
      finnhub: !!finnhubKey,
      newsapi: !!newsapiKey,
      marketaux: !!marketauxKey,
      polygon: !!polygonKey
    });
    
    const apiCount = [finnhubKey, newsapiKey, marketauxKey, polygonKey].filter(Boolean).length;
    if (apiCount === 0) {
      return Response.json({ 
        error: "No API keys configured" 
      }, { status: 500 });
    }
    
    // Fetch from all sources
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
    
    // Collect results
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
    
    console.log(`\n📊 Total fetched: ${allArticles.length} from ${successfulSources.join(", ")}`);
    
    if (allArticles.length === 0) {
      return Response.json({ 
        error: "No articles from any source",
        sources_attempted: sourceNames
      }, { status: 500 });
    }
    
    // Pick diverse articles with strict dedup
    const topArticles = pickTopDiverseArticles(allArticles, 30);
    
    // Format for storage
    const formattedStories = topArticles.map((article, index) => ({
      id: randomId(),
      title: safeText(article.headline, "Breaking News"),
      what_happened: safeText(article.summary, "Details emerging..."),
      why_it_matters: "",
      href: safeText(article.url, "#"),
      imageUrl: article.image || categoryImageUrl(article.category),
      outlet: safeText(article.source, "Unknown"),
      category: article.category,
      datetime: article.datetime,
      provider: article.provider,
      topic: article.topic,
      score: article.score,
      rank: index + 1
    }));
    
    // Clear old cache
    try {
      const oldCache = await base44.entities.NewsCache.filter({});
      for (const entry of oldCache) {
        await base44.entities.NewsCache.delete(entry.id);
      }
      console.log(`🗑️ Cleared ${oldCache.length} old cache entries`);
    } catch (e) {
      console.log("Cache clear note:", e.message);
    }
    
    // Save new cache
    const cacheEntry = await base44.entities.NewsCache.create({
      stories: JSON.stringify(formattedStories),
      refreshed_at: new Date().toISOString(),
      sources_used: successfulSources.join(","),
      total_fetched: allArticles.length,
      articles_selected: formattedStories.length
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(60));
    console.log(`✅ COMPLETE in ${elapsed}ms`);
    console.log(`📰 Cached ${formattedStories.length} diverse stories`);
    console.log("=".repeat(60) + "\n");
    
    return Response.json({
      success: true,
      message: "News cache refreshed (v3 - strict dedup)",
      stories_cached: formattedStories.length,
      total_fetched: allArticles.length,
      sources_used: successfulSources,
      refreshed_at: cacheEntry.refreshed_at,
      elapsed_ms: elapsed,
      category_breakdown: formattedStories.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {}),
      top_5_headlines: formattedStories.slice(0, 5).map(s => `[${s.category}] ${s.title}`)
    });
    
  } catch (error) {
    console.error("❌ [refreshNewsCache] Error:", error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
});