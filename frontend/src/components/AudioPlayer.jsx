import { useRef, useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, ListMusic, Pause, Play, Repeat, Repeat1, Settings2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

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
      <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
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
          repeatMode, setRepeatMode } = useAudio();

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

  const coverStyle = currentTrack.coverArt
    ? { backgroundImage: `url(${currentTrack.coverArt})` }
    : { background: 'linear-gradient(145deg,#b8ff65,#df5b9c)' };

  // ── FLOATING PILL (all pages except insights/chat) ───────────────────
  if (!cardModal) return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* Panels pop above */}
      {showQueue && (
        <div className="absolute bottom-full right-0 mb-3 w-72">
          <QueuePanel playQueue={playQueue} queueIndex={queueIndex} onSelect={t => { setCurrentTrack(t); setIsPlaying(true); setShowQueue(false); }} onClose={() => setShowQueue(false)} />
        </div>
      )}
      {showSettings && (
        <div className="absolute bottom-full right-0 mb-3 w-72">
          <SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Compact floating pill */}
      <div className="flex items-center gap-2 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 shadow-2xl px-3 py-2">
        {/* Cover art */}
        <div className="h-9 w-9 shrink-0 rounded-lg bg-cover bg-center" style={coverStyle} />

        {/* Title + progress */}
        <div className="w-32 min-w-0">
          <MarqueeText text={currentTrack.title} className="text-xs font-semibold text-white" />
          <ProgressBar progress={progress} duration={duration} onSeek={seek} className="h-1 w-full mt-1.5" />
        </div>

        {/* Core controls */}
        <div className="flex items-center gap-1 text-white shrink-0">
          <button onClick={handlePrev} className="h-7 w-7 grid place-items-center rounded-full hover:bg-white/10">
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </button>
          <button onClick={() => setIsPlaying(p => !p)} className="h-8 w-8 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
            {isBuffering && isPlaying
              ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
              : isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
          </button>
          <button onClick={handleNext} className="h-7 w-7 grid place-items-center rounded-full hover:bg-white/10">
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>

        {/* Extra controls */}
        <div className="flex items-center gap-0.5 text-white/40 shrink-0">
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
  );

  // ── CARD MODAL (insights + chat) ──────────────────────────────────────
  return (
    <div className="w-60 select-none">
      {showSettings && <div className="mb-2"><SettingsPanel playbackRate={playbackRate} setRate={handleRate} pitchShift={pitchShift} setPitch={handlePitch} onClose={() => setShowSettings(false)} compact /></div>}
      {showQueue && <div className="mb-2"><QueuePanel playQueue={playQueue} queueIndex={queueIndex} onSelect={t => { setCurrentTrack(t); setIsPlaying(true); setShowQueue(false); }} onClose={() => setShowQueue(false)} /></div>}

      <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden">
        {!hideCover && !collapsed && (
          <div className="relative w-full" style={{ paddingBottom: '100%' }}>
            <div className="absolute inset-0 bg-cover bg-center" style={coverStyle} />
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
            <button onClick={handlePrev} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10"><SkipBack className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setIsPlaying(p => !p)} className="h-9 w-9 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition-transform">
              {isBuffering && isPlaying ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleNext} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10"><SkipForward className="h-4 w-4 fill-current" /></button>
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
