import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
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
    const date = safeISODate(body?.date);
    const audioOnly = Boolean(body?.audio_only);
    const skipAudio = Boolean(body?.skip_audio); // NEW: option to skip audio generation

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

      const briefing = existing[0];
      const script = safeText(briefing?.script);
      if (!script) {
        return Response.json(
          { error: "DailyBriefing has no script. Generate script first." },
          { status: 400 }
        );
      }

      // Mark generating
      await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        status: "generating",
      });

      const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);

      const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
        file: audioFile,
      });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri,
        expires_in: 60 * 60 * 24 * 7,
      });

      const updated = await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
        audio_url: signed_url,
        status: "ready",
      });

      return Response.json({ success: true, briefing: updated });
    }

    // =========================================================
    // FULL MODE: generate stories/meta/script AND audio
    // =========================================================

    const name =
      safeText(preferences?.user_name) ||
      safeText(user?.name) ||
      safeText(user?.full_name) ||
      "there";

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

    const storiesPrompt = `
You are curating "Selected Stories" for a premium, paid investor briefing product.

DATE: ${date}

USER PROFILE (use this to SELECT and FRAME stories):
${JSON.stringify(prefProfile, null, 2)}

Selection rules:
- Return exactly 5 stories.
- Prioritize: (1) relevance to user's holdings/watchlist/sectors/goals, then (2) market-moving importance, then (3) recency.
- Each story must be real and verifiable today (use internet context). Prefer reputable sources (Reuters, Bloomberg, WSJ, FT, CNBC, central banks, major filings).
- Outlet: outlet name only. No URLs in outlet.

Content rules:
- what_happened: 1–2 sentences, specific. MUST be non-empty.
- why_it_matters: exactly 1 sentence, personalized. MUST be non-empty.
- both_sides: two short sentences. MUST be non-empty.
- category: one of [markets, crypto, economy, technology, real estate, commodities, default].
- Include market tape as % moves only (no index levels).

Return JSON only.
`;

    const storiesSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        market_tape: {
          type: "object",
          additionalProperties: false,
          properties: {
            sp500_pct: { type: "string" },
            nasdaq_pct: { type: "string" },
            dow_pct: { type: "string" },
          },
          required: ["sp500_pct", "nasdaq_pct", "dow_pct"],
        },
        news_stories: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              href: { type: "string" },
              title: { type: "string" },
              what_happened: { type: "string" },
              why_it_matters: { type: "string" },
              both_sides: {
                type: "object",
                additionalProperties: false,
                properties: {
                  side_a: { type: "string" },
                  side_b: { type: "string" },
                },
                required: ["side_a", "side_b"],
              },
              outlet: { type: "string" },
              category: { type: "string" },
            },
            required: ["title", "what_happened", "why_it_matters", "both_sides", "outlet", "category"],
          },
        },
      },
      required: ["market_tape", "news_stories"],
    };

    const storiesData = await invokeLLM(base44, storiesPrompt, true, storiesSchema);

    if (!storiesData || !Array.isArray(storiesData.news_stories) || storiesData.news_stories.length !== 5) {
      return Response.json({ error: "Story generation failed: invalid payload" }, { status: 500 });
    }

    const allowedCats = new Set(["markets", "crypto", "economy", "technology", "real estate", "commodities", "default"]);

    const enrichedStories = storiesData.news_stories.map((s) => {
      const rawCat = safeText(s?.category, "default").toLowerCase();
      const category = allowedCats.has(rawCat) ? rawCat : "default";

      const title = safeText(s?.title, "Untitled story");
      const what = safeText(s?.what_happened, "");
      const why = safeText(s?.why_it_matters, "");
      const sideA = safeText(s?.both_sides?.side_a, "");
      const sideB = safeText(s?.both_sides?.side_b, "");
      const outlet = safeText(s?.outlet, "Unknown");

      if (!what || !why || !sideA || !sideB) throw new Error("LLM returned incomplete story fields.");

      return {
        id: safeText(s?.id, randomId()),
        href: safeText(s?.href, "#"),
        imageUrl: categoryImageUrl(category),
        title,
        what_happened: what,
        why_it_matters: why,
        both_sides: { side_a: sideA, side_b: sideB },
        outlet,
        category,
      };
    });

    const marketTape = {
      sp500_pct: normalizePct(storiesData.market_tape?.sp500_pct),
      nasdaq_pct: normalizePct(storiesData.market_tape?.nasdaq_pct),
      dow_pct: normalizePct(storiesData.market_tape?.dow_pct),
    };

    const metaPrompt = `
You are producing metadata for the UI of a premium investor briefing.

DATE: ${date}
LISTENER: ${name}

MARKET TAPE:
- S&P: ${marketTape.sp500_pct}
- Nasdaq: ${marketTape.nasdaq_pct}
- Dow: ${marketTape.dow_pct}

STORIES:
${enrichedStories
  .map(
    (s, i) => `${i + 1}) ${s.title}
- category: ${s.category}
- what_happened: ${s.what_happened}
- why_it_matters: ${s.why_it_matters}
`
  )
  .join("\n")}

Return JSON only with:
- summary: 2–3 sentences max.
- key_highlights: array of 3–5 bullets.
- market_sentiment: { label: "bullish"|"bearish"|"neutral"|"mixed", description: one sentence }.
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

    const scriptPrompt = `
Write the full spoken script for "Pulse" using the provided data.

LISTENER NAME: ${name}
DATE: ${date}

VOICE:
- Plain + investor
- Natural pacing
- Impartial
- No filler like "according to"
- Percent moves only. No index levels.

STRUCTURE (6A):
Hook -> Tape -> One Thread -> Engage (up to 4 stories) -> Call to Action -> Close

DATA:
market_tape:
- S&P: ${marketTape.sp500_pct}
- Nasdaq: ${marketTape.nasdaq_pct}
- Dow: ${marketTape.dow_pct}

stories:
${enrichedStories
  .map(
    (s, i) => `
${i + 1}) ${s.title}
- what: ${s.what_happened}
- why: ${s.why_it_matters}
- sideA: ${s.both_sides.side_a}
- sideB: ${s.both_sides.side_b}
- outlet: ${s.outlet}
`
  )
  .join("\n")}

Return JSON only: { "script": "..." }
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

    const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: userEmail,
    });

    // Save briefing with script first
    const baseRecord = {
      date,
      created_by: userEmail,
      script,
      summary: uiSummary,
      market_sentiment: uiSentiment,
      key_highlights: uiHighlights,
      news_stories: enrichedStories,
      duration_minutes: estimatedMinutes,
      status: skipAudio ? "script_ready" : "generating",
      audio_url: null,
    };

    let saved;
    if (Array.isArray(existing) && existing.length > 0) {
      saved = await base44.asServiceRole.entities.DailyBriefing.update(existing[0].id, baseRecord);
    } else {
      saved = await base44.asServiceRole.entities.DailyBriefing.create(baseRecord);
    }

    // If skip_audio is true, return early with script only
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
    // Generate audio automatically
    // =========================================================
    const audioFile = await generateAudioFile(script, date, elevenLabsApiKey);

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
      file: audioFile,
    });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });

    const updated = await base44.asServiceRole.entities.DailyBriefing.update(saved.id, {
      audio_url: signed_url,
      status: "ready",
    });

    return Response.json({
      success: true,
      briefing: updated,
      wordCount: wc,
      estimatedMinutes,
      status: "ready",
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});