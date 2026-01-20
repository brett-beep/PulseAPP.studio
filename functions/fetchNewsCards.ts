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
    const count = body?.count || 5;
    const preferences = body?.preferences || {};

    const prefProfile = {
      interests: preferences?.interests ?? preferences?.investment_interests ?? null,
      holdings: preferences?.holdings ?? preferences?.portfolio_holdings ?? null,
      goals: preferences?.goals ?? preferences?.investment_goals ?? null,
    };

    console.log("📡 Fetching news cards with preferences:", prefProfile);

    const newsPrompt = `
You are curating ${count} TOP NEWS STORIES for an investor news feed.

CRITICAL: These must be REAL, CURRENT financial/market news from the last 24 hours.

USER PROFILE (use to PRIORITIZE relevant stories):
${JSON.stringify(prefProfile, null, 2)}

${prefProfile.interests && Array.isArray(prefProfile.interests) && prefProfile.interests.length > 0 
  ? `\nPRIORITY INTERESTS: ${prefProfile.interests.join(', ')}. Prioritize stories in these areas.`
  : ''}

LENGTH REQUIREMENTS:
- headline: 60-80 characters max (be punchy and direct)
- what_happened: 3-5 full sentences with complete context, details, and facts. Do NOT truncate or cut off mid-sentence.
- portfolio_impact: 2-3 full sentences explaining why this matters to investors. Do NOT truncate or cut off mid-sentence.

For each story return:
- headline: attention-grabbing title (60-80 chars)
- what_happened: 3-5 complete sentences of facts and context
- portfolio_impact: 2-3 complete sentences on investor relevance
- source: outlet name (Reuters, Bloomberg, WSJ, CNBC, etc.)
- category: [markets, economy, technology, crypto, real estate, commodities, default]

Return JSON with array of ${count} stories.
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
              headline: { type: "string", maxLength: 80 },
              what_happened: { type: "string" },
              portfolio_impact: { type: "string" },
              source: { type: "string" },
              category: { type: "string" },
              href: { type: "string" },
            },
            required: ["headline", "what_happened", "portfolio_impact", "source", "category"],
          },
        },
      },
      required: ["stories"],
    };

    const newsData = await invokeLLM(base44, newsPrompt, true, newsSchema);

    if (!newsData || !Array.isArray(newsData.stories)) {
      return Response.json({ error: "Failed to fetch news stories" }, { status: 500 });
    }

    const allowedCats = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);

    // Only truncate headline
    const truncateHeadline = (text, maxLen) => {
      const clean = safeText(text, "");
      if (clean.length <= maxLen) return clean;
      return clean.substring(0, maxLen - 3) + "...";
    };

    const stories = newsData.stories.map((story) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";

      return {
        id: safeText(story?.id, randomId()),
        href: safeText(story?.href, "#"),
        imageUrl: categoryImageUrl(category),
        title: truncateHeadline(story?.headline, 80),
        what_happened: safeText(story?.what_happened, ""),
        why_it_matters: safeText(story?.portfolio_impact, ""),
        both_sides: {
          side_a: safeText(story?.portfolio_impact, ""),
          side_b: ""
        },
        outlet: safeText(story?.source, "Unknown"),
        category,
      };
    });

    return Response.json({
      success: true,
      stories,
      count: stories.length,
    });

  } catch (error) {
    console.error("Error in fetchNewsCards:", error);
    return Response.json({ 
      error: error?.message || String(error), 
      stack: error?.stack 
    }, { status: 500 });
  }
});