import { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, FastForward, Activity, X } from 'lucide-react';
import * as Tone from 'tone';

export default function AudioPlayer({ track, isPlaying, onPlayPause, onNext, onPrev, hasNext, hasPrev }) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0); // In semitones
  const [showControls, setShowControls] = useState(false);

  const audioRef = useRef(null);
  const sourceRef = useRef(null);
  const pitchShiftRef = useRef(null);

  useEffect(() => {
    // Recreate the Audio and Web Audio nodes when track changes
    const audio = new Audio();
    audio.crossOrigin = "anonymous"; // Essential for Web Audio API processing
    audio.src = track.url;
    audio.playbackRate = playbackRate;
    audio.muted = isMuted;
    audioRef.current = audio;

    // Initialize Tone.js Effect
    const pitch = new Tone.PitchShift({ pitch: pitchShift }).toDestination();
    pitchShiftRef.current = pitch;

    // Connect HTML5 Audio to Tone.js
    const source = Tone.context.createMediaElementSource(audio);
    // Connect native node to Tone node
    Tone.connect(source, pitch);
    sourceRef.current = source;

    // Event Listeners
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onNext);

    // Initial load
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onNext);
      
      source.disconnect();
      pitch.dispose();
      audioRef.current = null;
    };
  }, [track.url]); // We only completely recreate when the track URL changes

  // Handle Play/Pause
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      // Ensure Tone.js context is running (requires user gesture, which should have happened)
      Tone.start().then(() => {
        audioRef.current.play().catch(e => {
          console.error("Playback failed:", e);
          // Auto-play was likely prevented, fallback to pause state
          onPlayPause(); 
        });
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, track.url]);

  // Handle Effects Syncing
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      // When changing HTML5 audio playback rate, it preserves pitch by default in most modern browsers.
      // To ensure our PitchShift handles pitch independently, we let HTML5 Audio handle speed.
      // We can also disable native pitch preservation if we wanted speed to affect pitch:
      // audioRef.current.preservesPitch = false;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = pitchShift;
    }
  }, [pitchShift]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const formatTime = (time) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!track) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      
      {/* Advanced Controls Panel */}
      {showControls && (
        <div className="max-w-4xl mx-auto px-6 mb-4 animate-slide-up relative">
          <div className="glass rounded-2xl p-6 border-border border flex flex-col md:flex-row items-center justify-center gap-12 relative">
            <button 
              onClick={() => setShowControls(false)} 
              className="absolute top-4 right-4 p-1.5 text-secondary-label hover:text-primary-label hover:bg-shading rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Speed Control */}
            <div className="flex flex-col gap-2 w-48">
              <div className="flex items-center justify-between text-xs font-medium text-secondary-label">
                <span className="flex items-center gap-1"><FastForward className="w-3 h-3" /> Speed</span>
                <span>{playbackRate.toFixed(2)}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2" step="0.05" 
                value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                className="w-full h-1 bg-shading rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-label [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-[10px] text-secondary-label/50 mt-1">
                <span>0.5x</span>
                <button onClick={() => setPlaybackRate(1)} className="hover:text-primary-label">Reset</button>
                <span>2.0x</span>
              </div>
            </div>

            <div className="w-px h-12 bg-border"></div>

            {/* Pitch Control */}
            <div className="flex flex-col gap-2 w-48">
              <div className="flex items-center justify-between text-xs font-medium text-secondary-label">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Pitch Shift</span>
                <span>{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
              </div>
              <input 
                type="range" min="-12" max="12" step="1" 
                value={pitchShift} onChange={(e) => setPitchShift(parseInt(e.target.value))}
                className="w-full h-1 bg-shading rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-label [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-[10px] text-secondary-label/50 mt-1">
                <span>-12st</span>
                <button onClick={() => setPitchShift(0)} className="hover:text-primary-label">Reset</button>
                <span>+12st</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Player Bar */}
      <div className="glass border-t border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          
          {/* Track Info */}
          <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
            <div className="w-12 h-12 bg-shading rounded-lg flex items-center justify-center border border-border">
              <div className={`w-3 h-3 rounded-full bg-primary-label ${isPlaying ? 'animate-pulse' : ''}`}></div>
            </div>
            <div className="min-w-0">
              <h4 className="font-medium text-sm truncate">{track.title}</h4>
              <p className="text-xs text-secondary-label truncate">{track.artist || track.uploader?.name || 'Unknown Artist'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center flex-1 max-w-xl">
            <div className="flex items-center gap-6 mb-2">
              <button 
                onClick={onPrev} 
                disabled={!hasPrev}
                className={`transition-colors ${hasPrev ? 'text-secondary-label hover:text-primary-label' : 'text-border cursor-not-allowed'}`}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button 
                onClick={onPlayPause}
                className="w-10 h-10 bg-primary-label text-primary-background rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              <button 
                onClick={onNext} 
                disabled={!hasNext}
                className={`transition-colors ${hasNext ? 'text-secondary-label hover:text-primary-label' : 'text-border cursor-not-allowed'}`}
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
            
            <div className="w-full flex items-center gap-3 text-xs text-secondary-label font-medium font-mono">
              <span>{formatTime(progress)}</span>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={progress} 
                onChange={handleSeek}
                className="w-full h-1 bg-shading rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-label [&::-webkit-slider-thumb]:rounded-full"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Extras */}
          <div className="flex items-center justify-end gap-3 w-1/4 min-w-[150px]">
            <button 
              onClick={() => setShowControls(!showControls)} 
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors border ${showControls ? 'bg-primary-label text-primary-background border-primary-label' : 'text-secondary-label border-border hover:bg-shading hover:text-primary-label'}`}
            >
              Edit Audio
            </button>
            <button onClick={toggleMute} className="p-1.5 text-secondary-label hover:text-primary-label transition-colors">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
