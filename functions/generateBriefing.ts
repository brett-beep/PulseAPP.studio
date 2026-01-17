import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function sanitizeForAudio(raw) {
  if (!raw) return "";

  let s = String(raw);

  // 1) Remove markdown links: [text](https://url) -> "text"
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");

  // 2) Remove bare URLs
  s = s.replace(/https?:\/\/\S+/g, "");

  // 3) Remove parenthetical domain mentions like (apnews.com) / (something.net)
  s = s.replace(/\(([^)]*\b(?:com|net|org|io|co|ca|ai|app)\b[^)]*)\)/gi, "");

  // 4) Remove leftover markdown artifacts
  s = s.replace(/[*_`>#]/g, "");

  // 5) Remove “journalistic attribution” phrasing if it slips through
  // Keep this list tight; do not over-sanitize normal language.
  const banned = [
    "according to",
    "as reported by",
    "in today’s news",
    "in today's news",
    "reports say",
    "sources say",
    "dot com",
  ];
  for (const phrase of banned) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    s = s.replace(re, "");
  }

  // 6) Normalize whitespace
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.trim();

  return s;
}

// Helper: safe date for filenames and record keys
function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
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
    // Stage A: Research (facts only)
    // -----------------------------
    const researchPrompt = `
You are a financial research analyst. Your job is to collect FACTS only, not narration.

Date: ${date}

User Profile (for relevance only):
- Goals: ${(preferences?.investment_goals || []).join(", ") || "General investing"}
- Risk tolerance: ${preferences?.risk_tolerance || "moderate"}
- Interests: ${(preferences?.investment_interests || []).join(", ") || "General markets"}
- Holdings: ${(preferences?.portfolio_holdings || []).join(", ") || "Not specified"}

TASK:
Return a structured research pack for a daily financial briefing.

STRICT RULES:
- Do NOT write a script.
- Do NOT include any URLs.
- Do NOT include markdown links.
- Do NOT include parenthetical website domains (e.g., "(apnews.com)").
- No “according to / as reported by / sources say”.
- Outlet field must be a NAME only (e.g., "Bloomberg", "WSJ", "Reuters", "Associated Press") — never a domain.
- Keep each item concise. Facts, numbers, timelines, what changed, why it matters.

REQUIRED OUTPUT:
- market_snapshot: key moves & drivers (bullet facts)
- thread_candidates: 3 possible "common threads" driving today (plain language)
- top_stories: 5 stories ranked by relevance/impact (each with facts, 2-sided framing, implications)
- tomorrow_watchlist: 2–4 catalysts/events

When you mention companies, include tickers if known.
`;

    const research = await base44.integrations.Core.InvokeLLM({
      prompt: researchPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          market_snapshot: {
            type: "array",
            items: { type: "string" },
            description: "Facts-only bullets about market moves and key drivers",
          },
          thread_candidates: {
            type: "array",
            items: { type: "string" },
            description: "3 plain-language candidate themes (no hype)",
          },
          top_stories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                outlet: { type: "string", description: "Outlet name only, never a domain" },
                category: { type: "string" },
                facts: {
                  type: "array",
                  items: { type: "string" },
                  description: "Neutral facts only",
                },
                curiosity_question: {
                  type: "string",
                  description: "A single question that opens the 'why now?' angle",
                },
                side_a: {
                  type: "string",
                  description: "1–2 sentences: interpretation A (impartial)",
                },
                side_b: {
                  type: "string",
                  description: "1–2 sentences: interpretation B (impartial)",
                },
                implications_short_term: {
                  type: "array",
                  items: { type: "string" },
                },
                implications_long_term: {
                  type: "array",
                  items: { type: "string" },
                },
                ties_to_thread: {
                  type: "string",
                  description: "How this links to the day’s common thread",
                },
              },
              required: [
                "title",
                "outlet",
                "facts",
                "curiosity_question",
                "side_a",
                "side_b",
                "implications_short_term",
                "implications_long_term",
                "ties_to_thread",
              ],
            },
            description: "Five ranked stories, facts + balanced framing",
          },
          tomorrow_watchlist: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["market_snapshot", "thread_candidates", "top_stories", "tomorrow_watchlist"],
      },
    });

    // Choose one thread candidate (simple: take first; you can later add logic)
    const chosenThread =
      (Array.isArray(research?.thread_candidates) && research.thread_candidates[0]) ||
      "the way risk is being priced in the background";

    // -----------------------------
    // Stage B: Script writer (your style)
    // -----------------------------
    const scriptPrompt = `
You are the host of "Pulse" — a premium morning financial audio briefing.

STYLE (LOCKED):
- Luxury Morning Host vibe: calm, confident, engaging.
- Medium energy. Natural spoken cadence. Narrative-like, but impartial.
- Plain + investor vocabulary. Avoid academic phrasing.
- No hype, no drama without context. State the fact first, then zoom out.
- Avoid AI-isms and overused contrast structures. Do NOT overuse "not X...but Y".
  Only use contrast if it adds real explanatory weight — otherwise remove it.

FORBIDDEN PHRASES (never appear):
"according to", "as reported by", "in today’s news", "sources say", "reports say", "dot com", any URL, any domain.

SOURCES:
- You may mention outlet names ONLY sparingly.
- If you mention an outlet, do it as a short tag at the end of a story, like: "Source: Bloomberg."
- Max 2 outlet mentions in the entire script. Otherwise omit.

STRUCTURE (6A: One Thread) — target ~8 minutes when read aloud:
0) Hook (1–3 lines): a soft, contextual hook. No numbers. No URLs.
1) The Tape (brief): calm market orientation, no data dump.
2) The Thread: clearly state the day's common thread in plain language, and why the listener should care (ripple effects).
3) Engage (4 stories max, using this micro-structure each time):
   - Facts (neutral, brief)
   - Curiosity pivot ("The natural question is..." etc.)
   - Two-sided framing (A / B), 1–2 sentences each, impartial
   - Short-term vs long-term implications (simple)
   - Tie back to the thread (explicit)
4) Call to Action: not buy/sell — orientation. One or two lanes ("long-term" vs "risk-sensitive").
5) Close: 1 thing to watch tomorrow + calm signoff.

USER PERSONALIZATION:
- Greeting: "${preferences?.preferred_greeting || "Good morning"}"
- Use name occasionally: "${preferences?.user_name || ""}"
- Keep it subtle. No forced personalization.

INPUT RESEARCH PACK (facts-only):
Market snapshot bullets:
${(research.market_snapshot || []).map((x) => `- ${x}`).join("\n")}

Chosen common thread:
${chosenThread}

Top stories:
${(research.top_stories || [])
  .slice(0, 5)
  .map((st, idx) => {
    const facts = (st.facts || []).map((f) => `    - ${f}`).join("\n");
    const ist = (st.implications_short_term || []).map((f) => `    - ${f}`).join("\n");
    const ilt = (st.implications_long_term || []).map((f) => `    - ${f}`).join("\n");
    return `
${idx + 1}) ${st.title}
  Outlet: ${st.outlet}
  Facts:
${facts}
  Curiosity question: ${st.curiosity_question}
  Side A: ${st.side_a}
  Side B: ${st.side_b}
  Short-term:
${ist}
  Long-term:
${ilt}
  Tie to thread: ${st.ties_to_thread}
`;
  })
  .join("\n")}

Tomorrow watchlist:
${(research.tomorrow_watchlist || []).map((x) => `- ${x}`).join("\n")}

OUTPUT:
Return ONLY the final script text. No JSON. No bullets. No headings like "Section 1".
Write it the way a human host would speak.
`;

    const scriptText = await base44.integrations.Core.InvokeLLM({
      prompt: scriptPrompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          script: { type: "string" },
        },
        required: ["script"],
      },
    });

    const rawScript = scriptText?.script || "";
    const finalScript = sanitizeForAudio(rawScript);

    // Estimate duration
    const wordCount = finalScript.split(/\s+/).filter(Boolean).length;
    const estimatedMinutes = Math.max(1, Math.round(wordCount / 150));

    // -----------------------------
    // ElevenLabs TTS
    // -----------------------------
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      return Response.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel (example)
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
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
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      return Response.json(
        { error: "ElevenLabs TTS failed", details: errorText },
        { status: 500 }
      );
    }

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
    // Save briefing record
    // -----------------------------
    const briefingRecord = {
      date,
      script: finalScript,
      summary: finalScript.slice(0, 280), // lightweight placeholder; refine later
      market_sentiment: "mixed", // optional; you can add a sentiment field in Stage B if you want
      key_highlights: (research.market_snapshot || []).slice(0, 6),
      news_stories: (research.top_stories || []).slice(0, 5).map((st) => ({
        title: st.title,
        summary: (st.facts || []).slice(0, 2).join(" "),
        relevance_reason: st.ties_to_thread,
        source: st.outlet,
        category: st.category || "Market",
      })),
      audio_url: signed_url,
      duration_minutes: estimatedMinutes,
      status: "ready",
      created_by: user.email,
    };

    const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: user.email,
    });

    let savedBriefing;
    if (existing.length > 0) {
      savedBriefing = await base44.asServiceRole.entities.DailyBriefing.update(
        existing[0].id,
        briefingRecord
      );
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
    return Response.json(
      { error: error?.message || String(error), stack: error?.stack },
      { status: 500 }
    );
  }
});
