// ============================================================
// fetchNewsCards.ts - Base44 Function (v3 - Alpha Vantage)
// Reads from NewsCache (30 articles from Alpha Vantage)
// FILTERS by user's selected interests/topics/holdings
// Returns TOP 5 most relevant stories for the user
// Enhances with LLM personalization
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function safeText(input: unknown, fallback: string = ""): string {
  const s = typeof input === "string" ? input.trim() : "";
  return s || fallback;
}

function stripLinksAndUrls(s: string): string {
  if (!s) return "";
  let t = String(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\(\s*[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)(?:\/[^)]*)?s*\)/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");
  t = t.replace(/[*_`>#]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function capToTwoSentences(text: string): string {
  const t = safeText(text, "").trim();
  if (!t) return "";
  const parts = t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ").trim();
}

function generateFallbackWhyItMatters(category: string): string {
  const statements: Record<string, string> = {
    crypto: "Monitor for potential volatility in crypto holdings.",
    "real estate": "May affect REITs and housing-related investments.",
    commodities: "Could impact commodity ETFs and related positions.",
    technology: "Consider implications for tech sector holdings.",
    economy: "May influence broader market sentiment and Fed policy expectations.",
    markets: "Factor into overall portfolio strategy.",
  };
  return statements[category] || statements.markets;
}

// ============================================================
// INTEREST MATCHING - Maps user interests to categories/keywords
// ============================================================

const INTEREST_TO_CATEGORIES: Record<string, string[]> = {
  // Direct category matches
  "crypto": ["crypto"],
  "cryptocurrency": ["crypto"],
  "bitcoin": ["crypto"],
  "ethereum": ["crypto"],
  "blockchain": ["crypto"],
  
  "real estate": ["real estate"],
  "reits": ["real estate"],
  "housing": ["real estate"],
  "property": ["real estate"],
  
  "commodities": ["commodities"],
  "gold": ["commodities"],
  "oil": ["commodities"],
  "silver": ["commodities"],
  "energy": ["commodities"],
  
  "technology": ["technology"],
  "tech": ["technology"],
  "ai": ["technology"],
  "artificial intelligence": ["technology"],
  "software": ["technology"],
  "semiconductors": ["technology"],
  
  "economy": ["economy"],
  "macro": ["economy"],
  "federal reserve": ["economy"],
  "fed": ["economy"],
  "interest rates": ["economy"],
  "inflation": ["economy"],
  
  "markets": ["markets"],
  "stocks": ["markets"],
  "equities": ["markets"],
  "etfs": ["markets"],
  "index funds": ["markets"],
  "s&p 500": ["markets"],
  "nasdaq": ["markets"],
  
  // Broader interests that span multiple categories
  "growth stocks": ["technology", "markets"],
  "value investing": ["markets", "economy"],
  "dividends": ["markets", "real estate"],
  "passive income": ["real estate", "markets"],
  "retirement": ["markets", "economy"],
  "trading": ["markets", "crypto"],
};

// Keywords to search in headlines/summaries for each interest
const INTEREST_KEYWORDS: Record<string, string[]> = {
  "crypto": ["crypto", "bitcoin", "btc", "ethereum", "eth", "blockchain", "defi", "nft", "coinbase", "binance", "altcoin"],
  "real estate": ["real estate", "housing", "mortgage", "property", "rent", "home", "reits", "homebuilder", "zillow", "construction"],
  "commodities": ["oil", "gold", "silver", "commodity", "wheat", "corn", "natural gas", "copper", "lithium", "metals", "mining", "energy"],
  "technology": ["tech", "software", "ai", "chip", "semiconductor", "apple", "google", "microsoft", "meta", "amazon", "nvidia", "saas", "cloud"],
  "economy": ["fed", "inflation", "gdp", "unemployment", "interest rate", "economy", "recession", "jobs", "cpi", "ppi", "fomc", "powell", "treasury"],
  "markets": ["stock", "market", "s&p", "nasdaq", "dow", "earnings", "ipo", "merger", "acquisition", "etf", "index", "rally", "selloff"],
};

function getMatchingCategories(userInterests: string[]): string[] {
  const categories = new Set<string>();
  
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    
    // Check direct mapping
    if (INTEREST_TO_CATEGORIES[interestLower]) {
      INTEREST_TO_CATEGORIES[interestLower].forEach(c => categories.add(c));
    }
    
    // Also do partial matching
    for (const [key, cats] of Object.entries(INTEREST_TO_CATEGORIES)) {
      if (interestLower.includes(key) || key.includes(interestLower)) {
        cats.forEach(c => categories.add(c));
      }
    }
  }
  
  return Array.from(categories);
}

function getMatchingKeywords(userInterests: string[]): string[] {
  const keywords = new Set<string>();
  
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    
    // Add the interest itself as a keyword
    keywords.add(interestLower);
    
    // Add related keywords
    for (const [category, kws] of Object.entries(INTEREST_KEYWORDS)) {
      if (interestLower.includes(category) || category.includes(interestLower)) {
        kws.forEach(k => keywords.add(k));
      }
    }
  }
  
  return Array.from(keywords);
}

// ============================================================
// PERSONALIZED SCORING
// ============================================================

interface CachedStory {
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
  topics?: string[];
  sentiment_score?: number;
  urgency_score?: number;
  rank?: number;
}

function scoreArticleForUser(
  article: CachedStory, 
  userCategories: string[], 
  userKeywords: string[], 
  userHoldings: any[]
): number {
  let relevanceScore = 0;
  const articleText = `${article.title} ${article.what_happened}`.toLowerCase();
  const articleCategory = (article.category || "").toLowerCase();
  
  // 1. Category match (high value - 50 points)
  if (userCategories.includes(articleCategory)) {
    relevanceScore += 50;
  }
  
  // 2. Keyword matches in headline/summary (20 points each)
  for (const keyword of userKeywords) {
    if (articleText.includes(keyword)) {
      relevanceScore += 20;
    }
  }
  
  // 3. Holdings match (highest value - user owns this!)
  for (const holding of userHoldings) {
    const symbol = (typeof holding === "string" ? holding : holding?.symbol || "").toLowerCase();
    const name = (typeof holding === "string" ? "" : holding?.name || "").toLowerCase();
    
    if (symbol && articleText.includes(symbol)) {
      relevanceScore += 100; // Very high - directly about their holding
    }
    if (name && name.length > 3 && articleText.includes(name)) {
      relevanceScore += 80;
    }
  }
  
  // 4. Inherit urgency score from cache (provides recency/importance weight)
  relevanceScore += (article.urgency_score || 0) * 0.5;
  
  // 5. Sentiment strength bonus (strong sentiment = more actionable)
  const sentimentStrength = Math.abs(article.sentiment_score || 0);
  relevanceScore += sentimentStrength * 20;
  
  return Math.round(relevanceScore);
}

function filterAndRankForUser(
  cachedStories: CachedStory[], 
  preferences: any, 
  count: number
): CachedStory[] {
  const userInterests = preferences?.investment_interests || preferences?.interests || [];
  const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];
  
  console.log(`🎯 [Filter] User interests: ${userInterests.join(", ") || "none"}`);
  console.log(`🎯 [Filter] User holdings: ${userHoldings.length} items`);
  
  // If user has no preferences, return top stories by urgency score
  if (userInterests.length === 0 && userHoldings.length === 0) {
    console.log("📰 [Filter] No preferences - returning top stories by urgency score");
    return cachedStories
      .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
      .slice(0, count);
  }
  
  // Get matching categories and keywords
  const userCategories = getMatchingCategories(userInterests);
  const userKeywords = getMatchingKeywords(userInterests);
  
  console.log(`🎯 [Filter] Matching categories: ${userCategories.join(", ")}`);
  console.log(`🎯 [Filter] Keywords to match: ${userKeywords.slice(0, 10).join(", ")}...`);
  
  // Score each article for this user
  const scoredArticles = cachedStories.map(article => ({
    ...article,
    userRelevanceScore: scoreArticleForUser(article, userCategories, userKeywords, userHoldings)
  }));
  
  // Sort by user relevance (high relevance first), then by urgency score
  scoredArticles.sort((a, b) => {
    // Primary: relevance score
    if (b.userRelevanceScore !== a.userRelevanceScore) {
      return b.userRelevanceScore - a.userRelevanceScore;
    }
    // Secondary: urgency score
    return (b.urgency_score || 0) - (a.urgency_score || 0);
  });
  
  // Log what we're returning
  console.log("📰 [Filter] Top picks for user:");
  scoredArticles.slice(0, count).forEach((a, i) => {
    console.log(`   ${i + 1}. [relevance:${a.userRelevanceScore}] [urgency:${a.urgency_score}] [${a.category}] ${a.title.slice(0, 50)}...`);
  });
  
  // If top results have 0 relevance, mix in some top-ranked general news
  const topPicks = scoredArticles.slice(0, count);
  const hasRelevantNews = topPicks.some(a => a.userRelevanceScore > 0);
  
  if (!hasRelevantNews) {
    console.log("⚠️ [Filter] No highly relevant news found - returning top general news");
    return cachedStories
      .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
      .slice(0, count);
  }
  
  return topPicks;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  try {
    console.log("📰 [fetchNewsCards] Function started (v3 - Alpha Vantage)");

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const count = body?.count || 5; // Default to 5 stories
    const preferences = body?.preferences || {};

    // =========================================================
    // READ FROM CACHE
    // =========================================================
    console.log("📦 [fetchNewsCards] Reading from NewsCache...");
    
    let cachedStories: CachedStory[] = [];
    let cacheAge = null;
    let cacheInfo: any = {};
    
    try {
      const cacheEntries = await base44.entities.NewsCache.filter({});
      
      if (cacheEntries && cacheEntries.length > 0) {
        const latestCache = cacheEntries.sort((a: any, b: any) => 
          new Date(b.refreshed_at).getTime() - new Date(a.refreshed_at).getTime()
        )[0];
        
        cachedStories = JSON.parse(latestCache.stories || "[]");
        cacheAge = latestCache.refreshed_at;
        cacheInfo = {
          sources: latestCache.sources_used,
          total: latestCache.total_fetched,
          selected: latestCache.articles_selected
        };
        
        console.log(`✅ [fetchNewsCards] Found ${cachedStories.length} cached stories from ${cacheAge}`);
      } else {
        console.log("⚠️ [fetchNewsCards] No cache found");
        return Response.json({
          success: false,
          error: "News cache is empty. Please wait for the next refresh cycle.",
          stories: [],
          cached: false
        });
      }
    } catch (cacheError: any) {
      console.error("❌ [fetchNewsCards] Cache read error:", cacheError);
      return Response.json({
        success: false,
        error: "Failed to read news cache: " + cacheError.message,
        stories: []
      });
    }

    // Check cache age
    if (cacheAge) {
      const ageMs = Date.now() - new Date(cacheAge).getTime();
      const ageMinutes = Math.round(ageMs / 60000);
      console.log(`⏱️ [fetchNewsCards] Cache age: ${ageMinutes} minutes`);
    }

    // =========================================================
    // FILTER BY USER INTERESTS - Get top 5 for this user
    // =========================================================
    const personalizedStories = filterAndRankForUser(cachedStories, preferences, count);

    // =========================================================
    // ENHANCE WITH LLM (personalized "why it matters")
    // =========================================================
    const userInterests = preferences?.investment_interests || preferences?.interests || [];
    const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];

    console.log("🤖 [fetchNewsCards] Enhancing stories with LLM personalization...");

    const enhancementPrompt = `You are a buy-side market analyst rewriting news blurbs for a retail investor.

For each story, provide a personalized "why_it_matters" explanation:

1) what_happened (2-3 sentences, specific + concrete):
   - Include at least ONE concrete anchor: a number (%, $, bps), named company/ticker, or clear market mechanism
   - Explain WHY markets care
   - NO URLs or citations

2) why_it_matters (CRITICAL: Maximum 35-45 words, 2 sentences):
   - Specific investment impact only
   - If the user owns relevant holdings, mention them directly
   - NO hedging words (could/may/might)
   - Be concise and actionable

USER PROFILE:
- Interests: ${Array.isArray(userInterests) && userInterests.length > 0 ? userInterests.join(", ") : "General markets"}
- Holdings: ${Array.isArray(userHoldings) && userHoldings.length > 0 ? userHoldings.map((h: any) => (typeof h === "string" ? h : h?.symbol)).join(", ") : "Not specified"}

NEWS STORIES:
${personalizedStories
  .map(
    (article, i) => `
STORY ${i + 1}:
Headline: ${article.title || "No headline"}
Source: ${article.outlet || "Unknown"}
Category: ${article.category || "General"}
Sentiment: ${article.sentiment_score && article.sentiment_score > 0.1 ? "Bullish" : article.sentiment_score && article.sentiment_score < -0.1 ? "Bearish" : "Neutral"}
Raw Summary: ${article.what_happened || "No summary available"}
`
  )
  .join("\n")}

Return JSON only.`;

    const enhancementSchema = {
      type: "object",
      properties: {
        enhanced_stories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              story_index: { type: "number" },
              what_happened: { type: "string" },
              why_it_matters: { type: "string" },
            },
            required: ["story_index", "what_happened", "why_it_matters"],
          },
        },
      },
      required: ["enhanced_stories"],
    };

    let enhancedData = null;
    try {
      enhancedData = await base44.integrations.Core.InvokeLLM({
        prompt: enhancementPrompt,
        add_context_from_internet: true,
        response_json_schema: enhancementSchema,
      });
      console.log("✅ [fetchNewsCards] LLM enhancement complete");
    } catch (llmError: any) {
      console.error("⚠️ [fetchNewsCards] LLM enhancement failed:", llmError.message);
    }

    // Build final stories array
    const stories = personalizedStories.map((article, index) => {
      const enhanced =
        enhancedData?.enhanced_stories?.find((e: any) => e.story_index === index + 1) ||
        enhancedData?.enhanced_stories?.[index];

      const whatHappenedRaw =
        enhanced?.what_happened || safeText(article.what_happened, "Details pending.");
      const whyItMattersRaw =
        enhanced?.why_it_matters || article.why_it_matters || generateFallbackWhyItMatters(article.category);

      const whatHappened = stripLinksAndUrls(whatHappenedRaw);
      const whyItMatters = capToTwoSentences(stripLinksAndUrls(whyItMattersRaw));

      return {
        id: article.id,
        href: article.href,
        imageUrl: article.imageUrl,
        title: article.title,
        what_happened: whatHappened,
        why_it_matters: whyItMatters,
        both_sides: {
          side_a: whyItMatters,
          side_b: "",
        },
        outlet: article.outlet,
        category: article.category,
        datetime: article.datetime,
        provider: article.provider,
        sentiment_score: article.sentiment_score,
        urgency_score: article.urgency_score,
        rank: article.rank,
        userRelevanceScore: (article as any).userRelevanceScore
      };
    });

    console.log(`✅ [fetchNewsCards] Returning ${stories.length} personalized stories`);

    return Response.json({
      success: true,
      stories,
      count: stories.length,
      source: "cache",
      cache_age: cacheAge,
      cache_info: cacheInfo,
      enhanced: !!enhancedData,
      personalized: true,
      user_interests: userInterests,
    });
  } catch (error: any) {
    console.error("❌ [fetchNewsCards] Error:", error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
});
