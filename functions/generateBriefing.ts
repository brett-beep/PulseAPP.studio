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
        const briefingData = await base44.integrations.Core.InvokeLLM({
            prompt: newsPrompt,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    script: {
                        type: "string",
                        description: "The full audio briefing script, written for natural speech"
                    },
                    summary: {
                        type: "string",
                        description: "A 2-3 sentence executive summary"
                    },
                    market_sentiment: {
                        type: "string",
                        enum: ["bullish", "bearish", "neutral", "mixed"],
                        description: "Overall market sentiment"
                    },
                    key_highlights: {
                        type: "array",
                        items: { type: "string" },
                        description: "4-6 key bullet points from the briefing"
                    },
                    news_stories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                summary: { type: "string" },
                                relevance_reason: { type: "string" },
                                source: { type: "string" },
                                category: { type: "string" }
                            }
                        },
                        description: "4-6 curated news stories most relevant to the user"
                    }
                }
            }
        });

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
        const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
        
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
                    model_id: "eleven_multilingual_v2",
                    output_format: "mp3_44100_128",
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

        const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
            file: audioFile
        });

        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
            file_uri,
            expires_in: 60 * 60 * 6
        });

        // Create or update the briefing record
        const briefingRecord = {
            date: date,
            script: briefingData.script,
            summary: briefingData.summary,
            market_sentiment: briefingData.market_sentiment,
            key_highlights: briefingData.key_highlights,
            news_stories: briefingData.news_stories,
            audio_url: signed_url,
            audio_file_uri: file_uri,
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
            savedBriefing = await base44.asServiceRole.entities.DailyBriefing.create(briefingRecord);
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