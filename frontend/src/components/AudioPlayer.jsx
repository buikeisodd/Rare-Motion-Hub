import { useRef, useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, ListMusic, Pause, Play, Repeat, Repeat1, Settings2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { gradientFor } from '../utils/gradients';

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

// Draggable progress bar with pointer capture
function ProgressBar({ progress, duration, onSeek, className = '' }) {
  const barRef = useRef(null);
  const dragging = useRef(false);
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const calc = (e) => Math.max(0, Math.min(1, (e.clientX - barRef.current.getBoundingClientRect().left) / barRef.current.getBoundingClientRect().width)) * duration;
  const onDown = (e) => { dragging.current = true; barRef.current.setPointerCapture(e.pointerId); onSeek(calc(e)); };
  const onMove = (e) => { if (dragging.current) onSeek(calc(e)); };
  const onUp   = (e) => { dragging.current = false; barRef.current.releasePointerCapture(e.pointerId); };
  return (
    <div ref={barRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      className={`relative cursor-pointer rounded-full bg-white/20 group ${className}`} style={{ touchAction: 'none' }}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-[#D7FF65]" style={{ width: `${pct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-[#D7FF65] shadow-md opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
    </div>
  );
}

function QueuePanel({ playQueue, queueIndex, onSelect, onClose }) {
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
            <button key={t.id + i} onClick={() => onSelect(t)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${i === queueIndex ? 'bg-white/20 text-white font-semibold' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}>
              <div className="truncate">{t.title}</div>
              <div className="truncate text-[10px] opacity-60">{t.artist || t.producer}</div>
            </button>
          ))}
      </div>
    </div>
  );
}

function SettingsPanel({ playbackRate, setRate, pitchShift, setPitch, onClose, compact = false }) {
  return (
    <div className={`rounded-2xl bg-[#1e1e1e] border border-white/10 shadow-2xl ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold text-white/60 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>Playback</span>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <div className={`flex justify-between text-white/50 mb-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Speed</span>
            <span className="font-mono">{playbackRate.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.5" max="2" step="0.05" value={playbackRate} onChange={e => setRate(parseFloat(e.target.value))} className="w-full accent-white" />
          <button onClick={() => setRate(1)} className="mt-0.5 text-[10px] text-white/35 hover:text-white">Reset</button>
        </div>
        <div>
          <div className={`flex justify-between text-white/50 mb-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> Pitch</span>
            <span className="font-mono">{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
          </div>
          <input type="range" min="-7" max="7" step="1" value={pitchShift} onChange={e => setPitch(parseInt(e.target.value, 10))} className="w-full accent-white" />
          <button onClick={() => setPitch(0)} className="mt-0.5 text-[10px] text-white/35 hover:text-white">Reset</button>
        </div>
      </div>
    </div>
  );
}

export default function AudioPlayer({ cardModal = false, hideCover = false, onDismiss }) {
  const { currentTrack, tracks, projectName, isPlaying, setIsPlaying, setCurrentTrack,
          progress, duration, isBuffering, seek, setVolume, setMuted, setPlaybackRate: ctxSetRate,
          repeatMode, setRepeatMode, projectCover, projectId } = useAudio();

  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMutedState] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [showQueue, setShowQueue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { audioRef } = useAudio();

  // Sync volume/muted/rate changes to the shared audio element via context
  const handleVolume = (v) => { setVolumeState(v); setVolume(v); if (v > 0) { setIsMutedState(false); setMuted(false); } };
  const handleMute   = (m) => { setIsMutedState(m); setMuted(m); };
  const handleRate   = (r) => { setPlaybackRateState(r); applyRate(r, pitchShift); };
  const handlePitch  = (p) => { setPitchShift(p); applyRate(playbackRate, p); };

  const applyRate = (rate, pitch) => {
    const ratio = Math.pow(2, pitch / 12);
    const combined = Math.max(0.25, Math.min(3, rate * ratio));
    ctxSetRate(combined);
    const audio = audioRef.current;
    if (audio) { audio.preservesPitch = pitch === 0; audio.mozPreservesPitch = pitch === 0; audio.webkitPreservesPitch = pitch === 0; }
  };

  // Build queue from tracks
  useEffect(() => {
    if (!tracks?.length) { setPlayQueue([]); setQueueIndex(-1); return; }
    let q = [...tracks];
    if (isShuffled) {
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (currentTrack) { const si = q.findIndex(t => t.id === currentTrack.id); if (si > 0) [q[0], q[si]] = [q[si], q[0]]; }
    }
    setPlayQueue(q);
    const idx = currentTrack ? q.findIndex(t => t.id === currentTrack.id) : 0;
    setQueueIndex(idx !== -1 ? idx : 0);
  }, [tracks, isShuffled, currentTrack?.id]);

  // Handle track end (repeat-one handled in AudioContext; this handles next-track)
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const onEnd = () => {
      if (repeatMode === 2) return; // context handles repeat-one
      let next = queueIndex + 1;
      if (next >= playQueue.length) { if (repeatMode === 1) next = 0; else { setIsPlaying(false); return; } }
      if (playQueue[next]) { setCurrentTrack(playQueue[next]); setIsPlaying(true); }
    };
    audio.addEventListener('ended', onEnd);
    return () => audio.removeEventListener('ended', onEnd);
  }, [queueIndex, playQueue, repeatMode, audioRef]);

  const handlePrev = () => {
    if (!playQueue.length) return;
    if (audioRef.current?.currentTime > 3) { seek(0); return; }
    let prev = queueIndex - 1;
    if (prev < 0) prev = repeatMode === 1 ? playQueue.length - 1 : 0;
    if (playQueue[prev]) { setCurrentTrack(playQueue[prev]); setIsPlaying(true); }
  };
  const handleNext = () => {
    if (!playQueue.length) return;
    let next = queueIndex + 1;
    if (next >= playQueue.length) { if (repeatMode === 1) next = 0; else { setIsPlaying(false); return; } }
    if (playQueue[next]) { setCurrentTrack(playQueue[next]); setIsPlaying(true); }
  };
  const toggleShuffle = () => setIsShuffled(s => !s);
  const fmt = (t) => { if (!isFinite(t)) return '0:00'; return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`; };

  if (!currentTrack) return null;

  const coverArt = currentTrack.coverArt || projectCover;
  const coverStyle = coverArt
    ? { backgroundImage: `url(${coverArt})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradientFor(projectId || currentTrack.projectId || currentTrack.id) };

  // ── FLOATING PILL (all pages except insights/chat) ───────────────────
  if (!cardModal) return (
    <>
    <div className="fixed bottom-[4.8rem] right-3 z-50 max-w-[calc(100vw-5.25rem)] select-none sm:bottom-6 sm:right-6 sm:max-w-none">
      {/* Panels pop above */}
      {showQueue && (
        <div className="absolute bottom-full right-0 mb-3 w-[min(18rem,calc(100vw-1.5rem))] sm:w-72">
          <QueuePanel playQueue={playQueue} queueIndex={queueIndex} onSelect={t => { setCurrentTrack(t); setIsPlaying(true); setShowQueue(false); }} onClose={() => setShowQueue(false)} />
        </div>
      )}
      {showSettings && (
        <div className="absolute bottom-full right-0 mb-3 w-[min(18rem,calc(100vw-1.5rem))] sm:w-72">
          <SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Compact floating pill */}
      <div onClick={() => setExpanded(true)} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-[#1c1c1e]/95 px-2.5 py-2 shadow-2xl backdrop-blur-xl sm:px-3">
        {/* Cover art */}
        <div className={`h-9 w-9 shrink-0 rounded-full bg-cover bg-center ${isPlaying ? 'animate-spin-slow' : ''}`} style={coverStyle} />

        {/* Title + progress */}
        <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
          <MarqueeText text={currentTrack.title} className="text-xs font-semibold text-white" />
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="h-1 w-full mt-1.5" />
        </div>

        {/* Core controls */}
        <div className="flex shrink-0 items-center gap-0.5 text-white sm:gap-1" onClick={(event) => event.stopPropagation()}>
          <button onClick={toggleShuffle} className={`hidden h-7 w-7 place-items-center rounded-full sm:grid ${isShuffled ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
            <Shuffle className="h-3.5 w-3.5" />
          </button>
          <button onClick={handlePrev} className="hidden h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:text-white sm:grid">
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </button>
          <button onClick={() => setIsPlaying(p => !p)} className="h-8 w-8 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
            {isBuffering && isPlaying
              ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
              : isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
          </button>
          <button onClick={handleNext} className="hidden h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:text-white sm:grid">
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </button>
          <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`hidden h-7 w-7 place-items-center rounded-full sm:grid ${repeatMode > 0 ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
            {repeatMode === 2 ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Extra controls */}
        <div className="hidden items-center gap-0.5 text-white/40 sm:flex shrink-0" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => { setShowQueue(q => !q); setShowSettings(false); }} className={`relative h-7 w-7 grid place-items-center rounded-full transition-colors ${showQueue ? 'text-white bg-white/15' : 'hover:text-white'}`}>
            <ListMusic className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setShowSettings(s => !s); setShowQueue(false); }} className={`h-7 w-7 grid place-items-center rounded-full transition-colors ${showSettings ? 'text-white bg-white/15' : 'hover:text-white'}`}>
            <Activity className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDismiss ? onDismiss() : null} className="h-7 w-7 grid place-items-center rounded-full hover:text-red-400 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
    {expanded && (
      <div className="fixed inset-0 z-[90] flex flex-col bg-primary-background text-primary-label sm:hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
          <button onClick={() => setExpanded(false)} className="grid h-10 w-10 place-items-center rounded-full bg-shading" aria-label="Collapse player">
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-label">Now Playing</span>
          <button onClick={() => { setExpanded(false); onDismiss?.(); }} className="grid h-10 w-10 place-items-center rounded-full bg-shading" aria-label="Close player">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-center px-6 pb-8">
          <div className="mx-auto aspect-square w-full max-w-[18rem] rounded-[1.75rem] bg-cover bg-center shadow-2xl" style={coverStyle} />
          <div className="mt-7 text-center">
            <MarqueeText text={currentTrack.title} className="mx-auto max-w-xs text-2xl font-bold text-primary-label" />
            <MarqueeText text={projectName || currentTrack.artist || 'Starlight Station'} className="mx-auto mt-1 max-w-xs text-sm text-secondary-label" />
          </div>
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="mt-7 h-1.5 w-full" />
          <div className="mt-2 flex justify-between text-xs font-mono text-secondary-label">
            <span>{fmt(progress)}</span>
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>
          <div className="mt-7 flex items-center justify-between text-primary-label">
            <button onClick={toggleShuffle} className={`grid h-11 w-11 place-items-center rounded-full ${isShuffled ? 'bg-shading text-primary-label' : 'text-secondary-label'}`}><Shuffle className="h-5 w-5" /></button>
            <button onClick={handlePrev} className="grid h-12 w-12 place-items-center rounded-full bg-shading"><SkipBack className="h-5 w-5 fill-current" /></button>
            <button onClick={() => setIsPlaying(p => !p)} className="grid h-16 w-16 place-items-center rounded-full bg-primary-label text-primary-background">
              {isBuffering && isPlaying ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-background border-t-transparent" /> : isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
            </button>
            <button onClick={handleNext} className="grid h-12 w-12 place-items-center rounded-full bg-shading"><SkipForward className="h-5 w-5 fill-current" /></button>
            <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`grid h-11 w-11 place-items-center rounded-full ${repeatMode > 0 ? 'bg-shading text-primary-label' : 'text-secondary-label'}`}>{repeatMode === 2 ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}</button>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-shading/40 p-4">
            <SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => {}} compact />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-shading/40 px-4 py-3">
            <button onClick={() => handleMute(!isMuted)} className="text-secondary-label">{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="min-w-0 flex-1 accent-white" />
          </div>
        </div>
      </div>
    )}
    </>
  );

  // ── CARD MODAL (insights + chat) ──────────────────────────────────────
  return (
    <div className="w-60 select-none">
      {showSettings && <div className="mb-2"><SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => setShowSettings(false)} compact /></div>}
      {showQueue && <div className="mb-2"><QueuePanel playQueue={playQueue} queueIndex={queueIndex} onSelect={t => { setCurrentTrack(t); setIsPlaying(true); setShowQueue(false); }} onClose={() => setShowQueue(false)} /></div>}

      <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden">
        {!hideCover && !collapsed && (
          <div className="mx-auto mt-4 mb-6 aspect-square w-48 max-w-full relative">
            <div className={`absolute inset-0 rounded-full border-4 border-[#2c2c2e] shadow-2xl overflow-hidden bg-cover bg-center ${isPlaying ? 'animate-spin-slow' : ''}`} style={coverStyle} />
            <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-[#1c1c1e] border-2 border-[#2c2c2e]" />
            <button onClick={() => setCollapsed(true)} className="absolute top-2 right-2 h-6 w-6 grid place-items-center rounded-full bg-black/50 text-white/80 hover:bg-black/70">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <MarqueeText text={currentTrack.title} className="text-xs font-bold text-white" />
              <MarqueeText text={isBuffering && isPlaying ? 'Buffering…' : (projectName || currentTrack.artist || 'Starlight Station')} className="text-[10px] text-white/50 mt-0.5" />
            </div>
            {!hideCover && collapsed && (
              <button onClick={() => setCollapsed(false)} className="shrink-0 text-white/40 hover:text-white"><ChevronUp className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="h-1 w-full mb-1" />
          <div className="flex justify-between text-[9px] font-mono text-white/35 mb-3">
            <span>{fmt(progress)}</span>
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>
          <div className="flex items-center justify-between text-white mb-2">
            <button onClick={toggleShuffle} className={`h-7 w-7 grid place-items-center rounded-full ${isShuffled ? 'text-white' : 'text-white/30 hover:text-white/60'}`}><Shuffle className="h-3.5 w-3.5" /></button>
            <button onClick={handlePrev} className="h-8 w-8 grid place-items-center rounded-full text-white/70 hover:text-white transition-colors"><SkipBack className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setIsPlaying(p => !p)} className="h-9 w-9 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
              {isBuffering && isPlaying ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleNext} className="h-8 w-8 grid place-items-center rounded-full text-white/70 hover:text-white transition-colors"><SkipForward className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`h-7 w-7 grid place-items-center rounded-full ${repeatMode > 0 ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {repeatMode === 2 ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button onClick={() => { setShowSettings(s => !s); setShowQueue(false); }} className={`h-6 w-6 grid place-items-center rounded-full ${showSettings ? 'text-white bg-white/20' : 'text-white/35 hover:text-white'}`}><Activity className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setShowQueue(q => !q); setShowSettings(false); }} className={`relative h-6 w-6 grid place-items-center rounded-full ${showQueue ? 'text-white bg-white/20' : 'text-white/35 hover:text-white'}`}>
              <ListMusic className="h-3.5 w-3.5" />
              {playQueue.length > 0 && <span className="absolute -right-1 -top-1 h-3 min-w-3 grid place-items-center rounded-full bg-white text-black text-[7px] font-bold">{playQueue.length}</span>}
            </button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleMute(!isMuted)} className="text-white/35 hover:text-white">
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="w-14 accent-white h-1" />
            </div>
            <button onClick={() => onDismiss ? onDismiss() : null} className="text-white/35 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
