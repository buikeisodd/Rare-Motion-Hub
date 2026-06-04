import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, ChevronLeft, Download, FileText, Image as ImageIcon, Link2, Lock, MoreHorizontal, Music, Play, Plus, Search, Trash2 } from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';
import UploadModal from '../components/UploadModal';
import CoverArtPicker from '../components/CoverArtPicker';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Project({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const fetchWorkspace = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/workspace?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      const nextProject = data.projects.find((item) => item.id === id);
      const nextTracks = data.tracks.filter((track) => track.projectId === id);
      setProject(nextProject);
      setTracks(nextTracks);
    } catch (err) {
      console.error('Failed to fetch workspace', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const res = await fetch(`${apiUrl}/api/workspace?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
        if (!cancelled) {
          const nextProject = data.projects.find((item) => item.id === id);
          const nextTracks = data.tracks.filter((track) => track.projectId === id);
          setProject(nextProject);
          setTracks(nextTracks);
        }
      } catch (err) {
        console.error('Failed to fetch workspace', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [id, user.id]);

  const handlePlay = (track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying((playing) => !playing);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }

    fetch(`${apiUrl}/api/listen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, projectId: project?.id, trackId: track.id })
    }).catch((err) => console.error('Failed to record listening activity', err));
  };

  const handleUploadSuccess = (newTrack) => {
    setTracks((prev) => [...prev, newTrack]);
    setIsUploadOpen(false);
  };

  const handleCoverSelect = (newCoverUrl) => {
    setProject((prev) => ({ ...prev, coverArt: newCoverUrl }));
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await fetch(`${apiUrl}/api/projects/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      navigate('/library');
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleDeleteTrack = async (event, trackId) => {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this track?')) return;
    try {
      await fetch(`${apiUrl}/api/tracks/${trackId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      setTracks((prev) => prev.filter((track) => track.id !== trackId));
      if (currentTrack?.id === trackId) {
        setIsPlaying(false);
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Failed to delete track', err);
    }
  };

  const handleExport = () => {
    const payload = {
      project,
      tracks,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.name || 'project'}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIsProjectMenuOpen(false);
  };

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/shared/project/${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('Copied');
    } catch {
      window.prompt('Copy project link:', shareUrl);
      setShareStatus('Ready');
    }
    window.setTimeout(() => setShareStatus(''), 1600);
  };

  if (loading) return null;
  if (!project) return <div className="text-center mt-20">Project not found</div>;

  const leadTrack = tracks[0];

  return (
    <div className="min-h-screen bg-primary-background pb-40 animate-fade-in relative">
      <header className="px-6 py-12 md:px-20 flex items-center justify-between">
        <Link to="/library" className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Back to library">
          <ChevronLeft className="w-8 h-8" />
        </Link>

        <div className="flex items-center gap-3">
          <button onClick={handleCopyShareLink} className="relative grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Copy project link">
            <Link2 className="w-7 h-7" />
            {shareStatus && <span className="absolute -bottom-8 rounded-full bg-primary-label px-3 py-1 text-xs font-bold text-primary-background">{shareStatus}</span>}
          </button>
          <button className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Search project">
            <Search className="w-7 h-7" />
          </button>
          <div className="relative">
            <button onClick={() => setIsProjectMenuOpen((open) => !open)} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Project options">
              <MoreHorizontal className="w-7 h-7" />
            </button>
            {isProjectMenuOpen && (
              <div className="absolute right-0 top-20 z-40 w-72 rounded-[1.5rem] border border-border bg-[#191919] p-4 shadow-2xl">
                <button onClick={() => navigate(`/project/${id}/insights`)} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-bold hover:bg-highlight">
                  <BarChart3 className="h-6 w-6" />
                  Insights
                </button>
                <button onClick={() => { alert('Notes are coming soon.'); setIsProjectMenuOpen(false); }} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-bold hover:bg-highlight">
                  <FileText className="h-6 w-6" />
                  Notes
                </button>
                <button onClick={handleExport} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-bold hover:bg-highlight">
                  <Download className="h-6 w-6" />
                  Export
                </button>
                <div className="my-3 border-t border-border" />
                <button onClick={handleDeleteProject} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-bold text-red-500 hover:bg-red-500/10">
                  <Trash2 className="h-6 w-6" />
                  Delete project
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-14 px-6 md:grid-cols-[minmax(18rem,38rem)_minmax(20rem,47rem)] md:px-20 md:pt-16">
        <section className="flex justify-center md:justify-start">
          <div className="relative group aspect-square w-full max-w-[38rem] overflow-hidden rounded-[1.4rem] bg-[linear-gradient(135deg,#b7ff63_0%,#d6c18e_45%,#d84f93_100%)] shadow-2xl">
            {project.coverArt && <img src={project.coverArt} alt={project.name} className="h-full w-full object-cover" />}
            <button
              type="button"
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsCoverPickerOpen(true)}
            >
              <ImageIcon className="w-8 h-8 text-white mb-2" />
              <span className="text-white text-sm font-medium">Change Cover</span>
            </button>
          </div>
        </section>

        <section className="pt-2">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-4xl font-semibold tracking-normal text-secondary-label md:text-5xl">{project.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xl text-secondary-label">
                <Lock className="h-5 w-5 fill-current" />
                <span>{user.name}</span>
                <span>•</span>
                <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{tracks.length ? '0s' : 'Now'}</span>
              </p>
            </div>
            <button onClick={() => leadTrack ? handlePlay(leadTrack) : setIsUploadOpen(true)} className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-primary-label text-primary-background transition-transform hover:scale-105" aria-label={leadTrack ? 'Play project' : 'Add tracks'}>
              <Play className="h-8 w-8 fill-current translate-x-0.5" />
            </button>
          </div>

          <button onClick={() => setIsUploadOpen(true)} className="mb-10 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-shading text-xl font-semibold text-primary-label transition-colors hover:bg-highlight">
            <Plus className="h-7 w-7" />
            Add tracks
          </button>

          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-shading/50 p-12 text-center flex flex-col items-center">
                <Music className="w-12 h-12 text-secondary-label mb-4" />
                <h3 className="text-lg font-medium mb-1">No tracks yet</h3>
                <p className="text-secondary-label text-sm mb-6">Upload a work-in-progress audio file.</p>
                <button onClick={() => setIsUploadOpen(true)} className="text-sm font-medium bg-shading hover:bg-highlight px-4 py-2 rounded-full transition-colors border border-border">
                  Upload Track
                </button>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div key={track.id} onClick={() => handlePlay(track)} className={`group grid grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-2xl px-3 py-4 cursor-pointer transition-all ${currentTrack?.id === track.id ? 'bg-highlight' : 'hover:bg-shading'}`}>
                  <div className="text-center text-xl text-secondary-label">
                    {currentTrack?.id === track.id && isPlaying ? <Play className="mx-auto h-5 w-5 fill-current text-primary-label" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold text-primary-label">{track.title}</h3>
                    <p className="mt-1 text-lg text-secondary-label">{new Date(track.uploadedAt).toLocaleDateString() === new Date().toLocaleDateString() ? 'Now' : new Date(track.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-4 text-primary-label">
                    <button onClick={(event) => handleDeleteTrack(event, track.id)} className="p-2 text-secondary-label hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100" title="Delete track">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <MoreHorizontal className="h-6 w-6" />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {currentTrack && (() => {
        const idx = tracks.findIndex((track) => track.id === currentTrack.id);
        const hasNext = idx !== -1 && idx < tracks.length - 1;
        const hasPrev = idx > 0;

        return (
          <AudioPlayer
            track={currentTrack}
            projectName={project.name}
            isPlaying={isPlaying}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onPlayPause={() => setIsPlaying((playing) => !playing)}
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
        userId={user.id}
        onRefresh={fetchWorkspace}
        projectCoverUrl={project?.coverArt}
      />
    </div>
  );
}
