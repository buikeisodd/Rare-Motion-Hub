import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const AudioPlayerContext = createContext(null);
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const resolveTrackUrl = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    const isLocalBackend = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    if (isLocalBackend || !/^https?:$/.test(parsed.protocol)) {
      return `${apiUrl.replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return url.startsWith('/') ? `${apiUrl.replace(/\/$/, '')}${url}` : url;
  }
};

// Ready versions already have the durable Cloudinary URL returned by upload.
// Only staged/local versions need the media stream endpoint.
const resolveActiveTrackUrl = (track) => {
  const activeVersion = track?.activeVersionId
    ? (track.versions || []).find((version) => String(version.id) === String(track.activeVersionId))
    : null;
  if (activeVersion?.playbackStatus !== 'processing' && activeVersion?.playbackStatus !== 'failed') {
    const directUrl = activeVersion?.playbackUrl || activeVersion?.url;
    if (directUrl && !activeVersion.filename) return resolveTrackUrl(directUrl);
  }
  if (track?.activeVersionId) {
    return `${apiUrl.replace(/\/$/, '')}/api/media/tracks/${encodeURIComponent(track.id)}/versions/${encodeURIComponent(track.activeVersionId)}`;
  }
  return resolveTrackUrl(track?.playbackUrl || track?.url);
};

const hasPlayableSource = (track) => Boolean(resolveActiveTrackUrl(track));

export function AudioProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0=off 1=all 2=one

  // Single audio element for the entire app lifetime — never recreated
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = document.createElement('audio');
    audioRef.current.preload = 'auto';
  }

  // Load new track when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    const sourceUrl = resolveActiveTrackUrl(currentTrack);
    if (!sourceUrl) { audio.pause(); audio.removeAttribute('src'); return; }
    setProgress(0);
    setDuration(0);
    setIsBuffering(true);
    audio.pause();
    audio.src = sourceUrl;
    audio.load();
  }, [currentTrack?.id, currentTrack?.activeVersionId, currentTrack?.playbackUrl, currentTrack?.url, currentTrack?.versions]);

  // Play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!hasPlayableSource(currentTrack)) return;
    if (isPlaying && audio.paused) {
      audio.play().catch((err) => {
        console.error('Audio playback failed:', err, 'for track URL:', resolveActiveTrackUrl(currentTrack));
        setIsPlaying(false);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.activeVersionId, currentTrack?.url]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    const onTime    = () => setProgress(audio.currentTime);
    const onMeta    = () => setDuration(audio.duration || 0);
    const onCanPlay = () => setIsBuffering(false);
    const onWait    = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onError   = (e) => {
      console.error('Audio element error:', audio.error?.code, audio.error?.message, 'src:', audio.src);
      setIsBuffering(false);
      setIsPlaying(false);
    };
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('canplay',        onCanPlay);
    audio.addEventListener('waiting',        onWait);
    audio.addEventListener('playing',        onPlaying);
    audio.addEventListener('error',          onError);
    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplay',        onCanPlay);
      audio.removeEventListener('waiting',        onWait);
      audio.removeEventListener('playing',        onPlaying);
      audio.removeEventListener('error',          onError);
    };
  }, []);

  // Repeat one — handled directly in context so it always works
  useEffect(() => {
    const audio = audioRef.current;
    const onEnd = () => {
      if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      // repeatMode 0/1 handled by AudioPlayer's ended listener for next-track logic
    };
    audio.addEventListener('ended', onEnd);
    return () => audio.removeEventListener('ended', onEnd);
  }, [repeatMode]);

  const seek = useCallback((t) => {
    setProgress(t);
    audioRef.current.currentTime = t;
  }, []);

  const setVolume = useCallback((v) => {
    audioRef.current.volume = v;
  }, []);

  const setMuted = useCallback((m) => {
    audioRef.current.muted = m;
  }, []);

  const setPlaybackRate = useCallback((r) => {
    audioRef.current.playbackRate = r;
  }, []);

  const [projectCover, setProjectCover] = useState(null);
  const [projectId, setProjectId] = useState(null);

  const playTrack = useCallback((track, newTracks, newProjectName, newProjectCover, newProjectId) => {
    setCurrentTrack(track);
    if (newTracks) setTracks(newTracks);
    if (newProjectName !== undefined) setProjectName(newProjectName);
    if (newProjectCover !== undefined) setProjectCover(newProjectCover);
    if (newProjectId !== undefined) setProjectId(newProjectId);
    setIsPlaying(true);
  }, []);

  const addTracksToQueue = useCallback((tracksToAdd, { projectName: nextProjectName, autoplay = true } = {}) => {
    const incoming = (tracksToAdd || []).filter(t => t?.id);
    if (!incoming.length) return;
    let appended = [];
    setQueue(prev => {
      const seen = new Set(prev.map(t => t.id));
      appended = incoming.filter(t => !seen.has(t.id));
      return appended.length ? [...prev, ...appended] : prev;
    });
    if (!appended.length) return;
    if (autoplay) {
      setCurrentTrack(current => {
        if (!current) {
          setIsPlaying(true);
          if (nextProjectName !== undefined) setProjectName(nextProjectName);
          return appended[0];
        }
        return current;
      });
    }
  }, []);

  const addToQueue = useCallback((track) => {
    addTracksToQueue([track], { projectName: track.projectTitle || track.projectName || projectName });
  }, [addTracksToQueue, projectName]);

  const playbackTracks = useMemo(() => {
    if (!queue.length) return tracks;
    if (!tracks.length) return queue;
    const seen = new Set(tracks.map(t => t.id));
    const extras = queue.filter(t => !seen.has(t.id));
    return extras.length ? [...tracks, ...extras] : tracks;
  }, [tracks, queue]);

  const value = {
    currentTrack, setCurrentTrack,
    tracks: playbackTracks, setTracks,
    projectName, setProjectName,
    projectCover, setProjectCover,
    projectId, setProjectId,
    isPlaying, setIsPlaying,
    progress, duration, isBuffering,
    repeatMode, setRepeatMode,
    seek, setVolume, setMuted, setPlaybackRate,
    playTrack, addToQueue, addTracksToQueue,
    queue, audioRef,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}
