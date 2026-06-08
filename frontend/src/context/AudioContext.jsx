import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // Single audio element for the entire app lifetime — never recreated
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = document.createElement('audio');
    audioRef.current.preload = 'auto';
  }

  // Load new track when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!currentTrack?.url) { audio.pause(); return; }
    setProgress(0);
    setDuration(0);
    setIsBuffering(true);
    audio.pause();
    audio.src = currentTrack.url;
    audio.load();
  }, [currentTrack?.url]);

  // Play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!currentTrack?.url) return;
    if (isPlaying && audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.url]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    const onTime    = () => setProgress(audio.currentTime);
    const onMeta    = () => setDuration(audio.duration || 0);
    const onCanPlay = () => setIsBuffering(false);
    const onWait    = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('canplay',        onCanPlay);
    audio.addEventListener('waiting',        onWait);
    audio.addEventListener('playing',        onPlaying);
    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplay',        onCanPlay);
      audio.removeEventListener('waiting',        onWait);
      audio.removeEventListener('playing',        onPlaying);
    };
  }, []);

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

  const playTrack = useCallback((track, newTracks, newProjectName) => {
    setCurrentTrack(track);
    if (newTracks) setTracks(newTracks);
    if (newProjectName !== undefined) setProjectName(newProjectName);
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
    isPlaying, setIsPlaying,
    progress, duration, isBuffering,
    seek, setVolume, setMuted, setPlaybackRate,
    playTrack, addToQueue, addTracksToQueue,
    queue, audioRef,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}
