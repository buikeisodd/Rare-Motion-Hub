import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Activity, FastForward, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';

// Custom Marquee Component
const MarqueeText = ({ text, className }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div 
        ref={textRef} 
        className={`inline-block ${isOverflowing ? 'animate-marquee pr-8' : ''}`}
      >
        {text}
        {isOverflowing && <span className="ml-8">{text}</span>}
      </div>
    </div>
  );
};

export default function AudioPlayer({ tracks = [], currentTrack, projectName, isPlaying, onPlayPause, onTrackChange }) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  // Playback modes: 0 = None, 1 = All, 2 = One
  const [repeatMode, setRepeatMode] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  // Build Queue
  const buildQueue = useCallback((sourceTracks, startTrack, shuffle) => {
    if (!sourceTracks || sourceTracks.length === 0) {
      setPlayQueue([]);
      setQueueIndex(-1);
      return;
    }
    
    let newQueue = [...sourceTracks];
    if (shuffle) {
      // Fisher-Yates shuffle
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
      }
      // Ensure current track is first
      if (startTrack) {
        const idx = newQueue.findIndex(t => t.id === startTrack.id);
        if (idx > 0) {
          [newQueue[0], newQueue[idx]] = [newQueue[idx], newQueue[0]];
        }
      }
    }
    setPlayQueue(newQueue);
    if (startTrack) {
      const idx = newQueue.findIndex(t => t.id === startTrack.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      setQueueIndex(0);
    }
  }, []);

  // Initialize/Update Queue
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      buildQueue(tracks, currentTrack, isShuffled);
    }
  }, [tracks]); // Only rebuild fully if tracks change

  // Sync queueIndex when currentTrack changes externally
  useEffect(() => {
    if (currentTrack && playQueue.length > 0) {
      const idx = playQueue.findIndex(t => t.id === currentTrack.id);
      if (idx !== -1 && idx !== queueIndex) {
        setQueueIndex(idx);
      }
    }
  }, [currentTrack, playQueue]);

  // Handle Shuffle Toggle
  const toggleShuffle = () => {
    const newShuffle = !isShuffled;
    setIsShuffled(newShuffle);
    buildQueue(tracks, currentTrack, newShuffle);
  };

  // Handle Repeat Toggle
  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev + 1) % 3);
  };

  const effectiveRate = useMemo(() => {
    const pitchRatio = Math.pow(2, pitchShift / 12);
    return Math.max(0.25, Math.min(3, playbackRate * pitchRatio));
  }, [pitchShift, playbackRate]);

  // Next Track Logic
  const handleNext = useCallback(() => {
    if (!playQueue.length) return;
    
    if (repeatMode === 2) {
      // Repeat One
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    let nextIdx = queueIndex + 1;
    if (nextIdx >= playQueue.length) {
      if (repeatMode === 1) {
        nextIdx = 0; // Repeat All
      } else {
        // End of queue, stop playback
        onPlayPause(false);
        return;
      }
    }
    onTrackChange(playQueue[nextIdx]);
  }, [queueIndex, playQueue, repeatMode, onTrackChange, onPlayPause]);

  // Prev Track Logic
  const handlePrev = useCallback(() => {
    if (!playQueue.length) return;
    
    // If we're more than 3 seconds in, restart track instead of going back
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      if (repeatMode === 1) {
        prevIdx = playQueue.length - 1; // Wrap around
      } else {
        prevIdx = 0; // Stick to beginning
      }
    }
    onTrackChange(playQueue[prevIdx]);
  }, [queueIndex, playQueue, repeatMode, onTrackChange]);

  // Use a ref for handleNext so it can be used in the event listener without triggering effect cleanup
  const handleNextRef = useRef(handleNext);
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setProgress(0);
    setDuration(0);
    setIsBuffering(true);
    audio.pause();
    audio.src = currentTrack.url;
    audio.preload = 'auto';
    
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onCanPlay = () => setIsBuffering(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => handleNextRef.current();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.url]);

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && audio.paused) {
      audio.play().catch((err) => {
        console.error('Playback failed:', err);
        onPlayPause(false);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.url]);

  // Handle Playback Rate & Pitch
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = effectiveRate;
    audio.preservesPitch = pitchShift === 0;
    audio.mozPreservesPitch = pitchShift === 0;
    audio.webkitPreservesPitch = pitchShift === 0;
  }, [effectiveRate, pitchShift]);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Interactive Visualizer Scrubber
  const handleProgressBarInteraction = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    const newTime = percent * duration;
    setProgress(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const handlePointerDown = (e) => {
    progressBarRef.current.setPointerCapture(e.pointerId);
    handleProgressBarInteraction(e);
  };

  const handlePointerMove = (e) => {
    if (progressBarRef.current.hasPointerCapture(e.pointerId)) {
      handleProgressBarInteraction(e);
    }
  };

  const handlePointerUp = (e) => {
    progressBarRef.current.releasePointerCapture(e.pointerId);
  };

  const formatTime = (time) => {
    if (Number.isNaN(time) || !Number.isFinite(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  const hasNext = repeatMode === 1 || repeatMode === 2 || queueIndex < playQueue.length - 1;
  const hasPrev = true; // Prev always active now (either restarts track or goes to prev)

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center justify-end px-3 sm:bottom-6 sm:px-4 pointer-events-none">
      <audio ref={audioRef} preload="auto" playsInline />
      
      {/* Settings Panel */}
      {showControls && (
        <div className="pointer-events-auto w-[min(92vw,30rem)] mb-4 rounded-[1.25rem] bg-[#292929]/95 p-4 shadow-2xl backdrop-blur-xl animate-slide-up sm:p-5">
          <button onClick={() => setShowControls(false)} className="absolute right-4 top-4 text-secondary-label hover:text-primary-label" aria-label="Close audio controls">
            <X className="h-5 w-5" />
          </button>
          <div className="grid gap-6 pr-8 sm:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-secondary-label">
                <span className="flex items-center gap-2"><FastForward className="h-4 w-4" /> Speed</span>
                <span>{playbackRate.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="2" step="0.05" value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} className="w-full accent-white" />
              <button onClick={() => setPlaybackRate(1)} className="mt-2 text-xs text-secondary-label hover:text-primary-label">Reset speed</button>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-secondary-label">
                <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Pitch</span>
                <span>{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
              </div>
              <input type="range" min="-7" max="7" step="1" value={pitchShift} onChange={(e) => setPitchShift(parseInt(e.target.value, 10))} className="w-full accent-white" />
              <p className="mt-2 text-xs text-secondary-label">Pitch uses native playback for cleaner sound.</p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Viewer Panel */}
      {showQueue && (
        <div className="pointer-events-auto w-[min(92vw,30rem)] mb-4 rounded-[1.25rem] bg-[#292929]/95 p-4 shadow-2xl backdrop-blur-xl animate-slide-up max-h-80 flex flex-col sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-primary-label">Queue</h3>
            <button onClick={() => setShowQueue(false)} className="text-secondary-label hover:text-primary-label" aria-label="Close queue">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 hide-scrollbar">
            {playQueue.map((track, idx) => (
              <button 
                key={`${track.id}-${idx}`} 
                onClick={() => onTrackChange(track)}
                className={`w-full text-left p-2 rounded-xl transition-colors ${idx === queueIndex ? 'bg-highlight text-primary-label' : 'text-secondary-label hover:bg-shading'}`}
              >
                <div className="truncate text-sm font-semibold">{track.title}</div>
                <div className="truncate text-xs opacity-75">{track.artist || track.producer}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Player Bar */}
      <div className="pointer-events-auto grid w-[min(94vw,58rem)] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 rounded-[1.5rem] bg-[#2b2b2b]/95 px-3 py-3 shadow-2xl backdrop-blur-xl sm:flex sm:gap-4 sm:rounded-full sm:px-4">
        
        {/* Track Info */}
        <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:gap-4">
          <div className="h-12 w-12 shrink-0 rounded-full bg-[linear-gradient(145deg,#b8ff65,#df5b9c)] sm:h-14 sm:w-14" />
          <div className="min-w-0 flex flex-col justify-center">
            <MarqueeText text={currentTrack.title} className="text-base font-semibold w-full" />
            <MarqueeText 
              text={isBuffering && isPlaying ? 'Buffering...' : (projectName || currentTrack.artist || currentTrack.uploader?.name || 'untitled')} 
              className="text-sm text-secondary-label w-full" 
            />
          </div>
        </div>

        {/* Interactive Visualizer Scrubber & Time */}
        <div className="hidden h-14 flex-1 items-center gap-4 md:flex">
          <div 
            ref={progressBarRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex h-12 flex-1 items-end gap-[3px] overflow-hidden cursor-pointer group"
          >
            {Array.from({ length: 44 }).map((_, index) => {
              const barPercent = index / 44;
              const currentPercent = duration ? progress / duration : 0;
              const isPlayed = barPercent <= currentPercent;
              return (
                <span 
                  key={index} 
                  className={`flex-1 rounded-full transition-colors duration-100 ${isPlayed ? 'bg-[linear-gradient(180deg,#b8ff65,#df5b9c)] opacity-90' : 'bg-primary-label/20 group-hover:bg-primary-label/30'}`} 
                  style={{ height: `${18 + ((index * 17) % 30)}px` }} 
                />
              );
            })}
          </div>
          <div className="shrink-0 font-mono text-sm text-primary-label">
            {formatTime(progress)} / {formatTime(duration)}
          </div>
        </div>

        {/* Mobile Scrubber */}
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={progress} 
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setProgress(val);
            if (audioRef.current) audioRef.current.currentTime = val;
          }} 
          className="col-span-2 h-1 w-full accent-[#df5b9c] sm:hidden" 
          aria-label="Track progress" 
        />

        {/* Controls */}
        <div className="flex items-center justify-end gap-2 text-primary-label sm:gap-3">
          
          <button onClick={toggleShuffle} className={`hidden md:block transition-colors ${isShuffled ? 'text-[#b8ff65]' : 'text-secondary-label hover:text-primary-label'}`} aria-label="Shuffle">
            <Shuffle className="h-5 w-5" />
          </button>
          
          <button onClick={handlePrev} disabled={!hasPrev} className="disabled:opacity-30" aria-label="Previous track">
            <SkipBack className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
          </button>
          
          <button onClick={() => onPlayPause(!isPlaying)} className="grid h-10 w-10 place-items-center rounded-full bg-primary-label text-primary-background sm:h-12 sm:w-12 transition-transform active:scale-95" aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="h-5 w-5 fill-current sm:h-6 sm:w-6" /> : <Play className="h-5 w-5 fill-current translate-x-0.5 sm:h-6 sm:w-6" />}
          </button>
          
          <button onClick={handleNext} disabled={!hasNext} className="disabled:opacity-30" aria-label="Next track">
            <SkipForward className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
          </button>
          
          <button onClick={toggleRepeat} className={`hidden md:block transition-colors ${repeatMode > 0 ? 'text-[#b8ff65]' : 'text-secondary-label hover:text-primary-label'}`} aria-label="Repeat">
            {repeatMode === 2 ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>

          <button onClick={() => { setShowQueue(!showQueue); setShowControls(false); }} className={`transition-colors ${showQueue ? 'text-primary-label' : 'text-secondary-label hover:text-primary-label'}`} aria-label="Queue">
            <ListMusic className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          
          <button onClick={() => { setShowControls(!showControls); setShowQueue(false); }} className={`transition-colors ${showControls ? 'text-primary-label' : 'text-secondary-label hover:text-primary-label'}`} aria-label="Audio controls">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          
          <div className="flex items-center gap-2 group">
            <button onClick={toggleMute} className="text-secondary-label hover:text-primary-label" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" /> : <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={isMuted ? 0 : volume} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (val > 0 && isMuted) setIsMuted(false);
              }} 
              className="w-16 sm:w-20 h-1 accent-[#df5b9c] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:block" 
              aria-label="Volume"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
