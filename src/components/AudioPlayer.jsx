import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function AudioPlayer({
  audioUrl,
  title = "Daily Briefing",
  duration, // minutes (optional fallback)
  onComplete,
  greeting = "Good morning",
  userName = "Alex",
}) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState((duration || 0) * 60 || 0);
  const [isMuted, setIsMuted] = useState(false);

  // Cursor-driven specular highlight
  const mx = useMotionValue(240);
  const my = useMotionValue(140);
  const sx = useSpring(mx, { stiffness: 240, damping: 28, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 240, damping: 28, mass: 0.6 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setTotalDuration(d);
      else setTotalDuration((duration || 0) * 60 || 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl, duration, onComplete]);

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

  const formatTime = (seconds) => {
    const s = Number.isFinite(seconds) ? seconds : 0;
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const bars = useMemo(() => {
    const count = 52;
    return Array.from({ length: count }, (_, i) => {
      const baseHeight = 12 + Math.sin(i * 0.42) * 12 + Math.cos(i * 0.68) * 8;
      return { i, p: i / (count - 1), baseHeight };
    });
  }, []);

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.9, 0.2, 1] }}
      onPointerMove={onPointerMove}
      className="relative overflow-hidden rounded-[32px] p-8"
      style={{
        // Option B porcelain glass
        background: "rgba(255, 255, 252, 0.72)",
        backdropFilter: "blur(34px) saturate(1.35) contrast(1.05)",
        WebkitBackdropFilter: "blur(34px) saturate(1.35) contrast(1.05)",
        border: "1px solid rgba(255, 255, 255, 0.55)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.62), inset 0 -1px 0 rgba(0,0,0,0.06)",
      }}
    >
      {/* Inner stroke ring */}
      <div
        className="pointer-events-none absolute inset-[1px] rounded-[31px]"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)",
        }}
      />

      {/* Cursor-tracking specular highlight */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          // CSS vars driven by MotionValues (valid pattern)
          "--mx": sx,
          "--my": sy,
          background:
            "radial-gradient(260px 200px at var(--mx) var(--my), rgba(255,255,255,0.70), rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.00) 72%)",
          mixBlendMode: "screen",
          opacity: 0.9,
        }}
      />

      {/* Caustic blobs (slow, subtle) */}
      <motion.div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
        animate={{
          x: [0, 24, -10, 0],
          y: [0, -18, 10, 0],
          scale: isPlaying ? [1, 1.12, 1] : [1, 1.04, 1],
        }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle, rgba(255, 214, 140, 0.40) 0%, rgba(255, 214, 140, 0.10) 40%, rgba(255, 214, 140, 0.00) 72%)",
          filter: "blur(18px)",
          opacity: 0.75,
        }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 -left-28 h-80 w-80 rounded-full"
        animate={{
          x: [0, -20, 18, 0],
          y: [0, 20, -12, 0],
          scale: isPlaying ? [1, 1.16, 1] : [1, 1.06, 1],
        }}
        transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        style={{
          background:
            "radial-gradient(circle, rgba(255, 120, 80, 0.30) 0%, rgba(255, 120, 80, 0.10) 44%, rgba(255, 120, 80, 0.00) 74%)",
          filter: "blur(22px)",
          opacity: 0.6,
        }}
      />

      {/* Micro-grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
          mixBlendMode: "overlay",
        }}
      />

      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="metadata" /> : null}

      {/* CONTENT */}
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-slate-700/70 text-lg mb-1"
          >
            {greeting}, <span className="font-medium text-slate-800/85">{userName}</span>
          </motion.p>

          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
            style={{
              background: "rgba(255, 180, 100, 0.18)",
              border: "1px solid rgba(255, 180, 100, 0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <motion.span
              animate={{ scale: isPlaying ? [1, 1.22, 1] : 1, opacity: isPlaying ? [0.75, 1, 0.75] : 0.85 }}
              transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 h-2 rounded-full"
              style={{ background: "rgba(255, 125, 60, 0.95)" }}
            />
            <span className="text-slate-800/70 text-sm font-medium tracking-wide">TODAY&apos;S FINANCIAL BRIEFING</span>
          </div>

          <div className="text-slate-900/80 text-xl font-semibold tracking-tight">{title}</div>
        </div>

        {/* Waveform */}
        <div className="flex items-center justify-center gap-[2px] h-24 mb-8 px-4">
          {bars.map((bar) => {
            const isActive = bar.p <= progress;
            return (
              <motion.div
                key={bar.i}
                animate={{
                  height: isPlaying
                    ? [bar.baseHeight, bar.baseHeight * 1.55, bar.baseHeight * 0.72, bar.baseHeight]
                    : bar.baseHeight * 0.42,
                  opacity: isActive ? 1 : 0.28,
                }}
                transition={{
                  duration: isPlaying ? 0.55 + (bar.i % 7) * 0.02 : 0.25,
                  repeat: isPlaying ? Infinity : 0,
                  ease: "easeInOut",
                  delay: isPlaying ? bar.i * 0.012 : 0,
                }}
                className="w-[3px] rounded-full"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, rgba(255, 160, 80, 0.92) 0%, rgba(255, 100, 60, 0.84) 100%)"
                    : "rgba(100, 100, 100, 0.28)",
                }}
              />
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mb-8 px-2">
          <Slider
            value={[currentTime]}
            max={totalDuration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between mt-3 text-slate-500/70 text-sm font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, totalDuration - currentTime))}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleMute}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              background: "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)",
            }}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-slate-500" /> : <Volume2 className="h-5 w-5 text-slate-500" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => skip(-15)}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              background: "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)",
            }}
          >
            <RotateCcw className="h-5 w-5 text-slate-500" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            disabled={!audioUrl}
            className="w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, rgba(255, 130, 70, 0.9) 0%, rgba(255, 90, 50, 0.95) 100%)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 8px 24px rgba(255, 100, 50, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.3), inset 0 -2px 2px rgba(0, 0, 0, 0.1)",
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                >
                  <Pause className="h-8 w-8 text-white" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                >
                  <Play className="h-8 w-8 text-white ml-1" fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => skip(30)}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              background: "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)",
            }}
          >
            <FastForward className="h-5 w-5 text-slate-500" />
          </motion.button>

          <div className="w-12" />
        </div>

        {!audioUrl && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-slate-400 text-sm mt-6">
            Audio briefing is being generated...
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}