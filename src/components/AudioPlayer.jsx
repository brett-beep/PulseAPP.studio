// UPDATED AudioPlayer.jsx - Add countdown timer and disabled state

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Loader2, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export default function AudioPlayer({ 
  audioUrl, 
  duration, 
  greeting, 
  userName, 
  currentDate, 
  onGenerate, 
  isGenerating, 
  status,
  // NEW PROPS:
  canGenerateNew = true,
  timeUntilNextBriefing = null,
  briefingCount = 0
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef(null);

  // Log component state
  console.log('🎵 [AudioPlayer Component] Rendered with audioUrl:', audioUrl);
  console.log('🎵 [AudioPlayer Component] isGenerating:', isGenerating);
  console.log('🎵 [AudioPlayer Component] status:', status);
  console.log('🎵 [AudioPlayer Component] canGenerateNew:', canGenerateNew);
  console.log('🎵 [AudioPlayer Component] timeUntilNextBriefing:', timeUntilNextBriefing);
  console.log('🎵 [AudioPlayer Component] briefingCount:', briefingCount);

  // Setup audio element
  useEffect(() => {
    if (!audioRef.current) {
      console.log('🎵 [Audio Element] No audio ref');
      return;
    }

    const audio = audioRef.current;
    console.log('🎵 [Audio Element] Setting up event listeners for:', audioUrl);

    const handleLoadedMetadata = () => {
      console.log('🎵 [Audio Element] Metadata loaded, duration:', audio.duration);
      setAudioDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      console.log('🎵 [Audio Element] Playback ended');
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      console.log('🎵 [Audio Element] Can play');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [audioUrl]);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (value) => {
    if (!audioRef.current) return;
    const newTime = (value[0] / 100) * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Determine button state
  const isButtonDisabled = isGenerating || !canGenerateNew;
  const buttonText = isGenerating 
    ? "Generating..." 
    : briefingCount >= 3 
    ? "Daily Limit Reached"
    : audioUrl 
    ? "Generate New Update" 
    : "Generate Briefing";

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{currentDate}</p>
        </div>
        
        {/* Briefing count indicator */}
        <div className="text-right">
          <p className="text-xs text-slate-400">Today's briefings</p>
          <p className="text-lg font-semibold text-slate-700">{briefingCount} / 3</p>
        </div>
      </div>

      {/* Audio Player or Generate Button */}
      {audioUrl ? (
        <div className="space-y-6">
          <audio ref={audioRef} src={audioUrl} preload="metadata" />
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[progress]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="cursor-pointer"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRestart}
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              
              <Button
                onClick={togglePlayPause}
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full w-14 h-14"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>

              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500">Speed:</span>
                <div className="flex gap-1">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate New Update Button */}
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={onGenerate}
                disabled={isButtonDisabled}
                variant="outline"
                className={`${
                  isButtonDisabled 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                } border-slate-200`}
              >
                {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {buttonText}
              </Button>
              
              {/* Countdown Timer */}
              {timeUntilNextBriefing && timeUntilNextBriefing !== "Daily limit reached" && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Next update in {timeUntilNextBriefing}</span>
                </div>
              )}
              
              {timeUntilNextBriefing === "Daily limit reached" && (
                <div className="text-xs text-slate-500">
                  Resets at midnight
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Headphones className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {briefingCount === 0 ? "Ready for your first briefing?" : "Ready for an update?"}
            </h2>
            <p className="text-slate-600 text-sm">
              {briefingCount === 0 
                ? "Generate your personalized investment briefing" 
                : "Get the latest market updates and news"}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={onGenerate}
              disabled={isButtonDisabled}
              size="lg"
              className={`${
                isButtonDisabled
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
              } text-white px-8`}
            >
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {buttonText}
            </Button>

            {/* Countdown Timer for initial generation */}
            {timeUntilNextBriefing && timeUntilNextBriefing !== "Daily limit reached" && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                <span>Next briefing available in {timeUntilNextBriefing}</span>
              </div>
            )}
            
            {timeUntilNextBriefing === "Daily limit reached" && (
              <div className="text-xs text-slate-500">
                You've reached your daily limit (3 briefings). Resets at midnight.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}