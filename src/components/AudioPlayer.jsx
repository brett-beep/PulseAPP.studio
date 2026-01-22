import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX, Gauge, Clock, Loader2 } from "lucide-react";
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
  statusLabel = null, // NEW: Add this prop
  canGenerateNew = true,
  timeUntilNextBriefing = null,
  briefingCount = 0,
}) {
  console.log("🎵 [AudioPlayer Component] Rendered with audioUrl:", audioUrl);
  console.log("🎵 [AudioPlayer Component] isGenerating:", isGenerating);
  console.log("🎵 [AudioPlayer Component] status:", status);
  console.log("🎵 [AudioPlayer Component] statusLabel:", statusLabel);
  
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState((duration || 0) * 60 || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

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

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

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
      className="relative overflow-hidden rounded-[40px] p-10"
      style={{
        background: "linear-gradient(145deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.55) 100%)",
        backdropFilter: "blur(60px) saturate(1.5) url(#container-glass)",
        WebkitBackdropFilter: "blur(60px) saturate(1.5)",
        border: "0.5px solid rgba(255, 255, 255, 0.8)",
        boxShadow: `
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
        className="pointer-events-none absolute inset-[0.5px] rounded-[39.5px]"
        style={{
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-[1px] rounded-[39px]"
        style={{
          border: "0.5px solid rgba(0, 0, 0, 0.04)",
          boxShadow: "inset 0 0 0 0.5px rgba(255, 255, 255, 0.5)",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[40px]"
        style={{
          "--highlight-x": sx,
          "--highlight-y": sy,
          background: "radial-gradient(320px 240px at var(--highlight-x) var(--highlight-y), rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Status overlay during generation */}
      {isGenerating && statusLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-md rounded-[40px] z-30 gap-4"
        >
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-slate-800 text-base font-semibold px-6 text-center">{statusLabel}</p>
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
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay rounded-[40px]"
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-slate-500/80 text-xs font-medium tracking-wider uppercase mb-1">
              {currentDate}
            </p>
            <p className="text-slate-800/90 text-lg">
              {greeting}, <span className="font-semibold text-slate-900">{userName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-slate-400 text-[10px] font-medium tracking-wider uppercase">Today</p>
              <p className="text-slate-700 text-sm font-semibold">{briefingCount} / 3</p>
            </div>
            <motion.div
              animate={{ 
                scale: isPlaying ? [1, 1.15, 1] : 1,
                opacity: isPlaying ? [0.7, 1, 0.7] : 0.75
              }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "linear-gradient(135deg, rgba(255, 140, 80, 0.95) 0%, rgba(255, 90, 50, 1) 100%)" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-[3px] h-28 mb-8 px-2">
          {bars.map((bar) => {
            const isActive = bar.p <= progress;
            return (
              <motion.div
                key={bar.i}
                animate={{
                  height: isPlaying
                    ? [bar.baseHeight, bar.baseHeight * 1.65, bar.baseHeight * 0.75, bar.baseHeight]
                    : bar.baseHeight * 0.45,
                  opacity: isActive ? 1 : 0.25,
                }}
                transition={{
                  duration: isPlaying ? 0.6 + (bar.i % 9) * 0.025 : 0.3,
                  repeat: isPlaying ? Infinity : 0,
                  ease: "easeInOut",
                  delay: isPlaying ? bar.i * 0.015 : 0,
                }}
                className="w-[3.5px] rounded-full"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, rgba(255, 150, 85, 0.95) 0%, rgba(255, 95, 55, 0.9) 100%)"
                    : "rgba(120, 120, 120, 0.25)",
                }}
              />
            );
          })}
        </div>

        <div className="mb-10 px-1">
          <Slider
            value={[currentTime]}
            max={totalDuration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between mt-3 text-slate-600/70 text-sm font-mono tracking-tight">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, totalDuration - currentTime))}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
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
              background: "linear-gradient(135deg, rgba(255, 140, 75, 0.95) 0%, rgba(255, 85, 45, 1) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: `
                0 12px 32px rgba(255, 100, 50, 0.4),
                0 4px 12px rgba(255, 100, 50, 0.25),
                inset 0 2px 2px rgba(255, 255, 255, 0.4),
                inset 0 -2px 3px rgba(0, 0, 0, 0.15)
              `,
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Pause className="h-9 w-9 text-white" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                >
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
                            ? "linear-gradient(135deg, rgba(255, 140, 75, 0.2) 0%, rgba(255, 85, 45, 0.2) 100%)"
                            : "transparent",
                          color: playbackRate === speed ? "rgb(255, 85, 45)" : "rgb(71, 85, 105)",
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

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mt-8"
            >
              {/* Progress status is now shown in the overlay above, so we can keep this minimal */}
              <p className="text-slate-500 text-xs">Please wait while your briefing is being created...</p>
            </motion.div>
          ) : (
            <motion.div
              key="generate-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center mt-8 gap-2"
            >
              <motion.button
                whileHover={canGenerateNew ? { scale: 1.05, y: -2 } : {}}
                whileTap={canGenerateNew ? { scale: 0.98 } : {}}
                onClick={canGenerateNew ? onGenerate : undefined}
                disabled={isButtonDisabled}
                className={`px-6 py-3 rounded-full text-sm font-semibold transition-all ${
                  isButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: isButtonDisabled
                    ? "linear-gradient(135deg, rgba(180, 180, 180, 0.6) 0%, rgba(150, 150, 150, 0.7) 100%)"
                    : "linear-gradient(135deg, rgba(255, 140, 75, 0.95) 0%, rgba(255, 85, 45, 1) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.5)",
                  boxShadow: isButtonDisabled
                    ? "0 4px 12px rgba(0, 0, 0, 0.1)"
                    : `
                      0 8px 24px rgba(255, 100, 50, 0.3),
                      0 4px 12px rgba(255, 100, 50, 0.2),
                      inset 0 1px 1px rgba(255, 255, 255, 0.3)
                    `,
                  color: isButtonDisabled ? "rgba(255, 255, 255, 0.8)" : "white",
                }}
              >
                {getButtonText()}
              </motion.button>

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
      </div>
    </motion.div>
  );
}