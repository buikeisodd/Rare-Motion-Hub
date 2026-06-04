import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, FastForward, ListMusic, Pause, Play, Repeat2, Rewind, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';

export default function AudioPlayer({ track, projectName, isPlaying, onPlayPause, onNext, onPrev, hasNext, hasPrev }) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const audioRef = useRef(null);
  const onNextRef = useRef(onNext);
  const onPlayPauseRef = useRef(onPlayPause);

  useEffect(() => {
    onNextRef.current = onNext;
    onPlayPauseRef.current = onPlayPause;
  }, [onNext, onPlayPause]);

  const effectiveRate = useMemo(() => {
    const pitchRatio = Math.pow(2, pitchShift / 12);
    return Math.max(0.25, Math.min(3, playbackRate * pitchRatio));
  }, [pitchShift, playbackRate]);

  useEffect(() => {
    const audio = new Audio(track.url);
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audio.muted = isMuted;
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => onNextRef.current?.();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [track.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = effectiveRate;
    audio.preservesPitch = pitchShift === 0;
    audio.mozPreservesPitch = pitchShift === 0;
    audio.webkitPreservesPitch = pitchShift === 0;
  }, [effectiveRate, pitchShift]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('Playback failed:', err);
        onPlayPauseRef.current?.();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, track.url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const formatTime = (time) => {
    if (Number.isNaN(time) || !Number.isFinite(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!track) return null;

  return (
    <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
      {showControls && (
        <div className="absolute bottom-24 w-[min(90vw,34rem)] rounded-[1.5rem] bg-[#292929]/95 p-5 shadow-2xl backdrop-blur-xl animate-slide-up">
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

      <div className="flex w-[min(92vw,74rem)] items-center gap-5 rounded-full bg-[#2b2b2b]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-4 w-60">
          <div className="h-16 w-16 shrink-0 rounded-full bg-[linear-gradient(145deg,#b8ff65,#df5b9c)]" />
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold">{track.title}</h4>
            <p className="truncate text-sm text-secondary-label">{projectName || track.artist || track.uploader?.name || 'untitled project'}</p>
          </div>
        </div>

        <div className="hidden h-16 flex-1 items-center gap-4 md:flex">
          <div className="flex h-12 flex-1 items-end gap-1 overflow-hidden">
            {Array.from({ length: 44 }).map((_, index) => (
              <span key={index} className="w-1 rounded-full bg-primary-label/40" style={{ height: `${18 + ((index * 17) % 30)}px` }} />
            ))}
          </div>
          <div className="shrink-0 font-mono text-sm text-primary-label">
            {formatTime(progress)} / {formatTime(duration)}
          </div>
        </div>

        <input type="range" min="0" max={duration || 100} value={progress} onChange={handleSeek} className="sr-only" aria-label="Track progress" />

        <div className="flex items-center gap-4 text-primary-label">
          <button onClick={onPrev} disabled={!hasPrev} className="disabled:opacity-30" aria-label="Previous track">
            <SkipBack className="h-6 w-6 fill-current" />
          </button>
          <button onClick={onPlayPause} className="grid h-12 w-12 place-items-center rounded-full bg-primary-label text-primary-background" aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current translate-x-0.5" />}
          </button>
          <button onClick={onNext} disabled={!hasNext} className="disabled:opacity-30" aria-label="Next track">
            <SkipForward className="h-6 w-6 fill-current" />
          </button>
          <Shuffle className="hidden h-5 w-5 text-secondary-label md:block" />
          <Repeat2 className="hidden h-5 w-5 text-secondary-label md:block" />
          <button onClick={() => setShowControls((open) => !open)} className={showControls ? 'text-primary-label' : 'text-secondary-label hover:text-primary-label'} aria-label="Audio controls">
            <ListMusic className="h-6 w-6" />
          </button>
          <button onClick={() => setIsMuted((muted) => !muted)} className="text-primary-label" aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
