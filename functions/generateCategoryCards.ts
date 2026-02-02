// generateCategoryCards.ts - Pre-generates news card sets for all portfolio categories
// Runs on schedule (every 15-60 min depending on market hours)
// Costs: 6 LLM credits per run (one per category)

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function getTimeVariant(): string {
  const hour = new Date().getUTCHours();
  // Adjust for US Eastern (UTC-5 or UTC-4 DST)
  const etHour = (hour - 5 + 24) % 24;
  
  if (etHour >= 4 && etHour < 12) return "MORNING";
  if (etHour >= 12 && etHour < 18) return "AFTERNOON";
  return "EVENING";
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔄 [generateCategoryCards] Starting...");
    console.log("=".repeat(60));

    const base44 = createClientFromRequest(req);
    const timeVariant = getTimeVariant();

    console.log(`⏰ Time variant: ${timeVariant}`);

    // Read cached stories from NewsCache (populated by refreshNewsCache)
    const cacheEntries = await base44.entities.NewsCache.filter({});
    if (!cacheEntries || cacheEntries.length === 0) {
      console.error("❌ NewsCache is empty");
      return Response.json({ error: "NewsCache is empty. Run refreshNewsCache first." }, { status: 503 });
    }

    const latestCache = cacheEntries.sort((a: any, b: any) =>
      new Date(b.refreshed_at).getTime() - new Date(a.refreshed_at).getTime()
    )[0];

    const allStories: any[] = JSON.parse(latestCache.stories || "[]");
    console.log(`📰 Found ${allStories.length} cached stories (from ${latestCache.refreshed_at})`);

    if (allStories.length < 10) {
      return Response.json({ error: "Not enough stories in cache", count: allStories.length }, { status: 503 });
    }

    // Schema for LLM response - indices, summary, and per-story description + takeaway
    const selectionSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        selected_indices: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: { type: "number" },
        },
        story_details: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              story_index: { type: "number" },
              description_short: { type: "string" },
              why_it_matters: { type: "string" },
            },
            required: ["story_index", "description_short", "why_it_matters"],
          },
        },
      },
      required: ["summary", "selected_indices", "story_details"],
    };

    // Build numbered story list for LLM (include raw summary snippet for rewriting)
    const storyList = allStories
      .map(
        (s: any, i: number) =>
          `${i + 1}. [${s.category || "general"}] ${s.title} (${s.outlet || "Unknown"})\n   Raw: ${(s.what_happened || s.summary || "").slice(0, 200)}...`
      )
      .join("\n\n");

    const storyDetailsInstruction = `
For EACH of the 5 stories you select, you MUST also provide:
- description_short: 2-3 sentences, 400-500 characters MAX. Clean, factual summary in English. No thank-yous, no fluff. Focus on what happened and why it matters to markets.
- why_it_matters: ONE sentence investor takeaway, 150-200 characters. Specific (e.g. "Rising rates could pressure growth multiples; consider shortening duration in bond funds."). NOT generic phrases like "Could impact portfolio performance."

Return story_details as an array of 5 objects with story_index (1-${allStories.length}), description_short, and why_it_matters.`;

    // Category definitions with prompts
    const categories = [
      {
        name: "MARKET",
        prompt: `You are selecting the TOP 5 MACRO/MARKET-WIDE stories for investors.

TIME: ${timeVariant}
${timeVariant === "MORNING" ? "Focus: Overnight developments, futures, pre-market setup, Asia/Europe markets" : ""}
${timeVariant === "AFTERNOON" ? "Focus: Intraday moves, Fed/economic data releases, breaking policy news" : ""}
${timeVariant === "EVENING" ? "Focus: After-hours earnings impact, tomorrow's catalysts, overnight risks" : ""}

CRITERIA FOR MARKET NEWS:
✅ Fed/interest rates/monetary policy
✅ Economic data (jobs, GDP, inflation, CPI)
✅ Geopolitical events affecting markets
✅ Major index moves (S&P, Nasdaq, Dow)
✅ Sector rotation, risk-on/risk-off sentiment

❌ NOT company-specific earnings (unless market-moving like AAPL/NVDA)
❌ NOT single-stock moves

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Fed holds rates, tech rallies on AI optimism, oil drops 3%")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
      {
        name: "TECH_PORTFOLIO",
        prompt: `You are selecting TOP 5 stories for investors holding BIG TECH: AAPL, MSFT, GOOGL, META, AMZN, NVDA.

TIME: ${timeVariant}

CRITERIA FOR TECH PORTFOLIO:
✅ Big tech earnings, guidance, product launches
✅ AI/ML developments, chip demand, cloud growth
✅ Antitrust, regulation affecting tech giants
✅ Semiconductor supply chain
✅ Enterprise software, SaaS trends

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Apple beats earnings, Microsoft AI spending accelerates")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
      {
        name: "GROWTH_PORTFOLIO",
        prompt: `You are selecting TOP 5 stories for investors holding GROWTH STOCKS: TSLA, SHOP, SQ, ABNB, UBER, PLTR, SNOW.

TIME: ${timeVariant}

CRITERIA FOR GROWTH PORTFOLIO:
✅ High-growth company news (EV, fintech, e-commerce)
✅ Disruptive technology developments
✅ Growth stock earnings, user metrics, guidance
✅ Venture/IPO market sentiment
✅ Interest rate impact on growth valuations

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Tesla FSD update, Shopify merchant growth accelerates")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
      {
        name: "ENERGY_PORTFOLIO",
        prompt: `You are selecting TOP 5 stories for investors holding ENERGY: XLE, CVX, XOM, COP, OXY.

TIME: ${timeVariant}

CRITERIA FOR ENERGY PORTFOLIO:
✅ Oil/gas prices, supply/demand
✅ OPEC decisions, production cuts
✅ Energy company earnings, dividends
✅ Geopolitical events (Middle East, Russia)
✅ Renewable energy vs. fossil fuel trends

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Oil surges on OPEC cuts, Chevron raises dividend")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
      {
        name: "CRYPTO_PORTFOLIO",
        prompt: `You are selecting TOP 5 stories for investors holding CRYPTO-RELATED: COIN, MARA, RIOT, MSTR.

TIME: ${timeVariant}

CRITERIA FOR CRYPTO PORTFOLIO:
✅ Bitcoin/Ethereum price moves
✅ Crypto regulation, SEC actions
✅ Exchange news (Coinbase, Binance)
✅ Mining economics, halving impact
✅ Institutional crypto adoption

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Bitcoin breaks $60k, Coinbase volume spikes on ETF inflows")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
      {
        name: "MIXED_PORTFOLIO",
        prompt: `You are selecting TOP 5 stories for DIVERSIFIED/VALUE investors (dividend stocks, healthcare, financials, REITs).

TIME: ${timeVariant}

CRITERIA FOR MIXED/VALUE PORTFOLIO:
✅ Dividend stocks, yield plays
✅ Defensive sectors (utilities, healthcare, consumer staples)
✅ Financial sector (banks, insurance)
✅ Real estate, REITs
✅ Sector rotation to value

AVAILABLE STORIES:
${storyList}

Return JSON with:
- summary: 10-15 word overview (e.g., "Banks rally on rate outlook, healthcare defensive in selloff")
- selected_indices: Array of exactly 5 story numbers (1-${allStories.length})
${storyDetailsInstruction}`,
      },
    ];

    // Clear old cards for this time variant
    try {
      const oldCards = await base44.entities.NewsCardCache.filter({ time_variant: timeVariant });
      for (const card of oldCards) {
        await base44.entities.NewsCardCache.delete(card.id);
      }
      console.log(`🗑️ Cleared ${oldCards.length} old ${timeVariant} cards`);
    } catch (e) {
      console.log("Note: Could not clear old cards (entity may be empty)");
    }

    // Generate each category
    const results: any[] = [];

    for (const cat of categories) {
      try {
        console.log(`\n📝 Generating ${cat.name}_${timeVariant}...`);

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: cat.prompt,
          add_context_from_internet: false,
          response_json_schema: selectionSchema,
        });

        // Map indices back to full story objects; merge LLM-written description + takeaway
        const detailsByIndex = (result.story_details || []).reduce(
          (acc: Record<number, any>, d: any) => {
            if (d && typeof d.story_index === "number") acc[d.story_index] = d;
            return acc;
          },
          {}
        );

        const selectedStories = (result.selected_indices || [])
          .filter((idx: number) => idx >= 1 && idx <= allStories.length)
          .slice(0, 5)
          .map((idx: number) => {
            const story = allStories[idx - 1];
            const details = detailsByIndex[idx];
            const whatHappened =
              details?.description_short?.trim?.() ||
              story.what_happened ||
              (story.summary && story.summary.slice(0, 500)) ||
              "";
            const whyItMatters =
              details?.why_it_matters?.trim?.() || story.why_it_matters || "";
            return {
              id: story.id || randomId(),
              title: story.title,
              what_happened: whatHappened.slice(0, 500),
              why_it_matters: whyItMatters.slice(0, 220),
              href: story.href,
              outlet: story.outlet,
              category: story.category,
              datetime: story.datetime,
              imageUrl: story.imageUrl,
              sentiment_score: story.sentiment_score,
              urgency_score: story.urgency_score,
            };
          });

        // Ensure we have 5 stories (pad with top stories if needed)
        while (selectedStories.length < 5 && allStories.length > selectedStories.length) {
          const nextStory = allStories.find(
            (s: any) => !selectedStories.some((sel: any) => sel.id === s.id)
          );
          if (nextStory) {
            selectedStories.push({
              id: nextStory.id || randomId(),
              title: nextStory.title,
              what_happened: nextStory.what_happened,
              why_it_matters: nextStory.why_it_matters || "",
              href: nextStory.href,
              outlet: nextStory.outlet,
              category: nextStory.category,
              datetime: nextStory.datetime,
              imageUrl: nextStory.imageUrl,
              sentiment_score: nextStory.sentiment_score,
              urgency_score: nextStory.urgency_score,
            });
          } else {
            break;
          }
        }

        // Save to NewsCardCache
        const cacheKey = `${cat.name}_${timeVariant}`;
        await base44.entities.NewsCardCache.create({
          category: cacheKey,
          summary: result.summary || `${cat.name} news for ${timeVariant.toLowerCase()}`,
          stories: JSON.stringify(selectedStories),
          updated_at: new Date().toISOString(),
          time_variant: timeVariant,
        });

        console.log(`✅ ${cacheKey}: "${result.summary}" (${selectedStories.length} stories)`);
        results.push({ category: cacheKey, summary: result.summary, count: selectedStories.length });

      } catch (error: any) {
        console.error(`❌ Failed to generate ${cat.name}:`, error.message);
        results.push({ category: `${cat.name}_${timeVariant}`, error: error.message });
      }
    }

    const elapsed = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(60));
    console.log(`✅ COMPLETE in ${elapsed}ms`);
    console.log(`📊 Generated ${results.filter(r => !r.error).length}/6 card sets for ${timeVariant}`);
    console.log("=".repeat(60) + "\n");

    return Response.json({
      success: true,
      time_variant: timeVariant,
      cards_generated: results.filter(r => !r.error).length,
      results,
      elapsed_ms: elapsed,
      credits_used: results.filter(r => !r.error).length, // 1 credit per successful category
    });

  } catch (error: any) {
    console.error("❌ [generateCategoryCards] Error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
