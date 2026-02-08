// ============================================================
// fetchNewsCards.ts - Base44 Function (v5 - Ticker-Personalized)
// STRATEGY: Ticker-specific news via Finlight → UserNewsCache (3h TTL)
//           Falls back to category-based NewsCardCache if ticker fetch fails
// Uses 0 LLM credits. 1 Finlight API request when UserNewsCache is stale.
// Returns: { market_news: [5], portfolio_news: [5] }
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
// TICKER-SPECIFIC NEWS (Finlight API)
// ============================================================

const FINLIGHT_API_BASE = "https://api.finlight.me";
const USER_CACHE_TTL_HOURS = 3;

function randomId(): string {
  try { return crypto.randomUUID(); }
  catch { return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function extractTickers(holdings: any[]): string[] {
  if (!holdings || !Array.isArray(holdings)) return [];
  return holdings
    .map((h: any) => {
      if (typeof h === "string") return h.toUpperCase().trim();
      return (h?.symbol || h?.ticker || "").toUpperCase().trim();
    })
    .filter(Boolean);
}

function getDateFromHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const TICKER_CATEGORY_KEYWORDS: Record<string, string[]> = {
  markets: ["stock", "market", "trading", "wall street", "nasdaq", "dow", "s&p", "equity", "index"],
  crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "nft", "defi", "web3"],
  economy: ["fed", "interest rate", "inflation", "gdp", "unemployment", "economy", "recession"],
  technology: ["tech", "ai", "software", "chip", "semiconductor", "saas", "cloud"],
  "real estate": ["housing", "real estate", "mortgage", "property", "reits"],
  commodities: ["oil", "gold", "silver", "commodity", "energy", "natural gas"],
};

function categorizeByKeywords(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  for (const [category, keywords] of Object.entries(TICKER_CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return category;
  }
  return "markets";
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

function sentimentToScore(sentiment: string | undefined, confidence: number | undefined): number {
  const c = Math.max(0, Math.min(1, confidence || 0));
  if (sentiment === "positive") return c * 0.5;
  if (sentiment === "negative") return -c * 0.5;
  return 0;
}

function getCategoryMessage(category: string): string {
  const messages: Record<string, string> = {
    markets: "Could impact portfolio performance and market sentiment.",
    crypto: "May signal shifts in digital asset valuations.",
    economy: "Affects broader market conditions and strategies.",
    technology: "Could influence tech sector valuations.",
    "real estate": "May impact real estate investments.",
    commodities: "Could affect commodity prices and hedging.",
  };
  return messages[category] || "Worth monitoring for portfolio implications.";
}

function transformFinlightArticle(article: any, userTickers: string[]): any {
  const title = (article.title || "Breaking News").trim();
  const summary = (article.summary || "").trim();
  const category = categorizeByKeywords(title, summary);

  // Match article's company tickers against user's holdings
  const articleTickers: string[] = (article.companies || [])
    .map((c: any) => (c.ticker || "").toUpperCase())
    .filter(Boolean);
  const matchedTickers = articleTickers.filter((t: string) => userTickers.includes(t));

  // Build personalized "why it matters" without LLM
  let whyItMatters = "";
  if (matchedTickers.length > 0) {
    whyItMatters = `Directly relevant to your holding${matchedTickers.length > 1 ? "s" : ""}: ${matchedTickers.join(", ")}. `;
  }
  whyItMatters += getCategoryMessage(category);

  return {
    id: randomId(),
    title,
    what_happened: summary || title,
    why_it_matters: whyItMatters,
    href: article.link || "#",
    imageUrl: article.images && article.images.length > 0
      ? article.images[0]
      : categoryImageUrl(category),
    outlet: article.source || "Finlight",
    category,
    datetime: article.publishDate
      ? new Date(article.publishDate).toISOString()
      : new Date().toISOString(),
    provider: "finlight",
    topics: [],
    sentiment_score: sentimentToScore(article.sentiment, article.confidence),
    matched_tickers: matchedTickers,
  };
}

function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const aWords = new Set(normalize(a).split(" ").filter(w => w.length > 3));
  const bWords = new Set(normalize(b).split(" ").filter(w => w.length > 3));
  if (aWords.size < 3 || bWords.size < 3) return false;
  let overlap = 0;
  for (const w of aWords) { if (bWords.has(w)) overlap++; }
  return overlap / Math.min(aWords.size, bWords.size) > 0.5;
}

async function fetchFinlightTickerNews(apiKey: string, tickers: string[]): Promise<any[]> {
  const tickerQuery = tickers.map(t => `ticker:${t}`).join(" OR ");
  const fromDate = getDateFromHoursAgo(48); // 48h window for broader coverage
  const toDate = new Date().toISOString().slice(0, 10);

  console.log(`🔍 Finlight ticker query: ${tickerQuery}`);

  const response = await fetch(`${FINLIGHT_API_BASE}/v2/articles`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      query: tickerQuery,
      from: fromDate,
      to: toDate,
      language: "en",
      orderBy: "publishDate",
      order: "DESC",
      pageSize: 25,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Finlight ticker query failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const articles = data.articles || [];
  console.log(`✅ Finlight returned ${articles.length} ticker-specific articles`);
  return articles;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  try {
    console.log("📰 [fetchNewsCards] Function started (v5 - Ticker-Personalized)");

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
    // FETCH PORTFOLIO NEWS
    // Strategy: ticker-specific (Finlight) → UserNewsCache → category fallback
    // =========================================================
    let portfolioNews: any = null;
    const userTickers = extractTickers(userHoldings);

    console.log(`🎯 User tickers: ${userTickers.join(", ") || "none"}`);

    // ---------------------------------------------------------
    // STRATEGY 1: Ticker-specific news from UserNewsCache / Finlight
    // ---------------------------------------------------------
    if (userTickers.length > 0) {
      const tickersKey = userTickers.slice().sort().join(",");
      const tickersHash = simpleHash(tickersKey);

      // 1a. Check UserNewsCache for a fresh hit
      try {
        const userCacheEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
          user_email: user.email,
        });

        if (userCacheEntries && userCacheEntries.length > 0) {
          const latest = userCacheEntries.sort(
            (a: any, b: any) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
          )[0];

          const cacheAgeHours = (Date.now() - new Date(latest.fetched_at).getTime()) / (1000 * 60 * 60);
          const tickersMatch = latest.tickers_hash === tickersHash;

          if (cacheAgeHours < USER_CACHE_TTL_HOURS && tickersMatch) {
            const stories = typeof latest.stories === "string" ? JSON.parse(latest.stories) : latest.stories;
            if (stories && stories.length >= 2) {
              portfolioNews = {
                summary: `News for ${userTickers.slice(0, 5).join(", ")}${userTickers.length > 5 ? ` +${userTickers.length - 5} more` : ""}`,
                stories,
                updated_at: latest.fetched_at,
                source: "ticker_cache",
              };
              console.log(`✅ Portfolio news from UserNewsCache (${cacheAgeHours.toFixed(1)}h old, ${stories.length} stories)`);
            }
          } else {
            console.log(`⏰ UserNewsCache stale (${cacheAgeHours.toFixed(1)}h) or tickers changed`);
          }
        }
      } catch (e: any) {
        // Expected if UserNewsCache entity doesn't exist yet — graceful degradation
        console.log(`⚠️ UserNewsCache read skipped: ${e.message}`);
      }

      // 1b. No cache hit → fetch live from Finlight
      if (!portfolioNews) {
        const finlightKey = Deno.env.get("FINLIGHT_API_KEY");

        if (finlightKey) {
          try {
            const rawArticles = await fetchFinlightTickerNews(finlightKey, userTickers);

            if (rawArticles.length > 0) {
              // Transform to standard story format
              const transformed = rawArticles
                .map((a: any) => transformFinlightArticle(a, userTickers))
                .filter((s: any) => !isJunkStory(s));

              // Deduplicate by title similarity
              const deduped: any[] = [];
              for (const story of transformed) {
                if (!deduped.some(existing => isSimilarTitle(existing.title, story.title))) {
                  deduped.push(story);
                }
              }

              const topStories = deduped.slice(0, 5);

              if (topStories.length >= 2) {
                portfolioNews = {
                  summary: `Latest on ${userTickers.slice(0, 5).join(", ")}${userTickers.length > 5 ? ` +${userTickers.length - 5} more` : ""}`,
                  stories: topStories,
                  updated_at: new Date().toISOString(),
                  source: "ticker_live",
                };

                // Cache for next time (non-blocking, non-fatal)
                try {
                  // Clean up old entries for this user
                  const oldEntries = await base44.asServiceRole.entities.UserNewsCache.filter({
                    user_email: user.email,
                  });
                  for (const entry of oldEntries) {
                    await base44.asServiceRole.entities.UserNewsCache.delete(entry.id);
                  }

                  await base44.asServiceRole.entities.UserNewsCache.create({
                    user_email: user.email,
                    tickers_hash: tickersHash,
                    tickers_list: userTickers.join(","),
                    stories: JSON.stringify(topStories),
                    fetched_at: new Date().toISOString(),
                  });
                  console.log(`💾 Cached ${topStories.length} ticker-specific stories for ${user.email}`);
                } catch (cacheWriteError: any) {
                  // Non-fatal: we still have stories to return, caching just failed
                  console.warn(`⚠️ UserNewsCache write failed: ${cacheWriteError.message}`);
                }

                console.log(`✅ Portfolio news: ${topStories.length} ticker-specific stories (live Finlight)`);
              } else {
                console.log(`⚠️ Only ${topStories.length} usable ticker stories, falling back to category`);
              }
            } else {
              console.log(`⚠️ Finlight returned 0 articles for tickers, falling back to category`);
            }
          } catch (fetchError: any) {
            console.error(`❌ Finlight ticker fetch failed: ${fetchError.message}`);
          }
        } else {
          console.log(`⚠️ No FINLIGHT_API_KEY, skipping ticker-specific fetch`);
        }
      }
    }

    // ---------------------------------------------------------
    // STRATEGY 2 (FALLBACK): Category-based from NewsCardCache
    // ---------------------------------------------------------
    if (!portfolioNews) {
      console.log(`📂 Falling back to category-based portfolio news (${portfolioCategory})`);
      const portfolioCacheKey = `${portfolioCategory}_PORTFOLIO_${timeVariant}`;

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
            source: "category",
          };
          console.log(`✅ Portfolio news (${portfolioCategory}): "${portfolioNews.summary}" (${portfolioNews.stories?.length || 0} stories)`);
        }
      } catch (e: any) {
        console.error("❌ Failed to fetch category portfolio news:", e.message);
      }
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
      portfolio_source: portfolioNews?.source || "category",
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
