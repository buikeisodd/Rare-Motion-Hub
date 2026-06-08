import { useEffect, useRef, useState, useCallback } from 'react';
import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X, ChevronDown, ChevronUp } from 'lucide-react';

// Marquee with 2s pause at each end
function MarqueeText({ text, className = '' }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current)
        setOverflow(textRef.current.scrollWidth > containerRef.current.clientWidth + 2);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);
  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={textRef} className={overflow ? 'inline-block animate-marquee-pause' : 'inline-block'}>
        {text}{overflow && <span className="pl-12">{text}</span>}
      </span>
    </div>
  );
}

// Draggable progress bar — pointer capture so drag works outside the element
function ProgressBar({ progress, duration, onSeek, className = '' }) {
  const barRef = useRef(null);
  const dragging = useRef(false);
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;

  const calc = (e) => {
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };
  const onDown = (e) => {
    dragging.current = true;
    barRef.current.setPointerCapture(e.pointerId);
    onSeek(calc(e));
  };
  const onMove = (e) => { if (dragging.current) onSeek(calc(e)); };
  const onUp = (e) => { dragging.current = false; barRef.current.releasePointerCapture(e.pointerId); };

  return (
    <div
      ref={barRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className={`relative cursor-pointer rounded-full bg-white/20 group ${className}`}
      style={{ touchAction: 'none' }}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-none" style={{ width: `${pct}%` }} />
      {/* Thumb dot */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

// Shared queue panel
function QueuePanel({ playQueue, queueIndex, onTrackChange, onClose }) {
  return (
    <div className="rounded-2xl bg-[#1e1e1e] border border-white/10 p-3 shadow-2xl max-h-56 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Queue · {playQueue.length}</span>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="overflow-y-auto hide-scrollbar space-y-0.5">
        {playQueue.length === 0
          ? <p className="text-xs text-white/30 px-2 py-4 text-center">No tracks in queue</p>
          : playQueue.map((t, i) => (
            <button key={t.id + i} onClick={() => onTrackChange(t)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${i === queueIndex ? 'bg-white/20 text-white font-semibold' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}>
              <div className="truncate">{t.title}</div>
              <div className="truncate text-[10px] opacity-60">{t.artist || t.producer}</div>
            </button>
          ))
        }
      </div>
    </div>
  );
}

export default function AudioPlayer({ tracks = [], currentTrack, projectName, isPlaying, onPlayPause, onTrackChange, cardModal = false }) {
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
  const [collapsed, setCollapsed] = useState(false);
  const audioRef = useRef(null);

  const buildQueue = useCallback((src, startTrack, shuffle) => {
    if (!src?.length) { setPlayQueue([]); setQueueIndex(-1); return; }
    let q = [...src];
    if (shuffle) {
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      if (startTrack) {
        const si = q.findIndex(t => t.id === startTrack.id);
        if (si > 0) [q[0], q[si]] = [q[si], q[0]];
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
    if (next >= playQueue.length) { if (repeatMode === 1) next = 0; else { onPlayPause(false); return; } }
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setProgress(0); setDuration(0); setIsBuffering(true);
    audio.pause(); audio.src = currentTrack.url;
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
      ['timeupdate','loadedmetadata','canplay','waiting','playing','ended'].forEach((ev, i) =>
        audio.removeEventListener(ev, [onTime,onMeta,onCanPlay,onWait,onPlay,onEnd][i])
      );
    };
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current; if (!audio) return;
    if (isPlaying && audio.paused) audio.play().catch(() => onPlayPause(false));
    else if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying, currentTrack?.url]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

  const seek = (t) => { setProgress(t); if (audioRef.current) audioRef.current.currentTime = t; };
  const fmt = (t) => { if (!isFinite(t)) return '0:00'; return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`; };
  const toggleShuffle = () => { const next = !isShuffled; setIsShuffled(next); buildQueue(tracks, currentTrack, next); };

  if (!currentTrack) return null;

  const coverStyle = currentTrack.coverArt
    ? { backgroundImage: `url(${currentTrack.coverArt})` }
    : { background: 'linear-gradient(145deg,#b8ff65,#df5b9c)' };

  // ── BOTTOM BAR (all pages except insights) ───────────────────────────
  if (!cardModal) return (
    <div className="fixed inset-x-0 bottom-0 z-50 select-none border-t border-white/10 bg-[#1c1c1e]/95 backdrop-blur-xl">
      <audio ref={audioRef} preload="auto" playsInline />

      {/* Queue panel — pops above the bar */}
      {showQueue && (
        <div className="absolute bottom-full right-6 mb-3 w-72">
          <QueuePanel playQueue={playQueue} queueIndex={queueIndex} onTrackChange={t => { onTrackChange(t); setShowQueue(false); }} onClose={() => setShowQueue(false)} />
        </div>
      )}

      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        {/* Cover */}
        <div className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center" style={coverStyle} />
        {/* Title */}
        <div className="w-40 min-w-0 shrink-0">
          <MarqueeText text={currentTrack.title} className="text-sm font-semibold text-white" />
          <MarqueeText text={projectName || currentTrack.artist || 'Starlight Station'} className="text-xs text-white/50" />
        </div>
        {/* Draggable progress */}
        <div className="flex flex-1 items-center gap-3">
          <span className="text-[10px] font-mono text-white/40 w-8 text-right shrink-0">{fmt(progress)}</span>
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="h-1.5 flex-1" />
          <span className="text-[10px] font-mono text-white/40 w-10 shrink-0">-{fmt(Math.max(0, duration - progress))}</span>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1.5 text-white shrink-0">
          <button onClick={toggleShuffle} className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${isShuffled ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={handlePrev} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10">
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button onClick={() => onPlayPause(!isPlaying)} className="h-10 w-10 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
            {isBuffering && isPlaying
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>
          <button onClick={handleNext} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10">
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
          <button onClick={() => setRepeatMode(m => (m + 1) % 3)} className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${repeatMode > 0 ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
            {repeatMode === 2 ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </button>
          <button onClick={() => setShowQueue(q => !q)} className={`relative h-8 w-8 grid place-items-center rounded-full transition-colors ${showQueue ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/60'}`}>
            <ListMusic className="h-4 w-4" />
            {playQueue.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-3.5 min-w-3.5 grid place-items-center rounded-full bg-white text-black text-[8px] font-bold">{playQueue.length}</span>}
          </button>
          <button onClick={() => setIsMuted(m => !m)} className="text-white/40 hover:text-white ml-1">
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
            onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0) setIsMuted(false); }}
            className="w-20 accent-white h-1" />
        </div>
      </div>
    </div>
  );

  // ── CARD MODAL (insights page + chat inbox) ──────────────────────────
  return (
    <div className="w-60 select-none">
      <audio ref={audioRef} preload="auto" playsInline />

      {/* Queue panel */}
      {showQueue && (
        <div className="mb-2">
          <QueuePanel playQueue={playQueue} queueIndex={queueIndex} onTrackChange={t => { onTrackChange(t); setShowQueue(false); }} onClose={() => setShowQueue(false)} />
        </div>
      )}

      <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden">
        {/* Cover art */}
        {!collapsed && (
          <div className="relative w-full" style={{ paddingBottom: '100%' }}>
            <div className="absolute inset-0 bg-cover bg-center" style={coverStyle} />
            <button onClick={() => setCollapsed(true)}
              className="absolute top-2 right-2 h-6 w-6 grid place-items-center rounded-full bg-black/50 text-white/80 hover:bg-black/70">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="p-3">
          {/* Title + expand */}
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <MarqueeText text={currentTrack.title} className="text-xs font-bold text-white" />
              <MarqueeText text={isBuffering && isPlaying ? 'Buffering…' : (projectName || currentTrack.artist || 'Starlight Station')} className="text-[10px] text-white/50 mt-0.5" />
            </div>
            {collapsed && (
              <button onClick={() => setCollapsed(false)} className="shrink-0 text-white/40 hover:text-white">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Draggable progress */}
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="h-1 w-full mb-1" />
          <div className="flex justify-between text-[9px] font-mono text-white/35 mb-3">
            <span>{fmt(progress)}</span>
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>

          {/* Main controls */}
          <div className="flex items-center justify-between text-white mb-2">
            <button onClick={toggleShuffle} className={`h-7 w-7 grid place-items-center rounded-full transition-colors ${isShuffled ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              <Shuffle className="h-3.5 w-3.5" />
            </button>
            <button onClick={handlePrev} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button onClick={() => onPlayPause(!isPlaying)} className="h-9 w-9 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
              {isBuffering && isPlaying
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleNext} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
            <button onClick={() => setRepeatMode(m => (m + 1) % 3)} className={`h-7 w-7 grid place-items-center rounded-full transition-colors ${repeatMode > 0 ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {repeatMode === 2 ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Secondary row */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button onClick={() => setShowQueue(q => !q)} className={`relative h-6 w-6 grid place-items-center rounded-full transition-colors ${showQueue ? 'text-white bg-white/20' : 'text-white/35 hover:text-white'}`}>
              <ListMusic className="h-3.5 w-3.5" />
              {playQueue.length > 0 && <span className="absolute -right-1 -top-1 h-3 min-w-3 grid place-items-center rounded-full bg-white text-black text-[7px] font-bold">{playQueue.length}</span>}
            </button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsMuted(m => !m)} className="text-white/35 hover:text-white">
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0) setIsMuted(false); }}
                className="w-14 accent-white h-1" />
            </div>
            <button onClick={() => onPlayPause(false)} className="text-white/35 hover:text-red-400 transition-colors" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
