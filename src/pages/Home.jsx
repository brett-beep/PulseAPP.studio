import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

import AudioPlayer from '@/components/AudioPlayer';
import NewsCard from '@/components/NewsCard';
import MarketSentiment from '@/components/MarketSentiment';
import KeyHighlights from '@/components/KeyHighlights';
import OnboardingWizard from '@/components/OnboardingWizard';
import GenerateBriefingButton from '@/components/GenerateBriefingButton';

import { Settings, Headphones } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Home() {
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch current user
    const { data: user, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    // Fetch user preferences
    const { data: preferences, isLoading: prefsLoading } = useQuery({
        queryKey: ['userPreferences'],
        queryFn: async () => {
            const prefs = await base44.entities.UserPreferences.filter({ created_by: user?.email });
            return prefs[0] || null;
        },
        enabled: !!user,
    });

    // Fetch today's briefing
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: briefings, isLoading: briefingLoading, refetch: refetchBriefing } = useQuery({
        queryKey: ['todayBriefing', today],
        queryFn: async () => {
            const briefings = await base44.entities.DailyBriefing.filter({ 
                date: today,
                created_by: user?.email 
            });
            return briefings;
        },
        enabled: !!user && !!preferences?.onboarding_completed,
    });

    const todayBriefing = briefings?.[0];

    // Save preferences mutation
    const savePreferencesMutation = useMutation({
        mutationFn: async (prefs) => {
            if (preferences?.id) {
                return base44.entities.UserPreferences.update(preferences.id, prefs);
            }
            return base44.entities.UserPreferences.create(prefs);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
        },
    });

    // Generate briefing mutation
    const generateBriefing = async () => {
        setIsGenerating(true);
        
        try {
            // Build personalized prompt
            const userContext = `
                User Profile:
                - Investment Goals: ${preferences?.investment_goals?.join(', ') || 'General investing'}
                - Risk Tolerance: ${preferences?.risk_tolerance || 'moderate'}
                - Interests: ${preferences?.investment_interests?.join(', ') || 'General markets'}
                - Portfolio Holdings: ${preferences?.portfolio_holdings?.join(', ') || 'Not specified'}
                - Preferred Briefing Style: ${preferences?.preferred_voice || 'professional'}
                - Briefing Length: ${preferences?.briefing_length === 'short' ? '5 minutes' : preferences?.briefing_length === 'long' ? '12 minutes' : '8 minutes'}
            `;

            // Generate the briefing content using LLM
            const briefingResponse = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a professional financial analyst creating a personalized morning briefing.
                
${userContext}

Today's date: ${format(new Date(), 'MMMM d, yyyy')}

Create a comprehensive, personalized financial briefing that includes:
1. A brief market overview (major indices, key movements)
2. Analysis specifically relevant to the user's portfolio holdings and interests
3. Key economic events or data releases
4. 3-5 curated news stories most relevant to this user's profile

The tone should be ${preferences?.preferred_voice || 'professional'} and the content should be tailored to someone with ${preferences?.risk_tolerance || 'moderate'} risk tolerance.

IMPORTANT: This will be converted to audio, so write in a natural, spoken style. Use conversational transitions.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        script: {
                            type: "string",
                            description: "The full briefing script (8-10 minutes when read aloud)"
                        },
                        summary: {
                            type: "string",
                            description: "A 2-3 sentence summary of today's briefing"
                        },
                        market_sentiment: {
                            type: "string",
                            enum: ["bullish", "bearish", "neutral", "mixed"]
                        },
                        key_highlights: {
                            type: "array",
                            items: { type: "string" },
                            description: "3-5 key bullet points"
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
                            }
                        }
                    }
                }
            });

            // Save the briefing
            const briefingData = {
                date: today,
                script: briefingResponse.script,
                summary: briefingResponse.summary,
                market_sentiment: briefingResponse.market_sentiment,
                key_highlights: briefingResponse.key_highlights,
                news_stories: briefingResponse.news_stories,
                duration_minutes: preferences?.briefing_length === 'short' ? 5 : preferences?.briefing_length === 'long' ? 12 : 8,
                status: 'ready'
            };

            if (todayBriefing?.id) {
                await base44.entities.DailyBriefing.update(todayBriefing.id, briefingData);
            } else {
                await base44.entities.DailyBriefing.create(briefingData);
            }

            await refetchBriefing();
        } catch (error) {
            console.error('Error generating briefing:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOnboardingComplete = async (prefs) => {
        await savePreferencesMutation.mutateAsync(prefs);
    };

    // Loading state
    if (userLoading || prefsLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6">
                <div className="max-w-4xl mx-auto space-y-8">
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    // Show onboarding if not completed
    if (!preferences?.onboarding_completed) {
        return <OnboardingWizard onComplete={handleOnboardingComplete} />;
    }

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, rgba(255, 255, 249, 0.7) 0%, rgba(255, 226, 148, 0.51) 76%, rgba(255, 95, 31, 0.52) 100%)' }}>
            {/* Header */}
            <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                            <Headphones className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-semibold text-slate-900 tracking-tight">Briefing</span>
                    </div>
                    <Link to={createPageUrl('Settings')}>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                            <Settings className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Audio Player / Generate Button */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12"
                >
                    {todayBriefing?.status === 'ready' ? (
                        <div className="space-y-6">
                            <AudioPlayer
                                audioUrl={todayBriefing.audio_url}
                                duration={todayBriefing.duration_minutes}
                                greeting={greeting()}
                                userName={user?.full_name?.split(' ')[0] || 'there'}
                                currentDate={format(new Date(), 'MM/dd, EEE')}
                            />
                            
                            <div className="flex items-center justify-between">
                                <MarketSentiment sentiment={todayBriefing.market_sentiment} />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={generateBriefing}
                                    disabled={isGenerating}
                                    className="text-slate-500"
                                >
                                    Regenerate
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Headphones className="h-8 w-8 text-amber-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">
                                Your briefing awaits
                            </h2>
                            <p className="text-slate-500 mb-8 max-w-md mx-auto">
                                Get your personalized financial briefing with the latest market news and insights tailored to your portfolio.
                            </p>
                            <GenerateBriefingButton
                                onGenerate={generateBriefing}
                                isGenerating={isGenerating}
                                hasExistingBriefing={false}
                            />
                        </div>
                    )}
                </motion.section>

                {/* Summary & Key Highlights */}
                {todayBriefing?.status === 'ready' && (
                    <>
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mb-12"
                        >
                            {todayBriefing.summary && (
                                <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6">
                                    <p className="text-slate-700 leading-relaxed">{todayBriefing.summary}</p>
                                </div>
                            )}
                            <KeyHighlights highlights={todayBriefing.key_highlights} />
                        </motion.section>

                        {/* News Stories */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-slate-900">Curated for You</h2>
                                <span className="text-sm text-slate-400">
                                    {todayBriefing.news_stories?.length || 0} stories
                                </span>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {todayBriefing.news_stories?.slice(0, 5).map((story, index) => (
                                    <NewsCard key={index} story={story} index={index} />
                                ))}
                            </div>
                        </motion.section>
                    </>
                )}
            </main>
        </div>
    );
}