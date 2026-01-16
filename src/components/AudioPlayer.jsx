import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function AudioPlayer({ audioUrl, title, duration, onComplete }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration * 60 || 0);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

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

    // Generate waveform bars
    const bars = Array.from({ length: 40 }, (_, i) => {
        const progress = currentTime / totalDuration;
        const barProgress = i / 40;
        const isActive = barProgress <= progress;
        const height = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10;
        return { height, isActive };
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl"
        >
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
            
            <div className="text-center mb-8">
                <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 rounded-full mb-4"
                >
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-amber-400 text-sm font-medium tracking-wide">TODAY'S BRIEFING</span>
                </motion.div>
                <h2 className="text-white text-2xl font-light tracking-tight">{title}</h2>
            </div>

            {/* Waveform Visualization */}
            <div className="flex items-center justify-center gap-[3px] h-20 mb-8">
                {bars.map((bar, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 4 }}
                        animate={{ 
                            height: isPlaying ? bar.height : 8,
                            opacity: bar.isActive ? 1 : 0.3
                        }}
                        transition={{ 
                            duration: 0.15,
                            delay: isPlaying ? i * 0.01 : 0
                        }}
                        className={`w-1 rounded-full transition-colors duration-300 ${
                            bar.isActive ? 'bg-gradient-to-t from-amber-500 to-amber-300' : 'bg-slate-600'
                        }`}
                    />
                ))}
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <Slider
                    value={[currentTime]}
                    max={totalDuration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    className="cursor-pointer"
                />
                <div className="flex justify-between mt-2 text-slate-400 text-sm font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(totalDuration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full"
                >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => skip(-15)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full"
                >
                    <RotateCcw className="h-5 w-5" />
                </Button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={togglePlay}
                    disabled={!audioUrl}
                    className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <AnimatePresence mode="wait">
                        {isPlaying ? (
                            <motion.div
                                key="pause"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Pause className="h-7 w-7 text-slate-900" fill="currentColor" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="play"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Play className="h-7 w-7 text-slate-900 ml-1" fill="currentColor" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => skip(30)}
                    className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full"
                >
                    <FastForward className="h-5 w-5" />
                </Button>

                <div className="w-10" /> {/* Spacer for symmetry */}
            </div>

            {!audioUrl && (
                <p className="text-center text-slate-500 text-sm mt-4">
                    Audio briefing is being generated...
                </p>
            )}
        </motion.div>
    );
}