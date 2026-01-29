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
        className="relative mx-auto max-w-md"
      >
        {/* Glass card */}
        <div className="glass-card-strong rounded-3xl p-8 glow-primary">
          {/* Greeting */}
          <div className="mb-8 text-center">
            <p className="font-magnolia text-base text-muted-foreground">Good morning, Alex.</p>
            <p className="mt-1 text-2xl text-foreground" style={{ fontStyle: 'normal' }}>
              Here&apos;s your briefing this morning...
            </p>
          </div>

          {/* Waveform visualization */}
          <div className="mb-8 flex h-20 items-center justify-center gap-1">
            {[...Array(28)].map((_, i) => {
              const baseHeight = Math.sin(i * 0.4) * 15 + 25
              return (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-primary to-accent"
                  animate={
                    isPlaying
                      ? {
                          height: [
                            baseHeight * 0.6,
                            baseHeight * 1.8,
                            baseHeight * 0.6,
                          ],
                        }
                      : { height: 20 }
                  }
                  transition={{
                    duration: 1.2,
                    repeat: isPlaying ? Infinity : 0,
                    delay: i * 0.04,
                    ease: "easeInOut",
                  }}
                />
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div
              className="h-2 w-full cursor-pointer overflow-hidden rounded-full bg-muted/50 glass-border"
              onClick={handleProgressClick}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-sm text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => skip(-10)}
              className="text-muted-foreground transition-all hover:text-foreground hover:scale-110"
            >
              <SkipBack className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl glow-primary transition-all hover:scale-105 hover:shadow-2xl"
            >
              {isPlaying ? (
                <Pause className="h-7 w-7" fill="currentColor" />
              ) : (
                <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={() => skip(10)}
              className="text-muted-foreground transition-all hover:text-foreground hover:scale-110"
            >
              <SkipForward className="h-6 w-6" />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div
              className="h-2 w-24 cursor-pointer rounded-full bg-muted/50 glass-border"
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
        <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 to-accent/25 opacity-60 blur-3xl" />
      </motion.div>
    </motion.div>
  )
}
