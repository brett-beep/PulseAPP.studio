import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function AudioPlayer({ audioUrl, title, duration, onComplete, greeting, userName }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration * 60 || 0);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => {
            setTotalDuration(audio.duration);
            setIsLoaded(true);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            onComplete?.();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl, onComplete]);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play();
        }
        setIsPlaying(!isPlaying);
    };

    const skip = (seconds) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, totalDuration));
        }
    };

    const handleSeek = (value) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value[0];
            setCurrentTime(value[0]);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    // Generate waveform bars with more dynamic animation
    const bars = Array.from({ length: 50 }, (_, i) => {
        const progress = currentTime / totalDuration;
        const barProgress = i / 50;
        const isActive = barProgress <= progress;
        const baseHeight = 15 + Math.sin(i * 0.4) * 12 + Math.cos(i * 0.7) * 8;
        return { baseHeight, isActive, index: i };
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onHoverStart={() => setIsHovering(true)}
            onHoverEnd={() => setIsHovering(false)}
            className="relative overflow-hidden rounded-[32px] p-8"
            style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: `
                    0 8px 32px rgba(0, 0, 0, 0.08),
                    inset 0 1px 1px rgba(255, 255, 255, 0.6),
                    inset 0 -1px 1px rgba(0, 0, 0, 0.05)
                `,
            }}
        >
            {/* Animated gradient orbs for liquid effect */}
            <motion.div
                animate={{
                    x: isHovering ? [0, 20, -10, 0] : [0, 10, 0],
                    y: isHovering ? [0, -15, 10, 0] : [0, 5, 0],
                    scale: isPlaying ? [1, 1.1, 1] : 1,
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(255, 180, 100, 0.3) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                }}
            />
            <motion.div
                animate={{
                    x: isHovering ? [0, -15, 20, 0] : [0, -8, 0],
                    y: isHovering ? [0, 20, -10, 0] : [0, -5, 0],
                    scale: isPlaying ? [1, 1.15, 1] : 1,
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(255, 120, 80, 0.25) 0%, transparent 70%)',
                    filter: 'blur(25px)',
                }}
            />
            <motion.div
                animate={{
                    x: isPlaying ? [0, 15, -15, 0] : 0,
                    y: isPlaying ? [0, -10, 10, 0] : 0,
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(255, 200, 150, 0.15) 0%, transparent 60%)',
                    filter: 'blur(30px)',
                }}
            />

            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
            
            {/* Greeting & Title */}
            <div className="relative z-10 text-center mb-8">
                <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-slate-600/80 text-lg mb-1"
                >
                    {greeting}, <span className="font-medium text-slate-700">{userName}</span>
                </motion.p>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
                    style={{
                        background: 'rgba(255, 180, 100, 0.2)',
                        border: '1px solid rgba(255, 180, 100, 0.3)',
                    }}
                >
                    <motion.span 
                        animate={{ scale: isPlaying ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-2 h-2 bg-amber-500 rounded-full" 
                    />
                    <span className="text-amber-700/80 text-sm font-medium tracking-wide">TODAY'S FINANCIAL BRIEFING</span>
                </motion.div>
            </div>

            {/* Waveform Visualization */}
            <div className="relative z-10 flex items-center justify-center gap-[2px] h-24 mb-8 px-4">
                {bars.map((bar, i) => (
                    <motion.div
                        key={i}
                        animate={{ 
                            height: isPlaying 
                                ? [bar.baseHeight, bar.baseHeight * 1.5, bar.baseHeight * 0.7, bar.baseHeight]
                                : bar.baseHeight * 0.4,
                            opacity: bar.isActive ? 1 : 0.35,
                        }}
                        transition={{ 
                            duration: isPlaying ? 0.5 + Math.random() * 0.3 : 0.3,
                            repeat: isPlaying ? Infinity : 0,
                            ease: "easeInOut",
                            delay: isPlaying ? i * 0.02 : 0,
                        }}
                        className="w-[3px] rounded-full transition-colors duration-300"
                        style={{
                            background: bar.isActive 
                                ? 'linear-gradient(180deg, rgba(255, 160, 80, 0.9) 0%, rgba(255, 100, 60, 0.8) 100%)'
                                : 'rgba(100, 100, 100, 0.3)',
                        }}
                    />
                ))}
            </div>

            {/* Progress Bar */}
            <div className="relative z-10 mb-8 px-2">
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
            <div className="relative z-10 flex items-center justify-center gap-3">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleMute}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                    style={{
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.6)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
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
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.6)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
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
                        background: 'linear-gradient(135deg, rgba(255, 130, 70, 0.9) 0%, rgba(255, 90, 50, 0.95) 100%)',
                        border: '2px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: `
                            0 8px 24px rgba(255, 100, 50, 0.35),
                            inset 0 2px 2px rgba(255, 255, 255, 0.3),
                            inset 0 -2px 2px rgba(0, 0, 0, 0.1)
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
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.6)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                    }}
                >
                    <FastForward className="h-5 w-5 text-slate-500" />
                </motion.button>

                <div className="w-12" /> {/* Spacer for symmetry */}
            </div>

            {!audioUrl && (
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative z-10 text-center text-slate-400 text-sm mt-6"
                >
                    Audio briefing is being generated...
                </motion.p>
            )}
        </motion.div>
    );
}