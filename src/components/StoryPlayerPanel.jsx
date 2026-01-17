import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function StoryPlayerPanel({ story, isOpen, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when panel closes
      setIsGenerating(false);
      setAudioUrl(null);
      setIsPlaying(false);
      setError(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const generateAudio = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('generateStoryAudio', {
        title: story.title,
        content: story.what_happened || story.summary,
        source: story.outlet || story.source,
      });

      if (response?.data?.audioUrl) {
        setAudioUrl(response.data.audioUrl);
        // Auto-play after generation
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
          }
        }, 100);
      } else {
        setError('Failed to generate audio');
      }
    } catch (err) {
      console.error('Error generating audio:', err);
      setError(err.message || 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  };

  if (!story) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white shadow-2xl z-50 overflow-hidden"
          >
            {/* Blurred background image */}
            {story.image_url && (
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url(${story.image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(20px)',
                }}
              />
            )}

            {/* Content */}
            <div className="relative h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-slate-200">
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5 text-slate-600" />
                </button>
                <div className="pr-12">
                  <div className="text-xs text-slate-500 mb-2">
                    {story.outlet || story.source} • {story.date || 'Today'}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight">
                    {story.title}
                  </h2>
                </div>
              </div>

              {/* Main content area */}
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {!audioUrl && !isGenerating && (
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: '#FA8072' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateAudio}
                    className="w-24 h-24 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center transition-all"
                    aria-label="Generate audio briefing"
                  >
                    <Play className="h-10 w-10 text-white ml-1" fill="currentColor" />
                  </motion.button>
                )}

                {isGenerating && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center">
                      <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                    </div>
                    <p className="text-slate-600 text-sm flex items-center gap-2">
                      Generating audio briefing
                      <span className="inline-flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay: i * 0.2,
                            }}
                          >
                            .
                          </motion.span>
                        ))}
                      </span>
                    </p>
                  </div>
                )}

                {audioUrl && (
                  <div className="flex flex-col items-center gap-6">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlayPause}
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg flex items-center justify-center transition-all"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="h-10 w-10 text-white" fill="currentColor" />
                      ) : (
                        <Play className="h-10 w-10 text-white ml-1" fill="currentColor" />
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleReplay}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Replay
                    </motion.button>
                  </div>
                )}

                {/* Story content preview */}
                {(story.what_happened || story.summary) && (
                  <div className="mt-8 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 max-w-md">
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {story.what_happened || story.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}