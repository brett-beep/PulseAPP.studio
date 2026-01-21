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
    if (!briefings || !Array.isArray(briefings)) {
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    }

    const checkEligibility = () => {
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Filter briefings from today only (using created_at timestamp)
      const briefingsToday = briefings.filter(b => {
        const createdAt = new Date(b.created_at);
        return createdAt >= todayStart;
      });

      const briefingCount = briefingsToday.length;
      console.log("⏱️ [Countdown] Briefings today:", briefingCount);

      // Check daily limit (3 max)
      if (briefingCount >= 3) {
        setCanGenerateNew(false);
        setTimeUntilNextBriefing("Daily limit reached");
        return;
      }

      // If no briefings today, can generate immediately
      if (briefingCount === 0) {
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
        return;
      }

      // Check 3-hour cooldown from last briefing
      const lastBriefing = briefingsToday.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0];
      
      const lastCreatedAt = new Date(lastBriefing.created_at);
      const threeHoursLater = new Date(lastCreatedAt.getTime() + 3 * 60 * 60 * 1000);
      const msRemaining = threeHoursLater - now;

      if (msRemaining <= 0) {
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
      } else {
        setCanGenerateNew(false);
        
        // Format remaining time
        const hours = Math.floor(msRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeUntilNextBriefing(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeUntilNextBriefing(`${minutes}m ${seconds}s`);
        } else {
          setTimeUntilNextBriefing(`${seconds}s`);
        }
      }
    };

    // Check immediately
    checkEligibility();

    // Update every second for live countdown
    const interval = setInterval(checkEligibility, 1000);
    return () => clearInterval(interval);
  }, [briefings]);

  // NEW: Get briefing count for today (for display)
  const getBriefingCount = () => {
    if (!briefings || !Array.isArray(briefings)) return 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return briefings.filter(b => new Date(b.created_at) >= todayStart).length;
  };

  // =========================================================
  // UPDATED: Fetch news cards with better refresh logic
  // - 15 minute cache (reduced from 30)
  // - Force refresh on new browser session
  // - Auto-refresh every 15 minutes
  // =========================================================
  useEffect(() => {
    async function loadNewsCards() {
      // Only load if user is authenticated and onboarding is complete
      if (!user || !preferences?.onboarding_completed) return;

      const CACHE_KEY = 'newsCards';
      const TIMESTAMP_KEY = 'newsCardsTimestamp';
      const SESSION_FLAG = 'newsCardsSessionInit';
      const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

      const now = Date.now();
      const cachedNews = localStorage.getItem(CACHE_KEY);
      const cacheTimestamp = localStorage.getItem(TIMESTAMP_KEY);
      const isNewSession = !sessionStorage.getItem(SESSION_FLAG);
      
      // Mark this session as initialized
      sessionStorage.setItem(SESSION_FLAG, 'true');

      // Determine if we should use cache
      const cacheAge = cacheTimestamp ? (now - parseInt(cacheTimestamp)) : Infinity;
      const cacheValid = cacheAge < CACHE_DURATION;
      
      // Force refresh if:
      // 1. Cache is expired
      // 2. This is a new browser session (tab was closed and reopened)
      // 3. No cache exists
      const shouldRefresh = !cacheValid || isNewSession || !cachedNews;

      if (!shouldRefresh && cachedNews) {
        console.log("✅ Using cached news cards (age:", Math.round(cacheAge / 60000), "minutes)");
        setNewsCards(JSON.parse(cachedNews));
        setLastRefreshTime(new Date(parseInt(cacheTimestamp)));
        setIsLoadingNews(false);
        return;
      }

      try {
        setIsLoadingNews(true);
        console.log("📡 Fetching fresh news cards...");
        
        const response = await base44.functions.invoke("refreshNewsCache", {
          count: 5,
          preferences: preferences,
        });

        if (response?.data?.success && response?.data?.stories) {
          setNewsCards(response.data.stories);
          setLastRefreshTime(new Date());
          
          // Cache the results
          localStorage.setItem(CACHE_KEY, JSON.stringify(response.data.stories));
          localStorage.setItem(TIMESTAMP_KEY, now.toString());
          console.log("✅ News cards cached - will refresh in 15 minutes or on new session");
        } else {
          console.error("Failed to load news cards:", response?.data?.error);
          // Fall back to stale cache if available
          if (cachedNews) {
            console.log("⚠️ Using stale cache as fallback");
            setNewsCards(JSON.parse(cachedNews));
          }
        }
      } catch (error) {
        console.error("Error loading news cards:", error);
        
        // If we have old cache, use it
        if (cachedNews) {
          console.log("⚠️ Error occurred - using stale cache");
          setNewsCards(JSON.parse(cachedNews));
        }
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadNewsCards();
    
    // Auto-refresh every 15 minutes while the page is open
    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing news cards...");
      localStorage.removeItem('newsCards');
      localStorage.removeItem('newsCardsTimestamp');
      loadNewsCards();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user, preferences?.onboarding_completed]);

  // =========================================================
  // NEW: Manual refresh function for news cards
  // =========================================================
  const refreshNewsCards = async () => {
    if (!user || !preferences?.onboarding_completed) return;
    
    setIsLoadingNews(true);
    console.log("🔄 Manual refresh triggered...");
    
    // Clear cache
    localStorage.removeItem('newsCards');
    localStorage.removeItem('newsCardsTimestamp');
    
    try {
      const response = await base44.functions.invoke("refreshNewsCache", {
        count: 5,
        preferences: preferences,
      });

      if (response?.data?.success && response?.data?.stories) {
        setNewsCards(response.data.stories);
        setLastRefreshTime(new Date());
        localStorage.setItem('newsCards', JSON.stringify(response.data.stories));
        localStorage.setItem('newsCardsTimestamp', Date.now().toString());
        console.log("✅ News cards refreshed successfully");
      }
    } catch (error) {
      console.error("Error refreshing news cards:", error);
    } finally {
      setIsLoadingNews(false);
    }
  };

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

  // =========================================================
  // Generate FULL briefing (script + audio automatically)
  // =========================================================
  const generateFullBriefing = async () => {
    // Check if generation is allowed (not already generating AND cooldown passed)
    if (isGenerating || !canGenerateNew) return;

    setIsGenerating(true);
    try {
      // Log preferences being sent to verify investment_interests are included
      console.log("📤 [Generate Briefing] Sending preferences:", preferences);
      console.log("📤 [Generate Briefing] Investment interests:", preferences?.investment_interests);
      console.log("📤 [Generate Briefing] Portfolio holdings:", preferences?.portfolio_holdings);
      console.log("📤 [Generate Briefing] Investment goals:", preferences?.investment_goals);
      
      const response = await base44.functions.invoke("generateBriefing", {
        preferences: {
          user_name: preferences?.user_name || user?.full_name?.split(" ")?.[0] || "there",
          risk_tolerance: preferences?.risk_tolerance,
          time_horizon: preferences?.time_horizon,
          investment_goals: preferences?.investment_goals,
          investment_interests: preferences?.investment_interests,
          portfolio_holdings: preferences?.portfolio_holdings,
          briefing_length: preferences?.briefing_length,
          preferred_voice: preferences?.preferred_voice,
        },
        date: today,
        skip_audio: false, // Generate both script AND audio
      });

      if (response?.data?.error) {
        console.error("❌ Briefing generation error:", response.data.error);
        alert("Failed to generate briefing: " + response.data.error);
      } else {
        console.log("✅ Briefing generated successfully");
        await refetchBriefing();
      }
    } catch (error) {
      console.error("❌ Error generating briefing:", error);
      alert("Failed to generate briefing. Please try again.");
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
  
  console.log("🎵 [AudioPlayer] audioUrl prop:", audioUrl);
  console.log("🎵 [AudioPlayer] todayBriefing object:", todayBriefing);

  const highlights = parseJsonArray(todayBriefing?.key_highlights);
  
  // Get user's watchlist for real-time ticker (from portfolio_holdings)
  const userWatchlist = parseJsonArray(preferences?.portfolio_holdings || []);
  console.log("userWatchlist:", userWatchlist);
  console.log("userWatchlist length:", userWatchlist.length);
  
  // Guard sentiment type (new schema uses object)
  const sentiment =
    todayBriefing?.market_sentiment && typeof todayBriefing.market_sentiment === "object"
      ? todayBriefing.market_sentiment
      : null;

  const status = todayBriefing?.status || null;

  // Determine which stories to show: 
  // 1. If briefing exists with stories, show those
  // 2. Otherwise show the instant news cards
  const briefingStories = parseJsonArray(todayBriefing?.news_stories);
  const displayStories = briefingStories.length > 0 ? briefingStories : newsCards;

  const statusLabel = briefingLoading
    ? "Loading briefing..."
    : audioUrl
    ? "Status: Ready to Play"
    : isGenerating
    ? "Status: Generating..."
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
  <img 
    src="/assets/logo.png" 
    alt="PulseApp.Studio" 
    className="w-10 h-10"
  />
  <span className="font-semibold text-slate-900 tracking-tight">PulseApp.Studio</span>
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
            onGenerate={generateFullBriefing}
            isGenerating={isGenerating}
            status={status}
            // NEW: Pass countdown props to AudioPlayer
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
