import { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, FastForward, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X, ChevronDown, ChevronUp } from 'lucide-react';

// Marquee with pause: scrolls, waits 2s at start and end
function MarqueeText({ text, className = '' }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        setOverflow(textRef.current.scrollWidth > containerRef.current.clientWidth + 2);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={overflow ? 'inline-block animate-marquee-pause' : 'inline-block'}
      >
        {text}
        {overflow && <span className="pl-12">{text}</span>}
      </span>
    </div>
  );
}

export default function AudioPlayer({ tracks = [], currentTrack, projectName, isPlaying, onPlayPause, onTrackChange }) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [showQueue, setShowQueue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  // Build queue
  const buildQueue = useCallback((sourceTracks, startTrack, shuffle) => {
    if (!sourceTracks?.length) { setPlayQueue([]); setQueueIndex(-1); return; }
    let q = [...sourceTracks];
    if (shuffle) {
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      if (startTrack) {
        const idx = q.findIndex(t => t.id === startTrack.id);
        if (idx > 0) [q[0], q[idx]] = [q[idx], q[0]];
      }
    }
    setPlayQueue(q);
    const idx = startTrack ? q.findIndex(t => t.id === startTrack.id) : 0;
    setQueueIndex(idx !== -1 ? idx : 0);
  }, []);

  useEffect(() => { buildQueue(tracks, currentTrack, isShuffled); }, [tracks, buildQueue, isShuffled, currentTrack?.id]);

  useEffect(() => {
    if (currentTrack && playQueue.length > 0) {
      const idx = playQueue.findIndex(t => t.id === currentTrack.id);
      if (idx !== -1 && idx !== queueIndex) setQueueIndex(idx);
    }
  }, [currentTrack, playQueue]);

  const handleNext = useCallback(() => {
    if (!playQueue.length) return;
    if (repeatMode === 2) { audioRef.current?.play(); return; }
    let next = queueIndex + 1;
    if (next >= playQueue.length) {
      if (repeatMode === 1) next = 0;
      else { onPlayPause(false); return; }
    }
    onTrackChange(playQueue[next]);
  }, [queueIndex, playQueue, repeatMode, onTrackChange, onPlayPause]);

  const handlePrev = useCallback(() => {
    if (!playQueue.length) return;
    if (audioRef.current?.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    let prev = queueIndex - 1;
    if (prev < 0) prev = repeatMode === 1 ? playQueue.length - 1 : 0;
    onTrackChange(playQueue[prev]);
  }, [queueIndex, playQueue, repeatMode, onTrackChange]);

  const handleNextRef = useRef(handleNext);
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setProgress(0); setDuration(0); setIsBuffering(true);
    audio.pause();
    audio.src = currentTrack.url;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onCanPlay = () => setIsBuffering(false);
    const onWait = () => setIsBuffering(true);
    const onPlay = () => setIsBuffering(false);
    const onEnd = () => handleNextRef.current();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('waiting', onWait);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('ended', onEnd);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('waiting', onWait);
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('ended', onEnd);
    };
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && audio.paused) audio.play().catch(() => onPlayPause(false));
    else if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying, currentTrack?.url]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

  const fmt = (t) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const seek = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    setProgress(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  if (!currentTrack) return null;

  const pct = duration ? (progress / duration) * 100 : 0;
  const coverGradient = currentTrack.coverArt
    ? `url(${currentTrack.coverArt})`
    : 'linear-gradient(145deg, #b8ff65, #df5b9c)';

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 select-none">
      <audio ref={audioRef} preload="auto" playsInline />

      {/* Queue panel */}
      {showQueue && (
        <div className="mb-3 rounded-2xl bg-[#1e1e1e] border border-white/10 p-3 shadow-2xl max-h-64 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Queue</span>
            <button onClick={() => setShowQueue(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="overflow-y-auto hide-scrollbar space-y-1">
            {playQueue.map((t, i) => (
              <button key={t.id + i} onClick={() => onTrackChange(t)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${i === queueIndex ? 'bg-white/20 text-white font-semibold' : 'text-white/60 hover:bg-white/10'}`}>
                <div className="truncate">{t.title}</div>
                <div className="truncate opacity-60">{t.artist || t.producer}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-3 rounded-2xl bg-[#1e1e1e] border border-white/10 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>Speed</span><span>{playbackRate.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="2" step="0.05" value={playbackRate}
                onChange={e => setPlaybackRate(parseFloat(e.target.value))} className="w-full accent-white" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsMuted(m => !m)} className="text-white/60 hover:text-white shrink-0">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => { setVolume(parseFloat(e.target.value)); if (parseFloat(e.target.value) > 0) setIsMuted(false); }}
                className="w-full accent-white" />
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="rounded-3xl bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl overflow-hidden border border-white/10">

        {/* Cover art — full width */}
        {!collapsed && (
          <div
            className="w-full aspect-square bg-cover bg-center relative"
            style={{ backgroundImage: coverGradient }}
          >
            {/* Collapse button */}
            <button onClick={() => setCollapsed(true)}
              className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 backdrop-blur-sm">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Info + controls */}
        <div className="p-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <MarqueeText text={currentTrack.title} className="text-sm font-bold text-white" />
              <MarqueeText
                text={isBuffering && isPlaying ? 'Buffering…' : (projectName || currentTrack.artist || currentTrack.uploader?.name || 'Starlight Station')}
                className="text-xs text-white/50 mt-0.5"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {collapsed && (
                <button onClick={() => setCollapsed(false)}
                  className="h-6 w-6 grid place-items-center rounded-full text-white/50 hover:text-white">
                  <ChevronUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div
            ref={progressBarRef}
            onClick={seek}
            className="relative h-1 w-full rounded-full bg-white/20 cursor-pointer mb-1 group"
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            <div className="absolute inset-y-0 rounded-full bg-white/0 group-hover:scale-y-150 transition-transform" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/40 mb-4 font-mono">
            <span>{fmt(progress)}</span>
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>

          {/* Main controls */}
          <div className="flex items-center justify-between text-white">
            <button onClick={() => setIsShuffled(s => { buildQueue(tracks, currentTrack, !s); return !s; })}
              className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${isShuffled ? 'text-white' : 'text-white/30 hover:text-white/70'}`}>
              <Shuffle className="h-4 w-4" />
            </button>

            <button onClick={handlePrev} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10">
              <SkipBack className="h-5 w-5 fill-current" />
            </button>

            <button onClick={() => onPlayPause(!isPlaying)}
              className="h-12 w-12 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
              {isBuffering && isPlaying
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : isPlaying
                  ? <Pause className="h-5 w-5 fill-current" />
                  : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>

            <button onClick={handleNext} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10">
              <SkipForward className="h-5 w-5 fill-current" />
            </button>

            <button onClick={() => setRepeatMode(m => (m + 1) % 3)}
              className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${repeatMode > 0 ? 'text-white' : 'text-white/30 hover:text-white/70'}`}>
              {repeatMode === 2 ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>

          {/* Secondary controls */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <button onClick={() => { setShowSettings(s => !s); setShowQueue(false); }}
              className={`h-7 w-7 grid place-items-center rounded-full text-xs transition-colors ${showSettings ? 'text-white bg-white/20' : 'text-white/40 hover:text-white'}`}>
              <FastForward className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setShowQueue(q => !q); setShowSettings(false); }}
              className={`relative h-7 w-7 grid place-items-center rounded-full transition-colors ${showQueue ? 'text-white bg-white/20' : 'text-white/40 hover:text-white'}`}>
              <ListMusic className="h-3.5 w-3.5" />
              {playQueue.length > 0 && (
                <span className="absolute -right-1 -top-1 h-3.5 min-w-3.5 grid place-items-center rounded-full bg-white text-black text-[8px] font-bold px-0.5">
                  {playQueue.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsMuted(m => !m)} className="text-white/40 hover:text-white">
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => { setVolume(parseFloat(e.target.value)); if (parseFloat(e.target.value) > 0) setIsMuted(false); }}
                className="w-16 accent-white h-1" />
            </div>
            <button onClick={() => onPlayPause(false)}
              className="h-7 w-7 grid place-items-center rounded-full text-white/40 hover:text-red-400 transition-colors" title="Close player">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
