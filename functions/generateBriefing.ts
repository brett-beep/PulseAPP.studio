// generateBriefing function - synced Jan 26, 2026
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function localISODate(timeZone, input) {
  const s = typeof input === "string" ? input.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY-MM-DD in the user's timezone
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(timeZone, d = new Date()) {
  const weekdayShort = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(d);
  const mdParts = new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric", day: "numeric" }).formatToParts(d);

  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = map[weekdayShort] ?? 0;

  let month = 1; 
  let day = 1;
  for (const p of mdParts) {
    if (p.type === "month") month = Number(p.value) || 1;
    if (p.type === "day") day = Number(p.value) || 1;
  }

  const hour = Number(hourStr) || 0;

  return { dayOfWeek, hour, month, day };
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function sanitizeForAudio(s) {
  if (!s) return "";
  let t = String(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, "");
  t = t.replace(/[*_`>#]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
}

function normalizePct(input) {
  const s = String(input ?? "").trim();
  if (!s) return "0.0%";
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return "0.0%";
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return "0.0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
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

// =========================================================
// TWO-TIER STORY SELECTION SYSTEM
// =========================================================

// TIER 1: Breaking News Score - identifies urgent macro headlines
function getBreakingScore(story, nowTimestamp) {
  let score = 0;
  
  // Calculate age in hours
  const storyTime = new Date(story.datetime).getTime();
  const ageHours = (nowTimestamp - storyTime) / (1000 * 60 * 60);
  
  // 1. RECENCY BOOST (most important signal)
  if (ageHours <= 1) score += 100;
  else if (ageHours <= 2) score += 80;
  else if (ageHours <= 3) score += 60;
  else if (ageHours <= 6) score += 30;
  else if (ageHours <= 12) score += 10;
  
  // 2. MACRO CATEGORY BOOST
  const category = (story.category || "").toLowerCase();
  if (category === "economy") score += 40;
  if (category === "markets") score += 30;
  
  // 3. HIGH-IMPACT KEYWORDS (Bloomberg/CNBC-style breaking news signals)
  const BREAKING_SIGNALS = [
    // Fed/Monetary Policy
    "fed", "powell", "fomc", "rate cut", "rate hike", "inflation", "deflation",
    "federal reserve", "central bank", "monetary policy", "basis points", "bps",
    
    // Major Economic Data
    "jobs report", "unemployment", "gdp", "cpi", "ppi", "jobless claims",
    "consumer confidence", "retail sales", "manufacturing", "housing starts",
    "payroll", "nonfarm", "initial claims", "core inflation",
    
    // Market Events
    "selloff", "rally", "crash", "surge", "plunge", "record high", "record low",
    "circuit breaker", "volatility", "vix", "correction", "bear market", "bull market",
    "futures", "premarket", "after hours",
    
    // Geopolitical/Policy
    "trump", "biden", "tariff", "trade war", "sanctions", "summit",
    "executive order", "debt ceiling", "shutdown", "stimulus", "tax bill",
    "congress", "treasury", "yellen",
    
    // Corporate Big Events
    "bankruptcy", "merger", "acquisition", "m&a", "ipo", "earnings beat", 
    "earnings miss", "guidance cut", "guidance raise", "ceo", "layoffs",
    "restructuring", "spinoff", "dividend cut", "buyback",
    
    // Crisis/Disaster
    "crisis", "disaster", "emergency", "outbreak", "pandemic", "war", 
    "conflict", "attack", "breach", "hack", "scandal", "investigation",
    "default", "recession"
  ];
  
  const titleLower = (story.title || "").toLowerCase();
  const summaryLower = (story.what_happened || "").toLowerCase();
  const fullText = `${titleLower} ${summaryLower}`;
  
  // Count keyword matches
  const matchCount = BREAKING_SIGNALS.filter(kw => fullText.includes(kw)).length;
  score += matchCount * 12; // Each keyword match adds points
  
  // 4. SOURCE CREDIBILITY BOOST
  const TIER_1_SOURCES = ["bloomberg", "reuters", "wsj", "wall street journal", "financial times", "ft", "cnbc", "associated press", "ap"];
  const outletLower = (story.outlet || "").toLowerCase();
  if (TIER_1_SOURCES.some(s => outletLower.includes(s))) {
    score += 25;
  }
  
  // 5. Original cache rank bonus (already pre-scored by refreshNewsCache)
  const originalRank = story.rank || 999;
  if (originalRank <= 3) score += 20;
  else if (originalRank <= 5) score += 15;
  else if (originalRank <= 10) score += 10;
  
  // 6. Inherit urgency_score from Alpha Vantage pre-scoring (if available)
  if (story.urgency_score) {
    score += Math.round(story.urgency_score * 0.3); // Weight it as a supplemental signal
  }
  
  // 7. Sentiment strength bonus (strong market sentiment = more actionable)
  if (story.sentiment_score) {
    const sentimentStrength = Math.abs(story.sentiment_score);
    if (sentimentStrength > 0.3) score += 15; // Strong sentiment
    else if (sentimentStrength > 0.15) score += 8; // Moderate sentiment
  }
  
  return { score, ageHours };
}

// TIER 2: Personalization - matches user interests/holdings
const INTEREST_TO_CATEGORIES = {
  "crypto": ["crypto"], "cryptocurrency": ["crypto"], "bitcoin": ["crypto"], "ethereum": ["crypto"],
  "real estate": ["real estate"], "reits": ["real estate"], "housing": ["real estate"],
  "commodities": ["commodities"], "gold": ["commodities"], "oil": ["commodities"],
  "technology": ["technology"], "tech": ["technology"], "ai": ["technology"], "semiconductors": ["technology"],
  "economy": ["economy"], "macro": ["economy"], "federal reserve": ["economy"], "fed": ["economy"],
  "markets": ["markets"], "stocks": ["markets"], "equities": ["markets"], "etfs": ["markets"],
  "growth stocks": ["technology", "markets"], "value investing": ["markets", "economy"],
  "dividends": ["markets", "real estate"], "retirement": ["markets", "economy"],
};

const INTEREST_KEYWORDS = {
  "crypto": ["crypto", "bitcoin", "btc", "ethereum", "eth", "blockchain", "defi", "coinbase", "binance"],
  "real estate": ["real estate", "housing", "mortgage", "property", "rent", "reits", "homebuilder"],
  "commodities": ["oil", "gold", "silver", "commodity", "wheat", "natural gas", "copper", "lithium"],
  "technology": ["tech", "software", "ai", "chip", "semiconductor", "apple", "google", "microsoft", "nvidia", "meta", "amazon"],
  "economy": ["fed", "inflation", "gdp", "unemployment", "interest rate", "recession", "jobs", "cpi", "fomc", "powell"],
  "markets": ["stock", "market", "s&p", "nasdaq", "dow", "earnings", "ipo", "merger", "etf", "rally", "selloff"],
};

function getMatchingCategories(userInterests) {
  const categories = new Set();
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    if (INTEREST_TO_CATEGORIES[interestLower]) {
      INTEREST_TO_CATEGORIES[interestLower].forEach(c => categories.add(c));
    }
    for (const [key, cats] of Object.entries(INTEREST_TO_CATEGORIES)) {
      if (interestLower.includes(key) || key.includes(interestLower)) {
        cats.forEach(c => categories.add(c));
      }
    }
  }
  return Array.from(categories);
}

function getMatchingKeywords(userInterests) {
  const keywords = new Set();
  for (const interest of userInterests) {
    const interestLower = interest.toLowerCase().trim();
    keywords.add(interestLower);
    for (const [category, kws] of Object.entries(INTEREST_KEYWORDS)) {
      if (interestLower.includes(category) || category.includes(interestLower)) {
        kws.forEach(k => keywords.add(k));
      }
    }
  }
  return Array.from(keywords);
}

function getPersonalizationScore(story, userCategories, userKeywords, userHoldings) {
  let relevanceScore = 0;
  const storyText = `${story.title} ${story.what_happened}`.toLowerCase();
  const storyCategory = (story.category || "").toLowerCase();
  
  // Category match
  if (userCategories.includes(storyCategory)) relevanceScore += 50;
  
  // Keyword matches
  for (const keyword of userKeywords) {
    if (storyText.includes(keyword)) relevanceScore += 15;
  }
  
  // Holdings match (highest value)
  for (const holding of userHoldings) {
    const symbol = (typeof holding === "string" ? holding : holding?.symbol || "").toLowerCase();
    const name = (typeof holding === "string" ? "" : holding?.name || "").toLowerCase();
    if (symbol && storyText.includes(symbol)) relevanceScore += 100;
    if (name && name.length > 3 && storyText.includes(name)) relevanceScore += 80;
  }
  
  return relevanceScore;
}

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

async function invokeLLM(base44, prompt, addInternet, schema) {
  return await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: addInternet,
    response_json_schema: schema,
  });
}

async function generateAudioFile(script, date, elevenLabsApiKey) {
  const voiceId = "Qggl4b0xRMiqOwhPtVWT";

  const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_v3",
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text();
    throw new Error(`ElevenLabs TTS failed: ${errorText}`);
  }

  const audioBlob = await ttsResponse.blob();
  return new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};
    const rawTz = safeText(body?.timeZone || body?.time_zone || body?.timezone, "UTC");
    const timeZone = isValidTimeZone(rawTz) ? rawTz : "UTC";

    const date = localISODate(timeZone, body?.date);
    const audioOnly = Boolean(body?.audio_only);
    const skipAudio = Boolean(body?.skip_audio);

    const userEmail = safeText(user?.email);
    if (!userEmail) return Response.json({ error: "User email missing" }, { status: 400 });

    // Hardcoded temporarily while Base44 env vars are broken
    const elevenLabsApiKey = "sk_d95bc50d1ee151866aebf48be5f5d48a8c7c15809e913066";

    // =========================================================
    // AUDIO-ONLY MODE: convert existing script -> audio_url
    // =========================================================
    if (audioOnly) {
      const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
        date,
        created_by: userEmail,
      });

      if (!Array.isArray(existing) || existing.length === 0) {
        return Response.json(
          { error: "No DailyBriefing found for this date. Generate script first." },
          { status: 404 }
        );
      }

    const briefing = [...existing].sort((a, b) => {
      const da = a.delivered_at || a.updated_at || a.created_at;
      const db = b.delivered_at || b.updated_at || b.created_at;
      return new Date(db) - new Date(da);
    })[0];

      const script = safeText(briefing?.script);
      if (!script) {
        return Response.json(
          { error: "DailyBriefing has no script. Generate script first." },
          { status: 400 }
        );
      }

      await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        status: "generating_audio",
      });

      const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);

      const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
        file: audioFile,
      });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri,
        expires_in: 60 * 60 * 24 * 7,
      });

      const deliveredAt = new Date().toISOString();

      const updated = await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        audio_url: signed_url,
        status: "ready",
        delivered_at: deliveredAt,
        time_zone: timeZone,
      });

      return Response.json({ success: true, briefing: updated });
    }

    // =========================================================
    // FULL MODE: generate news-first briefing
    // =========================================================

    const name =
      safeText(preferences?.user_name) ||
      safeText(user?.name) ||
      safeText(user?.full_name) ||
      "there";

    // UPDATED: Map preferences properly including investment_interests
    const prefProfile = {
      risk_tolerance: preferences?.risk_tolerance ?? preferences?.riskLevel ?? null,
      time_horizon: preferences?.time_horizon ?? preferences?.horizon ?? null,
      goals: preferences?.goals ?? preferences?.investment_goals ?? null,
      sectors: preferences?.sectors ?? null,
      regions: preferences?.regions ?? null,
      watchlist: preferences?.watchlist ?? preferences?.tickers ?? null,
      holdings: preferences?.holdings ?? preferences?.portfolio_holdings ?? null,
      interests: preferences?.interests ?? preferences?.investment_interests ?? null,
      constraints: preferences?.constraints ?? null,
    };

    // =========================================================
    // STEP 1: READ FROM NEWSCACHE (0 extra API calls)
    // =========================================================
    console.log("📰 [generateBriefing] Reading from NewsCache...");

    let cachedStories = [];
    try {
      const cacheEntries = await base44.entities.NewsCache.filter({});
      
      if (cacheEntries && cacheEntries.length > 0) {
        const latestCache = cacheEntries.sort((a, b) => 
          new Date(b.refreshed_at) - new Date(a.refreshed_at)
        )[0];
        
        cachedStories = JSON.parse(latestCache.stories || "[]");
        console.log(`✅ [generateBriefing] Found ${cachedStories.length} cached stories (refreshed: ${latestCache.refreshed_at})`);
      } else {
        return Response.json({
          error: "News cache is empty. Please wait a few minutes for the cache to refresh.",
          success: false
        }, { status: 503 });
      }
    } catch (cacheError) {
      console.error("❌ [generateBriefing] Cache read error:", cacheError);
      return Response.json({
        error: "Failed to read news cache: " + cacheError.message,
        success: false
      }, { status: 500 });
    }

    // =========================================================
    // STEP 1B: Score stories for "breaking-ness"
    // =========================================================
    const nowTimestamp = Date.now();
    const scoredStories = cachedStories
      .map(story => {
        const { score, ageHours } = getBreakingScore(story, nowTimestamp);
        return { ...story, breakingScore: score, ageHours };
      })
      .filter(s => s.ageHours <= 24); // Only stories from last 24 hours

    console.log("🔥 [generateBriefing] Top breaking scores:");
    scoredStories
      .sort((a, b) => b.breakingScore - a.breakingScore)
      .slice(0, 5)
      .forEach((s, i) => {
        console.log(`   ${i + 1}. [score: ${s.breakingScore}] [age: ${s.ageHours.toFixed(1)}h] ${(s.title || "").slice(0, 55)}...`);
      });

    // =========================================================
    // STEP 1C: TIER 1 - Select RAPID FIRE stories (top 3 by breaking score)
    // =========================================================
    const rapidFireCandidates = [...scoredStories].sort((a, b) => b.breakingScore - a.breakingScore);
    const rapidFireStories = rapidFireCandidates.slice(0, 3);

    console.log("\n⚡ [generateBriefing] TIER 1 - RAPID FIRE (Breaking News):");
    rapidFireStories.forEach((s, i) => {
      console.log(`   ${i + 1}. [score:${s.breakingScore}] [age:${s.ageHours.toFixed(1)}h] [${s.category}] ${(s.title || "").slice(0, 50)}...`);
    });

    // =========================================================
    // STEP 1D: TIER 2 - Select PERSONALIZED stories
    // =========================================================
    const userInterests = prefProfile?.interests || [];
    const userHoldings = prefProfile?.holdings || [];
    const userCategories = getMatchingCategories(userInterests);
    const userKeywords = getMatchingKeywords(userInterests);

    console.log(`\n📊 [generateBriefing] User interests: ${userInterests.join(", ") || "none"}`);
    console.log(`📊 [generateBriefing] Matching categories: ${userCategories.join(", ") || "all"}`);

    // Exclude rapid fire stories from personalization pool
    const rapidFireIds = new Set(rapidFireStories.map(s => s.id));
    const personalizedCandidates = scoredStories.filter(story => !rapidFireIds.has(story.id));

    // Score for personalization
    const personalizedScored = personalizedCandidates.map(story => ({
      ...story,
      relevanceScore: getPersonalizationScore(story, userCategories, userKeywords, userHoldings)
    }));

    // Sort by relevance, then by breaking score as tiebreaker
    personalizedScored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.breakingScore - a.breakingScore;
    });

    const personalizedStories = personalizedScored.slice(0, 3);

    console.log("\n📊 [generateBriefing] TIER 2 - PERSONALIZED (Deep Dives):");
    personalizedStories.forEach((s, i) => {
      console.log(`   ${i + 1}. [relevance:${s.relevanceScore}] [breaking:${s.breakingScore}] [${s.category}] ${(s.title || "").slice(0, 45)}...`);
    });

    // =========================================================
    // STEP 1E: Combine into final 6 stories for briefing
    // =========================================================
    const allBriefingStories = [...rapidFireStories, ...personalizedStories];
    
    console.log(`\n✅ [generateBriefing] Selected ${allBriefingStories.length} total stories (3 rapid-fire + 3 personalized)`);

    // Format stories for UI compatibility
    const allowedCats = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);
    
    const truncateTitle = (text, maxLen) => {
      const clean = safeText(text, "");
      if (clean.length <= maxLen) return clean;
      return clean.substring(0, maxLen - 3) + "...";
    };

    const allStories = allBriefingStories.map((story, index) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";
      const isRapidFire = index < 3;

      return {
        id: safeText(story?.id, randomId()),
        href: safeText(story?.href, "#"),
        imageUrl: story?.imageUrl || categoryImageUrl(category),
        title: truncateTitle(story?.title, 80),
        what_happened: safeText(story?.what_happened, ""),
        why_it_matters: safeText(story?.why_it_matters, generateFallbackWhyItMatters(category)),
        both_sides: {
          side_a: safeText(story?.why_it_matters, ""),
          side_b: "",
        },
        outlet: safeText(story?.outlet, "Unknown"),
        category,
        datetime: story?.datetime,
        ageHours: story?.ageHours,
        isRapidFire,
        breakingScore: story?.breakingScore,
        relevanceScore: story?.relevanceScore || 0,
      };
    });

    // =========================================================
    // STEP 2: Get Market Snapshot via LLM (quick call, no web search)
    // =========================================================
    console.log("📈 [generateBriefing] Fetching market snapshot...");
    
    const marketPrompt = `
Provide the current market snapshot for ${date} (today).
Return the approximate percentage change for:
- S&P 500
- Nasdaq
- Dow Jones

If markets are closed, provide the most recent close percentages.
Return JSON only.
`;

    const marketSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        sp500_pct: { type: "string" },
        nasdaq_pct: { type: "string" },
        dow_pct: { type: "string" },
      },
      required: ["sp500_pct", "nasdaq_pct", "dow_pct"],
    };

    let marketSnapshot = { sp500_pct: "0.0%", nasdaq_pct: "0.0%", dow_pct: "0.0%" };
    try {
      const marketData = await invokeLLM(base44, marketPrompt, true, marketSchema);
      marketSnapshot = {
        sp500_pct: normalizePct(marketData?.sp500_pct),
        nasdaq_pct: normalizePct(marketData?.nasdaq_pct),
        dow_pct: normalizePct(marketData?.dow_pct),
      };
      console.log("✅ [generateBriefing] Market snapshot:", marketSnapshot);
    } catch (marketError) {
      console.error("⚠️ [generateBriefing] Market snapshot failed, using defaults:", marketError.message);
    }

    // =========================================================
    // STEP 3: Generate Metadata
    // =========================================================
    // Split stories for prompt formatting
    const rapidFireForPrompt = allStories.filter(s => s.isRapidFire);
    const personalizedForPrompt = allStories.filter(s => !s.isRapidFire);

    const metaPrompt = `
Create briefing metadata for ${date}.

LISTENER: ${name}

BREAKING NEWS (Rapid Fire):
${rapidFireForPrompt.map((s, i) => `${i + 1}. ${s.title} - ${s.what_happened}`).join("\n")}

PERSONALIZED STORIES:
${personalizedForPrompt.map((s, i) => `${i + 1}. ${s.title} - ${s.what_happened}`).join("\n")}

MARKET SNAPSHOT:
- S&P: ${marketSnapshot.sp500_pct}
- Nasdaq: ${marketSnapshot.nasdaq_pct}
- Dow: ${marketSnapshot.dow_pct}

Return JSON with:
- summary: 2-3 sentence overview focusing on the breaking news headlines
- key_highlights: 3-5 bullets (lead with news, not markets)
- market_sentiment: { label: "bullish"|"bearish"|"neutral"|"mixed", description: one sentence }
`;

    const metaSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        key_highlights: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
        market_sentiment: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            description: { type: "string" },
          },
          required: ["label", "description"],
        },
      },
      required: ["summary", "key_highlights", "market_sentiment"],
    };

    const meta = await invokeLLM(base44, metaPrompt, false, metaSchema);

    const uiSummary = safeText(meta?.summary, "");
    const uiHighlights = Array.isArray(meta?.key_highlights)
      ? meta.key_highlights.map((x) => safeText(x, "")).filter(Boolean)
      : [];
    const uiSentiment = meta?.market_sentiment || { label: "neutral", description: "" };

    // =========================================================
    // STEP 4: Generate Script with Hybrid Framework + Personal Opening
    // (timezone-aware)
    // =========================================================
    const now = new Date();
    const { hour, dayOfWeek, month, day } = getZonedParts(timeZone, now);

    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    if (hour >= 17) timeGreeting = "Good evening";

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;
    const isFriday = dayOfWeek === 5;

    let holidayGreeting = null;
    if (month === 1 && day === 1) holidayGreeting = "Happy New Year";
    if (month === 7 && day === 4) holidayGreeting = "Happy Fourth of July";
    if (month === 12 && day === 25) holidayGreeting = "Merry Christmas";
    if (month === 12 && day === 31) holidayGreeting = "Happy New Year's Eve";
    if (month === 11 && day >= 22 && day <= 28 && dayOfWeek === 4) holidayGreeting = "Happy Thanksgiving";
    if (month === 5 && dayOfWeek === 1 && day >= 25) holidayGreeting = "Happy Memorial Day";
    if (month === 9 && dayOfWeek === 1 && day <= 7) holidayGreeting = "Happy Labor Day";

    // Build user interests string for prompt
    const userInterestsStr = userInterests.length > 0 ? userInterests.join(", ") : "general markets";
    const userHoldingsStr = userHoldings.length > 0 
      ? userHoldings.map(h => typeof h === "string" ? h : h?.symbol).filter(Boolean).join(", ") 
      : "not specified";

    const scriptPrompt = `
Write the spoken script for "Pulse" - a news-first investor briefing.

LISTENER: ${name}
DATE: ${date}
TIME OF DAY: ${timeGreeting}
${holidayGreeting ? `HOLIDAY: ${holidayGreeting}` : ""}
${isWeekend ? "CONTEXT: Weekend" : ""}
${isMonday ? "CONTEXT: Monday (start of week)" : ""}
${isFriday ? "CONTEXT: Friday (end of week)" : ""}

TARGET LENGTH: 5 MINUTES (650-750 words total)

SCRIPT STRUCTURE - TWO-TIER FORMAT:

1. PERSONAL OPENING (20-30 words):
   - Start with: "${timeGreeting}, ${name}"
   ${holidayGreeting ? `- Include holiday greeting: "${holidayGreeting}"` : ""}
   ${isWeekend ? "- Add: \"Hope you're enjoying your weekend\" or similar weekend acknowledgment" : ""}
   ${isMonday ? "- Add: \"Hope you had a great weekend\" or \"Let's start the week strong\"" : ""}
   ${isFriday ? "- Add: \"Let's wrap up the week\" or similar end-of-week sentiment" : ""}
   - Make it feel like talking to a friend
   - Transition: "First, let's catch you up on what's breaking" or "Let's start with the headlines"

2. RAPID FIRE BREAKING NEWS (Stories 1-3) - ~150-180 words total (~50-60 words each):
   
   STYLE: Quick, punchy, Bloomberg/CNBC-style push notification format
   For EACH story:
   - State the headline clearly
   - What happened (1-2 sentences with key facts/numbers)
   - Investor impact (1 sentence)
   - Move on quickly
   
   DO NOT use narrative structure. Be direct and factual.
   After all 3, transition: "Now, let's dive deeper into stories that matter for your portfolio..."

3. PERSONALIZED DEEP DIVES (Stories 4-6) - ~400-450 words total (~130-150 words each):
   
   STYLE: Full narrative using HYBRID FRAMEWORK (but DON'T label sections):
   • HOOK: Grab attention with stakes or surprise
   • FACTS: Detailed explanation with specifics (numbers, mechanisms, context)
   • DEEPER MEANING: Connect to portfolio implications, sector impact
   
   ${userInterests.length > 0 ? `CONNECT TO USER'S INTERESTS: ${userInterestsStr}` : ""}
   ${userHoldings.length > 0 ? `MENTION USER'S HOLDINGS WHERE RELEVANT: ${userHoldingsStr}` : ""}

4. MARKET SNAPSHOT (30-40 words):
   - S&P, Nasdaq, Dow % moves only (no absolute levels)
   - One-sentence context on market direction

5. CLOSING (30-40 words):
   - Synthesize the day's themes
   - One actionable insight or question to consider
   - Sign off naturally

CRITICAL VOICE RULES:
- Conversational but authoritative
- Direct address ("you", "your portfolio")
- NO section labels in the output (don't say "RAPID FIRE", "DEEP DIVE", "HOOK", "FACTS", etc.)
- NO filler phrases or hedging
- Percent moves ONLY for indices (never absolute levels)
- Write as continuous spoken narration

DATA FOR RAPID FIRE (Stories 1-3 - Breaking News):
${rapidFireForPrompt
  .map(
    (s, i) => `
Story ${i + 1}:
Headline: ${s.title}
What happened: ${s.what_happened}
Source: ${s.outlet}
Category: ${s.category}
Age: ${(s.ageHours || 0).toFixed(1)} hours old
`
  )
  .join("\n")}

DATA FOR PERSONALIZED DEEP DIVES (Stories 4-6):
${personalizedForPrompt
  .map(
    (s, i) => `
Story ${i + 4}:
Headline: ${s.title}
What happened: ${s.what_happened}
Why it matters: ${s.why_it_matters || "Connect to investor implications"}
Source: ${s.outlet}
Category: ${s.category}
`
  )
  .join("\n")}

MARKET SNAPSHOT:
- S&P: ${marketSnapshot.sp500_pct}
- Nasdaq: ${marketSnapshot.nasdaq_pct}
- Dow: ${marketSnapshot.dow_pct}

Return JSON: { "script": "..." }
`;

    const scriptSchema = {
      type: "object",
      additionalProperties: false,
      properties: { script: { type: "string" } },
      required: ["script"],
    };

    const scriptData = await invokeLLM(base44, scriptPrompt, false, scriptSchema);
    const script = sanitizeForAudio(scriptData?.script || "");

    const wc = wordCount(script);
    const estimatedMinutes = Math.max(1, Math.round(wc / 150));

    // =========================================================
    // STEP 5: Save Briefing (ALWAYS CREATE NEW)
    // - delivered_at is set ONLY when user has access (ready/script_ready)
    // =========================================================
    const deliveredAtNow = new Date().toISOString();

    const baseRecord = {
      date,
      created_by: userEmail,
      script,
      summary: uiSummary,
      market_sentiment: uiSentiment,
      key_highlights: uiHighlights,
      news_stories: allStories,
      duration_minutes: estimatedMinutes,
      status: skipAudio ? "script_ready" : "writing_script",
      audio_url: null,
      time_zone: timeZone,
      delivered_at: skipAudio ? deliveredAtNow : null,
    };

    const saved = await base44.entities.DailyBriefing.create(baseRecord);

    console.log("🔍 [DEBUG] Created briefing with:");
    console.log("  - ID:", saved.id);
    console.log("  - date:", saved.date);
    console.log("  - created_by:", saved.created_by);
    console.log("  - status:", saved.status);
    console.log("  - time_zone:", saved.time_zone);
    console.log("  - delivered_at:", saved.delivered_at);

    if (skipAudio) {
      return Response.json({
        success: true,
        briefing: saved,
        wordCount: wc,
        estimatedMinutes,
        status: "script_ready",
      });
    }

    // =========================================================
    // Return immediately; generate audio async
    // =========================================================
    console.log("✅ Briefing created; starting async audio generation...");

    generateAudioAsync(base44, saved.id, script, date, elevenLabsApiKey, timeZone).catch((error) => {
      console.error("❌ Async audio generation failed:", error);
      base44.asServiceRole.entities.DailyBriefing.update(saved.id, {
        status: "failed",
      }).catch(console.error);
    });

    return Response.json({
      success: true,
      briefing: saved,
      wordCount: wc,
      estimatedMinutes,
      status: "writing_script",
      message: "Hang Tight! We're writing your briefing script...",
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});

// =========================================================
// Async audio generation function
// - sets delivered_at when READY (user can access)
// =========================================================
async function generateAudioAsync(base44Client, briefingId, script, date, elevenLabsApiKey, timeZone) {
  console.log(`🎵 [Async Audio] Starting generation for briefing ${briefingId}...`);

  try {
    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      status: "generating_audio",
    });
    console.log("✅ [Status] Updated to generating_audio");

    const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);
    console.log(`✅ [Async Audio] Audio file generated`);

    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      status: "uploading",
    });
    console.log("✅ [Status] Updated to uploading");

    const { file_uri } = await base44Client.asServiceRole.integrations.Core.UploadPrivateFile({
      file: audioFile,
    });
    console.log(`✅ [Async Audio] File uploaded: ${file_uri}`);

    const { signed_url } = await base44Client.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });
    console.log(`✅ [Async Audio] Signed URL created`);

    const deliveredAt = new Date().toISOString();

    await base44Client.asServiceRole.entities.DailyBriefing.update(briefingId, {
      audio_url: signed_url,
      status: "ready",
      delivered_at: deliveredAt,
      time_zone: timeZone,
    });

    console.log(`🎉 [Async Audio] Briefing ${briefingId} is now READY with audio! delivered_at=${deliveredAt}`);
  } catch (error) {
    console.error(`❌ [Async Audio] Failed for briefing ${briefingId}:`, error);
    throw error;
  }
}
