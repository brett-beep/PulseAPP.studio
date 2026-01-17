import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function sanitizeForAudio(s) {
  if (!s) return "";
  let t = String(s);

  // Remove markdown links: [text](url) -> text
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");

  // Remove any raw URLs
  t = t.replace(/https?:\/\/\S+/gi, "");

  // Remove domain-like tokens (apnews.com, nasdaq.com, etc.)
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");

  // Remove "www" and tracking tokens
  t = t.replace(/\bwww\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");

  // Remove spoken URL glue words that tend to leak into scripts
  t = t.replace(/\bhttps\b/gi, "");
  t = t.replace(/\bdot\b/gi, "");

  // Remove leftover citation parentheses like "( )" or "()"
  t = t.replace(/\(\s*\)/g, "");

  // Remove markdown / formatting artifacts
  t = t.replace(/[*_`>#]/g, "");

  // Normalize whitespace
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

// Enforce target length (~8 minutes at 150 wpm => ~1150-1300 words)
function needsExpansion(text, targetMinutes) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minWords = Math.floor(targetMinutes * 150 * 0.9); // 90% of target
  return words < minWords;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};
    const date = safeISODate(body?.date);

    // You selected: 8 mins, medium energy, plain+investor, narrative-like, no journalistic phrases
    const targetMinutes = 8;
    const targetWordRange = "1150 to 1350 words";

    // -----------------------------
    // SCRIPT PROMPT (single-call; hard style constraints)
    // -----------------------------
    const scriptPrompt = `
You are the host of "Pulse" — a premium morning financial audio briefing.

DATE: ${date}

VOICE + PACING (LOCKED):
- Medium energy
- Plain + investor voice (casual, engaging; avoid academic phrasing)
- Natural spoken cadence; narrative-like analysis; impartial
- Softer delivery: no overdramatic metaphors without context
- Avoid AI-isms. Do NOT overuse "not X...but Y". Only use contrast if it adds meaningful explanatory weight.

FORBIDDEN (must never appear, exact):
"according to", "as reported by", "in today’s news", "reports say", "sources say", "dot com", "https", "www", "utm"

SOURCES RULE:
- Do NOT include URLs or domains.
- Do NOT include parenthetical citations.
- If you mention a source, use outlet NAME ONLY, max 2 mentions total (e.g., "Reuters", "Bloomberg"). Otherwise omit sources entirely.

STRUCTURE (6A One Thread, target ~${targetMinutes} minutes):
0) Hook: one soft headline + a hook line that gives context, then “Let’s dive in.”
1) The Tape: quick orientation (no data dump; only what matters).
2) The Thread: ONE common thread + why it matters to the listener (ripple effects).
3) Engage: up to 4 stories. For each:
   - Facts first (neutral; keep it simple)
   - Curiosity pivot: “The natural question is…”
   - BOTH sides: 1–2 lines each, impartial, spoken language
   - Short-term vs long-term implication
   - Tie back to the thread
4) Call to Action: orientation only (no buy/sell, no advice language).
5) Close: one thing to watch tomorrow + calm signoff.

IMPORTANT OUTPUT RULES:
- Output must be a single continuous spoken script.
- Do NOT use section headings like "The Tape" / "The Thread" / "Engage" as standalone headers.
  Instead, weave transitions in speech (e.g., “Here’s the tape.” “Here’s the thread.”).
- No bullet lists.
- No numbered list formatting like "1." "2." on their own lines.
- Length must be ${targetWordRange}. If you are short, expand by adding more reasoning, context, and smooth transitions—without adding fluff.

PERSONALIZATION (light touch only):
- Risk tolerance: ${preferences?.risk_tolerance || "moderate"}
- Interests: ${(preferences?.investment_interests || []).join(", ") || "general markets"}
- Holdings: ${(preferences?.portfolio_holdings || []).join(", ") || "not specified"}

Now generate today’s full script.
`;

    const firstPass = await base44.integrations.Core.InvokeLLM({
      prompt: scriptPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          script: { type: "string" },
        },
        required: ["script"],
      },
    });

    let finalScript = sanitizeForAudio(firstPass?.script || "");

    // -----------------------------
    // If too short, do a second pass to expand (keeps style constraints)
    // -----------------------------
    if (needsExpansion(finalScript, targetMinutes)) {
      const expandPrompt = `
You previously wrote a Pulse script, but it is too short.

TASK:
Expand the script to ${targetWordRange} while preserving:
- same voice (plain + investor, medium energy, narrative-like, impartial)
- same structure (hook -> tape -> thread -> up to 4 stories -> CTA -> close)
- no URLs, no domains, no citations, no "according to", no "dot com"
- no standalone headings and no numbered list formatting

Here is the current script (expand it, do not restart completely):
<<<SCRIPT
${finalScript}
SCRIPT>>>

Return ONLY the expanded script text.
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

      finalScript = sanitizeForAudio(expanded?.script || finalScript);
    }

    if (!finalScript) {
      return Response.json({ error: "Script generation returned empty output" }, { status: 500 });
    }

    // Estimate duration
    const wordCount = finalScript.split(/\s+/).filter(Boolean).length;
    const estimatedMinutes = Math.max(1, Math.round(wordCount / 150));

    // -----------------------------
    // ElevenLabs TTS
    // -----------------------------
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
        text: finalScript,
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

    // Upload to Base44 private storage + create signed URL
    const audioBlob = await ttsResponse.blob();
    const audioFile = new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
      file: audioFile,
    });

    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7, // 7 days
    });

    // -----------------------------
    // Save record as the USER (so your UI can find it under your account)
    // -----------------------------
    const briefingRecord = {
      date,
      script: finalScript,
      audio_url: signed_url,
      duration_minutes: estimatedMinutes,
      status: "ready",
    };

    // IMPORTANT: use base44.entities (user context) so created_by = you
    const existing = await base44.entities.DailyBriefing.filter({ date });

    let savedBriefing;
    if (existing.length > 0) {
      savedBriefing = await base44.entities.DailyBriefing.update(existing[0].id, briefingRecord);
    } else {
      savedBriefing = await base44.entities.DailyBriefing.create(briefingRecord);
    }

    return Response.json({
      success: true,
      briefing: savedBriefing,
      estimatedMinutes,
      wordCount,
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});
