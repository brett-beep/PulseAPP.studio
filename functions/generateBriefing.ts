import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function sanitizeForAudio(s) {
  if (!s) return "";
  let t = String(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, ""); // index levels
  t = t.replace(/[*_`>#]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
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
    const date = safeISODate(body?.date);
    const previewOnly = Boolean(body?.preview_only);

    const name =
      (typeof preferences?.user_name === "string" && preferences.user_name.trim())
        ? preferences.user_name.trim()
        : (typeof user?.name === "string" && user.name.trim())
        ? user.name.trim()
        : "there";

    // 1) Get structured "selected stories" first (this powers your UI section)
    const storiesPrompt = `
You are curating "Selected stories" for a premium morning investor audio briefing.

DATE: ${date}

Rules:
- Return exactly 5 stories.
- Outlet: outlet name only (e.g., "WSJ", "Bloomberg", "Reuters"). No URLs.
- No "according to / as reported by / in today's news / dot com".
- Include market context (index % moves) ONLY as % (no index levels).
- Keep it investor-relevant.

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
            additionalProperties: false,
            properties: {
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

    // Sanity check: ensure we got valid stories
    if (!storiesData?.news_stories || !Array.isArray(storiesData.news_stories) || storiesData.news_stories.length < 5) {
      return Response.json({ 
        error: "Invalid stories data from LLM", 
        details: `Expected 5 stories, got ${storiesData?.news_stories?.length || 0}` 
      }, { status: 500 });
    }

    // 2) Write script using your 6A structure + those stories
    const scriptPrompt = `
Write the full spoken script for "Pulse" using the provided data.

LISTENER NAME: ${name}
DATE: ${date}

VOICE:
- Plain + investor (casual, engaging)
- Natural pacing, narrative-like
- Impartial
- Avoid “not X… but Y” unless it truly adds meaning
- NO journalistic filler like "according to", "as reported by", "in today's news", "dot com"

MARKET NUMBERS RULE:
- Percent moves only. No index levels.

STRUCTURE (6A One Thread, target ~8 minutes):
Hook (greet by name first line) -> Tape (use market_tape %s) -> One Thread -> Engage (use up to 4 of the stories, each: facts, curiosity pivot, both sides, short vs long term, tie to thread) -> Call to Action (orientation only) -> Close (one thing to watch tomorrow)

DATA:
market_tape:
- S&P: ${storiesData.market_tape.sp500_pct}
- Nasdaq: ${storiesData.market_tape.nasdaq_pct}
- Dow: ${storiesData.market_tape.dow_pct}

stories:
${storiesData.news_stories
  .map((s, i) => `
${i + 1}) ${s.title}
- what: ${s.what_happened}
- why: ${s.why_it_matters}
- sideA: ${s.both_sides.side_a}
- sideB: ${s.both_sides.side_b}
- outlet: ${s.outlet}
`).join("\n")}

Return JSON only: { "script": "..." }
`;

    const scriptSchema = {
      type: "object",
      additionalProperties: false,
      properties: { script: { type: "string" } },
      required: ["script"],
    };

    const scriptData = await invokeLLM(base44, scriptPrompt, false, scriptSchema);
    let script = sanitizeForAudio(scriptData.script || "");

    // Expand if too short
    for (let round = 0; round < 2; round++) {
      if (wordCount(script) >= 1150) break;
      const expand = await invokeLLM(
        base44,
        `Expand to 1150-1350 words. No URLs. No index levels. Same voice. Return JSON: {"script":"..."}\n\n<<<\n${script}\n>>>`,
        false,
        scriptSchema
      );
      script = sanitizeForAudio(expand.script || script);
    }

    const wc = wordCount(script);
    const estimatedMinutes = Math.max(1, Math.round(wc / 150));

    // Save record NOW so UI gets selected stories back
    const existingUser = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: user.email,
    });

    // Ensure stories are stored as array (not stringified) - Base44 entities support JSON
    const baseRecord = {
      date,
      script,
      summary: null,
      market_sentiment: null,
      key_highlights: [],
      news_stories: storiesData.news_stories, // Store as array directly
      duration_minutes: estimatedMinutes,
      status: previewOnly ? "script_ready" : "ready",
      audio_url: null,
    };

    let saved;
    if (existingUser.length > 0) {
      saved = await base44.asServiceRole.entities.DailyBriefing.update(existingUser[0].id, baseRecord);
    } else {
      saved = await base44.entities.DailyBriefing.create(baseRecord);
    }

    // If previewOnly, stop here (no ElevenLabs credits)
    if (previewOnly) {
      return Response.json({ success: true, briefing: saved, wordCount: wc, estimatedMinutes, preview_only: true });
    }

    // ElevenLabs
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

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
      return Response.json({ error: "ElevenLabs TTS failed", details: errorText }, { status: 500 });
    }

    const audioBlob = await ttsResponse.blob();
    const audioFile = new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: audioFile });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });

    const finalRecord = { ...baseRecord, audio_url: signed_url, status: "ready" };
    const finalSaved = await base44.asServiceRole.entities.DailyBriefing.update(saved.id, finalRecord);

    return Response.json({ success: true, briefing: finalSaved, wordCount: wc, estimatedMinutes });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});