import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX, Gauge, Clock, Loader2, FileText, X, Settings2, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { GlassFilter } from "@/components/ui/liquid-glass-button";

export default function AudioPlayer({
  audioUrl,
  duration,
  onComplete,
  greeting = "Good morning",
  userName = "Alex",
  currentDate = "01/16, Thu",
  onGenerate,
  isGenerating = false,
  status = null,
  statusLabel = null,
  canGenerateNew = true,
  timeUntilNextBriefing = null,
  briefingCount = 0,
  isPremium = false,
  transcript = "",
  sectionStories = [],
}) {
  console.log("🎵 [AudioPlayer Component] Rendered with audioUrl:", audioUrl);
  console.log("🎵 [AudioPlayer Component] isGenerating:", isGenerating);
  console.log("🎵 [AudioPlayer Component] status:", status);
  console.log("🎵 [AudioPlayer Component] statusLabel:", statusLabel);
  
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState((duration || 0) * 60 || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [infoCardExpanded, setInfoCardExpanded] = useState(false);
  const [frequencyData, setFrequencyData] = useState(() => Array(48).fill(0.3));

  const mx = useMotionValue(300);
  const my = useMotionValue(200);
  const sx = useSpring(mx, { stiffness: 200, damping: 30, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 200, damping: 30, mass: 0.5 });

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.log("🎵 [Audio Element] No audio ref");
      return;
    }

    console.log("🎵 [Audio Element] Setting up event listeners for:", audioUrl);

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      console.log("🎵 [Audio Element] Metadata loaded, duration:", audio.duration);
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setTotalDuration(d);
      else setTotalDuration((duration || 0) * 60 || 0);
    };
    const handleEnded = () => {
      console.log("🎵 [Audio Element] Playback ended");
      setIsPlaying(false);
      onComplete?.();
    };
    const handleError = (e) => {
      console.error("🎵 [Audio Element] Error:", e);
      console.error("🎵 [Audio Element] Error details:", audio.error);
    };
    const handleCanPlay = () => {
      console.log("🎵 [Audio Element] Can play");
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioUrl, duration, onComplete]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Audio-reactive waveform: AnalyserNode drives bar heights when playing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || !isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.88;
      analyserRef.current = analyser;
      source.connect(analyser);
      analyser.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const barCount = 48;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.floor(dataArray.length / barCount);
      const bars = [];
      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j] ?? 0;
        bars.push(Math.min(1, (sum / step / 255) * 2.2));
      }
      setFrequencyData(bars);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioUrl, isPlaying]);

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const sectionCount = Math.min(6, sectionStories?.length || 0);

  // Section boundaries: derived from transcript and scaled to actual audio duration (real-time)
  const sectionBoundariesSeconds = useMemo(() => {
    const raw = (transcript || "").trim();
    if (!raw || sectionCount === 0 || !totalDuration || totalDuration <= 0) return [];
    const text = raw.toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    if (totalWords === 0) return [];

    const transitionPhrases = [
      "next up",
      "up next",
      "another headline",
      "moving on",
      "and another",
      "next,",
      "one more",
      "shifting to",
      "turning to",
      "meanwhile",
      "also in the news",
      "and in",
      "finally",
      "last up",
    ];
    const positions = [];
    for (const phrase of transitionPhrases) {
      let idx = 0;
      while (idx < text.length) {
        const found = text.indexOf(phrase, idx);
        if (found === -1) break;
        positions.push(found);
        idx = found + 1;
      }
    }
    const sorted = [...new Set(positions)].sort((a, b) => a - b);
    const needBoundaries = 5;
    const earlySec = 0;

    const charToWordIndex = (charPos) => {
      let count = 0;
      let pos = 0;
      for (const w of words) {
        if (pos >= charPos) return count;
        pos += w.length + 1;
        count++;
      }
      return count;
    };

    if (sorted.length === 0) {
      return Array.from({ length: needBoundaries }, (_, i) => Math.max(0, ((i + 1) / 6) * totalDuration - earlySec));
    }
    const take = Math.min(needBoundaries, sorted.length);
    const selected = sorted
      .slice(0, take)
      .map((p) => Math.max(0, (charToWordIndex(p) / totalWords) * totalDuration - earlySec));
    if (selected.length < needBoundaries) {
      const last = selected[selected.length - 1] ?? totalDuration * 0.5;
      for (let i = selected.length; i < needBoundaries; i++) {
        selected.push(last + ((i - selected.length + 1) / (needBoundaries - selected.length + 1)) * (totalDuration - last));
      }
    }
    return selected.sort((a, b) => a - b);
  }, [transcript, sectionCount, totalDuration]);

  const currentSectionIndex = useMemo(() => {
    if (sectionCount === 0) return -1;
    if (sectionBoundariesSeconds.length === 0) {
      return totalDuration > 0 ? Math.min(sectionCount - 1, Math.floor((currentTime / totalDuration) * sectionCount)) : -1;
    }
    if (currentTime < sectionBoundariesSeconds[0]) return 0;
    for (let i = 1; i < sectionBoundariesSeconds.length; i++) {
      if (currentTime < sectionBoundariesSeconds[i]) return Math.min(i, sectionCount - 1);
    }
    return Math.min(sectionBoundariesSeconds.length, sectionCount - 1);
  }, [currentTime, sectionBoundariesSeconds, sectionCount, totalDuration]);

  const currentSectionStory =
    currentSectionIndex >= 0 && sectionStories?.[currentSectionIndex]
      ? sectionStories[currentSectionIndex]
      : null;

  // Intro: short waveform, then all 6 section cards
  const INTRO_SECONDS = 4;
  const introEndSeconds = INTRO_SECONDS;
  const showWaveform = sectionCount === 0 || currentTime < introEndSeconds;
  const showInfoCard = sectionCount > 0 && currentSectionStory && currentTime >= introEndSeconds;

  const sectionSummary = useMemo(() => {
    if (!currentSectionStory) return "";
    let text = (currentSectionStory.what_happened || currentSectionStory.title || "").trim();
    // Remove trailing source attribution
    text = text.replace(/\s*\(Source:\s*[^)]+\)\s*$/i, '').trim();
    return text;
  }, [currentSectionStory]);

  // Image per section
  const sectionImageSeed = useMemo(() => {
    if (!currentSectionStory) return String(currentSectionIndex + 1);
    const raw = (currentSectionStory.title || currentSectionStory.what_happened || "").slice(0, 50);
    return raw.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || String(currentSectionIndex + 1);
  }, [currentSectionStory, currentSectionIndex]);
  const sectionImageUrl = `https://picsum.photos/seed/${encodeURIComponent(sectionImageSeed)}/400/280`;

  useEffect(() => {
    setInfoCardExpanded(false);
  }, [currentSectionIndex]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await a.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const skip = (seconds) => {
    const a = audioRef.current;
    if (!a) return;
    const next = Math.max(0, Math.min((a.currentTime || 0) + seconds, totalDuration || a.duration || 0));
    a.currentTime = next;
  };

  const handleSeek = (value) => {
    const a = audioRef.current;
    if (!a) return;
    const t = value?.[0] ?? 0;
    a.currentTime = t;
    setCurrentTime(t);
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeSpeed = (speed) => {
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  const formatTime = (seconds) => {
    const s = Number.isFinite(seconds) ? seconds : 0;
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const bars = useMemo(() => {
    const count = 48;
    return Array.from({ length: count }, (_, i) => {
      const baseHeight = 14 + Math.sin(i * 0.38) * 14 + Math.cos(i * 0.62) * 10;
      return { i, p: i / (count - 1), baseHeight };
    });
  }, []);

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  const isButtonDisabled = isGenerating || !canGenerateNew;
  const getButtonText = () => {
    if (isGenerating) return "Generating...";
    if (briefingCount >= 3) return "Daily Limit Reached";
    if (!canGenerateNew && timeUntilNextBriefing) return "Generate Briefing";
    if (audioUrl) return "Generate New Update";
    return "Generate Briefing";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onPointerMove={onPointerMove}
      className="relative overflow-visible md:overflow-hidden rounded-[32px] md:rounded-[40px] p-5 md:p-10"
      style={{
        background: "linear-gradient(145deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.55) 100%)",
        backdropFilter: "blur(60px) saturate(1.5) url(#container-glass)",
        WebkitBackdropFilter: "blur(60px) saturate(1.5)",
        border: "0.5px solid rgba(255, 255, 255, 0.8)",
        boxShadow: `
          0 0 80px -20px hsla(25, 80%, 50%, 0.35),
          0 0 60px -15px hsla(15, 70%, 55%, 0.25),
          0 0 6px rgba(0,0,0,0.03),
          0 2px 6px rgba(0,0,0,0.08),
          inset 3px 3px 0.5px -3px rgba(0,0,0,0.9),
          inset -3px -3px 0.5px -3px rgba(0,0,0,0.85),
          inset 1px 1px 1px -0.5px rgba(0,0,0,0.6),
          inset -1px -1px 1px -0.5px rgba(0,0,0,0.6),
          inset 0 0 6px 6px rgba(0,0,0,0.12),
          inset 0 0 2px 2px rgba(0,0,0,0.06),
          0 0 12px rgba(255,255,255,0.15),
          0 24px 70px -12px rgba(0,0,0,0.15),
          0 8px 24px -8px rgba(0,0,0,0.08)
        `,
      }}
    >
      <GlassFilter />

      <div
        className="pointer-events-none absolute inset-[0.5px] rounded-[31.5px] md:rounded-[39.5px]"
        style={{
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-[1px] rounded-[31px] md:rounded-[39px]"
        style={{
          border: "0.5px solid rgba(0, 0, 0, 0.04)",
          boxShadow: "inset 0 0 0 0.5px rgba(255, 255, 255, 0.5)",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[32px] md:rounded-[40px]"
        style={{
          "--highlight-x": sx,
          "--highlight-y": sy,
          background: "radial-gradient(320px 240px at var(--highlight-x) var(--highlight-y), rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%)",
          mixBlendMode: "overlay",
        }}
      />

      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm rounded-[32px] md:rounded-[40px] z-30 gap-4 pointer-events-none"
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(25, 80%, 50%)' }} />
          {statusLabel && (
            <p className="text-slate-700 text-sm font-medium">{statusLabel}</p>
          )}
        </motion.div>
      )}

      <motion.div
        className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-40"
        animate={{
          x: [0, 30, -15, 0],
          y: [0, -25, 15, 0],
          scale: isPlaying ? [1, 1.15, 1] : [1, 1.05, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: "radial-gradient(circle, rgba(255, 200, 120, 0.6) 0%, rgba(255, 200, 120, 0.2) 35%, transparent 65%)",
          filter: "blur(28px)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full opacity-35"
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 25, -15, 0],
          scale: isPlaying ? [1, 1.2, 1] : [1, 1.08, 1],
        }}
        transition={{ duration: 9.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        style={{
          background: "radial-gradient(circle, rgba(255, 140, 90, 0.55) 0%, rgba(255, 140, 90, 0.18) 38%, transparent 68%)",
          filter: "blur(32px)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay rounded-[32px] md:rounded-[40px]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {audioUrl ? (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="metadata" 
          crossOrigin="anonymous"
        />
      ) : null}

      <div className="relative z-10">
        <div className="flex items-start md:items-center justify-between mb-6 md:mb-8 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-slate-500/80 text-[10px] md:text-xs font-medium tracking-wider uppercase mb-1">
              {currentDate}
            </p>
            <p className="text-base md:text-lg" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, letterSpacing: '0.15em' }}>
              <span className="text-slate-800/90 uppercase text-sm md:text-[inherit]">{greeting},</span>
              <br />
              <span className="font-semibold text-slate-900 normal-case text-[2.5rem] md:text-[3.5rem] leading-none md:leading-tight inline-block mt-1 md:mt-2" style={{ fontFamily: "'Italianno', 'Sacramento', cursive", letterSpacing: '0.05em', fontWeight: 400 }}>
                {userName}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {transcript.trim() ? (
              <motion.button
                type="button"
                onClick={() => setShowTranscript((t) => !t)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-[9px] md:text-[10px] font-semibold tracking-wider uppercase text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 md:gap-1.5 px-2 py-1 rounded"
              >
                <FileText className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span className="hidden md:inline">{showTranscript ? "Hide transcript" : "Show transcript"}</span>
                <span className="md:hidden">Transcript</span>
              </motion.button>
            ) : null}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-right">
                <p className="text-slate-400 text-[9px] md:text-[10px] font-medium tracking-wider uppercase">Today</p>
                <p className="text-slate-700 text-xs md:text-sm font-semibold">{briefingCount} / 3</p>
              </div>
            <motion.div
              animate={{ 
                scale: isPlaying ? [1, 1.15, 1] : 1,
                opacity: isPlaying ? [0.7, 1, 0.7] : 0.75
              }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full"
              style={{ background: "linear-gradient(135deg, rgba(230, 115, 26, 0.95) 0%, rgba(219, 114, 67, 1) 100%)" }}
            />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showTranscript && transcript.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mb-6"
            >
              <div
                className="rounded-2xl border border-slate-200/80 bg-slate-50/95 backdrop-blur-sm overflow-hidden"
                style={{
                  boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                }}
              >
                <div className="flex items-center justify-between px-4 md:px-5 py-2.5 md:py-3 border-b border-slate-200/80 bg-white/70">
                  <span className="text-[10px] md:text-xs font-semibold tracking-wider uppercase text-slate-500">Briefing transcript</span>
                  <motion.button
                    type="button"
                    onClick={() => setShowTranscript(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
                <div className="px-4 md:px-5 py-4 md:py-5 max-h-[280px] md:max-h-[320px] overflow-y-auto">
                  {transcript
                    .trim()
                    .split(/\n\n+/)
                    .filter((block) => block.trim())
                    .map((paragraph, i) => {
                      const lines = paragraph.trim().split("\n").map((l) => l.trim()).filter(Boolean);
                      return (
                        <p
                          key={i}
                          className="text-slate-700 text-xs md:text-sm leading-relaxed mb-3 md:mb-4 last:mb-0"
                        >
                          {lines.map((line, j) => (
                            <span key={j}>
                              {line}
                              {j < lines.length - 1 ? <br /> : null}
                            </span>
                          ))}
                        </p>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waveform/Info Card - mobile ~35% bigger than previous, desktop unchanged */}
        <div className={`rounded-xl md:rounded-2xl overflow-visible relative ${showWaveform ? "h-16 md:h-24" : "min-h-16 md:min-h-24"} ${showInfoCard ? "" : "mb-6 md:mb-8"}`}>
          {showWaveform ? (
            <div className="absolute inset-0 rounded-xl md:rounded-2xl flex items-center justify-center gap-px md:gap-0.5 px-1 md:px-2">
              {bars.map(({ i }, idx) => {
                const level = isPlaying && frequencyData[idx] != null
                  ? 0.18 + 0.82 * frequencyData[idx]
                  : 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(currentTime * 1.8 + i * 0.2));
                return (
                  <motion.div
                    key={i}
                    className="w-1 md:w-1.5 h-5 md:h-[26px] rounded-full flex-shrink-0 origin-center"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,200,140,0.95) 0%, rgba(230,115,26,0.85) 35%, rgba(219,114,67,0.7) 100%)",
                      boxShadow: "0 0 12px rgba(230,115,26,0.5)",
                      scaleY: level,
                    }}
                    transition={{ type: "spring", stiffness: 100, damping: 14, mass: 0.4 }}
                  />
                );
              })}
            </div>
          ) : showInfoCard ? (
            <div
              className="news-content relative rounded-[16px] md:rounded-[20px] overflow-hidden"
              style={{
                padding: 0,
                marginBottom: 60,
                opacity: 0.75,
                background: "rgba(240, 240, 240, 0.4)",
                boxShadow: [
                  "0 0 0 1px rgba(0, 0, 0, 0.05)",
                  "0 0 50px 12px rgba(0, 0, 0, 0.18)",
                  "0 0 85px 20px rgba(0, 0, 0, 0.12)",
                  "0 0 120px 28px rgba(0, 0, 0, 0.08)",
                ].join(", "),
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSectionIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="relative flex flex-col md:flex-row items-stretch min-w-0"
                  style={{ background: "transparent" }}
                >
                  <div className="relative w-full md:w-[42%] md:min-w-[160px] flex-shrink-0 overflow-hidden md:rounded-l-[20px]">
                    <img
                      src={sectionImageUrl}
                      alt=""
                      className="w-full h-32 md:h-full md:min-h-[140px] object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center px-4 py-3 md:px-6 md:py-5">
                    <p className="text-slate-800 text-xs md:text-[13px] font-semibold leading-tight drop-shadow-sm line-clamp-2 md:line-clamp-none" style={{ textShadow: "0 0 12px rgba(255,255,255,0.8)" }}>
                      {currentSectionStory.title || currentSectionStory.what_happened || "This section"}
                    </p>
                    {sectionSummary && (
                      <div className="mt-1 max-w-xl">
                        <p
                          className={`text-slate-600 text-[11px] md:text-sm leading-snug drop-shadow-sm md:line-clamp-none ${infoCardExpanded ? "" : "line-clamp-3"}`}
                          style={{ textShadow: "0 0 10px rgba(255,255,255,0.6)" }}
                        >
                          {sectionSummary}
                        </p>
                        <button
                          type="button"
                          onClick={() => setInfoCardExpanded((e) => !e)}
                          className="md:hidden mt-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                        >
                          {infoCardExpanded ? "Less" : "More"}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div
              className="absolute inset-0 rounded-xl md:rounded-2xl flex items-center justify-center"
              style={{ background: "transparent" }}
            >
              <p className="text-slate-400 text-[10px] md:text-xs text-center px-4">Play your briefing to see this section</p>
            </div>
          )}
        </div>

        <div className="mb-6 md:mb-10 px-1">
          <Slider
            value={[currentTime]}
            max={totalDuration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between mt-2 md:mt-3 text-slate-600/70 text-xs md:text-sm font-mono tracking-tight">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, totalDuration - currentTime))}</span>
          </div>
        </div>

        {/* DESKTOP CONTROLS: Original horizontal row (hidden on mobile) */}
        <div className="hidden md:flex items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={toggleMute}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(10px)",
              border: "0.5px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
            }}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-slate-600" /> : <Volume2 className="h-5 w-5 text-slate-600" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => skip(-15)}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(10px)",
              border: "0.5px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
            }}
          >
            <RotateCcw className="h-5 w-5 text-slate-600" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={togglePlay}
            disabled={!audioUrl}
            className="w-24 h-24 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, rgba(230, 115, 26, 0.95) 0%, rgba(219, 114, 67, 1) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: `
                0 12px 32px rgba(230, 115, 26, 0.4),
                0 4px 12px rgba(230, 115, 26, 0.25),
                inset 0 2px 2px rgba(255, 255, 255, 0.4),
                inset 0 -2px 3px rgba(0, 0, 0, 0.15)
              `,
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause-d" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                  <Pause className="h-9 w-9 text-white" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div key="play-d" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}>
                  <Play className="h-9 w-9 text-white ml-1" fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => skip(30)}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(10px)",
              border: "0.5px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
            }}
          >
            <FastForward className="h-5 w-5 text-slate-600" />
          </motion.button>

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="w-14 h-14 rounded-full flex items-center justify-center relative"
              style={{
                background: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(10px)",
                border: "0.5px solid rgba(255, 255, 255, 0.8)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
              }}
            >
              <Gauge className="h-5 w-5 text-slate-600" />
              <span className="absolute -bottom-0 text-[10px] font-semibold text-slate-700">
                {playbackRate}x
              </span>
            </motion.button>

            <AnimatePresence>
              {showSpeedMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 right-0 rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(20px)",
                    border: "0.5px solid rgba(255, 255, 255, 0.8)",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
                  }}
                >
                  <div className="p-2 flex flex-col gap-1">
                    {speedOptions.map((speed) => (
                      <motion.button
                        key={speed}
                        whileHover={{ scale: 1.05, x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => changeSpeed(speed)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-left transition-colors"
                        style={{
                          background: playbackRate === speed 
                            ? "linear-gradient(135deg, rgba(230, 115, 26, 0.2) 0%, rgba(219, 114, 67, 0.2) 100%)"
                            : "transparent",
                          color: playbackRate === speed ? "rgb(219, 114, 67)" : "rgb(71, 85, 105)",
                        }}
                      >
                        {speed}x
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* MOBILE CONTROLS: Single Play Button (always visible); expanded overlay has 4 controls only, spaced above it */}
        <div className="flex flex-col items-center gap-4 md:hidden">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={togglePlay}
            disabled={!audioUrl}
            className="w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, rgba(230, 115, 26, 0.95) 0%, rgba(219, 114, 67, 1) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: `
                0 12px 32px rgba(230, 115, 26, 0.4),
                0 4px 12px rgba(230, 115, 26, 0.25),
                inset 0 2px 2px rgba(255, 255, 255, 0.4),
                inset 0 -2px 3px rgba(0, 0, 0, 0.15)
              `,
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause-m" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                  <Pause className="h-8 w-8 text-white" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div key="play-m" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}>
                  <Play className="h-8 w-8 text-white ml-0.5" fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mt-6 md:mt-8"
            >
              <p className="text-slate-500 text-xs">Please wait while your briefing is being created...</p>
            </motion.div>
          ) : (
            <motion.div
              key="generate-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center mt-6 md:mt-8 gap-2"
            >
              {/* Mobile: grid keeps Generate + controls in fixed positions; no hover scale so nothing shifts */}
              <div className="w-full md:hidden grid grid-cols-3 items-center justify-items-center gap-2 min-h-[44px]">
                <div className="w-full" aria-hidden="true" />
                <motion.button
                  whileTap={canGenerateNew ? { scale: 0.96 } : {}}
                  onClick={canGenerateNew ? onGenerate : undefined}
                  disabled={isButtonDisabled}
                  className={`col-start-2 justify-self-center px-5 py-2.5 rounded-full text-xs font-semibold ${isButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    background: isButtonDisabled
                      ? "linear-gradient(135deg, rgba(180, 180, 180, 0.6) 0%, rgba(150, 150, 150, 0.7) 100%)"
                      : "linear-gradient(135deg, rgba(230, 115, 26, 0.95) 0%, rgba(219, 114, 67, 1) 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.5)",
                    boxShadow: isButtonDisabled ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 8px 24px rgba(230, 115, 26, 0.3), 0 4px 12px rgba(230, 115, 26, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
                    color: isButtonDisabled ? "rgba(255, 255, 255, 0.8)" : "white",
                  }}
                >
                  {getButtonText()}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowControls(!showControls)}
                  className="col-start-3 justify-self-end w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    border: "0.5px solid rgba(255, 255, 255, 0.8)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)",
                  }}
                >
                  <Settings2 className="h-5 w-5 text-slate-600" />
                </motion.button>
              </div>

              {/* Desktop: Generate button only */}
              <div className="hidden md:flex w-full flex-col items-center">
                <motion.button
                  whileHover={canGenerateNew ? { scale: 1.06 } : {}}
                  whileTap={canGenerateNew ? { scale: 0.96 } : {}}
                  onClick={canGenerateNew ? onGenerate : undefined}
                  disabled={isButtonDisabled}
                  className={`px-6 py-3 rounded-full text-sm font-semibold ${isButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    background: isButtonDisabled
                      ? "linear-gradient(135deg, rgba(180, 180, 180, 0.6) 0%, rgba(150, 150, 150, 0.7) 100%)"
                      : "linear-gradient(135deg, rgba(230, 115, 26, 0.95) 0%, rgba(219, 114, 67, 1) 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.5)",
                    boxShadow: isButtonDisabled
                      ? "0 4px 12px rgba(0, 0, 0, 0.1)"
                      : "0 8px 24px rgba(230, 115, 26, 0.3), 0 4px 12px rgba(230, 115, 26, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
                    color: isButtonDisabled ? "rgba(255, 255, 255, 0.8)" : "white",
                  }}
                >
                  {getButtonText()}
                </motion.button>
              </div>

              {timeUntilNextBriefing && timeUntilNextBriefing !== "Daily limit reached" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-slate-500 text-xs"
                >
                  <Clock className="h-3 w-3" />
                  <span>Next briefing available in {timeUntilNextBriefing}</span>
                </motion.div>
              )}

              {timeUntilNextBriefing === "Daily limit reached" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-500 text-xs"
                >
                  Daily limit reached. Resets at midnight.
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile: overlay mask + controls panel when expanded (on top of player, tap outside to close) */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              key="mobile-controls-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 pointer-events-none rounded-[32px] md:rounded-[40px] md:hidden"
            >
              <div
                className="absolute inset-0 rounded-[32px] md:rounded-[40px] pointer-events-auto"
                style={{ background: "transparent" }}
                onClick={() => setShowControls(false)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute right-0 z-30 pointer-events-auto flex flex-col items-end gap-3"
                style={{ bottom: "5.75rem" }}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.94 }} onClick={toggleMute}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255, 255, 255, 0.8)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)" }}
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-slate-600" /> : <Volume2 className="h-4 w-4 text-slate-600" />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.94 }} onClick={() => skip(-15)}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255, 255, 255, 0.8)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)" }}
                >
                  <RotateCcw className="h-4 w-4 text-slate-600" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.94 }} onClick={() => skip(30)}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255, 255, 255, 0.8)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)" }}
                >
                  <FastForward className="h-4 w-4 text-slate-600" />
                </motion.button>
                <div className="relative">
                  <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.94 }} onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="w-12 h-12 rounded-full flex items-center justify-center relative shrink-0"
                    style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255, 255, 255, 0.8)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)" }}
                  >
                    <Gauge className="h-4 w-4 text-slate-600" />
                    <span className="absolute -bottom-0 text-[9px] font-semibold text-slate-700">{playbackRate}x</span>
                  </motion.button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-2 right-0 rounded-xl overflow-hidden z-40"
                        style={{ background: "rgba(255, 255, 255, 0.98)", backdropFilter: "blur(20px)", border: "0.5px solid rgba(255, 255, 255, 0.8)", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)" }}
                      >
                        <div className="p-1.5 flex flex-col gap-0.5">
                          {speedOptions.map((speed) => (
                            <motion.button key={speed} whileHover={{ scale: 1.05, x: 2 }} whileTap={{ scale: 0.98 }} onClick={() => changeSpeed(speed)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors"
                              style={{ background: playbackRate === speed ? "linear-gradient(135deg, rgba(230, 115, 26, 0.2) 0%, rgba(219, 114, 67, 0.2) 100%)" : "transparent", color: playbackRate === speed ? "rgb(219, 114, 67)" : "rgb(71, 85, 105)" }}
                            >
                              {speed}x
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
