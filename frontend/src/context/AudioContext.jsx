import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);

  const playTrack = useCallback((track, newTracks, newProjectName) => {
    setCurrentTrack(track);
    if (newTracks) {
      setTracks(newTracks);
    }
    if (newProjectName !== undefined) {
      setProjectName(newProjectName);
    }
    setIsPlaying(true);
  }, []);

  const addToQueue = useCallback((track) => {
    setQueue((prev) => {
      if (prev.some((item) => item.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const playbackTracks = useMemo(() => {
    const seen = new Set(tracks.map((track) => track.id));
    const extras = queue.filter((track) => !seen.has(track.id));
    return extras.length ? [...tracks, ...extras] : tracks;
  }, [tracks, queue]);

  const value = {
    currentTrack,
    setCurrentTrack,
    tracks: playbackTracks,
    setTracks,
    projectName,
    setProjectName,
    isPlaying,
    setIsPlaying,
    playTrack,
    addToQueue,
    queue
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
