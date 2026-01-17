import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { preferences, date } = await req.json();

        // Build comprehensive news collection prompt
        const newsPrompt = `You are a financial research analyst tasked with creating a comprehensive daily financial briefing.

Today's date: ${date}

User Profile:
- Investment Goals: ${preferences?.investment_goals?.join(', ') || 'General investing'}
- Risk Tolerance: ${preferences?.risk_tolerance || 'moderate'}
- Sectors of Interest: ${preferences?.investment_interests?.join(', ') || 'General markets'}
- Portfolio Holdings: ${preferences?.portfolio_holdings?.join(', ') || 'Not specified'}
- Preferred Voice Style: ${preferences?.preferred_voice || 'professional'}
- Briefing Length Target: ${preferences?.briefing_length === 'short' ? '5 minutes' : preferences?.briefing_length === 'long' ? '12 minutes' : '8 minutes'}

TASK: Create a personalized financial briefing that includes:

1. **Market Overview** (2-3 minutes)
   - Major indices performance (S&P 500, Nasdaq, Dow Jones, international markets)
   - Key market drivers and sentiment
   - Sector rotation and notable movements

2. **Personalized Portfolio Analysis** (2-3 minutes)
   - Specific news and analysis for the user's holdings: ${preferences?.portfolio_holdings?.join(', ') || 'general market'}
   - Sector-specific developments in: ${preferences?.investment_interests?.join(', ') || 'major sectors'}
   - Risk assessment relevant to their ${preferences?.risk_tolerance || 'moderate'} risk tolerance

3. **Economic Events & Data** (1-2 minutes)
   - Important economic releases (GDP, inflation, employment, Fed policy)
   - Geopolitical events affecting markets
   - Upcoming catalysts to watch

4. **Curated News Stories** (3-5 minutes)
   - 4-6 highly relevant news stories based on user's interests and holdings
   - Include analysis of why each story matters to this specific investor

IMPORTANT REQUIREMENTS:
- Write in a natural, conversational speaking style (this will be converted to audio)
- Tone should be ${preferences?.preferred_voice || 'professional'}
- Target ${preferences?.briefing_length === 'short' ? '5' : preferences?.briefing_length === 'long' ? '12' : '8'} minutes when read aloud
- Include smooth transitions between sections
- Use the investor's name occasionally for personalization
- Avoid jargon unless explaining it
- Be specific with numbers, percentages, and timeframes
- End with a forward-looking statement about tomorrow's key events

Return comprehensive, actionable financial intelligence that this investor can listen to during their morning routine.`;

        // Use LLM with internet context to gather all available financial news
// -----------------------------
// LLM (schema-safe): research pack -> then script
// -----------------------------

// Stage A: research pack (JSON-safe, no nested objects)
const researchPrompt = `
You are a financial research analyst. Collect FACTS only. No narration.

Date: ${date}

User Profile (for relevance only):
- Goals: ${(preferences?.investment_goals || []).join(", ") || "General investing"}
- Risk tolerance: ${preferences?.risk_tolerance || "moderate"}
- Interests: ${(preferences?.investment_interests || []).join(", ") || "General markets"}
- Holdings: ${(preferences?.portfolio_holdings || []).join(", ") || "Not specified"}

STRICT RULES:
- Output MUST be valid JSON (double quotes, no trailing commas).
- Do NOT include URLs.
- Do NOT include markdown links.
- Do NOT include parenthetical domains like (apnews.com).
- Do NOT use: "according to", "as reported by", "sources say", "reports say", "dot com".
- If you mention a source, use outlet NAME only (e.g., Reuters, Bloomberg, WSJ).

Return:
- market_snapshot: 6–10 bullets
- thread_candidates: exactly 3 bullets
- story_cards: exactly 5 strings, each ONE story formatted exactly like this:

TITLE: ...
FACTS: ... ; ... ; ...
QUESTION: ...
SIDE_A: ...
SIDE_B: ...
SHORT_TERM: ... ; ...
LONG_TERM: ... ; ...
THREAD_LINK: ...
SOURCE: OutletName

- tomorrow_watchlist: 2–4 bullets
`;

const research = await base44.integrations.Core.InvokeLLM({
  prompt: researchPrompt,
  add_context_from_internet: true,
  response_json_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      market_snapshot: {
        type: "array",
        items: { type: "string" },
        minItems: 6,
        maxItems: 12
      },
      thread_candidates: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3
      },
      story_cards: {
        type: "array",
        items: { type: "string" },
        minItems: 5,
        maxItems: 5
      },
      tomorrow_watchlist: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 6
      }
    },
    required: ["market_snapshot", "thread_candidates", "story_cards", "tomorrow_watchlist"]
  }
});

const chosenThread = research.thread_candidates?.[0] || "how risk is being priced in the background";

// Stage B: write the final script in your Pulse voice (simple JSON: {script})
const scriptPrompt = `
You are the host of "Pulse" — a premium morning financial audio briefing.

STYLE (LOCKED):
- Luxury Morning Host vibe: calm, confident, engaging.
- Medium energy. Natural spoken cadence. Narrative-like, but impartial.
- Plain + investor vocabulary. Avoid academic phrasing.
- State the fact first, then zoom out. No drama without context.
- Avoid AI-isms. DO NOT overuse "not X...but Y". Only use it if it adds real explanatory weight.

FORBIDDEN (never appear):
"according to", "as reported by", "in today’s news", "sources say", "reports say", "dot com", any URL, any domain.

SOURCES:
- Outlet names only, sparingly.
- Max 2 outlet mentions total, and only as a short tag like: "Source: Reuters." Otherwise omit.

STRUCTURE (6A One Thread, ~8 minutes):
0) Hook (soft, contextual; no numbers)
1) The Tape (brief; calm orientation)
2) The Thread (state the common thread + why listener should care: ripple effects)
3) Engage (4 stories max; for each: facts -> curiosity question -> side A/side B -> short vs long term -> tie back)
4) Call to Action (orientation, not buy/sell)
5) Close (one thing to watch tomorrow + calm signoff)

INPUT:
Market snapshot:
${(research.market_snapshot || []).map((x) => `- ${x}`).join("\n")}

Chosen thread:
${chosenThread}

Story cards (use up to 4, in order):
${(research.story_cards || []).map((x, i) => `${i + 1}. ${x}`).join("\n\n")}

Tomorrow watchlist:
${(research.tomorrow_watchlist || []).map((x) => `- ${x}`).join("\n")}

OUTPUT:
Return ONLY the final script text as a single string.
No markdown. No headings like "Section 1".
`;

const scriptResp = await base44.integrations.Core.InvokeLLM({
  prompt: scriptPrompt,
  add_context_from_internet: false,
  response_json_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      script: { type: "string" }
    },
    required: ["script"]
  }
});

// Minimal cleanup to prevent spoken URLs/domains if anything slips through
let finalScript = (scriptResp?.script || "").trim();
finalScript = finalScript
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1") // markdown links -> text
  .replace(/https?:\/\/\S+/g, "") // bare urls
  .replace(/\(([^)]*\b(?:com|net|org|io|co|ca|ai|app)\b[^)]*)\)/gi, "") // (domain)
  .replace(/[ \t]{2,}/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

// Keep your original variable name so the rest of your file works unchanged:
const briefingData = {
  script: finalScript,
  summary: "", // optional later
  market_sentiment: "neutral",
  key_highlights: (research.market_snapshot || []).slice(0, 6),
  news_stories: [] // optional later
};


        // Count words to estimate duration
        const wordCount = briefingData.script.split(/\s+/).length;
        const estimatedMinutes = Math.ceil(wordCount / 150); // Average speaking rate

        // Convert script to audio using ElevenLabs
        const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
        
        if (!elevenLabsApiKey) {
            return Response.json({ 
                error: 'ElevenLabs API key not configured',
                briefingData,
                estimatedMinutes 
            }, { status: 500 });
        }

        // Use ElevenLabs professional voice (Rachel - clear, professional female voice)
        const voiceId = "Qggl4b0xRMiqOwhPtVWT"; // Rachel voice
        
        const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenLabsApiKey,
                },
                body: JSON.stringify({
                    text: briefingData.script,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                })
            }
        );

        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            return Response.json({ 
                error: 'ElevenLabs TTS failed', 
                details: errorText,
                briefingData,
                estimatedMinutes
            }, { status: 500 });
        }

        // Get audio data and upload it
        const audioBlob = await ttsResponse.blob();
        const audioFile = new File([audioBlob], `briefing-${date}.mp3`, { type: 'audio/mpeg' });

        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
            file: audioFile
        });

        // Create or update the briefing record
        const briefingRecord = {
            date: date,
            script: briefingData.script,
            summary: briefingData.summary,
            market_sentiment: briefingData.market_sentiment,
            key_highlights: briefingData.key_highlights,
            news_stories: briefingData.news_stories,
            audio_url: uploadResult.file_url,
            duration_minutes: estimatedMinutes,
            status: 'ready'
        };

        // Check if briefing already exists for this date
        const existingBriefings = await base44.asServiceRole.entities.DailyBriefing.filter({ 
            date: date,
            created_by: user.email 
        });

        let savedBriefing;
        if (existingBriefings.length > 0) {
            savedBriefing = await base44.asServiceRole.entities.DailyBriefing.update(
                existingBriefings[0].id, 
                briefingRecord
            );
        } else {
            savedBriefing = await base44.entities.DailyBriefing.create(briefingRecord);
        }

        return Response.json({ 
            success: true, 
            briefing: savedBriefing,
            estimatedMinutes 
        });

    } catch (error) {
        console.error('Error in generateBriefing:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});