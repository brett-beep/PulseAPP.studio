import React, { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react"

export function AudioPlayerPreview() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const formatTime = (time) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current) return
    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("Audio playback error:", error)
    }
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setIsLoaded(true)
    }
  }

  const handleProgressClick = (e) => {
    if (!audioRef.current || !isLoaded) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const skip = (seconds) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(duration, audioRef.current.currentTime + seconds)
    )
  }

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.load()
    }
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="relative w-full max-w-md">
      <audio
        ref={audioRef}
        src="/audio/briefing.mp3"
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onCanPlay={() => setIsLoaded(true)}
      />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden rounded-sm border border-[oklch(0.25_0.01_260)] bg-[oklch(0.14_0.01_260)]"
      >
        {/* Header */}
        <div className="border-b border-[oklch(0.25_0.01_260)] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase text-[oklch(0.78_0.12_85)]">
                Sample Briefing
              </p>
              <p className="mt-1 font-serif text-lg text-foreground">
                Thursday, January 29
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isPlaying && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.78_0.12_85)] opacity-75" />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isPlaying ? 'bg-[oklch(0.78_0.12_85)]' : 'bg-muted-foreground/50'}`} />
              </span>
              <span className="text-xs text-muted-foreground">
                {isPlaying ? 'Playing' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Waveform visualization */}
        <div className="px-6 py-8">
          <div className="flex h-20 items-end justify-center gap-[3px]">
            {[...Array(48)].map((_, i) => {
              const baseHeight = Math.sin(i * 0.3) * 30 + 40
              const randomVariation = Math.random() * 20
              return (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-[oklch(0.78_0.12_85)]"
                  initial={{ height: 8, opacity: 0.3 }}
                  animate={
                    isPlaying
                      ? {
                          height: [baseHeight * 0.3, baseHeight + randomVariation, baseHeight * 0.5],
                          opacity: [0.4, 0.9, 0.5],
                        }
                      : { 
                          height: Math.max(8, baseHeight * 0.4),
                          opacity: 0.3 
                        }
                  }
                  transition={{
                    duration: isPlaying ? 0.5 + Math.random() * 0.3 : 0.3,
                    repeat: isPlaying ? Infinity : 0,
                    delay: i * 0.02,
                    ease: "easeInOut",
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Progress section */}
        <div className="px-6 pb-6">
          {/* Progress bar */}
          <div
            className="group h-1 w-full cursor-pointer rounded-full bg-[oklch(0.25_0.01_260)]"
            onClick={handleProgressClick}
          >
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[oklch(0.78_0.12_85)] to-[oklch(0.70_0.10_60)] transition-all duration-100"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-[oklch(0.78_0.12_85)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          
          {/* Time display */}
          <div className="mt-3 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="border-t border-[oklch(0.25_0.01_260)] px-6 py-5">
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => skip(-15)}
              className="group flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs">15</span>
            </button>
            
            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.78_0.12_85)] text-[oklch(0.12_0.01_260)] shadow-lg shadow-[oklch(0.78_0.12_85_/_0.2)] transition-all hover:bg-[oklch(0.85_0.12_85)] hover:shadow-xl hover:shadow-[oklch(0.78_0.12_85_/_0.3)]"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
              )}
            </button>
            
            <button
              type="button"
              onClick={() => skip(15)}
              className="group flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="text-xs">15</span>
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Topics preview */}
        <div className="border-t border-[oklch(0.25_0.01_260)] px-6 py-4">
          <p className="text-xs text-muted-foreground mb-3">Today&apos;s topics</p>
          <div className="flex flex-wrap gap-2">
            {['Trump Tariffs', 'Fed Rates', 'Microsoft', 'Meta Earnings'].map((topic) => (
              <span
                key={topic}
                className="rounded-sm bg-[oklch(0.20_0.01_260)] px-3 py-1.5 text-xs text-foreground/80"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Subtle glow effect */}
      <div className="absolute -inset-1 -z-10 rounded-lg bg-[oklch(0.78_0.12_85_/_0.05)] blur-2xl" />
    </div>
  )
}
