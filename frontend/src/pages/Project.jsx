import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Music, Play, Image as ImageIcon, Trash2, MoreVertical, X } from 'lucide-react';
import * as Tone from 'tone';
import AudioPlayer from '../components/AudioPlayer';
import UploadModal from '../components/UploadModal';
import CoverArtPicker from '../components/CoverArtPicker';

export default function Project({ user }) {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const navigate = useNavigate();

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/workspace`);
      const data = await res.json();
      const proj = data.projects.find(p => p.id === id);
      setProject(proj);
      setTracks(data.tracks.filter(t => t.projectId === id) || []);
    } catch (err) {
      console.error('Failed to fetch workspace', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [id]);

  const handlePlay = async (track) => {
    await Tone.start(); // Unlock AudioContext on user interaction
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleUploadSuccess = (newTrack) => {
    setTracks([...tracks, newTrack]);
    setIsUploadOpen(false);
  };

  const handleCoverSelect = (newCoverUrl) => {
    setProject(prev => ({ ...prev, coverArt: newCoverUrl }));
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await fetch(`http://localhost:3001/api/projects/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleDeleteTrack = async (e, trackId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this track?')) return;
    try {
      await fetch(`http://localhost:3001/api/tracks/${trackId}`, { method: 'DELETE' });
      setTracks(tracks.filter(t => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        setIsPlaying(false);
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Failed to delete track', err);
    }
  };

  if (loading) return null;
  if (!project) return <div className="text-center mt-20">Project not found</div>;

  return (
    <div className="min-h-screen bg-primary-background pb-32 animate-fade-in relative">
      <header className="sticky top-0 z-40 glass px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-secondary-label hover:text-primary-label transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to Dashboard
        </Link>
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 bg-primary-label text-primary-background px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" />
          Upload Track
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-12 relative">
          <div className="absolute top-0 right-0 md:hidden">
            <button onClick={handleDeleteProject} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors" title="Delete Project">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <div className="relative group w-48 h-48 rounded-xl bg-shading flex items-center justify-center shrink-0 overflow-hidden border border-border shadow-2xl">
            {project.coverArt ? (
              <img src={project.coverArt} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <Music className="w-16 h-16 text-secondary-label" />
            )}
            <label 
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => setIsCoverPickerOpen(true)}
            >
              <ImageIcon className="w-8 h-8 text-white mb-2" />
              <span className="text-white text-sm font-medium">Change Cover</span>
            </label>
          </div>
          <div className="flex-1 flex justify-between items-end w-full">
            <div>
              <h3 className="text-sm font-medium text-secondary-label uppercase tracking-widest mb-2">Project</h3>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-primary-label mb-4">{project.name}</h1>
              <p className="text-secondary-label">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="hidden md:block">
              <button onClick={handleDeleteProject} className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors text-sm font-medium border border-red-500/20 hover:border-red-500/50">
                <Trash2 className="w-4 h-4" />
                Delete Project
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {tracks.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
              <Music className="w-12 h-12 text-secondary-label mb-4" />
              <h3 className="text-lg font-medium mb-1">No tracks yet</h3>
              <p className="text-secondary-label text-sm mb-6">Upload a work-in-progress audio file.</p>
              <button 
                onClick={() => setIsUploadOpen(true)}
                className="text-sm font-medium bg-shading hover:bg-highlight px-4 py-2 rounded-full transition-colors border border-border"
              >
                Upload Track
              </button>
            </div>
          ) : (
            tracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handlePlay(track)}
                className={`glass-hover group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border border-transparent ${currentTrack?.id === track.id ? 'bg-highlight border-border' : ''}`}
              >
                <div className="w-12 h-12 rounded-lg bg-shading flex items-center justify-center shrink-0 overflow-hidden relative border border-border">
                  {currentTrack?.id === track.id && isPlaying ? (
                    <div className="flex items-center justify-center gap-1 w-full h-full bg-primary-label/10">
                      <div className="w-1 bg-primary-label h-2 animate-pulse"></div>
                      <div className="w-1 bg-primary-label h-4 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 bg-primary-label h-3 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  ) : (
                    <Play className="w-5 h-5 text-primary-label opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <h3 className={`font-medium truncate ${currentTrack?.id === track.id ? 'text-primary-label' : ''}`}>
                      {track.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-secondary-label">
                      <span>{track.artist || track.uploader.name}</span>
                      {track.producer && (
                        <><span>•</span><span>Prod. {track.producer}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-secondary-label">
                    <span>{new Date(track.uploadedAt).toLocaleDateString()}</span>
                    <button 
                      onClick={(e) => handleDeleteTrack(e, track.id)}
                      className="p-2 text-secondary-label hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete track"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {currentTrack && (() => {
        const idx = tracks.findIndex(t => t.id === currentTrack.id);
        const hasNext = idx !== -1 && idx < tracks.length - 1;
        const hasPrev = idx > 0;

        return (
          <AudioPlayer 
            track={currentTrack} 
            isPlaying={isPlaying} 
            hasNext={hasNext}
            hasPrev={hasPrev}
            onPlayPause={async () => {
              await Tone.start();
              setIsPlaying(!isPlaying);
            }} 
            onNext={() => {
              if (hasNext) {
                setCurrentTrack(tracks[idx + 1]);
                setIsPlaying(true);
              }
            }}
            onPrev={() => {
              if (hasPrev) {
                setCurrentTrack(tracks[idx - 1]);
                setIsPlaying(true);
              }
            }}
          />
        );
      })()}

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onSuccess={handleUploadSuccess}
        userId={user.id}
        projectId={id}
      />

      <CoverArtPicker 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={handleCoverSelect}
        projectId={id}
      />
    </div>
  );
}
