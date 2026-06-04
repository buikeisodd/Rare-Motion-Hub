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
    <div className="relative min-h-screen bg-primary-background pb-36 animate-fade-in sm:pb-40">
      <header className="flex items-center justify-between px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-14">
        <Link to="/library" className="grid h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Back to library">
          <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={handleCopyShareLink} className="relative grid h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Copy project link">
            <Link2 className="h-5 w-5 sm:h-6 sm:w-6" />
            {shareStatus && <span className="absolute -bottom-8 rounded-full bg-primary-label px-3 py-1 text-xs font-bold text-primary-background">{shareStatus}</span>}
          </button>
          <button className="hidden h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:grid sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Search project">
            <Search className="h-6 w-6" />
          </button>
          <div className="relative">
            <button onClick={() => setIsProjectMenuOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Project options">
              <MoreHorizontal className="h-6 w-6" />
            </button>
            {isProjectMenuOpen && (
              <div className="absolute right-0 top-14 z-40 w-[min(18rem,86vw)] rounded-[1.25rem] border border-border bg-[#191919] p-3 shadow-2xl sm:top-16 sm:p-4">
                <button onClick={() => navigate(`/project/${id}/insights`)} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-bold hover:bg-highlight sm:py-4 sm:text-lg">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
                  Insights
                </button>
                <button onClick={() => { alert('Notes are coming soon.'); setIsProjectMenuOpen(false); }} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-bold hover:bg-highlight sm:py-4 sm:text-lg">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  Notes
                </button>
                <button onClick={handleExport} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-bold hover:bg-highlight sm:py-4 sm:text-lg">
                  <Download className="h-5 w-5 sm:h-6 sm:w-6" />
                  Export
                </button>
                <div className="my-3 border-t border-border" />
                <button onClick={handleDeleteProject} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-bold text-red-500 hover:bg-red-500/10 sm:py-4 sm:text-lg">
                  <Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  Delete project
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[minmax(16rem,30rem)_minmax(20rem,1fr)] md:gap-12 md:px-10 md:pt-10 lg:px-14">
        <section className="flex justify-center md:justify-start">
          <div className="group relative aspect-square w-full max-w-[24rem] overflow-hidden rounded-[1.2rem] bg-[linear-gradient(135deg,#b7ff63_0%,#d6c18e_45%,#d84f93_100%)] shadow-2xl md:max-w-[30rem]">
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

        <section className="pt-1">
          <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-normal text-secondary-label sm:text-4xl md:text-5xl">{project.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-base text-secondary-label sm:text-lg">
                <Lock className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                <span>{user.name}</span>
                <span>•</span>
                <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{tracks.length ? '0s' : 'Now'}</span>
              </p>
            </div>
            <button onClick={() => leadTrack ? handlePlay(leadTrack) : setIsUploadOpen(true)} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-label text-primary-background transition-transform hover:scale-105 sm:h-14 sm:w-14 sm:rounded-3xl" aria-label={leadTrack ? 'Play project' : 'Add tracks'}>
              <Play className="h-6 w-6 fill-current translate-x-0.5 sm:h-7 sm:w-7" />
            </button>
          </div>

          <button onClick={() => setIsUploadOpen(true)} className="mb-7 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-shading py-4 text-lg font-semibold text-primary-label transition-colors hover:bg-highlight sm:mb-9 sm:text-xl">
            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            Add tracks
          </button>

          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-shading/50 p-8 text-center sm:p-10">
                <Music className="w-12 h-12 text-secondary-label mb-4" />
                <h3 className="text-lg font-medium mb-1">No tracks yet</h3>
                <p className="text-secondary-label text-sm mb-6">Upload a work-in-progress audio file.</p>
                <button onClick={() => setIsUploadOpen(true)} className="text-sm font-medium bg-shading hover:bg-highlight px-4 py-2 rounded-full transition-colors border border-border">
                  Upload Track
                </button>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div key={track.id} onClick={() => handlePlay(track)} className={`group grid cursor-pointer grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-2xl px-2 py-3 transition-all sm:grid-cols-[2rem_1fr_auto] sm:gap-4 sm:px-3 sm:py-4 ${currentTrack?.id === track.id ? 'bg-highlight' : 'hover:bg-shading'}`}>
                  <div className="text-center text-base text-secondary-label sm:text-xl">
                    {currentTrack?.id === track.id && isPlaying ? <Play className="mx-auto h-5 w-5 fill-current text-primary-label" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-primary-label sm:text-xl">{track.title}</h3>
                    <p className="mt-1 text-sm text-secondary-label sm:text-base">{new Date(track.uploadedAt).toLocaleDateString() === new Date().toLocaleDateString() ? 'Now' : new Date(track.uploadedAt).toLocaleDateString()}</p>
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
