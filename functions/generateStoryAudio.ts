/**
 * generateStoryAudio
 * 
 * INPUT (JSON body):
 *   - story: object with { title, what_happened, why_it_matters, both_sides, category, outlet }
 *   - preferences: user preferences object (optional)
 *   - date: ISO date string (optional)
 *   - preview_only: boolean (if true, returns script only, no audio)
 * 
 * OUTPUT:
 *   - preview_only=true: { success: true, script: string, wordCount: number }
 *   - preview_only=false: { success: true, script: string, audio_url: string, wordCount: number }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function sanitizeForAudio(s) {
  let t = String(s || "").trim();
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/\*\*/g, "");
  t = t.replace(/\*/g, "");
  t = t.replace(/_/g, "");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/#{1,6}\s+/g, "");
  t = t.replace(/\bhttps?:\/\/[^\s]+/gi, "");
  t = t.replace(/\b\w+\.(com|org|net|io|co)\b/gi, "");
  return t.trim();
}

function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function safeText(input, fallback = "") {
  const s = typeof input === "string" ? input.trim() : "";
  return s || fallback;
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
    console.log("[generateStoryAudio] Request received");
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.error("[generateStoryAudio] Unauthorized: no user");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log(`[generateStoryAudio] Authenticated user: ${user.email}`);
    
    const body = await req.json();
    const { story, preferences, date, preview_only = false } = body;
    
    if (!story || !story.title) {
      console.error("[generateStoryAudio] Missing story data");
      return Response.json({ error: "Missing story data" }, { status: 400 });
    }
    
    console.log(`[generateStoryAudio] Processing story: ${story.title}`);
    
    const userName = safeText(preferences?.user_name) || 
                     safeText(user?.name) || 
                     safeText(user?.full_name) || 
                     "there";
    
    // Generate spoken script for this individual story
    const scriptPrompt = `
Write a 60-90 second spoken narrative for this financial news story.

STORY:
Title: ${story.title}
What Happened: ${story.what_happened}
Why It Matters: ${story.why_it_matters}
Both Sides:
- ${story.both_sides?.side_a || ""}
- ${story.both_sides?.side_b || ""}
Outlet: ${story.outlet}
Category: ${story.category}

VOICE:
- Plain, conversational, engaging
- Natural pacing
- Impartial analysis
- NO filler like "according to", "as reported by", "dot com"

STRUCTURE:
1. Open with the headline/hook (what happened)
2. Explain why it matters (context, implications)
3. Present both sides (risks and opportunities)
4. Close with a short takeaway

TARGET: 60-90 seconds when spoken (~100-135 words)

Return JSON only: { "script": "..." }
`;

    console.log("[generateStoryAudio] Calling LLM to generate script");
    
    const scriptSchema = {
      type: "object",
      properties: {
        script: { type: "string" }
      },
      required: ["script"]
    };
    
    const scriptData = await invokeLLM(base44, scriptPrompt, false, scriptSchema);
    const script = sanitizeForAudio(scriptData?.script || "");
    const wc = wordCount(script);
    
    console.log(`[generateStoryAudio] Script generated: ${wc} words`);
    
    if (preview_only) {
      console.log("[generateStoryAudio] Preview mode - returning script only");
      return Response.json({
        success: true,
        script,
        wordCount: wc
      });
    }
    
    // Generate audio with ElevenLabs
    console.log("[generateStoryAudio] Generating audio with ElevenLabs");
    
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      console.error("[generateStoryAudio] ELEVENLABS_API_KEY not configured");
      return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }
    
    const voiceId = "Qggl4b0xRMiqOwhPtVWT";
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
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
      console.error("[generateStoryAudio] ElevenLabs error:", errorText);
      return Response.json({ error: "ElevenLabs TTS failed", details: errorText }, { status: 500 });
    }
    
    console.log("[generateStoryAudio] Audio generated, uploading to storage");
    
    const audioBlob = await ttsResponse.blob();
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    
    const fileName = `story_audio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp3`;
    const file = new File([audioArrayBuffer], fileName, { type: "audio/mpeg" });
    
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    const audioUrl = uploadResult.file_url;
    
    console.log(`[generateStoryAudio] Upload complete: ${audioUrl}`);
    
    return Response.json({
      success: true,
      script,
      audio_url: audioUrl,
      wordCount: wc
    });
    
  } catch (error) {
    console.error("[generateStoryAudio] Error:", error);
    return Response.json({ 
      error: error?.message || String(error), 
      stack: error?.stack 
    }, { status: 500 });
  }
});