import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

import AudioPlayer from "@/components/AudioPlayer";
import NewsCard from "@/components/NewsCard";
import RealTimeMarketTicker from "@/components/RealTimeMarketTicker";
import KeyHighlights from "@/components/KeyHighlights";
import OnboardingWizard from "@/components/OnboardingWizard";

import { Settings, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newsCards, setNewsCards] = useState([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

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
  console.log("🔍 [Briefing Query] Date filter:", today);
  console.log("🔍 [Briefing Query] User email:", user?.email);
  console.log("🔍 [Briefing Query] Onboarding completed:", preferences?.onboarding_completed);
  
  const { data: briefings, isLoading: briefingLoading, error: briefingError, refetch: refetchBriefing } = useQuery({
    queryKey: ["todayBriefing", today],
    queryFn: async () => {
      console.log("🔍 [Briefing Query] Executing query...");
      
      // First, try WITHOUT user filter to see if ANY briefings exist
      console.log("🔍 [DEBUG] Trying query WITHOUT user filter...");
      const allBriefings = await base44.entities.DailyBriefing.filter({
        date: today,
      });
      console.log("🔍 [DEBUG] ALL briefings for date (no user filter):", allBriefings);
      console.log("🔍 [DEBUG] Count:", allBriefings?.length);
      
      // Log the first record to see actual field names
      if (allBriefings && allBriefings.length > 0) {
        console.log("🔍 [DEBUG] First record fields:", Object.keys(allBriefings[0]));
        console.log("🔍 [DEBUG] First record full data:", allBriefings[0]);
        console.log("🔍 [DEBUG] created_by field:", allBriefings[0].created_by);
        console.log("🔍 [DEBUG] user_email field:", allBriefings[0].user_email);
      }
      
      // Now try WITH user filter
      console.log("🔍 [DEBUG] Trying query WITH created_by filter...");
      const userBriefings = await base44.entities.DailyBriefing.filter({
        date: today,
        created_by: user?.email,
      });
      console.log("🔍 [DEBUG] Briefings with created_by filter:", userBriefings);
      console.log("🔍 [DEBUG] Count:", userBriefings?.length);
      
      // Return whichever has results (prioritize user-filtered)
      const result = userBriefings?.length > 0 ? userBriefings : allBriefings;
      console.log("🔍 [Briefing Query] Final result:", result);
      console.log("🔍 [Briefing Query] Is array?", Array.isArray(result));
      console.log("🔍 [Briefing Query] Length:", result?.length);
      return result;
    },
    enabled: !!user && !!preferences?.onboarding_completed,
    staleTime: 0,
    refetchOnMount: true,
  });

  console.log("🔍 [Briefing State] isLoading:", briefingLoading);
  console.log("🔍 [Briefing State] error:", briefingError);
  console.log("🔍 [Briefing State] briefings data:", briefings);

  const todayBriefing = briefings?.[0] || null;
  console.log("🔍 [Briefing State] todayBriefing (first item):", todayBriefing);
  console.log("🔍 [Briefing State] audio_url:", todayBriefing?.audio_url);
  // =========================================================
  // NEW: Fetch news cards immediately on page load (with caching)
  // =========================================================
  useEffect(() => {
    async function loadNewsCards() {
      // Only load if user is authenticated and onboarding is complete
      if (!user || !preferences?.onboarding_completed) return;

      // Check if we already have cached news cards (within last 30 minutes)
      const cachedNews = sessionStorage.getItem('newsCards');
      const cacheTimestamp = sessionStorage.getItem('newsCardsTimestamp');
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;

      if (cachedNews && cacheTimestamp && (now - parseInt(cacheTimestamp)) < thirtyMinutes) {
        console.log("✅ Using cached news cards");
        setNewsCards(JSON.parse(cachedNews));
        setIsLoadingNews(false);
        return;
      }

      try {
        setIsLoadingNews(true);
        console.log("📡 Fetching fresh news cards...");
        
        const response = await base44.functions.invoke("fetchNewsCards", {
          count: 5,
          preferences: preferences,
        });

        if (response?.data?.success && response?.data?.stories) {
          setNewsCards(response.data.stories);
          // Cache the results
          sessionStorage.setItem('newsCards', JSON.stringify(response.data.stories));
          sessionStorage.setItem('newsCardsTimestamp', now.toString());
          console.log("✅ News cards cached");
        } else {
          console.error("Failed to load news cards:", response?.data?.error);
        }
      } catch (error) {
        console.error("Error loading news cards:", error);
        
        // If rate limited and we have old cache, use it
        if (cachedNews) {
          console.log("⚠️ Rate limited - using stale cache");
          setNewsCards(JSON.parse(cachedNews));
        }
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadNewsCards();
  }, [user, preferences?.onboarding_completed]);

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
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke("generateBriefing", {
        preferences: preferences,
        date: today,
        skip_audio: false, // Generate both script AND audio
      });

      if (response?.data?.error) {
        console.error("Briefing generation error:", response.data.error);
        alert("Failed to generate briefing: " + response.data.error);
      } else {
        await refetchBriefing();
        // Optional: refresh news cards after briefing is generated
        // setNewsCards(response.data.briefing.news_stories || newsCards);
      }
    } catch (error) {
      console.error("Error generating briefing:", error);
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
    ? "Loading briefing…"
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
            onGenerate={generateFullBriefing}
            isGenerating={isGenerating}
            status={status}
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {briefingStories.length > 0 ? "From Your Briefing" : "Breaking News"}
            </h2>
            <span className="text-sm text-slate-400">
              {displayStories.length} {displayStories.length === 1 ? "story" : "stories"}
            </span>
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
                <NewsCard key={story?.id || index} story={story} index={index} />
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}