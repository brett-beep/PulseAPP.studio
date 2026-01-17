import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

import AudioPlayer from "@/components/AudioPlayer";
import NewsCard from "@/components/NewsCard";
import MarketSentiment from "@/components/MarketSentiment";
import KeyHighlights from "@/components/KeyHighlights";
import OnboardingWizard from "@/components/OnboardingWizard";

import { Settings, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  // Fetch user preferences
  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      const prefs = await base44.entities.UserPreferences.filter({ created_by: user?.email });
      return prefs[0] || null;
    },
    enabled: !!user,
  });

  // Fetch today's briefing
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: briefings, isLoading: briefingLoading, refetch: refetchBriefing } = useQuery({
    queryKey: ["todayBriefing", today],
    queryFn: async () => {
      const b = await base44.entities.DailyBriefing.filter({
        date: today,
        created_by: user?.email,
      });
      return b;
    },
    enabled: !!user && !!preferences?.onboarding_completed,
  });

  const todayBriefing = briefings?.[0] || null;

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (prefs) => {
      if (preferences?.id) return base44.entities.UserPreferences.update(preferences.id, prefs);
      return base44.entities.UserPreferences.create(prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  // Safe parser for Base44 array fields (can be array OR JSON-string)
  const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Mode A: generate stories/script only (fast)
  const generateBriefingScript = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke("generateBriefing", {
        preferences: preferences,
        date: today,
        // backend must support this flag and skip ElevenLabs
        audio_only: false,
      });

      if (response?.data?.error) {
        console.error("Briefing script generation error:", response.data.error);
        alert("Failed to generate briefing: " + response.data.error);
      } else {
        await refetchBriefing();
      }
    } catch (error) {
      console.error("Error generating briefing script:", error);
      alert("Failed to generate briefing. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Mode B: generate audio only (slow)
  const generateBriefingAudio = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke("generateBriefing", {
        date: today,
        audio_only: true,
      });

      if (response?.data?.error) {
        console.error("Audio generation error:", response.data.error);
        alert("Failed to generate audio: " + response.data.error);
      } else {
        await refetchBriefing();
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      alert("Failed to generate audio. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOnboardingComplete = async (prefs) => {
    await savePreferencesMutation.mutateAsync(prefs);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
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

  const firstName = user?.full_name?.split(" ")?.[0] || "there";
  const audioUrl = todayBriefing?.audio_url || null;

  const stories = parseJsonArray(todayBriefing?.news_stories);
  const highlights = parseJsonArray(todayBriefing?.key_highlights);

  // Guard sentiment type (new schema uses object)
  const sentiment =
    todayBriefing?.market_sentiment && typeof todayBriefing.market_sentiment === "object"
      ? todayBriefing.market_sentiment
      : null;

  const status = todayBriefing?.status || null;
  const hasScript = Boolean(todayBriefing?.script);
  const canGenerateAudio = status === "script_ready" && !audioUrl && hasScript;

  const onGenerate =
    audioUrl ? null : canGenerateAudio ? generateBriefingAudio : generateBriefingScript;

  const statusLabel = briefingLoading
    ? "Loading briefing…"
    : audioUrl
    ? "Status: Ready to Play"
    : canGenerateAudio
    ? "Status: Script Ready — Generate Audio"
    : "Status: Ready to Generate";

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 255, 249, 0.7) 0%, rgba(255, 226, 148, 0.51) 76%, rgba(255, 95, 31, 0.52) 100%)",
      }}
    >
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <Headphones className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight">Briefing</span>
          </div>
          <Link to={createPageUrl("Settings")}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* AUDIO PLAYER */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <AudioPlayer
            audioUrl={audioUrl}
            duration={todayBriefing?.duration_minutes || 8}
            greeting={greeting()}
            userName={firstName}
            currentDate={format(new Date(), "MM/dd, EEE")}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            status={status}
          />

          <div className="mt-6 flex items-center justify-between">
            <MarketSentiment sentiment={sentiment} />
            <div className="text-sm text-slate-500">{statusLabel}</div>
          </div>
        </motion.section>

        {(todayBriefing?.summary || highlights.length > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            {todayBriefing?.summary ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6">
                <p className="text-slate-700 leading-relaxed">{todayBriefing.summary}</p>
              </div>
            ) : null}

            {highlights.length > 0 ? <KeyHighlights highlights={highlights} /> : null}
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Curated for You</h2>
            <span className="text-sm text-slate-400">{stories.length} stories</span>
          </div>

          {stories.length === 0 ? (
            <div className="bg-white/70 rounded-2xl p-6 border border-slate-100">
              <p className="text-slate-600">
                No stories yet. Click <span className="font-semibold">Generate</span> on the player to populate today’s briefing.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {stories.map((story, index) => (
                <NewsCard key={story?.id || index} story={story} index={index} />
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}
