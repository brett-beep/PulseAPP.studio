import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
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

// Detect category from headline/summary keywords
function detectCategory(headline, summary) {
  const text = `${headline} ${summary}`.toLowerCase();
  
  if (text.match(/crypto|bitcoin|ethereum|btc|eth|blockchain|defi|nft/)) return "crypto";
  if (text.match(/real estate|housing|mortgage|property|rent|home price/)) return "real estate";
  if (text.match(/oil|gold|silver|commodity|commodities|wheat|corn|natural gas/)) return "commodities";
  if (text.match(/tech|software|ai|artificial intelligence|chip|semiconductor|apple|google|microsoft|meta|amazon|nvidia/)) return "technology";
  if (text.match(/fed|inflation|gdp|unemployment|interest rate|economy|economic|recession|jobs report/)) return "economy";
  if (text.match(/stock|market|s&p|nasdaq|dow|earnings|ipo|merger|acquisition/)) return "markets";
  
  return "markets"; // Default to markets for financial news
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const count = body?.count || 5;
    const preferences = body?.preferences || {};

    // Get Finnhub API key from environment
    const finnhubApiKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubApiKey) {
      return Response.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });
    }

    console.log("📡 Fetching news from Finnhub API...");

    // Fetch general market news from Finnhub
    const finnhubResponse = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`
    );

    if (!finnhubResponse.ok) {
      const errorText = await finnhubResponse.text();
      console.error("Finnhub API error:", errorText);
      return Response.json({ error: "Failed to fetch news from Finnhub" }, { status: 500 });
    }

    const finnhubNews = await finnhubResponse.json();
    console.log(`📰 Received ${finnhubNews.length} articles from Finnhub`);

    if (!Array.isArray(finnhubNews) || finnhubNews.length === 0) {
      return Response.json({ error: "No news available from Finnhub" }, { status: 500 });
    }

    // Get user's interests for relevance scoring
    const userInterests = preferences?.investment_interests || preferences?.interests || [];
    const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];

    // Score and sort news by relevance to user preferences
    const scoredNews = finnhubNews.map(article => {
      let relevanceScore = 0;
      const textToSearch = `${article.headline} ${article.summary}`.toLowerCase();

      // Boost score for articles matching user interests
      if (Array.isArray(userInterests)) {
        userInterests.forEach(interest => {
          if (textToSearch.includes(interest.toLowerCase())) {
            relevanceScore += 10;
          }
        });
      }

      // Boost score for articles mentioning user's holdings
      if (Array.isArray(userHoldings)) {
        userHoldings.forEach(holding => {
          const symbol = typeof holding === 'string' ? holding : holding?.symbol;
          if (symbol && textToSearch.includes(symbol.toLowerCase())) {
            relevanceScore += 15;
          }
        });
      }

      // Recency bonus (newer = higher score)
      const articleAge = Date.now() / 1000 - article.datetime;
      const hoursOld = articleAge / 3600;
      if (hoursOld < 1) relevanceScore += 5;
      else if (hoursOld < 6) relevanceScore += 3;
      else if (hoursOld < 24) relevanceScore += 1;

      return { ...article, relevanceScore };
    });

    // Sort by relevance score (highest first), then by recency
    scoredNews.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.datetime - a.datetime;
    });

    // Take top N stories
    const topNews = scoredNews.slice(0, count);

    // Transform Finnhub format to your app's format
    const stories = topNews.map((article) => {
      const category = detectCategory(article.headline, article.summary);
      
      // Generate a "why it matters" based on category
      const whyItMatters = generateWhyItMatters(article.headline, article.summary, category, userInterests);

      return {
        id: safeText(article.id?.toString(), randomId()),
        href: safeText(article.url, "#"),
        imageUrl: article.image || categoryImageUrl(category),
        title: safeText(article.headline, ""),
        what_happened: safeText(article.summary, ""),
        why_it_matters: whyItMatters,
        both_sides: {
          side_a: whyItMatters,
          side_b: ""
        },
        outlet: safeText(article.source, "Unknown"),
        category,
        datetime: article.datetime,
      };
    });

    return Response.json({
      success: true,
      stories,
      count: stories.length,
      source: "finnhub"
    });

  } catch (error) {
    console.error("Error in fetchNewsCards:", error);
    return Response.json({ 
      error: error?.message || String(error), 
      stack: error?.stack 
    }, { status: 500 });
  }
});

// Generate investor-relevant "why it matters" summary
function generateWhyItMatters(headline, summary, category, userInterests) {
  const text = `${headline} ${summary}`.toLowerCase();
  
  // Category-specific relevance statements
  const categoryStatements = {
    crypto: "Cryptocurrency investors should monitor this development for potential market volatility.",
    "real estate": "This could impact real estate investments and housing market dynamics.",
    commodities: "Commodity traders may see price movements based on this news.",
    technology: "Tech sector investors should consider how this affects growth stocks.",
    economy: "This macroeconomic development could influence broader market sentiment.",
    markets: "Market participants should factor this into their investment decisions.",
  };

  // Check for specific themes
  if (text.includes("earnings") || text.includes("profit") || text.includes("revenue")) {
    return "Earnings results can significantly impact stock valuations and sector sentiment.";
  }
  if (text.includes("fed") || text.includes("interest rate") || text.includes("inflation")) {
    return "Fed policy and inflation data directly affect market valuations and investment strategies.";
  }
  if (text.includes("merger") || text.includes("acquisition") || text.includes("deal")) {
    return "M&A activity often signals sector consolidation and can create investment opportunities.";
  }
  if (text.includes("layoff") || text.includes("job cut") || text.includes("restructur")) {
    return "Corporate restructuring may indicate challenges but could improve long-term profitability.";
  }

  return categoryStatements[category] || categoryStatements.markets;
}