import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNow } from "date-fns";

import AudioPlayer from "@/components/AudioPlayer";
import NewsCard from "@/components/NewsCard";
import RealTimeMarketTicker from "@/components/RealTimeMarketTicker";
import KeyHighlights from "@/components/KeyHighlights";
import OnboardingWizard from "@/components/OnboardingWizard";

import { Settings, Headphones, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newsCards, setNewsCards] = useState([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  
  // NEW: Track when news was last refreshed
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  // NEW: Countdown timer state for briefing limits (3 per day, 3-hour cooldown)
  const [timeUntilNextBriefing, setTimeUntilNextBriefing] = useState(null);
  const [canGenerateNew, setCanGenerateNew] = useState(true);

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
  console.log("📍 [Briefing Query] Date filter:", today);
  console.log("📍 [Briefing Query] User email:", user?.email);
  console.log("📍 [Briefing Query] Onboarding completed:", preferences?.onboarding_completed);
  
  const { data: briefings, isLoading: briefingLoading, error: briefingError, refetch: refetchBriefing } = useQuery({
    queryKey: ["todayBriefing", today],
    queryFn: async () => {
      console.log("📍 [Briefing Query] Executing query...");
      const b = await base44.entities.DailyBriefing.filter({
        date: today,
      });
      console.log("📍 [Briefing Query] Raw result:", b);
      console.log("📍 [Briefing Query] Is array?", Array.isArray(b));
      console.log("📍 [Briefing Query] Length:", b?.length);
      return b;
    },
    enabled: !!user && !!preferences?.onboarding_completed,
    staleTime: 0,
    refetchOnMount: true,
  });

  console.log("📍 [Briefing State] isLoading:", briefingLoading);
  console.log("📍 [Briefing State] error:", briefingError);
  console.log("📍 [Briefing State] briefings data:", briefings);

  // Get the most recent briefing (sorted by created_at descending)
  const todayBriefing = briefings && briefings.length > 0 
    ? [...briefings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] 
    : null;
  console.log("📍 [Briefing State] todayBriefing (most recent):", todayBriefing);
  console.log("📍 [Briefing State] audio_url:", todayBriefing?.audio_url);

  // =========================================================
  // NEW: Countdown timer logic for 3-per-day limit with 3-hour gap
  // =========================================================
  useEffect(() => {
    if (!briefings) return;
    
    // Count briefings created today
    const briefingCount = briefings.length;
    console.log("⏱️ [Countdown] Briefings today:", briefingCount);

    // If we have 3 briefings already, check if we need cooldown
    if (briefingCount >= 3) {
      const sortedBriefings = [...briefings].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      const latestBriefing = sortedBriefings[0];
      const latestTime = new Date(latestBriefing.created_at);
      const now = new Date();
      const threeHoursInMs = 3 * 60 * 60 * 1000;
      const timeSinceLatest = now - latestTime;

      if (timeSinceLatest < threeHoursInMs) {
        // Still in cooldown
        setCanGenerateNew(false);
        const nextAvailableTime = new Date(latestTime.getTime() + threeHoursInMs);
        setTimeUntilNextBriefing(nextAvailableTime);
      } else {
        // Cooldown over
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
      }
    } else {
      // Less than 3 briefings today, can generate anytime
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
    }
  }, [briefings]);

  // Get briefing count helper
  const getBriefingCount = () => {
    return briefings?.length || 0;
  };

  // =========================================================
  // Get user's watchlist from preferences
  // =========================================================
  const userWatchlist = preferences?.investment_interests || [];

  // =========================================================
  // Fetch news cards (from Backend with Caching)
  // =========================================================
  useEffect(() => {
    if (!user) return;

    const loadNews = async () => {
      try {
        setIsLoadingNews(true);
        // 🔥 CRITICAL FIX: Use refreshNewsCache instead of fetchNewsCards
        const result = await base44.functions.refreshNewsCache();
        console.log("📰 News cards loaded:", result);
        setNewsCards(result || []);
        setLastRefreshTime(new Date());
      } catch (error) {
        console.error("Error loading news cards:", error);
        setNewsCards([]);
      } finally {
        setIsLoadingNews(false);
      }
    };

    loadNews();
  }, [user]);

  // =========================================================
  // Manual refresh for news cards
  // =========================================================
  const refreshNewsCards = async () => {
    try {
      setIsLoadingNews(true);
      // 🔥 CRITICAL FIX: Use refreshNewsCache instead of fetchNewsCards
      const result = await base44.functions.refreshNewsCache();
      setNewsCards(result || []);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error("Error refreshing news cards:", error);
    } finally {
      setIsLoadingNews(false);
    }
  };

  // =========================================================
  // Parse highlights from briefing
  // =========================================================
  const highlights = todayBriefing?.highlights
    ? (() => {
        try {
          // If highlights is already an array, return it
          if (Array.isArray(todayBriefing.highlights)) {
            return todayBriefing.highlights;
          }
          // If it's a string, try to parse it as JSON
          if (typeof todayBriefing.highlights === "string") {
            return JSON.parse(todayBriefing.highlights);
          }
          return [];
        } catch (e) {
          console.error("Error parsing highlights:", e);
          return [];
        }
      })()
    : [];

  // =========================================================
  // Parse stories from briefing if it exists
  // =========================================================
  const briefingStories = todayBriefing?.stories_used
    ? (() => {
        try {
          if (Array.isArray(todayBriefing.stories_used)) {
            return todayBriefing.stories_used;
          }
          if (typeof todayBriefing.stories_used === "string") {
            return JSON.parse(todayBriefing.stories_used);
          }
          return [];
        } catch (e) {
          console.error("Error parsing stories_used:", e);
          return [];
        }
      })()
    : [];

  // =========================================================
  // Combine briefing stories and general news
  // Display briefing stories first if they exist, then fill with news cards
  // =========================================================
  const displayStories = briefingStories.length > 0 
    ? briefingStories 
    : newsCards;

  // =========================================================
  // Generate new briefing mutation
  // =========================================================
  const generateBriefing = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!canGenerateNew) {
        throw new Error("Please wait for the cooldown period before generating a new briefing");
      }

      setIsGenerating(true);

      const result = await base44.functions.generateDailyBriefing({
        user_email: user.email,
        user_interests: preferences?.investment_interests || [],
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["todayBriefing"]);
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("Error generating briefing:", error);
      setIsGenerating(false);
    },
  });

  // Check if user needs onboarding
  const needsOnboarding = !userLoading && !prefsLoading && !preferences?.onboarding_completed;

  if (needsOnboarding) {
    return <OnboardingWizard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="backdrop-blur-sm bg-white/80 border-b border-slate-100 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="w-6 h-6 text-amber-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Audilin
            </h1>
          </div>
          
          <Link to={createPageUrl("settings")}>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-amber-50"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Audio Player Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <AudioPlayer
            audioUrl={todayBriefing?.audio_url}
            todayBriefing={todayBriefing}
            onGenerate={() => generateBriefing.mutate()}
            isGenerating={isGenerating}
            isLoading={briefingLoading}
            canGenerateNew={canGenerateNew}
            timeUntilNextBriefing={timeUntilNextBriefing}
            briefingCount={getBriefingCount()}
          />

          <div className="mt-6">
            <RealTimeMarketTicker watchlist={userWatchlist} />
          </div>
        </motion.section>

        {/* Summary & Highlights (only show if briefing exists) */}
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

        {/* NEWS CARDS - Shows immediately on page load */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* UPDATED: News section header with refresh button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {briefingStories.length > 0 ? "From Your Briefing" : "Breaking News"}
            </h2>
            <div className="flex items-center gap-4">
              {lastRefreshTime && (
                <span className="text-xs text-slate-400">
                  Updated {formatDistanceToNow(lastRefreshTime, { addSuffix: true })}
                </span>
              )}
              <button
                onClick={refreshNewsCards}
                disabled={isLoadingNews}
                className="text-sm text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isLoadingNews ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
              <span className="text-sm text-slate-400">
                {displayStories.length} {displayStories.length === 1 ? "story" : "stories"}
              </span>
            </div>
          </div>

          {isLoadingNews ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/70 rounded-2xl p-6 border border-slate-100">
                  <Skeleton className="h-4 w-3/4 mb-3" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          ) : displayStories.length === 0 ? (
            <div className="bg-white/70 rounded-2xl p-6 border border-slate-100 text-center">
              <p className="text-slate-600">
                No news available. Please try refreshing the page or click{" "}
                <span className="font-semibold">Generate</span> to create your briefing.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {displayStories.map((story, index) => (
                <NewsCard 
                  key={story?.id || index} 
                  story={story}
                  index={index}
                />
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}