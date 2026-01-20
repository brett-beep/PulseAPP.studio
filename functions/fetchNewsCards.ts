import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
}

function stripLinksAndUrls(s) {
  if (!s) return "";
  let t = String(s);

  // Remove markdown links: [text](url) => text
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");

  // Remove raw URLs
  t = t.replace(/https?:\/\/\S+/gi, "");

  // Remove leftover "(domain.com)" style mentions often produced as citations
  t = t.replace(
    /\(\s*[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)(?:\/[^)]*)?\s*\)/gi,
    ""
  );

  // Remove utm fragments that sometimes leak without full URLs
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");

  // Cleanup formatting
  t = t.replace(/[*_`>#]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

function capToTwoSentences(text) {
  const t = safeText(text, "").trim();
  if (!t) return "";

  // Split on sentence endings. Keeps things deterministic.
  const parts = t
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  return parts.slice(0, 2).join(" ").trim();
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

  const aTokens = tokenSet(aText);
  const bTokens = tokenSet(bText);

  const sim = jaccard(aTokens, bTokens);

  // If categories differ, we tolerate more similarity (spillover stories)
  const aCat = detectCategory(a?.headline || "", a?.summary || "");
  const bCat = detectCategory(b?.headline || "", b?.summary || "");
  const differentCategory = aCat !== bCat;

  // Heuristic: if overlap is mostly a couple of named entities, don't treat as duplicate
  // (e.g., only "powell", "fed" overlap but everything else differs)
  const common = [];
  for (const t of aTokens) if (bTokens.has(t)) common.push(t);

  const entityish = new Set(["fed","federal","reserve","powell","doj","trump","court","supreme"]);
  const commonEntityishCount = common.filter(t => entityish.has(t)).length;
  const commonNonEntityishCount = common.length - commonEntityishCount;

  // Decision rule:
  // - Same category: dedupe if very similar
  // - Different category: dedupe only if extremely similar
  // - If overlap is mostly entityish and low non-entity overlap, do NOT dedupe
  if (commonNonEntityishCount <= 2 && commonEntityishCount >= 2) return false;

  if (!differentCategory) return sim >= 0.58;
  return sim >= 0.72;
}


function pickDiverseTopK(sortedArticles, k) {
  const picked = [];
  for (const art of sortedArticles) {
    if (!art?.headline && !art?.title) continue;

    let dup = false;
    for (const p of picked) {
      if (isNearDuplicate(art, p)) {
        dup = true;
        break;
      }
    }
    if (dup) continue;

    picked.push(art);
    if (picked.length >= k) break;
  }
  return picked;
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

  return "markets";
}

// Fallback if LLM fails
function generateFallbackWhyItMatters(category) {
  const statements = {
    crypto: "Monitor for potential volatility in crypto holdings.",
    "real estate": "May affect REITs and housing-related investments.",
    commodities: "Could impact commodity ETFs and related positions.",
    technology: "Consider implications for tech sector holdings.",
    economy: "May influence broader market sentiment and Fed policy expectations.",
    markets: "Factor into overall portfolio strategy.",
  };
  return statements[category] || statements.markets;
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 [fetchNewsCards] Function started");

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const count = body?.count || 5;
    const preferences = body?.preferences || {};

    // Get Finnhub API key
    const finnhubApiKey =
      Deno.env.get("FINNHUB_API_KEY") || Deno.env.get("VITE_FINNHUB_API_KEY");

    if (!finnhubApiKey) {
      return Response.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });
    }

    console.log("📡 [fetchNewsCards] Fetching news from Finnhub...");

    // Fetch general market news from Finnhub
    const finnhubResponse = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`
    );

    if (!finnhubResponse.ok) {
      const errorText = await finnhubResponse.text();
      console.error("❌ Finnhub API error:", errorText);
      return Response.json({ error: "Failed to fetch news from Finnhub" }, { status: 500 });
    }

    const finnhubNews = await finnhubResponse.json();
    console.log("🧪 [fetchNewsCards] Sample headlines (raw 10):");
(finnhubNews || []).slice(0, 10).forEach((a, i) => {
  console.log(`   RAW ${i + 1}:`, a?.headline);
});

    console.log(`📰 [fetchNewsCards] Received ${finnhubNews?.length || 0} articles`);

    if (!Array.isArray(finnhubNews) || finnhubNews.length === 0) {
      return Response.json({ error: "No news available" }, { status: 500 });
    }

    // Get user preferences for relevance scoring
    const userInterests = preferences?.investment_interests || preferences?.interests || [];
    const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];

    // Score and sort news by relevance
    const scoredNews = finnhubNews.map((article) => {
      let relevanceScore = 0;
      const textToSearch = `${article.headline || ""} ${article.summary || ""}`.toLowerCase();

      // Boost for matching interests
      if (Array.isArray(userInterests)) {
        userInterests.forEach((interest) => {
          if (interest && textToSearch.includes(String(interest).toLowerCase())) {
            relevanceScore += 10;
          }
        });
      }

      // Boost for matching holdings
      if (Array.isArray(userHoldings)) {
        userHoldings.forEach((holding) => {
          const symbol = typeof holding === "string" ? holding : holding?.symbol;
          if (symbol && textToSearch.includes(String(symbol).toLowerCase())) {
            relevanceScore += 15;
          }
        });
      }

      // Recency bonus
      const hoursOld = (Date.now() / 1000 - (article.datetime || 0)) / 3600;
      if (hoursOld < 1) relevanceScore += 5;
      else if (hoursOld < 6) relevanceScore += 3;
      else if (hoursOld < 24) relevanceScore += 1;

      return { ...article, relevanceScore };
    });

    // Sort by relevance, then recency
    scoredNews.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return (b.datetime || 0) - (a.datetime || 0);
    });

    // ✅ NEW: diversify so we don't return 5 versions of the same story
    const CANDIDATE_POOL = Math.max(40, count * 8);
    const candidates = scoredNews.slice(0, CANDIDATE_POOL);
    const topNews = pickDiverseTopK(candidates, count);

    // If diversification filtered too aggressively, backfill with the next best
    if (topNews.length < count) {
      const already = new Set(topNews.map((a) => a?.id ?? a?.url ?? a?.headline));
      for (const art of candidates) {
        const key = art?.id ?? art?.url ?? art?.headline;
        if (already.has(key)) continue;
        topNews.push(art);
        already.add(key);
        if (topNews.length >= count) break;
      }
    }

    console.log(`🧠 [fetchNewsCards] Selected ${topNews.length} diversified stories`);
console.log("🧪 [fetchNewsCards] Selected headlines (diversified):");
(topNews || []).forEach((a, i) => {
  console.log(`   PICK ${i + 1}:`, a?.headline);
});

    console.log("🤖 [fetchNewsCards] Enhancing stories with LLM...");

    // Use LLM to enhance each story with better summaries
    const enhancementPrompt = `You are a buy-side market analyst rewriting news blurbs for retail investors.

For each story, return:

1) what_happened (2-3 sentences, specific + concrete):
   - Must include at least ONE concrete anchor:
     * a number (%, $, bps, yield level, inflation print, EPS, revenue, guidance, etc.), OR
     * a named company/ticker AND the market move (e.g., “shares fell ~3% premarket”), OR
     * a clear “channel” to markets (rates, USD, oil, credit spreads, earnings, regulation, supply chain).
   - Explain the *mechanism*: WHY markets care (risk-on/off, margins, demand, policy path, liquidity, etc.).
   - DO NOT include URLs, markdown links, citations, or “(source.com)” in the text.

2) why_it_matters (1-2 sentences, actionable investor framing):
   - Call out what could move next: the specific asset class/sector/ticker sensitivity.
   - If relevant, tie directly to the user's interests/holdings.
   - Focus only on the investable implication (what could move, and why).
   - No filler, no hedging, no general advice.
   - DO NOT include URLs, markdown links, citations, or “(source.com)”.


USER PROFILE:
- Interests: ${Array.isArray(userInterests) && userInterests.length > 0 ? userInterests.join(", ") : "General markets"}
- Holdings: ${Array.isArray(userHoldings) && userHoldings.length > 0 ? userHoldings.map((h) => (typeof h === "string" ? h : h?.symbol)).join(", ") : "Not specified"}

NEWS STORIES:
${topNews
  .map(
    (article, i) => `
STORY ${i + 1}:
Headline: ${article.headline || "No headline"}
Source: ${article.source || "Unknown"}
Raw Summary: ${article.summary || "No summary available"}
URL: ${article.url || ""}
`
  )
  .join("\n")}

IMPORTANT:
- Use real numbers and data when available in the source
- If the source lacks specifics, provide informed context (e.g., typical ranges, historical comparisons)
- Tailor "why_it_matters" to the user's interests/holdings when relevant
- Keep what_happened to 2-3 sentences max
- Keep why_it_matters to 1-2 sentences max

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
    } catch (llmError) {
      console.error("⚠️ [fetchNewsCards] LLM enhancement failed, using raw summaries:", llmError);
    }

    // Build the final stories array
    const stories = topNews.map((article, index) => {
      const category = detectCategory(article.headline || "", article.summary || "");

      const enhanced =
        enhancedData?.enhanced_stories?.find((e) => e.story_index === index + 1) ||
        enhancedData?.enhanced_stories?.[index];

      const whatHappenedRaw =
        enhanced?.what_happened || safeText(article.summary, "Details pending.");

      const whyItMattersRaw =
        enhanced?.why_it_matters || generateFallbackWhyItMatters(category);

      const whatHappened = stripLinksAndUrls(whatHappenedRaw);
      const whyItMatters = capToTwoSentences(stripLinksAndUrls(whyItMattersRaw));

      return {
  id: safeText(article.id?.toString(), randomId()),
  href: safeText(article.url, "#"),
  imageUrl: article.image || categoryImageUrl(category),
  title: safeText(article.headline, ""),
  what_happened: whatHappened,
  why_it_matters: cappedWhyItMatters,
  both_sides: {
    side_a: cappedWhyItMatters,
    side_b: "",
  },
  outlet: safeText(article.source, "Unknown"),
  category,
  datetime: article.datetime,
};
    });

    console.log(`✅ [fetchNewsCards] Returning ${stories.length} enhanced stories`);

    return Response.json({
      success: true,
      stories,
      count: stories.length,
      source: "finnhub",
      enhanced: !!enhancedData,
      diversified: true,
    });
  } catch (error) {
    console.error("❌ [fetchNewsCards] Error:", error);
    return Response.json(
      {
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
});
