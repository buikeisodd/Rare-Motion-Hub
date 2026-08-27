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
function ProgressBar({ progress, duration, onSeek, className = '', activeColor = '#9BAF9B' }) {
  const barRef = useRef(null);
  const dragging = useRef(false);
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const calc = (e) => Math.max(0, Math.min(1, (e.clientX - barRef.current.getBoundingClientRect().left) / barRef.current.getBoundingClientRect().width)) * duration;
  const onDown = (e) => { dragging.current = true; barRef.current.setPointerCapture(e.pointerId); onSeek(calc(e)); };
  const onMove = (e) => { if (dragging.current) onSeek(calc(e)); };
  const onUp   = (e) => { dragging.current = false; barRef.current.releasePointerCapture(e.pointerId); };
  const bars = [4, 8, 12, 7, 16, 10, 20, 13, 8, 18, 24, 11, 15, 9, 21, 14, 7, 17, 12, 25, 15, 9, 18, 11, 22, 14, 8, 16, 10, 20, 13, 7, 17, 23, 12, 8, 15, 10, 19, 13, 7, 16, 11, 21, 14, 9, 18, 12, 6, 15, 10, 20, 13, 8, 17, 11, 22, 14, 7, 16, 10, 19, 12, 6];
  return (
    <div ref={barRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      role="slider" aria-label="Track progress" aria-valuemin="0" aria-valuemax={duration || 0} aria-valuenow={progress}
      className={`relative flex cursor-pointer items-center gap-[2px] rounded-lg bg-white/[0.03] px-1 group ${className}`} style={{ touchAction: 'none' }}>
      {bars.map((height, index) => <span key={index} className={`min-w-0 flex-1 rounded-full transition-colors duration-150 ${index / bars.length <= pct / 100 ? 'is-active' : 'is-inactive'}`} style={{ height: `${height}px`, backgroundColor: index / bars.length <= pct / 100 ? activeColor : '#F3EBDD' }} />)}
      <span className="pointer-events-none absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100" style={{ left: `${pct}%` }} />
    </div>
  );
}

function QueuePanel({ playQueue, queueIndex, onSelect, onClose }) {
  return (
    <div className="rounded-2xl bg-[#1e1e1e] border border-white/10 p-3 shadow-2xl max-h-56 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#F3EBDD]/60 uppercase tracking-wider">Queue Â· {playQueue.length}</span>
        <button onClick={onClose} className="text-[#F3EBDD]/70 hover:text-[#F3EBDD]"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="overflow-y-auto hide-scrollbar space-y-0.5">
        {playQueue.length === 0
          ? <p className="text-xs text-[#F3EBDD]/50 px-2 py-4 text-center">No tracks in queue</p>
          : playQueue.map((t, i) => (
            <button key={t.id + i} onClick={() => onSelect(t)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${i === queueIndex ? 'bg-white/20 text-[#34483B] font-semibold' : 'text-[#F3EBDD]/70 hover:bg-white/10 hover:text-[#F3EBDD]'}`}>
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
        <span className={`font-bold text-[#F3EBDD]/80 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>Playback</span>
        <button onClick={onClose} className="text-[#F3EBDD]/70 hover:text-[#F3EBDD]"><X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <div className={`flex justify-between text-[#F3EBDD]/80 mb-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Speed</span>
            <span className="font-mono">{playbackRate.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.5" max="2" step="0.05" value={playbackRate} onChange={e => setRate(parseFloat(e.target.value))} className="w-full accent-[#34483B]" />
          <button onClick={() => setRate(1)} className="mt-0.5 text-[10px] text-[#F3EBDD]/60 hover:text-[#F3EBDD]">Reset</button>
        </div>
        <div>
          <div className={`flex justify-between text-[#F3EBDD]/80 mb-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> Pitch</span>
            <span className="font-mono">{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
          </div>
          <input type="range" min="-7" max="7" step="1" value={pitchShift} onChange={e => setPitch(parseInt(e.target.value, 10))} className="w-full accent-[#34483B]" />
          <button onClick={() => setPitch(0)} className="mt-0.5 text-[10px] text-[#F3EBDD]/60 hover:text-[#F3EBDD]">Reset</button>
        </div>
      </div>
    </div>
  );
}

export default function AudioPlayer({ cardModal = false, hideCover = false, minimal = false, onDismiss, projectSurface = false }) {
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

  // â”€â”€ FLOATING PILL (all pages except insights/chat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!cardModal) return (
    <>
    <div className="rmh-audio-player fixed right-3 z-50 w-[min(42rem,calc(100vw-1.5rem))] select-none sm:right-6">
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
      <div onClick={() => setExpanded(true)} className={`rmh-audio-surface relative flex w-full overflow-hidden items-center gap-3 rounded-[1.35rem] border border-white/10 bg-[#1b1b1d]/[.76] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:gap-4 sm:px-4 sm:py-3.5 ${projectSurface ? 'project-audio-surface' : ''}`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-15 blur-md" style={coverStyle} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#141416]/[.76]" />
        {/* Cover art */}
        <div className={`rmh-audio-cover relative z-10 h-12 w-12 shrink-0 rounded-full border-2 border-white/10 bg-cover bg-center shadow-lg ${isPlaying ? 'animate-spin-slower' : ''}`} style={coverStyle} />

        {/* Title + progress */}
        <div className="rmh-audio-meta relative z-10 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3"><MarqueeText text={currentTrack.title} className="text-sm font-semibold text-[#F3EBDD]" /><span className="shrink-0 text-[10px] font-mono text-[#F3EBDD]/70">{fmt(progress)} / {fmt(duration)}</span></div>
          <ProgressBar progress={progress} duration={duration} onSeek={seek} activeColor={projectSurface ? '#34483B' : '#9BAF9B'} className="mt-2 h-7 w-full" />
        </div>

        {/* Core controls */}
        <div className="rmh-audio-primary relative z-10 flex shrink-0 items-center gap-0.5 text-accent sm:gap-1" onClick={(event) => event.stopPropagation()}>
          <button title="Shuffle" onClick={toggleShuffle} className={`hidden h-8 w-8 place-items-center rounded-full sm:grid ${isShuffled ? 'text-[#34483B]' : 'text-[#34483B]/30 hover:text-[#34483B]/60'}`}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button title="Previous" onClick={handlePrev} className="hidden h-8 w-8 place-items-center rounded-full text-[#34483B]/70 transition-colors hover:text-[#34483B] sm:grid">
            <SkipBack className="h-4 w-4 fill-current" />
          </button>
          <button title={isPlaying ? 'Pause' : 'Play'} onClick={() => setIsPlaying(p => !p)} className="h-10 w-10 grid place-items-center rounded-xl bg-accent text-primary-background hover:bg-accent-hover hover:scale-105 transition-transform">
            {isBuffering && isPlaying
              ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
              : isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>
          <button title="Next" onClick={handleNext} className="hidden h-8 w-8 place-items-center rounded-full text-[#34483B]/70 transition-colors hover:text-[#34483B] sm:grid">
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
          <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`hidden h-7 w-7 place-items-center rounded-full sm:grid ${repeatMode > 0 ? 'text-[#34483B]' : 'text-[#34483B]/30 hover:text-[#34483B]/60'}`}>
            {repeatMode === 2 ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Extra controls */}
        <div className="rmh-audio-secondary relative z-10 hidden items-center gap-0.5 text-accent/75 sm:flex shrink-0" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => { setShowQueue(q => !q); setShowSettings(false); }} className={`relative h-7 w-7 grid place-items-center rounded-full transition-colors ${showQueue ? 'text-[#34483B] bg-white/15' : 'hover:text-[#34483B]'}`}>
            <ListMusic className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setShowSettings(s => !s); setShowQueue(false); }} className={`h-7 w-7 grid place-items-center rounded-full transition-colors ${showSettings ? 'text-[#34483B] bg-white/15' : 'hover:text-[#34483B]'}`}>
            <Activity className="h-3.5 w-3.5" />
          </button>
          <button title={isMuted ? 'Unmute' : 'Mute'} onClick={() => handleMute(!isMuted)} className="h-7 w-7 grid place-items-center rounded-full hover:text-[#34483B]">
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="h-1 w-16 accent-accent" />
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
          <div className="mt-7 flex items-center justify-between text-accent">
            <button onClick={toggleShuffle} className={`grid h-11 w-11 place-items-center rounded-full ${isShuffled ? 'bg-shading text-primary-label' : 'text-secondary-label'}`}><Shuffle className="h-5 w-5" /></button>
            <button onClick={handlePrev} className="grid h-12 w-12 place-items-center rounded-full bg-shading"><SkipBack className="h-5 w-5 fill-current" /></button>
            <button onClick={() => setIsPlaying(p => !p)} className="grid h-14 w-14 place-items-center rounded-xl bg-accent text-primary-background hover:bg-accent-hover">
              {isBuffering && isPlaying ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-background border-t-transparent" /> : isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
            </button>
            <button onClick={handleNext} className="grid h-12 w-12 place-items-center rounded-full bg-shading"><SkipForward className="h-5 w-5 fill-current" /></button>
            <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`grid h-11 w-11 place-items-center rounded-full ${repeatMode > 0 ? 'bg-shading text-primary-label' : 'text-secondary-label'}`}>{repeatMode === 2 ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}</button>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-shading/40 p-4">
            <SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => {}} compact />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-shading/40 px-4 py-3">
            <button onClick={() => handleMute(!isMuted)} className="text-accent">{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="min-w-0 flex-1 accent-[#34483B]" />
          </div>
        </div>
      </div>
    )}
    </>
  );

  // â”€â”€ CARD MODAL (insights + chat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="w-60 select-none">
      {showSettings && <div className="mb-2"><SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => setShowSettings(false)} compact /></div>}
      {showQueue && <div className="mb-2"><QueuePanel playQueue={playQueue} queueIndex={queueIndex} onSelect={t => { setCurrentTrack(t); setIsPlaying(true); setShowQueue(false); }} onClose={() => setShowQueue(false)} /></div>}

      <div className="relative rounded-2xl border border-white/10 bg-[#1c1c1e]/80 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-15 blur-md" style={coverStyle} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#141416]/[.76]" />
        {!hideCover && !collapsed && <div className="h-2" />}
        <div className="relative z-10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <MarqueeText text={currentTrack.title} className="text-xs font-bold text-[#F3EBDD]" />
              <MarqueeText text={isBuffering && isPlaying ? 'Bufferingâ€¦' : (projectName || currentTrack.artist || 'Starlight Station')} className="text-[10px] text-[#F3EBDD]/70 mt-0.5" />
            </div>
            {!hideCover && collapsed && (
              <button onClick={() => setCollapsed(false)} className="shrink-0 text-[#F3EBDD]/70 hover:text-[#F3EBDD]"><ChevronUp className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <ProgressBar progress={progress} duration={duration} onSeek={seek} activeColor={projectSurface ? '#34483B' : '#9BAF9B'} className="h-1 w-full mb-1" />
          <div className="flex justify-between text-[9px] font-mono text-[#34483B]/35 mb-3">
            <span>{fmt(progress)}</span>
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>
          <div className="flex items-center justify-between text-accent mb-2">
            <button onClick={toggleShuffle} className={`h-7 w-7 grid place-items-center rounded-full ${isShuffled ? 'text-[#34483B]' : 'text-[#34483B]/30 hover:text-[#34483B]/60'}`}><Shuffle className="h-3.5 w-3.5" /></button>
            <button onClick={handlePrev} className="h-8 w-8 grid place-items-center rounded-full text-[#34483B]/70 hover:text-[#34483B] transition-colors"><SkipBack className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setIsPlaying(p => !p)} className="h-8 w-8 grid place-items-center rounded-xl bg-accent text-primary-background hover:bg-accent-hover hover:scale-105 transition-transform">
              {isBuffering && isPlaying ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleNext} className="h-8 w-8 grid place-items-center rounded-full text-[#34483B]/70 hover:text-[#34483B] transition-colors"><SkipForward className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setRepeatMode(m => (m+1)%3)} className={`h-7 w-7 grid place-items-center rounded-full ${repeatMode > 0 ? 'text-[#34483B]' : 'text-[#34483B]/30 hover:text-[#34483B]/60'}`}>
              {repeatMode === 2 ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            </button>
          </div>
          {!minimal && <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button onClick={() => { setShowSettings(s => !s); setShowQueue(false); }} className={`h-6 w-6 grid place-items-center rounded-full ${showSettings ? 'text-[#34483B] bg-white/20' : 'text-[#F3EBDD]/60 hover:text-[#F3EBDD]'}`}><Activity className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setShowQueue(q => !q); setShowSettings(false); }} className={`relative h-6 w-6 grid place-items-center rounded-full ${showQueue ? 'text-[#34483B] bg-white/20' : 'text-[#F3EBDD]/60 hover:text-[#F3EBDD]'}`}>
              <ListMusic className="h-3.5 w-3.5" />
              {playQueue.length > 0 && <span className="absolute -right-1 -top-1 h-3 min-w-3 grid place-items-center rounded-full bg-white text-black text-[7px] font-bold">{playQueue.length}</span>}
            </button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleMute(!isMuted)} className="text-accent/75 hover:text-accent-hover">
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="w-14 accent-[#34483B] h-1" />
            </div>
            <button onClick={() => onDismiss ? onDismiss() : null} className="text-[#34483B]/35 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>}
          {minimal && <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-2">
            <button onClick={() => handleMute(!isMuted)} className="text-[#34483B]/60 hover:text-[#34483B]" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => handleVolume(parseFloat(e.target.value))} className="w-24 accent-[#34483B] h-1" />
          </div>}
        </div>
      </div>
    </div>
  );
}

