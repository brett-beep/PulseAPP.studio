import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { title, content, source } = body;

    if (!title || !content) {
      return Response.json({ error: "Missing required fields: title, content" }, { status: 400 });
    }

    // Generate a concise audio script for this story
    const script = `
${title}

${content}

This story was reported by ${source || "various sources"}.
`.trim();

    // Generate audio using ElevenLabs
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

    const voiceId = "Qggl4b0xRMiqOwhPtVWT"; // Same voice as main briefing

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
    const audioFile = new File([audioBlob], `story-${Date.now()}.mp3`, { type: "audio/mpeg" });

    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: audioFile });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 60 * 60 * 24, // 24 hours
    });

    return Response.json({ success: true, audioUrl: signed_url });
  } catch (error) {
    console.error("Error in generateStoryAudio:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});