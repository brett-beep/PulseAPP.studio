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

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeISODate(input) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return new Date().toISOString().slice(0, 10);
}

function safeText(input, fallback) {
  const s = typeof input === "string" ? input.trim() : "";
  return s || (fallback || "");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const date = safeISODate(body?.date);

    const userEmail = safeText(user?.email);
    if (!userEmail) return Response.json({ error: "User email missing" }, { status: 400 });

    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

    const existing = await base44.asServiceRole.entities.DailyBriefing.filter({
      date,
      created_by: userEmail,
    });

    if (!Array.isArray(existing) || existing.length === 0) {
      return Response.json({ error: "No DailyBriefing found for this date." }, { status: 404 });
    }

    const briefing = existing[0];
    const script = safeText(briefing?.script);
    if (!script) {
      return Response.json({ error: "DailyBriefing has no script to convert to audio." }, { status: 400 });
    }

    // Optional: mark generating
    await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
      status: "generating",
    });

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
      await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, { status: "failed" });
      return Response.json({ error: "ElevenLabs TTS failed", details: errorText }, { status: 500 });
    }

    const audioBlob = await ttsResponse.blob();
    const audioFile = new File([audioBlob], `briefing-${date}.mp3`, { type: "audio/mpeg" });

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: audioFile });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24 * 7,
    });

    const updated = await base44.asServiceRole.entities.DailyBriefing.update(briefing.id, {
      audio_url: signed_url,
      status: "ready",
    });

    return Response.json({ success: true, briefing: updated });
  } catch (error) {
    console.error("Error in generateBriefingAudio:", error);
    return Response.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
});
