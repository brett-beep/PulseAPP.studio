// ============================================================
// fetchNewsCards.ts - Base44 Function (v4 - Category-Based)
// Reads pre-generated cards from NewsCardCache (0 LLM credits per call)
// Returns: { market_news: [5], portfolio_news: [5] }
// Manually adding a line --- to redeploy on Base44
// ============================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function safeText(input: unknown, fallback: string = ""): string {
  const s = typeof input === "string" ? input.trim() : "";
  return s || fallback;
}

function getTimeVariant(): string {
  const hour = new Date().getUTCHours();
  // Adjust for US Eastern (UTC-5 or UTC-4 DST)
  const etHour = (hour - 5 + 24) % 24;

  if (etHour >= 4 && etHour < 12) return "MORNING";
  if (etHour >= 12 && etHour < 18) return "AFTERNOON";
  return "EVENING";
}

// Filter junk when serving fallback (raw NewsCache) so we never show blog thank-yous or low-quality sources
function isJunkStory(story: any): boolean {
  const href = (story.href || story.url || "").toLowerCase();
  const outlet = (story.outlet || story.source || "").toLowerCase();
  const title = (story.title || "").toLowerCase();
  const body = (story.what_happened || story.summary || "").toLowerCase();
  const combined = `${title} ${body}`.slice(0, 600);

  if (/blogspot|wordpress\.com|tumblr\.com|patreon|ko-fi|substack\.com\/thank/i.test(href) || /blogspot|wordpress|tumblr|patreon|ko-fi/i.test(outlet)) {
    return true;
  }
  if (/thank\s+you\s+for\s+(your\s+)?(superbly\s+)?(generous\s+)?subscription/i.test(combined)) return true;
  if (/thank\s+you\s+.*\s+subscription\s+to\s+this\s+site/i.test(combined)) return true;
  if (/greatly\s+honored\s+by\s+your\s+support/i.test(combined)) return true;
  if (/^\s*thank\s+you[,.]/i.test(combined)) return true;

  return false;
}

// ============================================================
// PORTFOLIO CATEGORY DETECTION
// ============================================================

const TECH_TICKERS = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "INTC", "AMD", "CRM", "ORCL", "ADBE", "CSCO"];
const GROWTH_TICKERS = ["TSLA", "SHOP", "SQ", "ABNB", "UBER", "LYFT", "PLTR", "SNOW", "RBLX", "DKNG", "HOOD", "RIVN", "LCID", "SOFI"];
const ENERGY_TICKERS = ["XLE", "CVX", "XOM", "COP", "SLB", "OXY", "HAL", "MPC", "PSX", "VLO", "EOG", "PXD"];
const CRYPTO_TICKERS = ["COIN", "MARA", "RIOT", "MSTR", "CLSK", "HUT", "BITF", "HIVE"];

function classifyHolding(ticker: string): string {
  const t = ticker.toUpperCase();
  if (TECH_TICKERS.includes(t)) return "TECH";
  if (GROWTH_TICKERS.includes(t)) return "GROWTH";
  if (ENERGY_TICKERS.includes(t)) return "ENERGY";
  if (CRYPTO_TICKERS.includes(t)) return "CRYPTO";
  return "MIXED";
}

function determineUserPortfolioCategory(holdings: any[]): string {
  if (!holdings || holdings.length === 0) return "MIXED";

  const categoryCounts: Record<string, number> = {
    TECH: 0,
    GROWTH: 0,
    ENERGY: 0,
    CRYPTO: 0,
    MIXED: 0,
  };

  for (const holding of holdings) {
    const ticker = typeof holding === "string" ? holding : holding?.symbol || holding?.ticker || "";
    if (!ticker) continue;

    // Check if holding already has a portfolio_category field
    const existingCategory = holding?.portfolio_category;
    if (existingCategory && categoryCounts[existingCategory] !== undefined) {
      categoryCounts[existingCategory]++;
    } else {
      // Classify based on ticker
      const category = classifyHolding(ticker);
      categoryCounts[category]++;
    }
  }

  // Crypto gets priority if user has 2+ crypto holdings (they're probably a crypto investor)
  if (categoryCounts.CRYPTO >= 2) return "CRYPTO";

  // Otherwise return the most common category
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0] || "MIXED";
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  try {
    console.log("📰 [fetchNewsCards] Function started (v4 - Category-Based, 0 LLM credits)");

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences || {};
    const userHoldings = preferences?.portfolio_holdings || preferences?.holdings || [];

    const timeVariant = getTimeVariant();
    const portfolioCategory = determineUserPortfolioCategory(userHoldings);

    console.log(`⏰ Time variant: ${timeVariant}`);
    console.log(`📊 User portfolio category: ${portfolioCategory}`);
    console.log(`📈 User holdings: ${userHoldings.length} items`);

    // =========================================================
    // FETCH MARKET NEWS (same for everyone)
    // =========================================================
    const marketCacheKey = `MARKET_${timeVariant}`;
    let marketNews: any = null;

    try {
      const marketCache = await base44.entities.NewsCardCache.filter({
        category: marketCacheKey,
      });

      if (marketCache && marketCache.length > 0) {
        const latest = marketCache.sort(
          (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        marketNews = {
          summary: latest.summary,
          stories: typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories,
          updated_at: latest.updated_at,
        };
        console.log(`✅ Market news: "${marketNews.summary}" (${marketNews.stories?.length || 0} stories)`);
      }
    } catch (e: any) {
      console.error("❌ Failed to fetch market news:", e.message);
    }

    // =========================================================
    // FETCH PORTFOLIO NEWS (based on user's category)
    // =========================================================
    const portfolioCacheKey = `${portfolioCategory}_PORTFOLIO_${timeVariant}`;
    let portfolioNews: any = null;

    try {
      const portfolioCache = await base44.entities.NewsCardCache.filter({
        category: portfolioCacheKey,
      });

      if (portfolioCache && portfolioCache.length > 0) {
        const latest = portfolioCache.sort(
          (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        portfolioNews = {
          summary: latest.summary,
          stories: typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories,
          updated_at: latest.updated_at,
        };
        console.log(`✅ Portfolio news (${portfolioCategory}): "${portfolioNews.summary}" (${portfolioNews.stories?.length || 0} stories)`);
      }
    } catch (e: any) {
      console.error("❌ Failed to fetch portfolio news:", e.message);
    }

    // =========================================================
    // FALLBACK: If NewsCardCache is empty, fall back to NewsCache
    // When on fallback you get RAW Alpha Vantage summaries (short, 1–2 sentences)
    // and generic "Why It Matters". Run generateCategoryCards on a schedule to get
    // LLM-written 400–500 char descriptions and 150–200 char takeaways instead.
    // =========================================================
    if (!marketNews || !portfolioNews) {
      console.log("⚠️ NewsCardCache not populated, falling back to NewsCache...");

      try {
        const cacheEntries = await base44.entities.NewsCache.filter({});
        if (cacheEntries && cacheEntries.length > 0) {
          const latestCache = cacheEntries.sort(
            (a: any, b: any) => new Date(b.refreshed_at).getTime() - new Date(a.refreshed_at).getTime()
          )[0];

          let allStories = JSON.parse(latestCache.stories || "[]");
          const before = allStories.length;
          allStories = allStories.filter((s: any) => !isJunkStory(s));
          if (before !== allStories.length) {
            console.log(`🧹 Fallback: filtered ${before - allStories.length} junk stories → ${allStories.length} remaining`);
          }

          if (!marketNews && allStories.length >= 5) {
            marketNews = {
              summary: "Today's top market stories",
              stories: allStories.slice(0, 5),
              updated_at: latestCache.refreshed_at,
              fallback: true,
            };
          }

          if (!portfolioNews && allStories.length >= 10) {
            portfolioNews = {
              summary: "Stories relevant to your portfolio",
              stories: allStories.slice(5, 10),
              updated_at: latestCache.refreshed_at,
              fallback: true,
            };
          }

          console.log("✅ Fallback to NewsCache successful");
        }
      } catch (fallbackError: any) {
        console.error("❌ Fallback failed:", fallbackError.message);
      }
    }

    // =========================================================
    // RETURN RESPONSE
    // =========================================================
    if (!marketNews && !portfolioNews) {
      return Response.json(
        {
          success: false,
          error: "News cards not yet generated. Please wait a few minutes.",
          hint: "Run generateCategoryCards to populate the cache.",
        },
        { status: 503 }
      );
    }

    console.log(`✅ [fetchNewsCards] Returning news (0 LLM credits)`);

    return Response.json({
      success: true,
      time_variant: timeVariant,
      portfolio_category: portfolioCategory,
      market_news: marketNews || {
        summary: "Market news unavailable",
        stories: [],
        updated_at: null,
      },
      portfolio_news: portfolioNews || {
        summary: "Portfolio news unavailable",
        stories: [],
        updated_at: null,
      },
      credits_used: 0,
    });
  } catch (error: any) {
    console.error("❌ [fetchNewsCards] Error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
