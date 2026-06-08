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

  const addTracksToQueue = useCallback((tracksToAdd, { projectName: nextProjectName, autoplay = true } = {}) => {
    const incoming = (tracksToAdd || []).filter((track) => track?.id);
    if (!incoming.length) return;

    let appended = [];
    setQueue((prev) => {
      const seen = new Set(prev.map((track) => track.id));
      appended = incoming.filter((track) => !seen.has(track.id));
      return appended.length ? [...prev, ...appended] : prev;
    });

    if (!appended.length) return;

    if (autoplay) {
      setCurrentTrack((current) => {
        if (!current) {
          setIsPlaying(true);
          if (nextProjectName !== undefined) {
            setProjectName(nextProjectName);
          }
          return appended[0];
        }
        return current;
      });
    }
  }, []);

  const addToQueue = useCallback((track) => {
    addTracksToQueue([track], {
      projectName: track.projectTitle || track.projectName || projectName
    });
  }, [addTracksToQueue, projectName]);

  const playbackTracks = useMemo(() => {
    if (!queue.length) return tracks;
    if (!tracks.length) return queue;

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
    addTracksToQueue,
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
