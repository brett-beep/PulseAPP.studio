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
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
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

    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!skipAudio && !elevenLabsApiKey) {
      return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

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
    // STEP 1: Pull TOP 3 HEADLINE STORIES (NEWS-FIRST)
    // =========================================================
    const headlinePrompt = `
You are curating the TOP 3 HEADLINE STORIES for a premium investor briefing on ${date}.

CRITICAL: These must be REAL, BREAKING financial/market news from the last 24 hours. Use internet search to find:
- Breaking corporate news (earnings, M&A, executive changes)
- Major economic data releases (jobs, inflation, GDP)
- Federal Reserve or central bank announcements
- Significant market-moving events
- Geopolitical developments affecting markets

USER PROFILE (use to PRIORITIZE which headlines matter most):
${JSON.stringify(prefProfile, null, 2)}

${prefProfile.interests && Array.isArray(prefProfile.interests) && prefProfile.interests.length > 0 
  ? `\nPRIORITY INTERESTS: The user is particularly interested in: ${prefProfile.interests.join(', ')}. 
Prioritize stories related to these sectors/topics when selecting headlines.`
  : ''}

Selection criteria:
1. RECENCY: Must be from last 24 hours (prioritize overnight/morning news)
2. IMPACT: Market-moving potential
3. RELEVANCE: Connection to user's portfolio/watchlist/sectors/interests

LENGTH REQUIREMENTS:
- headline: 60-80 characters max (be punchy and direct)
- what_happened: 3-5 sentences with full details and context about the story
- portfolio_impact: 2-3 sentences explaining what this means for investors and their portfolios

For each story return:
- headline: attention-grabbing title (60-80 chars)
- what_happened: 3-5 sentences with full details
- portfolio_impact: 2-3 sentences on investor impact
- source: outlet name (Reuters, Bloomberg, WSJ, etc.)
- category: [markets, economy, technology, crypto, real estate, commodities, default]

Also include current market snapshot:
- S&P 500, Nasdaq, Dow movements (% only, no levels)

Return JSON only.
`;

    const headlineSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        market_snapshot: {
          type: "object",
          additionalProperties: false,
          properties: {
            sp500_pct: { type: "string" },
            nasdaq_pct: { type: "string" },
            dow_pct: { type: "string" },
          },
          required: ["sp500_pct", "nasdaq_pct", "dow_pct"],
        },
        top_headlines: {
          type: "array",
          minItems: 3,
          maxItems: 3,
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
      required: ["market_snapshot", "top_headlines"],
    };

    const headlineData = await invokeLLM(base44, headlinePrompt, true, headlineSchema);

    if (!headlineData || !Array.isArray(headlineData.top_headlines) || headlineData.top_headlines.length !== 3) {
      return Response.json({ error: "Headline generation failed: invalid payload" }, { status: 500 });
    }

    const allowedCats = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);

    const truncateTitle = (text, maxLen) => {
      const clean = safeText(text, "");
      if (clean.length <= maxLen) return clean;
      return clean.substring(0, maxLen - 3) + "...";
    };

    const topStories = headlineData.top_headlines.map((story) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";

      return {
        id: safeText(story?.id, randomId()),
        href: safeText(story?.href, "#"),
        imageUrl: categoryImageUrl(category),
        title: truncateTitle(story?.headline, 80),
        what_happened: safeText(story?.what_happened, ""),
        why_it_matters: safeText(story?.portfolio_impact, ""),
        both_sides: {
          side_a: safeText(story?.portfolio_impact, ""),
          side_b: "",
        },
        outlet: safeText(story?.source, "Unknown"),
        category,
      };
    });

    const marketSnapshot = {
      sp500_pct: normalizePct(headlineData.market_snapshot?.sp500_pct),
      nasdaq_pct: normalizePct(headlineData.market_snapshot?.nasdaq_pct),
      dow_pct: normalizePct(headlineData.market_snapshot?.dow_pct),
    };

    // =========================================================
    // STEP 2: Generate 2 additional context stories
    // =========================================================
    const contextPrompt = `
You already have these 3 TOP HEADLINES:
${topStories.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}

Now find 2 ADDITIONAL stories that provide context or related developments. These should:
- Complement the top 3 (not duplicate)
- Be from the last 48 hours
- Add depth to the briefing

USER PROFILE:
${JSON.stringify(prefProfile, null, 2)}

${prefProfile.interests && Array.isArray(prefProfile.interests) && prefProfile.interests.length > 0 
  ? `\nUSER INTERESTS: ${prefProfile.interests.join(", ")}. 
Look for stories related to these areas when selecting context stories.`
  : ""}

LENGTH REQUIREMENTS:
- headline: 60-80 characters max
- what_happened: 3-5 sentences with full details and context about the story
- portfolio_impact: 2-3 sentences explaining what this means for investors

Return 2 stories in same format as before.
`;

    const contextSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        context_stories: {
          type: "array",
          minItems: 2,
          maxItems: 2,
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
      required: ["context_stories"],
    };

    const contextData = await invokeLLM(base44, contextPrompt, true, contextSchema);

    const contextStories = (contextData?.context_stories || []).map((story) => {
      const rawCat = safeText(story?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";

      return {
        id: safeText(story?.id, randomId()),
        href: safeText(story?.href, "#"),
        imageUrl: categoryImageUrl(category),
        title: truncateTitle(story?.headline, 80),
        what_happened: safeText(story?.what_happened, ""),
        why_it_matters: safeText(story?.portfolio_impact, ""),
        both_sides: {
          side_a: safeText(story?.portfolio_impact, ""),
          side_b: "",
        },
        outlet: safeText(story?.source, "Unknown"),
        category,
      };
    });

    const allStories = [...topStories, ...contextStories];

    // =========================================================
    // STEP 3: Generate Metadata
    // =========================================================
    const metaPrompt = `
Create briefing metadata for ${date}.

LISTENER: ${name}

TOP 3 HEADLINES:
${topStories.map((s, i) => `${i + 1}. ${s.title} - ${s.what_happened}`).join("\n")}

MARKET SNAPSHOT:
- S&P: ${marketSnapshot.sp500_pct}
- Nasdaq: ${marketSnapshot.nasdaq_pct}
- Dow: ${marketSnapshot.dow_pct}

Return JSON with:
- summary: 2-3 sentence overview focusing on the top headlines
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

    const scriptPrompt = `
Write the spoken script for "Pulse" - a news-first investor briefing.

LISTENER: ${name}
DATE: ${date}
TIME OF DAY: ${timeGreeting}
${holidayGreeting ? `HOLIDAY: ${holidayGreeting}` : ""}
${isWeekend ? "CONTEXT: Weekend" : ""}
${isMonday ? "CONTEXT: Monday (start of week)" : ""}
${isFriday ? "CONTEXT: Friday (end of week)" : ""}

CRITICAL: TARGET LENGTH IS 5 MINUTES (650-750 words).

SCRIPT STRUCTURE - HYBRID FRAMEWORK:

1. PERSONAL OPENING (20-30 words):
   - Start with: "${timeGreeting}, ${name}"
   ${holidayGreeting ? `- Include holiday greeting: "${holidayGreeting}"` : ""}
   ${isWeekend ? "- Add: \"Hope you're enjoying your weekend\" or similar weekend acknowledgment" : ""}
   ${isMonday ? "- Add: \"Hope you had a great weekend\" or \"Let's start the week strong\"" : ""}
   ${isFriday ? "- Add: \"Let's wrap up the week\" or similar end-of-week sentiment" : ""}
   - Make it feel like talking to a friend, not reading news
   - Then transition: "Let's get into it" or "Here's what moved markets today"

2. TOP 3 STORIES - Each follows HYBRID FRAMEWORK:
   • HOOK
   • QUESTION (optional)
   • FACTS
   • DEEPER MEANING
   • Do NOT include any section labels or meta words like: "HOOK", "QUESTION", "FACTS", "DEEPER MEANING"
   • Just write clean spoken paragraphs.

   (~150-180 words per story)

3. MARKET SNAPSHOT (30-40 words):
   - S&P, Nasdaq, Dow % moves
   - One-sentence context

4. CLOSING (30-40 words):
   - Synthesize themes
   - One actionable insight
   - Sign off

TOTAL TARGET: 650-750 words

VOICE GUIDELINES:
- Conversational but authoritative
- No filler phrases
- Percent moves ONLY, no index levels
- Direct address ("you", "your portfolio")
- ABSOLUTE RULE: Do not output any outline markers, headings, or labels.
  Do not say or print: "HOOK", "QUESTION", "FACTS", "DEEPER MEANING", "Top Story", "Market Snapshot", "Closing".
  Write as continuous spoken narration only.

DATA:

TOP 3 HEADLINES:
${topStories
  .map(
    (s, i) => `
${i + 1}. ${s.title}
   What: ${s.what_happened}
   Impact: ${s.why_it_matters}
   Source: ${s.outlet}
   Category: ${s.category}
`
  )
  .join("\n")}

MARKET SNAPSHOT:
- S&P: ${marketSnapshot.sp500_pct}
- Nasdaq: ${marketSnapshot.nasdaq_pct}
- Dow: ${marketSnapshot.dow_pct}

CONTEXT STORIES:
${contextStories.map((s, i) => `${i + 1}. ${s.title} - ${s.what_happened}`).join("\n")}

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
