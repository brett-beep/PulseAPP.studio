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
import AmbientAurora from "@/components/ui/ambient-aurora";

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

  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  // Countdown timer state for briefing limits (3 per day, 3-hour cooldown)
  const [timeUntilNextBriefing, setTimeUntilNextBriefing] = useState(null);
  const [canGenerateNew, setCanGenerateNew] = useState(true);
  const [generationStartedAt, setGenerationStartedAt] = useState(null); // Track when generation started

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

  // ============================
  // TIMEZONE-SAFE "TODAY"
  // ============================
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone }); // YYYY-MM-DD

  console.log("📍 [Briefing Query] Date filter:", today);
  console.log("📍 [Briefing Query] User email:", user?.email);
  console.log("📍 [Briefing Query] User timezone:", userTimeZone);
  console.log("📍 [Briefing Query] Onboarding completed:", preferences?.onboarding_completed);

  const {
    data: briefings,
    isLoading: briefingLoading,
    error: briefingError,
    refetch: refetchBriefing,
  } = useQuery({
    queryKey: ["todayBriefing", today, user?.email],
    queryFn: async () => {
      console.log("📍 [Briefing Query] Executing query...");
      const b = await base44.entities.DailyBriefing.filter({
        date: today,
        created_by: user?.email,
      });
      console.log("📍 [Briefing Query] Raw result:", b);
      console.log("📍 [Briefing Query] Is array?", Array.isArray(b));
      console.log("📍 [Briefing Query] Length:", b?.length);

      if (b && b.length > 0) {
        const mostRecent = [...b].sort((a, b) => {
          // Prefer delivered_at if present; else fall back
          const dateA = a.delivered_at || a.updated_date || a.created_date || a.updated_at || a.created_at || 0;
          const dateB = b.delivered_at || b.updated_date || b.created_date || b.updated_at || b.created_at || 0;
          return new Date(dateB) - new Date(dateA);
        })[0];
        console.log("📍 [Briefing Query] Most recent status:", mostRecent.status);
        console.log("📍 [Briefing Query] Has audio_url:", !!mostRecent.audio_url);
        console.log("📍 [Briefing Query] delivered_at:", mostRecent.delivered_at);
      }

      return b;
    },
    enabled: !!user && !!preferences?.onboarding_completed,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: isGenerating ? 2000 : false,
  });

  console.log("📍 [Briefing State] isLoading:", briefingLoading);
  console.log("📍 [Briefing State] error:", briefingError);
  console.log("📍 [Briefing State] briefings data:", briefings);

  // Most recent briefing (prefer delivered_at)
  const todayBriefing =
    briefings && briefings.length > 0
      ? [...briefings].sort((a, b) => {
          const dateA = a.delivered_at || a.updated_date || a.created_date || a.updated_at || a.created_at || 0;
          const dateB = b.delivered_at || b.updated_date || b.created_date || b.updated_at || b.created_at || 0;
          return new Date(dateB) - new Date(dateA);
        })[0]
      : null;

  console.log("📍 [Briefing State] todayBriefing (most recent):", todayBriefing);
  console.log("📍 [Briefing State] audio_url:", todayBriefing?.audio_url);
  console.log("📍 [Briefing State] status:", todayBriefing?.status);
  console.log("📍 [Briefing State] delivered_at:", todayBriefing?.delivered_at);

  // Auto-stop isGenerating when briefing is ready OR script_ready (since you skip audio sometimes)
  // FIX: Only stop if the briefing was delivered AFTER we started generating
  useEffect(() => {
    if (!isGenerating || !generationStartedAt) return;
    
    const isReady = todayBriefing?.status === "ready" || todayBriefing?.status === "script_ready";
    if (!isReady) return;
    
    // Check if this briefing was delivered after we started generating
    const deliveredAt = todayBriefing?.delivered_at || todayBriefing?.updated_date || todayBriefing?.created_date || todayBriefing?.updated_at || todayBriefing?.created_at;
    if (!deliveredAt) return;
    
    const deliveredTime = new Date(deliveredAt).getTime();
    const startedTime = generationStartedAt.getTime();
    
    // Only stop if this briefing was delivered AFTER we clicked generate (with 5s buffer for clock skew)
    if (deliveredTime >= startedTime - 5000) {
      console.log("✅ NEW Briefing is delivered! Stopping generation state.");
      console.log("   - Generation started at:", generationStartedAt.toISOString());
      console.log("   - Briefing delivered at:", deliveredAt);
      setIsGenerating(false);
      setGenerationStartedAt(null);
    } else {
      console.log("⏳ Old briefing detected, still waiting for new one...");
      console.log("   - Generation started at:", generationStartedAt.toISOString());
      console.log("   - Old briefing delivered at:", deliveredAt);
    }
  }, [isGenerating, generationStartedAt, todayBriefing?.status, todayBriefing?.delivered_at, todayBriefing?.updated_date, todayBriefing?.created_date, todayBriefing?.updated_at, todayBriefing?.created_at]);

  // =========================================================
  // COUNTDOWN: ONLY START AFTER BRIEFING IS DELIVERED
  // - delivered statuses: ready / script_ready
  // - cooldown starts from delivered_at if available
  // =========================================================
  
  //====ENABLE THIS FOR COOLDOWN====//
  useEffect(() => {
    if (!briefings || !Array.isArray(briefings)) {
      console.log("⏱️ [Countdown] No briefings array, allowing generation");
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    } 


    const checkEligibility = () => {
      const delivered = briefings.filter((b) => b && (b.status === "ready" || b.status === "script_ready"));
      const briefingCount = delivered.length;

      console.log("⏱️ [Countdown] Delivered briefings today:", briefingCount);

      // Daily limit (3 max) based on DELIVERED briefings only
      if (briefingCount >= 3) {
        console.log("⏱️ [Countdown] Daily limit reached (3/3 delivered)");
        setCanGenerateNew(false);
        setTimeUntilNextBriefing("Daily limit reached");
        return;
      }

      // If none delivered today, can generate immediately
      if (briefingCount === 0) {
        console.log("⏱️ [Countdown] No delivered briefings today, can generate");
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
        return;
      }

      // Cooldown from LAST DELIVERED briefing (prefer delivered_at)
      // FIX: Base44 timestamps may come back without timezone ("Z").
// If no timezone suffix is present, treat it as UTC by appending "Z".
const parseBase44Time = (value) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;

  const hasTZ =
    s.endsWith("Z") ||
    /[+-]\d{2}:\d{2}$/.test(s) ||
    /[+-]\d{4}$/.test(s);

  return new Date(hasTZ ? s : `${s}Z`);
};

const pickDeliveredTime = (b) =>
  b?.delivered_at || b?.updated_date || b?.created_date || b?.updated_at || b?.created_at || null;

// Cooldown from LAST DELIVERED briefing (prefer delivered_at)
const lastDelivered = [...delivered].sort((a, b) => {
  const ta = parseBase44Time(pickDeliveredTime(a))?.getTime() || 0;
  const tb = parseBase44Time(pickDeliveredTime(b))?.getTime() || 0;
  return tb - ta;
})[0];

const lastDeliveredAt = parseBase44Time(pickDeliveredTime(lastDelivered));
const now = new Date();

if (!lastDeliveredAt || isNaN(lastDeliveredAt.getTime())) {
  console.log("⏱️ [Countdown] Could not parse last delivered time, allowing generation");
  setCanGenerateNew(true);
  setTimeUntilNextBriefing(null);
  return;
}

const threeHoursLater = new Date(lastDeliveredAt.getTime() + 3 * 60 * 60 * 1000);
const msRemaining = threeHoursLater.getTime() - now.getTime();


      console.log("⏱️ [Countdown] Last delivered at:", lastDeliveredAt.toLocaleString());
      console.log("⏱️ [Countdown] Current time:", now.toLocaleString());
      console.log("⏱️ [Countdown] Three hours later:", threeHoursLater.toLocaleString());
      console.log("⏱️ [Countdown] Time remaining (ms):", msRemaining);

      if (msRemaining <= 0) {
        console.log("⏱️ [Countdown] Cooldown complete, can generate");
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
      } else {
        console.log("⏱️ [Countdown] Cooldown active, cannot generate");
        setCanGenerateNew(false);

        const hours = Math.floor(msRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);

        if (hours > 0) setTimeUntilNextBriefing(`${hours}h ${minutes}m ${seconds}s`);
        else if (minutes > 0) setTimeUntilNextBriefing(`${minutes}m ${seconds}s`);
        else setTimeUntilNextBriefing(`${seconds}s`);
      }
    };

    checkEligibility();
    const interval = setInterval(checkEligibility, 1000);
    return () => clearInterval(interval);
  }, [briefings]);

  // Briefing count for UI (DELIVERED only)
  const getBriefingCount = () => {
    if (!briefings || !Array.isArray(briefings)) return 0;
    return briefings.filter((b) => b && (b.status === "ready" || b.status === "script_ready")).length;
  };

  // Fetch news cards with better refresh logic
  useEffect(() => {
    if (!user || !preferences?.onboarding_completed) return;

    const CACHE_KEY = `newsCards:${user.email}`;
    const TIMESTAMP_KEY = `newsCardsTimestamp:${user.email}`;
    const SESSION_FLAG = `newsCardsSessionInit:${user.email}`;
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    async function loadNewsCards() {
      // one-time cleanup of old global keys
      localStorage.removeItem("newsCards");
      localStorage.removeItem("newsCardsTimestamp");
      sessionStorage.removeItem("newsCardsSessionInit");

      const now = Date.now();
      const cachedNews = localStorage.getItem(CACHE_KEY);
      const cacheTimestamp = localStorage.getItem(TIMESTAMP_KEY);
      const isNewSession = !sessionStorage.getItem(SESSION_FLAG);

      sessionStorage.setItem(SESSION_FLAG, "true");

      const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity;
      const cacheValid = cacheAge < CACHE_DURATION;

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
        console.log("📦 Reading news cards from cache via fetchNewsCards...");

        const resp = await base44.functions.invoke("fetchNewsCards", {
          count: 10,
          preferences: preferences,
        });

        if (resp?.data?.success) {
          const stories = Array.isArray(resp.data.stories) ? resp.data.stories : [];

          setNewsCards(stories);

          if (resp.data.cache_age) {
            setLastRefreshTime(new Date(resp.data.cache_age));
          } else {
            setLastRefreshTime(new Date());
          }

          localStorage.setItem(CACHE_KEY, JSON.stringify(stories));
          localStorage.setItem(TIMESTAMP_KEY, now.toString());

          console.log(`✅ Loaded ${stories.length} stories via fetchNewsCards (source=${resp.data.source})`);
        } else {
          console.error("Failed to load stories:", resp?.data?.error);
          if (cachedNews) {
            console.log("⚠️ Using stale localStorage cache as fallback");
            setNewsCards(JSON.parse(cachedNews));
          }
        }
      } catch (error) {
        console.error("Error loading news cards:", error);

        if (cachedNews) {
          console.log("⚠️ Error occurred - using stale cache");
          setNewsCards(JSON.parse(cachedNews));
        }
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadNewsCards();

    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing news cards...");
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
      loadNewsCards();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user, preferences?.onboarding_completed]);

  // Manual refresh function for news cards
  const refreshNewsCards = async () => {
    if (!user || !preferences?.onboarding_completed) return;

    const CACHE_KEY = `newsCards:${user.email}`;
    const TIMESTAMP_KEY = `newsCardsTimestamp:${user.email}`;

    setIsLoadingNews(true);
    console.log("🔄 Manual refresh triggered - FORCING CACHE REGENERATION...");

    try {
      console.log("🔄 Manual refresh - bypassing localStorage, reading via fetchNewsCards...");

      const resp = await base44.functions.invoke("fetchNewsCards", {
        count: 10,
        preferences: preferences,
      });

      if (resp?.data?.success) {
        const stories = Array.isArray(resp.data.stories) ? resp.data.stories : [];

        setNewsCards(stories);

        if (resp.data.cache_age) {
          setLastRefreshTime(new Date(resp.data.cache_age));
        } else {
          setLastRefreshTime(new Date());
        }

        localStorage.setItem(CACHE_KEY, JSON.stringify(stories));
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());

        console.log(`✅ Manual refresh loaded ${stories.length} stories (source=${resp.data.source})`);
      } else {
        console.error("Manual refresh failed:", resp?.data?.error);
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

  // Safe parser for Base44 array fields
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

  // Generate FULL briefing with proper status checking
  const generateFullBriefing = async () => {
    if (isGenerating || !canGenerateNew) {
      console.log("⚠️ Generation blocked:", { isGenerating, canGenerateNew });
      return;
    }

    const startTime = new Date();
    setGenerationStartedAt(startTime);
    setIsGenerating(true);
    console.log("🎬 Starting briefing generation at:", startTime.toISOString());

    try {
      console.log("📤 [Generate Briefing] Sending preferences:", preferences);

      const response = await base44.functions.invoke("generateBriefing", {
        preferences: {
          user_name: preferences?.display_name || user?.full_name?.split(" ")?.[0] || "there",
          risk_tolerance: preferences?.risk_tolerance,
          time_horizon: preferences?.time_horizon,
          investment_goals: preferences?.investment_goals,
          investment_interests: preferences?.investment_interests,
          portfolio_holdings: preferences?.portfolio_holdings,
          briefing_length: preferences?.briefing_length,
          preferred_voice: preferences?.preferred_voice,
        },
        date: today,
        timeZone: userTimeZone,
        skip_audio: false, // TEMPORARY: Skip audio to save ElevenLabs credits during testing
      });

      if (response?.data?.error) {
        console.error("❌ Briefing generation error:", response.data.error);
        alert("Failed to generate briefing: " + response.data.error);
        setIsGenerating(false);
        setGenerationStartedAt(null);
      } else {
        console.log("✅ Briefing generation started!");
        console.log("📊 Response data:", response.data);

        await refetchBriefing();

        setTimeout(async () => {
          await refetchBriefing();
          console.log("🔄 Second refetch completed for countdown timer");
        }, 500);
      }
    } catch (error) {
      console.error("❌ Error generating briefing:", error);
      alert("Failed to generate briefing. Please try again.");
      setIsGenerating(false);
      setGenerationStartedAt(null);
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

  const firstName = preferences?.display_name || user?.full_name?.split(" ")?.[0] || "there";
  const audioUrl = todayBriefing?.audio_url || null;

  console.log("🎵 [AudioPlayer] audioUrl prop:", audioUrl);
  console.log("🎵 [AudioPlayer] todayBriefing object:", todayBriefing);

  const highlights = parseJsonArray(todayBriefing?.key_highlights);

  const userWatchlist = parseJsonArray(preferences?.portfolio_holdings || []);
  console.log("userWatchlist:", userWatchlist);
  console.log("userWatchlist length:", userWatchlist.length);

  const sentiment =
    todayBriefing?.market_sentiment && typeof todayBriefing.market_sentiment === "object"
      ? todayBriefing.market_sentiment
      : null;

  const status = todayBriefing?.status || null;

  const briefingStories = parseJsonArray(todayBriefing?.news_stories);
  const newsCardStories = newsCards.slice(0, 5);

  // Show proper status based on briefing state
  const getStatusLabel = () => {
    if (briefingLoading) return "Loading briefing...";

    switch (status) {
      case "writing_script":
        return "✍️ Writing your briefing script...";
      case "generating_audio":
        return "🎵 Generating audio...";
      case "uploading":
        return "📤 Almost ready...";
      case "ready":
        return audioUrl ? "✅ Ready to Play" : "⏳ Finalizing...";
      case "script_ready":
        return "✅ Script Ready (audio skipped for testing)";
      default:
        return "Ready to Generate";
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: "hsl(45, 40%, 95%)",
      }}
    >
      {/* Animated Aurora Background */}
      <AmbientAurora />
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/pulse-logo.svg"
              alt="PulseApp"
              className="h-10 w-auto"
            />
            <span className="font-semibold text-slate-900 tracking-tight">PulseApp</span>
          </div>

          <Link to={createPageUrl("Settings")}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
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
            statusLabel={getStatusLabel()}
            canGenerateNew={canGenerateNew}
            timeUntilNextBriefing={timeUntilNextBriefing}
            briefingCount={getBriefingCount()}
          />

          <div className="mt-6">
            <RealTimeMarketTicker watchlist={userWatchlist} />
          </div>
        </motion.section>

        {/* Summary & Highlights */}
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

        {/* NEWS CARDS */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Breaking News</h2>
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
                {isLoadingNews ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </button>
              <span className="text-sm text-slate-400">
                {newsCardStories.length} {newsCardStories.length === 1 ? "story" : "stories"}
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
          ) : newsCardStories.length === 0 ? (
            <div className="bg-white/70 rounded-2xl p-6 border border-slate-100 text-center">
              <p className="text-slate-600">
                No news available. Please try refreshing the page or click{" "}
                <span className="font-semibold">Generate</span> to create your briefing.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {newsCardStories.map((story, index) => (
                <NewsCard key={index} story={story} />
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}