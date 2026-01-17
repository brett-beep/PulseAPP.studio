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

  // Remove domains like apnews.com, nasdaq.com
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)\b/gi, "");

  // Remove "www" and tracking tokens
  t = t.replace(/\bwww\b/gi, "");
  t = t.replace(/\butm_[a-z0-9_]+\b/gi, "");

  // Remove spoken URL glue words that frequently leak into scripts
  t = t.replace(/\bhttps\b/gi, "");
  t = t.replace(/\bdot\b/gi, "");

  // Remove leftover markdown artifacts
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

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const preferences = body?.preferences ?? {};
    const date = safeISODate(body?.date);

    // -----------------------------
    // ONE-CALL SCRIPT PROMPT (6A One Thread, schema-safe)
    // -----------------------------
    const scriptPrompt = `
You are the host of "Pulse" — a premium morning financial audio briefing.

DATE: ${date}

LOCKED STYLE:
- Medium energy
- Plain + investor voice (casual, engaging; avoid academic tone)
- Natural pacing; narrative-like analysis; impartial
- Facts first, then zoom out
- Avoid AI-isms. Do NOT overuse "not X...but Y". Only use contrast if it adds real explanatory weight.

FORBIDDEN PHRASES (never use):
"according to", "as reported by", "in today’s news", "reports say", "sources say", "dot com", "https", "www", "utm"

SOURCES RULE:
- Outlet names only, optional
- Max 2 outlet mentions in the entire script
- Never include URLs or domains (no .com, no links)

STRUCTURE (6A One Thread, target ~8 minutes read aloud):
0) Hook: open with a question/challenge/goal (1–3 lines). No numbers.
1) The Tape: calm orientation (no data dump; only what's needed).
2) The Thread: state ONE common thread driving today + why it matters (ripple effects).
3) Engage: cover up to 4 stories, each:
   - Facts first (neutral; include key numbers if essential)
   - Curiosity pivot (“the natural question is…”)
   - Both sides (1–2 lines each, impartial)
   - Short-term vs long-term implication (simple)
   - Tie back to the thread
4) Call to Action: orientation only (no buy/sell).
5) Close: one thing to watch tomorrow + calm signoff.

PERSONALIZATION:
- Name: ${preferences?.user_name || ""}
- Risk tolerance: ${preferences?.risk_tolerance || "moderate"}
- Interests: ${(preferences?.investment_interests || []).join(", ") || "general markets"}
- Holdings (if any): ${(preferences?.portfolio_holdings || []).join(", ") || "not specified"}
Use personalization lightly (do not force it).

OUTPUT:
Return ONLY the spoken script text.
No headings like "Market Overview".
No bullets.
No links.
`;

    const llmResp = await base44.integrations.Core.InvokeLLM({
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

    const finalScript = sanitizeForAudio(llmResp?.script || "");
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

    // Use your voice ID
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

    // Save record (keep minimal to avoid schema mismatch issues)
    const briefingRecord = {
      date,
      script: finalScript,
      audio_url: signed_url,
      duration_minutes: estimatedMinutes,
      status: "ready",
    };

    // Upsert by date + creator
    const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: user.email,
    });

    let savedBriefing;
    if (existing.length > 0) {
      savedBriefing = await base44.asServiceRole.entities.DailyBriefing.update(existing[0].id, briefingRecord);
    } else {
      savedBriefing = await base44.asServiceRole.entities.DailyBriefing.create(briefingRecord);
    }

    return Response.json({
      success: true,
      briefing: savedBriefing,
      estimatedMinutes,
    });
  } catch (error) {
    console.error("Error in generateBriefing:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});
