// UPDATED Home.jsx - Add these changes to your existing Home component

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

import { Settings, Headphones, Loader2, Clock } from "lucide-react"; // Add Clock icon
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newsCards, setNewsCards] = useState([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  
  // NEW: Countdown timer state
  const [timeUntilNextBriefing, setTimeUntilNextBriefing] = useState(null);
  const [canGenerateNew, setCanGenerateNew] = useState(false);

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

  // Fetch ALL briefings for today (to check count and timestamps)
  const today = format(new Date(), "yyyy-MM-dd");
  
  const { data: briefings, isLoading: briefingLoading, error: briefingError, refetch: refetchBriefing } = useQuery({
    queryKey: ["todayBriefing", today],
    queryFn: async () => {
      const b = await base44.entities.DailyBriefing.filter({
        date: today,
      });
      return b;
    },
    enabled: !!user && !!preferences?.onboarding_completed,
    staleTime: 0,
    refetchOnMount: true,
  });

  // NEW: Calculate briefing eligibility and countdown
  useEffect(() => {
    if (!briefings || !Array.isArray(briefings)) {
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    }

    const briefingsToday = briefings.filter(b => {
      const briefingDate = new Date(b.created_at);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return briefingDate >= todayStart;
    });

    const briefingCount = briefingsToday.length;

    // If we've hit the daily limit (3 briefings)
    if (briefingCount >= 3) {
      setCanGenerateNew(false);
      setTimeUntilNextBriefing("Daily limit reached");
      return;
    }

    // If no briefings yet today, allow generation
    if (briefingCount === 0) {
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    }

    // Find the most recent briefing
    const sortedBriefings = [...briefingsToday].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    const lastBriefing = sortedBriefings[0];
    const lastBriefingTime = new Date(lastBriefing.created_at);
    const threeHoursLater = new Date(lastBriefingTime.getTime() + (3 * 60 * 60 * 1000));
    const now = new Date();

    if (now >= threeHoursLater) {
      // 3 hours have passed, allow new briefing
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
    } else {
      // Still within 3-hour window
      setCanGenerateNew(false);
      const msRemaining = threeHoursLater - now;
      const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000);
      
      setTimeUntilNextBriefing(
        `${hoursRemaining}h ${minutesRemaining}m ${secondsRemaining}s`
      );
    }
  }, [briefings]);

  // NEW: Update countdown every second
  useEffect(() => {
    if (canGenerateNew || !briefings) return;

    const interval = setInterval(() => {
      const briefingsToday = briefings.filter(b => {
        const briefingDate = new Date(b.created_at);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return briefingDate >= todayStart;
      });

      if (briefingsToday.length >= 3) {
        setCanGenerateNew(false);
        setTimeUntilNextBriefing("Daily limit reached");
        clearInterval(interval);
        return;
      }

      if (briefingsToday.length === 0) {
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
        clearInterval(interval);
        return;
      }

      const sortedBriefings = [...briefingsToday].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      const lastBriefing = sortedBriefings[0];
      const lastBriefingTime = new Date(lastBriefing.created_at);
      const threeHoursLater = new Date(lastBriefingTime.getTime() + (3 * 60 * 60 * 1000));
      const now = new Date();

      if (now >= threeHoursLater) {
        setCanGenerateNew(true);
        setTimeUntilNextBriefing(null);
        clearInterval(interval);
      } else {
        const msRemaining = threeHoursLater - now;
        const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000);
        
        setTimeUntilNextBriefing(
          `${hoursRemaining}h ${minutesRemaining}m ${secondsRemaining}s`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [briefings, canGenerateNew]);

  // Get the most recent briefing for display
  const todayBriefing = briefings && briefings.length > 0 
    ? [...briefings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    : null;

  console.log("🔍 [Briefing State] todayBriefing (most recent):", todayBriefing);
  console.log("🔍 [Briefing State] audio_url:", todayBriefing?.audio_url);
  console.log("🔍 [Briefing State] canGenerateNew:", canGenerateNew);
  console.log("🔍 [Briefing State] timeUntilNextBriefing:", timeUntilNextBriefing);

  // ... (rest of your existing code: news cards loading, mutations, etc.)

  // =========================================================
  // Generate FULL briefing (updated to check limits)
  // =========================================================
  const generateFullBriefing = async () => {
    if (isGenerating || !canGenerateNew) return;

    setIsGenerating(true);
    try {
      console.log("📤 [Generate Briefing] Sending preferences:", preferences);
      
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
        skip_audio: false,
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

  // ... (rest of your existing code: handleOnboardingComplete, greeting, etc.)

  // In your AudioPlayer section, update the button:
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
            // NEW PROPS:
            canGenerateNew={canGenerateNew}
            timeUntilNextBriefing={timeUntilNextBriefing}
            briefingCount={briefings?.filter(b => {
              const briefingDate = new Date(b.created_at);
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              return briefingDate >= todayStart;
            }).length || 0}
          />
          
          {/* ... rest of your component ... */}
        </motion.section>
      </main>
    </div>
  );
}