import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
function isTooShort(text) {
  return wordCount(text) < 1150; // ~8 min at 150 wpm
}

function sanitizeForAudio(s) {
  if (!s) return "";
  let t = String(s);

  // Strip markdown links: [text](url) -> text
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");

  // Strip raw URLs + domains
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");

  // Strip URL glue
  t = t.replace(/\bhttps\b/gi, "");
  t = t.replace(/\bwww\b/gi, "");
  t = t.replace(/\bdot\b/gi, "");

  // Remove empty citation parentheses left behind
  t = t.replace(/\(\s*\)/g, "");

  // Remove standalone section headers if model outputs them
  t = t.replace(/^\s*(The Tape|The Thread|Engage|Call to Action|Close)\s*$/gim, "");

  // HARD: remove index “levels” like 6,940.01 or 23,515.39 (commas + optional decimals)
  // We only remove the numeric token; the prompt should avoid generating them in the first place.
  t = t.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, "");

  // Remove markdown-ish formatting chars
  t = t.replace(/[*_`>#]/g, "");

  // Normalize whitespace
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    //delete this// 
    const previewOnly = Boolean(body?.preview_only);
    //delete this//
    const preferences = body?.preferences ?? {};
    const date = safeISODate(body?.date);

    const name =
      (typeof preferences?.user_name === "string" && preferences.user_name.trim()) ? preferences.user_name.trim()
      : (typeof user?.name === "string" && user.name.trim()) ? user.name.trim()
      : "there";

    const targetWordRange = "1150 to 1350 words";

    const scriptPrompt = `
You are the host of "Pulse" — a premium morning financial audio briefing.

DATE: ${date}
LISTENER NAME: ${name}

VOICE (LOCKED):
- Medium energy
- Plain + investor voice (casual, engaging; no academic tone)
- Natural pacing; narrative-like; impartial
- Avoid AI-isms. Do NOT overuse “not X… but Y”.

ABSOLUTE RULE (MARKET NUMBERS):
- DO NOT read index levels / point values.
- NO values like "6,940.01" or "23,515.39" or "49,359.33".
- In the market tape, only give PERCENT changes for the day (e.g., “S&P was down 0.1%”).
- Percentages are fine. Whole-dollar figures are fine when necessary (e.g., “a $285 billion package”).
- Avoid decimals in general unless it materially changes meaning. Prefer rounding.

FORBIDDEN PHRASES (never use):
"according to", "as reported by", "in today’s news", "reports say", "sources say",
"dot com", "https", "www", "utm"

SOURCES RULE:
- No URLs or domains.
- No parenthetical citations.
- If you mention a source: outlet name only, max 2 mentions total. Otherwise omit.

STRUCTURE (6A One Thread, target ~8 minutes):
0) Hook: greet the listener by name in the first sentence. Then one soft headline + one hook line with context + “Let’s dive in.”
1) The Tape: quick orientation (only what matters). Percent changes only, no index levels.
2) The Thread: ONE common thread + why it matters (ripple effects).
3) Engage: up to 4 stories. For each:
   - Facts first (neutral, simple)
   - Curiosity pivot: “The natural question is…”
   - Both sides: 1–2 lines each, spoken language, impartial
   - Short-term vs long-term implication
   - Tie back to the thread
4) Call to Action: orientation only (no advice / no buy-sell).
5) Close: one thing to watch tomorrow + calm signoff.

OUTPUT RULES (STRICT):
- Return ONLY the spoken script.
- No standalone section headers on their own lines.
- No bullet points.
- No numbered list formatting like "1." "2." on their own lines.
- Length MUST be ${targetWordRange}. If short, expand with more reasoning and transitions, not fluff.

Light personalization (optional, do not force):
Risk tolerance: ${preferences?.risk_tolerance || "moderate"}
Interests: ${(preferences?.investment_interests || []).join(", ") || "general markets"}
Holdings: ${(preferences?.portfolio_holdings || []).join(", ") || "not specified"}

Generate today’s full script now.
`;

    // Pass 1
    const first = await base44.integrations.Core.InvokeLLM({
      prompt: scriptPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        additionalProperties: false,
        properties: { script: { type: "string" } },
        required: ["script"],
      },
    });

    let script = sanitizeForAudio(first?.script || "");

    // Pass 2 expansion if short
    if (isTooShort(script)) {
      const expandPrompt = `
Expand the script to ${targetWordRange}.

KEEP:
- same voice (plain + investor, medium energy, narrative-like, impartial)
- greet the listener by name in the first sentence ("${name}")
- no index levels / point values; percent changes only for market tape
- same structure (hook -> tape -> thread -> up to 4 stories -> CTA -> close)

FORBIDDEN:
- No URLs, domains, citations, or citation-like parentheses
- No standalone headers
- No bullet points
- No numbered list formatting like "1." "2."

SCRIPT TO EXPAND:
<<<
${script}
>>>

Return ONLY the expanded script.
`;
      const expanded = await base44.integrations.Core.InvokeLLM({
        prompt: expandPrompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          additionalProperties: false,
          properties: { script: { type: "string" } },
          required: ["script"],
        },
      });

      script = sanitizeForAudio(expanded?.script || script);
    }

    if (!script) return Response.json({ error: "Empty script" }, { status: 500 });

    const wc = wordCount(script);
    const estimatedMinutes = Math.max(1, Math.round(wc / 150));
//**********DELETE AFTER TESTING//
if (previewOnly) {
  // Save script only, skip ElevenLabs to preserve credits
  const existingUser = await base44.asServiceRole.entities.DailyBriefing.filter({
    date,
    created_by: user.email,
  });

  const briefingRecord = {
    date,
    script,
    duration_minutes: estimatedMinutes,
    status: "script_ready",
    audio_url: null,
  };

  let saved;
  if (existingUser.length > 0) {
    saved = await base44.asServiceRole.entities.DailyBriefing.update(existingUser[0].id, briefingRecord);
  } else {
    saved = await base44.entities.DailyBriefing.create(briefingRecord);
  }

  return Response.json({
    success: true,
    briefing: saved,
    estimatedMinutes,
    preview_only: true,
  });
}
//**********DELETE AFTER TESTING//
    // ElevenLabs TTS
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

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

    // Upload private file + signed URL
    const audioBlob = await ttsResponse.blob();
    const audioFile = new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: audioFile });

    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });

    // Save under YOUR user so UI can find it
    const existingUser = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: user.email,
    });

    const briefingRecord = {
      date,
      script,
      audio_url: signed_url,
      duration_minutes: estimatedMinutes,
      status: "ready",
    };

    let saved;
    if (existingUser.length > 0) {
      saved = await base44.asServiceRole.entities.DailyBriefing.update(existingUser[0].id, briefingRecord);
    } else {
      saved = await base44.entities.DailyBriefing.create(briefingRecord);
    }

    return Response.json({
      success: true,
      briefing: saved,
      wordCount: wc,
      estimatedMinutes,
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});
