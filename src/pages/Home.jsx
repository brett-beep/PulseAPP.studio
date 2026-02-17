import React, { useState, useEffect, useRef, useCallback } from "react";
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
import UpgradeModal from "@/components/UpgradeModal";

import { Settings, Headphones, Loader2, RefreshCw, Crown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const SMOOTH_EASE = [0.25, 0.46, 0.45, 0.94];
const SMOOTH_DURATION = 0.4;

const LAYOUT_TRANSITION = { layout: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } };

// Base44 timestamps can come without timezone suffix; treat them as UTC to avoid
// mis-ordering records and false "generation complete" transitions.
function parseBase44Timestamp(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  const hasTZ = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
  const d = new Date(hasTZ ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Format summary text with section headers
// Handles BOTH formats: "**Market Snapshot:** text" AND "Market Snapshot: text"
function FormattedSummary({ text }) {
  if (!text) return null;

  // Known section headers to detect
  const KNOWN_HEADERS = [
    'Market Snapshot',
    'Key Developments', 
    'What to Watch',
    'Actionable Highlights',
    'Key Highlights',
    'Summary',
    'Outlook',
  ];

  // Build a regex that matches both **Header:** and Header: formats
  // Captures: optional **, header name, optional **, colon, then content until next header or end
  const headerPattern = new RegExp(
    `(?:\\*\\*)?\\s*(${KNOWN_HEADERS.join('|')})\\s*(?:\\*\\*)?\\s*:\\s*`,
    'gi'
  );

  // Find all header positions
  const headerPositions = [];
  let headerMatch;
  while ((headerMatch = headerPattern.exec(text)) !== null) {
    headerPositions.push({
      index: headerMatch.index,
      endIndex: headerMatch.index + headerMatch[0].length,
      title: headerMatch[1].trim()
    });
  }

  // If no headers found, just return clean text
  if (headerPositions.length === 0) {
    return <p className="text-slate-700 dark:text-neutral-300 leading-relaxed">{text.replace(/\*\*/g, '')}</p>;
  }

  // Build sections from header positions
  const sections = [];

  // Any text before the first header
  if (headerPositions[0].index > 0) {
    const beforeText = text.slice(0, headerPositions[0].index).replace(/\*\*/g, '').trim();
    if (beforeText) {
      sections.push({ type: 'text', content: beforeText });
    }
  }

  // Each header + its content (until next header or end of string)
  for (let i = 0; i < headerPositions.length; i++) {
    const contentStart = headerPositions[i].endIndex;
    const contentEnd = i + 1 < headerPositions.length ? headerPositions[i + 1].index : text.length;
    const content = text.slice(contentStart, contentEnd).replace(/\*\*/g, '').trim();

    sections.push({
      type: 'section',
      title: headerPositions[i].title,
      content
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        section.type === 'section' ? (
          <div key={index} className="space-y-2">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              {section.title}
            </h4>
            <p className="text-slate-700 dark:text-neutral-300 leading-relaxed">
              {section.content}
            </p>
          </div>
        ) : (
          <p key={index} className="text-slate-700 dark:text-neutral-300 leading-relaxed">
            {section.content}
          </p>
        )
      ))}
    </div>
  );
}

function MarketSection({ marketSectionOpen, setMarketSectionOpen, setLastExpandedSection, marketStories, isSecond, gridOrder }) {
  return (
    <motion.div
      layout
      transition={LAYOUT_TRANSITION}
      className={`rounded-3xl overflow-hidden ${marketSectionOpen || isSecond ? "lg:col-span-2" : ""}`}
      style={{
        order: gridOrder,
        background: "var(--section-market-bg)",
        border: "1px solid var(--section-border)",
        boxShadow: "var(--section-market-shadow)",
      }}
    >
      <motion.div layout={false} className="flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setMarketSectionOpen((o) => !o);
            setLastExpandedSection("market");
          }}
          className="w-full text-left p-4 md:p-6 flex flex-col gap-3 md:gap-4 hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: "linear-gradient(135deg, rgba(147, 197, 253, 0.55) 0%, rgba(96, 165, 250, 0.4) 100%)", boxShadow: "0 0 24px -4px rgba(96, 165, 250, 0.3)" }}>
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 text-lg">Market News</h3>
                <p className="text-xs text-slate-500">{marketStories.length} stories</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: marketSectionOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--chevron-bg)" }}
            >
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </motion.div>
          </div>
          {!marketSectionOpen && marketStories.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {marketStories.slice(0, 3).map((story, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 opacity-70" style={{ background: "rgba(96, 165, 250, 0.7)" }} />
                  <p className="text-sm text-slate-600 leading-relaxed">{story.title}</p>
                </div>
              ))}
              {marketStories.length > 3 && <p className="text-xs text-slate-500 pl-4.5 pt-1">+{marketStories.length - 3} more stories</p>}
            </div>
          )}
        </button>
      </motion.div>
      {marketSectionOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: SMOOTH_EASE }}
          className="overflow-hidden"
          style={{ borderTop: "1px solid var(--section-divider)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: SMOOTH_EASE }}
            className="px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {marketStories.map((story, index) => (
                <NewsCard key={`market-${index}`} story={story} index={index} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

function PortfolioSection({ portfolioSectionOpen, setPortfolioSectionOpen, setLastExpandedSection, portfolioStories, isSecond, gridOrder }) {
  return (
    <motion.div
      layout
      transition={LAYOUT_TRANSITION}
      className={`rounded-3xl overflow-hidden ${portfolioSectionOpen || isSecond ? "lg:col-span-2" : ""}`}
      style={{
        order: gridOrder,
        background: "var(--section-portfolio-bg)",
        border: "1px solid var(--section-border)",
        boxShadow: "var(--section-portfolio-shadow)",
      }}
    >
      <motion.div layout={false} className="flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setPortfolioSectionOpen((o) => !o);
            setLastExpandedSection("portfolio");
          }}
          className="w-full text-left p-4 md:p-6 flex flex-col gap-3 md:gap-4 hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: "linear-gradient(135deg, rgba(253, 230, 138, 0.6) 0%, rgba(251, 191, 36, 0.45) 100%)", boxShadow: "0 0 24px -4px rgba(251, 191, 36, 0.28)" }}>
                <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 text-base md:text-lg">Your Portfolio</h3>
                <p className="text-[10px] md:text-xs text-slate-500">{portfolioStories.length} stories</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: portfolioSectionOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--chevron-bg)" }}
            >
              <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
            </motion.div>
          </div>
          {!portfolioSectionOpen && portfolioStories.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {portfolioStories.slice(0, 3).map((story, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 opacity-70" style={{ background: "rgba(251, 191, 36, 0.7)" }} />
                  <p className="text-sm text-slate-600 leading-relaxed">{story.title}</p>
                </div>
              ))}
              {portfolioStories.length > 3 && <p className="text-xs text-slate-500 pl-4.5 pt-1">+{portfolioStories.length - 3} more stories</p>}
            </div>
          )}
        </button>
      </motion.div>
      {portfolioSectionOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: SMOOTH_EASE }}
          className="overflow-hidden"
          style={{ borderTop: "1px solid var(--section-divider)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: SMOOTH_EASE }}
            className="px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {portfolioStories.map((story, index) => (
                <NewsCard key={`portfolio-${index}`} story={story} index={index} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [marketNews, setMarketNews] = useState(null); // { summary, stories, updated_at }
  const [portfolioNews, setPortfolioNews] = useState(null); // { summary, stories, updated_at }
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [marketSectionOpen, setMarketSectionOpen] = useState(false);
  const [portfolioSectionOpen, setPortfolioSectionOpen] = useState(false);
  const [lastExpandedSection, setLastExpandedSection] = useState("market"); // "market" | "portfolio" – whichever is expanded sits on top

  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullStartYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullZoneRef = useRef(null);
  const pullDistanceRef = useRef(0);

  // Countdown timer state for briefing limits (3 per day, 3-hour cooldown) - FREE USERS ONLY
  const [timeUntilNextBriefing, setTimeUntilNextBriefing] = useState(null);
  const [canGenerateNew, setCanGenerateNew] = useState(true);
  const [generationStartedAt, setGenerationStartedAt] = useState(null); // Track when generation started
  const [elapsedSecs, setElapsedSecs] = useState(0); // Elapsed seconds since generation started

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
          const timeA = parseBase44Timestamp(dateA)?.getTime() || 0;
          const timeB = parseBase44Timestamp(dateB)?.getTime() || 0;
          return timeB - timeA;
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
          const timeA = parseBase44Timestamp(dateA)?.getTime() || 0;
          const timeB = parseBase44Timestamp(dateB)?.getTime() || 0;
          return timeB - timeA;
        })[0]
      : null;

  console.log("📍 [Briefing State] todayBriefing (most recent):", todayBriefing);
  console.log("📍 [Briefing State] audio_url:", todayBriefing?.audio_url);
  console.log("📍 [Briefing State] status:", todayBriefing?.status);
  console.log("📍 [Briefing State] delivered_at:", todayBriefing?.delivered_at);

  // Check if user is premium
  const isPremium = preferences?.is_premium === true;

  // Auto-stop isGenerating when briefing is ready OR script_ready (since you skip audio sometimes)
  // FIX: Only stop if the briefing was delivered AFTER we started generating
  useEffect(() => {
    if (!isGenerating || !generationStartedAt) return;
    
    const isReady = todayBriefing?.status === "ready" || todayBriefing?.status === "script_ready";
    if (!isReady) return;
    
    // Check if this briefing was delivered after we started generating
    const deliveredAt = todayBriefing?.delivered_at || todayBriefing?.updated_date || todayBriefing?.created_date || todayBriefing?.updated_at || todayBriefing?.created_at;
    if (!deliveredAt) return;
    
    const deliveredTime = parseBase44Timestamp(deliveredAt)?.getTime() || 0;
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
  
  // Admin email: unlimited briefings for testing (no cooldown, no 3/day limit)
  const ADMIN_EMAIL = "brett@audilin.com";
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  //====ENABLE THIS FOR COOLDOWN (FREE USERS ONLY)====//
  useEffect(() => {
    // Premium users bypass all limits
    if (isPremium) {
      console.log("👑 [Premium] User has premium access - no limits");
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    }

    // Admin bypass: unlimited for testing
    if (isAdmin) {
      console.log("🔧 [Admin] Admin account - no cooldown/limit");
      setCanGenerateNew(true);
      setTimeUntilNextBriefing(null);
      return;
    }

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
const pickDeliveredTime = (b) =>
  b?.delivered_at || b?.updated_date || b?.created_date || b?.updated_at || b?.created_at || null;

// Cooldown from LAST DELIVERED briefing (prefer delivered_at)
const lastDelivered = [...delivered].sort((a, b) => {
  const ta = parseBase44Timestamp(pickDeliveredTime(a))?.getTime() || 0;
  const tb = parseBase44Timestamp(pickDeliveredTime(b))?.getTime() || 0;
  return tb - ta;
})[0];

const lastDeliveredAt = parseBase44Timestamp(pickDeliveredTime(lastDelivered));
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
  }, [briefings, isPremium, isAdmin]);

  // Elapsed seconds effect (drives progressive messaging during generation)
  useEffect(() => {
    if (!isGenerating || !generationStartedAt) {
      setElapsedSecs(0);
      return;
    }
    const tick = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - generationStartedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isGenerating, generationStartedAt]);

  // Briefing count for UI (DELIVERED only)
  const getBriefingCount = () => {
    if (!briefings || !Array.isArray(briefings)) return 0;
    return briefings.filter((b) => b && (b.status === "ready" || b.status === "script_ready")).length;
  };

  // Fetch news cards on load (independent of briefing; always available)
  useEffect(() => {
    if (!user || !preferences?.onboarding_completed) return;

    const CACHE_KEY = `newsCards:${user.email}`;
    const TIMESTAMP_KEY = `newsCardsTimestamp:${user.email}`;
    const MANUAL_REFRESH_KEY = `newsCardsManualRefreshTimestamp:${user.email}`;
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    // UI timer should reflect the last time the user manually clicked Refresh.
    const manualRefreshTs = localStorage.getItem(MANUAL_REFRESH_KEY);
    if (manualRefreshTs) {
      const parsed = new Date(parseInt(manualRefreshTs));
      if (!isNaN(parsed.getTime())) setLastRefreshTime(parsed);
    }

    async function loadNewsCards() {
      const now = Date.now();
      const cached = localStorage.getItem(CACHE_KEY);
      const cacheTimestamp = localStorage.getItem(TIMESTAMP_KEY);
      const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity;
      const cacheValid = cacheAge < CACHE_DURATION;

      if (cacheValid && cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.market_news != null || parsed.portfolio_news != null) {
            setMarketNews(parsed.market_news ?? null);
            setPortfolioNews(parsed.portfolio_news ?? null);
          } else if (Array.isArray(parsed)) {
            const half = Math.ceil(parsed.length / 2);
            setMarketNews({ summary: "Market News", stories: parsed.slice(0, half), updated_at: null });
            setPortfolioNews({ summary: "Your Portfolio", stories: parsed.slice(half), updated_at: null });
          }
          console.log("✅ Using cached news cards (age:", Math.round(cacheAge / 60000), "min)");
        } catch (_) {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(TIMESTAMP_KEY);
        }
        setIsLoadingNews(false);
        return;
      }

      try {
        setIsLoadingNews(true);
        console.log("📦 Loading news cards via fetchNewsCards...");

        const resp = await base44.functions.invoke("fetchNewsCards", {
          preferences: preferences,
        });

        if (resp?.data?.success) {
          // New shape: market_news + portfolio_news
          const market = resp.data.market_news;
          const portfolio = resp.data.portfolio_news;

          if (market || portfolio) {
            setMarketNews(market ?? { summary: "Market News", stories: [], updated_at: null });
            setPortfolioNews(portfolio ?? { summary: "Your Portfolio", stories: [], updated_at: null });
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ market_news: market, portfolio_news: portfolio })
            );
            localStorage.setItem(TIMESTAMP_KEY, now.toString());
            console.log(
              "✅ Loaded news: market",
              market?.stories?.length ?? 0,
              "portfolio",
              portfolio?.stories?.length ?? 0
            );
          } else {
            // Legacy shape: flat stories array
            const stories = Array.isArray(resp.data.stories) ? resp.data.stories : [];
            if (stories.length > 0) {
              const half = Math.ceil(stories.length / 2);
              setMarketNews({
                summary: "Market News",
                stories: stories.slice(0, half),
                updated_at: resp.data.cache_age || null,
              });
              setPortfolioNews({
                summary: "Your Portfolio",
                stories: stories.slice(half),
                updated_at: resp.data.cache_age || null,
              });
              localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                  market_news: { summary: "Market News", stories: stories.slice(0, half) },
                  portfolio_news: { summary: "Your Portfolio", stories: stories.slice(half) },
                })
              );
              localStorage.setItem(TIMESTAMP_KEY, now.toString());
            }
          }
        } else {
          console.error("Failed to load news:", resp?.data?.error);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              setMarketNews(parsed.market_news ?? null);
              setPortfolioNews(parsed.portfolio_news ?? null);
            } catch (_) {}
          }
        }
      } catch (error) {
        console.error("Error loading news cards:", error);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setMarketNews(parsed.market_news ?? null);
            setPortfolioNews(parsed.portfolio_news ?? null);
          } catch (_) {}
        }
      } finally {
        setIsLoadingNews(false);
      }
    }

    loadNewsCards();

    const refreshInterval = setInterval(() => {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
      loadNewsCards();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user, preferences?.onboarding_completed]);

  // Manual refresh for news cards
  const refreshNewsCards = useCallback(async () => {
    if (!user || !preferences?.onboarding_completed) return;

    const CACHE_KEY = `newsCards:${user.email}`;
    const TIMESTAMP_KEY = `newsCardsTimestamp:${user.email}`;
    const MANUAL_REFRESH_KEY = `newsCardsManualRefreshTimestamp:${user.email}`;

    // Clear ALL local caches to force fresh data
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
    // Timer always reflects the last manual click, even if network request fails.
    const manualClickTime = new Date();
    setLastRefreshTime(manualClickTime);
    localStorage.setItem(MANUAL_REFRESH_KEY, manualClickTime.getTime().toString());

    setIsLoadingNews(true);
    try {
      const resp = await base44.functions.invoke("fetchNewsCards", {
        preferences: preferences,
        force_refresh: true,
        _t: Date.now(), // cache bust
      });

      if (resp?.data?.success) {
        const market = resp.data.market_news;
        const portfolio = resp.data.portfolio_news;

        if (market || portfolio) {
          setMarketNews(market ?? { summary: "Market News", stories: [], updated_at: null });
          setPortfolioNews(portfolio ?? { summary: "Your Portfolio", stories: [], updated_at: null });
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ market_news: market, portfolio_news: portfolio })
          );
          localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
        } else if (Array.isArray(resp.data.stories) && resp.data.stories.length > 0) {
          const stories = resp.data.stories;
          const half = Math.ceil(stories.length / 2);
          const mn = { summary: "Market News", stories: stories.slice(0, half), updated_at: resp.data.cache_age };
          const pn = { summary: "Your Portfolio", stories: stories.slice(half), updated_at: resp.data.cache_age };
          setMarketNews(mn);
          setPortfolioNews(pn);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ market_news: mn, portfolio_news: pn }));
          localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
        }
      }
    } catch (error) {
      console.error("Error refreshing news cards:", error);
    } finally {
      setIsLoadingNews(false);
    }
  }, [user, preferences]);

  useEffect(() => {
    const zone = pullZoneRef.current;
    if (!zone) return;
    const isCoarseMobile = window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
    if (!isCoarseMobile) return;

    const THRESHOLD = 72;
    const MAX_PULL = 120;

    const onTouchStart = (event) => {
      const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
      if (scrollTop > 0 || isLoadingNews || isPullRefreshing) {
        isPullingRef.current = false;
        return;
      }
      pullStartYRef.current = event.touches?.[0]?.clientY ?? 0;
      isPullingRef.current = true;
    };

    const onTouchMove = (event) => {
      if (!isPullingRef.current) return;
      const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
      if (scrollTop > 0) return;

      const currentY = event.touches?.[0]?.clientY ?? 0;
      const delta = currentY - pullStartYRef.current;
      if (delta <= 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      event.preventDefault();
      const nextPull = Math.min(MAX_PULL, delta * 0.55);
      pullDistanceRef.current = nextPull;
      setPullDistance(nextPull);
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistanceRef.current >= THRESHOLD && !isLoadingNews && !isPullRefreshing) {
        setIsPullRefreshing(true);
        try {
          await refreshNewsCards();
        } finally {
          setIsPullRefreshing(false);
        }
      }
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    zone.addEventListener("touchstart", onTouchStart, { passive: true });
    zone.addEventListener("touchmove", onTouchMove, { passive: false });
    zone.addEventListener("touchend", onTouchEnd, { passive: true });
    zone.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      zone.removeEventListener("touchstart", onTouchStart);
      zone.removeEventListener("touchmove", onTouchMove);
      zone.removeEventListener("touchend", onTouchEnd);
      zone.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [refreshNewsCards, isLoadingNews, isPullRefreshing]);

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
      // Try JSON parse first
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        // If it parsed as an object, try extracting array values
        if (parsed && typeof parsed === "object") {
          const vals = Object.values(parsed);
          if (vals.length > 0 && typeof vals[0] === "string") return vals;
        }
        return [];
      } catch {
        // If it's a non-JSON string that looks like content, wrap it
        if (value.trim().length > 10) return [value.trim()];
        return [];
      }
    }
    // Handle object with array-like values (e.g., {0: "a", 1: "b"})
    if (value && typeof value === "object") {
      const vals = Object.values(value);
      if (vals.length > 0 && typeof vals[0] === "string") return vals;
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
      <div className="min-h-screen p-4 md:p-6" style={{ background: "var(--loading-skeleton-bg)" }}>
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
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
  console.log("🔍 [Key Highlights] raw:", todayBriefing?.key_highlights);
  console.log("🔍 [Key Highlights] type:", typeof todayBriefing?.key_highlights);
  console.log("🔍 [Key Highlights] parsed:", highlights);
  console.log("🔍 [Key Highlights] count:", highlights.length);

  const userWatchlist = parseJsonArray(preferences?.portfolio_holdings || []);
  console.log("userWatchlist:", userWatchlist);
  console.log("userWatchlist length:", userWatchlist.length);

  const sentiment =
    todayBriefing?.market_sentiment && typeof todayBriefing.market_sentiment === "object"
      ? todayBriefing.market_sentiment
      : null;

  const status = todayBriefing?.status || null;

  const briefingStories = parseJsonArray(todayBriefing?.news_stories);
  const marketStories = marketNews?.stories ?? [];
  // Always show top 5 only for Your Portfolio.
  const portfolioStories = (portfolioNews?.stories ?? []).slice(0, 5);
  const hasAnyNews = marketStories.length > 0 || portfolioStories.length > 0;

  // Show proper status based on briefing state — progressive during generation
  const getStatusLabel = () => {
    if (briefingLoading && !isGenerating) return "Loading briefing...";

    if (isGenerating) {
      // Real backend statuses take priority when they arrive
      if (status === "generating_audio") return "🎵 Generating audio...";
      if (status === "uploading") return "📤 Almost ready...";

      // Progressive messages while writing_script or before first poll
      if (elapsedSecs < 8) return "📡 Gathering market data...";
      if (elapsedSecs < 18) return "📰 Analyzing your portfolio news...";
      if (elapsedSecs < 35) return "🧠 Your analyst is selecting stories...";
      if (elapsedSecs < 55) return "✍️ Writing your personalized script...";
      if (elapsedSecs < 75) return "🎵 Generating audio...";
      return "⏳ Almost there — wrapping up...";
    }

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
      className="min-h-screen relative app-theme-surface"
      style={{
        backgroundColor: "hsl(var(--background))",
      }}
    >
      {/* Animated Aurora Background */}
      <AmbientAurora />
      {/* Header */}
      <header className="mobile-safe-sticky backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)", paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <div className="h-12 w-12 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src="/pulse-logo.svg"
                alt="PulseApp"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight truncate">PulseApp</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isPremium && (
              <Button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white gap-2"
              >
                <Crown className="h-4 w-4" />
                Upgrade
              </Button>
            )}
            <Link to={createPageUrl("Settings")}>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 pb-safe relative z-10" style={{ overscrollBehavior: "none" }}>
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
            onComplete={() => console.log('Audio completed')}
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
            isPremium={isPremium}
            transcript={todayBriefing?.script ?? ""}
            sectionStories={(briefingStories || []).slice(0, 6)}
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
              <div className="bg-white dark:bg-card rounded-2xl p-6 border border-slate-100 dark:border-border mb-6">
                <FormattedSummary text={todayBriefing.summary} />
              </div>
            ) : null}

            {highlights.length > 0 ? <KeyHighlights highlights={highlights} /> : null}
          </motion.section>
        )}

        {/* UPGRADE MODAL */}
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

        {/* NEWS CARDS – Market News + Your Portfolio */}
        <motion.section
          ref={pullZoneRef}
          data-pull-refresh-zone="true"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
          style={{
            transform: pullDistance > 0 ? `translateY(${Math.min(56, pullDistance)}px)` : "translateY(0px)",
            transition: isPullingRef.current ? "none" : "transform 180ms ease",
          }}
        >
          <div className="md:hidden -mt-1 mb-1 h-8 flex items-center justify-center text-sm text-slate-500">
            {isPullRefreshing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing
              </span>
            ) : pullDistance > 0 ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                {pullDistance >= 72 ? "Release to refresh" : "Pull to refresh"}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-y-1">
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 shrink-0">News for You</h2>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={refreshNewsCards}
                  disabled={isLoadingNews}
                  title="Fetch latest news"
                  className="min-h-11 px-2 rounded-md text-sm text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 select-none"
                >
                  {isLoadingNews ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  Refresh
                </button>
                <span className="text-sm text-slate-400 shrink-0">
                  {marketStories.length + portfolioStories.length} stories
                </span>
              </div>
              {lastRefreshTime && !isNaN(new Date(lastRefreshTime).getTime()) && (
                <span className="text-sm text-slate-400">
                  Updated {formatDistanceToNow(lastRefreshTime, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {isLoadingNews ? (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--section-border)", background: "var(--empty-card-bg)" }}>
                <div className="p-4" style={{ borderBottom: "1px solid var(--section-border)" }}>
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="p-6 grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          ) : !hasAnyNews ? (
            <div className="rounded-2xl p-8 text-center" style={{ border: "1px solid var(--section-border)", background: "var(--empty-card-bg)" }}>
              <p className="text-slate-600">
                No news available yet. Check back in a few minutes or try refreshing.
              </p>
              <p className="text-sm text-slate-400 mt-2">
                News is loaded automatically based on your interests and portfolio—no need to generate a briefing.
              </p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MarketSection
                marketSectionOpen={marketSectionOpen}
                setMarketSectionOpen={setMarketSectionOpen}
                setLastExpandedSection={setLastExpandedSection}
                marketStories={marketStories}
                isSecond={portfolioSectionOpen}
                gridOrder={!portfolioSectionOpen ? 1 : 2}
              />
              <PortfolioSection
                portfolioSectionOpen={portfolioSectionOpen}
                setPortfolioSectionOpen={setPortfolioSectionOpen}
                setLastExpandedSection={setLastExpandedSection}
                portfolioStories={portfolioStories}
                isSecond={marketSectionOpen}
                gridOrder={portfolioSectionOpen ? 1 : 2}
              />
            </motion.div>
          )}
        </motion.section>
      </main>
    </div>
  );
}