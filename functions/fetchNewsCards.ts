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

async function invokeLLM(base44, prompt, addInternet, schema) {
  return await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: addInternet,
    response_json_schema: schema,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};
    const count = body?.count || 5; // default 5 stories

    const prefProfile = {
      risk_tolerance: preferences?.risk_tolerance ?? preferences?.riskLevel ?? null,
      time_horizon: preferences?.time_horizon ?? preferences?.horizon ?? null,
      goals: preferences?.goals ?? null,
      sectors: preferences?.sectors ?? null,
      regions: preferences?.regions ?? null,
      watchlist: preferences?.watchlist ?? preferences?.tickers ?? null,
      holdings: preferences?.holdings ?? null,
      interests: preferences?.interests ?? null,
      constraints: preferences?.constraints ?? null,
    };

    // =========================================================
    // Fetch Breaking News Cards (fast, no audio generation)
    // =========================================================
    const newsPrompt = `
You are curating breaking financial news cards for an investor dashboard.

Fetch the TOP ${count} most important financial/market stories from the LAST 24 HOURS.

USER PROFILE (prioritize relevance):
${JSON.stringify(prefProfile, null, 2)}

Selection criteria:
1. RECENCY: Last 24 hours only
2. MARKET IMPACT: Stories that move markets
3. RELEVANCE: Match user's holdings/sectors/interests

For each story provide:
- headline: Clear, engaging title (8-12 words)
- summary: 2-3 sentences explaining what happened
- portfolio_insight: 1-2 sentences on what this means for investors (personalized to user profile)
- source: Outlet name (Reuters, Bloomberg, WSJ, etc.)
- category: [markets, crypto, economy, technology, real estate, commodities, default]
- url: Link to original article if available

Return JSON only.
`;

    const newsSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        stories: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              headline: { type: "string" },
              summary: { type: "string" },
              portfolio_insight: { type: "string" },
              source: { type: "string" },
              category: { type: "string" },
              url: { type: "string" },
            },
            required: ["headline", "summary", "portfolio_insight", "source", "category"],
          },
        },
      },
      required: ["stories"],
    };

    const newsData = await invokeLLM(base44, newsPrompt, true, newsSchema);

    if (!newsData || !Array.isArray(newsData.stories)) {
      return Response.json({ error: "Failed to fetch news stories" }, { status: 500 });
    }

    const allowedCats = new Set([
      "markets",
      "crypto",
      "economy",
      "technology",
      "real estate",
      "commodities",
      "default",
    ]);

    const newsCards = newsData.stories.map((story) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";

      return {
        id: safeText(story?.id, randomId()),
        headline: safeText(story?.headline, "Breaking News"),
        summary: safeText(story?.summary, ""),
        portfolioInsight: safeText(story?.portfolio_insight, ""),
        source: safeText(story?.source, "Unknown"),
        category,
        imageUrl: categoryImageUrl(category),
        url: safeText(story?.url, "#"),
      };
    });

    return Response.json({
      success: true,
      stories: newsCards,
      count: newsCards.length,
    });
  } catch (error) {
    console.error("Error in fetchNewsCards:", error);
    return Response.json(
      { error: error?.message || String(error), stack: error?.stack },
      { status: 500 }
    );
  }
});