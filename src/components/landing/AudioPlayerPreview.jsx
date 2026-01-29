import React, { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"

export function AudioPlayerPreview() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)

  const formatTime = (time) => {
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
    }
  }

  const handleProgressClick = (e) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeClick = (e) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newVolume = Math.max(0, Math.min(1, clickX / rect.width))
    audioRef.current.volume = newVolume
    setVolume(newVolume)
  }

  const skip = (seconds) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(duration, audioRef.current.currentTime + seconds)
    )
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
      className="relative"
    >
      <audio
        ref={audioRef}
        src="/audio/briefing.mp3"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative mx-auto max-w-sm"
      >
        {/* Glass card */}
        <div className="rounded-3xl bg-card/80 p-6 shadow-xl backdrop-blur-sm border border-border/50">
          {/* Greeting */}
          <div className="mb-6 text-center">
            <p className="font-magnolia text-sm text-muted-foreground">Good morning, Alex.</p>
            <p className="mt-1 font-magnolia text-xl text-card-foreground">
              Here&apos;s your briefing this morning
            </p>
          </div>

          {/* Waveform visualization */}
          <div className="mb-6 flex h-16 items-center justify-center gap-1">
            {[...Array(24)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-primary/60"
                animate={
                  isPlaying
                    ? {
                        height: [
                          Math.random() * 20 + 10,
                          Math.random() * 40 + 20,
                          Math.random() * 20 + 10,
                        ],
                      }
                    : { height: 16 }
                }
                transition={{
                  duration: 0.8,
                  repeat: isPlaying ? Infinity : 0,
                  delay: i * 0.03,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div
              className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-muted"
              onClick={handleProgressClick}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => skip(-10)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" fill="currentColor" />
              ) : (
                <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={() => skip(10)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div
              className="h-1.5 w-20 cursor-pointer rounded-full bg-muted"
              onClick={handleVolumeClick}
            >
              <div
                className="h-full rounded-full bg-muted-foreground/50 transition-all"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Decorative glow */}
        <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 to-accent/20 opacity-50 blur-2xl" />
      </motion.div>
    </motion.div>
  )
}
