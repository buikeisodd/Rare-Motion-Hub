import React, { createContext, useContext, useState, useCallback } from 'react';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

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

  const value = {
    currentTrack,
    setCurrentTrack,
    tracks,
    setTracks,
    projectName,
    setProjectName,
    isPlaying,
    setIsPlaying,
    playTrack
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
