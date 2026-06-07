import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, ChevronLeft, Download, FileText, Image as ImageIcon, Link2, Lock, MoreHorizontal, Music, Play, Plus, Shuffle, Trash2 } from 'lucide-react';
import UploadModal from '../components/UploadModal';
import CoverArtPicker from '../components/CoverArtPicker';
import ConfirmModal from '../components/ConfirmModal';
import ShareLinkModal from '../components/ShareLinkModal';
import MarqueeInput from '../components/MarqueeInput';
import { useAudio } from '../context/AudioContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function timeAgo(dateStr) {
  const uploaded = new Date(dateStr);
  const now = new Date();
  const diffMs = now - uploaded;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return uploaded.toLocaleDateString();
}

export default function Project({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const { currentTrack, isPlaying, playTrack } = useAudio();
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableArtist, setEditableArtist] = useState('');

  const fetchProject = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Project not found');
      setProject(data.project);
      setEditableTitle(data.project?.title || data.project?.name || 'Untitled project');
      setEditableArtist(data.project?.artist || user.name);
      setTracks(data.tracks || []);
    } catch (err) {
      console.error('Failed to fetch project', err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject({ showLoading: true });
  }, [id, user.id]);

  const fetchWorkspace = fetchProject;

  const handlePlay = (track) => {
    playTrack(track, tracks, project.title || project.name);
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

  const saveProjectMetadata = async () => {
    const nextTitle = editableTitle.trim() || 'Untitled project';
    const nextArtist = editableArtist.trim() || user.name;
    setEditableTitle(nextTitle);
    setEditableArtist(nextArtist);
    setProject((prev) => prev ? { ...prev, title: nextTitle, name: nextTitle, artist: nextArtist } : prev);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: nextTitle, artist: nextArtist })
      });
      const savedProject = await res.json();
      if (!res.ok) throw new Error(savedProject.error || 'Could not update project.');
      setProject(savedProject);
    } catch (err) {
      console.error('Failed to save project metadata', err);
    }
  };

  const handleDeleteClick = (e) => {
    setIsProjectMenuOpen(false);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsConfirmOpen(false);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete project');
      navigate('/library');
    } catch (err) {
      alert(err.message);
      console.error(err);
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

  const handleExport = async () => {
    setIsProjectMenuOpen(false);
    if (!tracks.length) {
      alert('No tracks to export.');
      return;
    }
    for (const track of tracks) {
      try {
        const res = await fetch(track.url);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${track.title || 'track'}.wav`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(`Failed to export track ${track.title}`, err);
      }
    }
  };

  const handleCopyShareLink = async () => {
    setIsShareModalOpen(true);
  };

  if (loading) return null;
  if (!project) return <div className="text-center mt-20">Project not found</div>;

  const leadTrack = tracks[0];

  return (
    <div className="relative min-h-screen bg-primary-background pb-40">
      {isProjectMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)} />
      )}
      <header className="relative z-50 flex items-center justify-between px-6 py-6 lg:px-14">
        <Link to="/library" className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Back to library">
          <ChevronLeft className="h-6 w-6" />
        </Link>

        <div className="flex items-center gap-3">
          <button onClick={handleCopyShareLink} className="relative grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Copy project link">
            <Link2 className="h-5 w-5" />
          </button>

          <div className="relative">
            <button onClick={() => setIsProjectMenuOpen((open) => !open)} className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Project options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {isProjectMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-16 z-50 w-64 rounded-[1.25rem] border border-border panel-bg p-3 shadow-2xl origin-top-right"
                >
                  <button onClick={() => { setIsShareModalOpen(true); setIsProjectMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <Link2 className="h-6 w-6" />
                    Share project
                  </button>
                  <button onClick={() => navigate(`/project/${id}/insights`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <BarChart3 className="h-6 w-6" />
                    Insights
                  </button>
                  <button onClick={() => { alert('Notes are coming soon.'); setIsProjectMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <FileText className="h-6 w-6" />
                    Notes
                  </button>
                  <button onClick={handleExport} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <Download className="h-6 w-6" />
                    Export
                  </button>
                  <div className="my-3 border-t border-border" />
                  <button onClick={handleDeleteClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-6 w-6" />
                    Delete project
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pt-4 grid-cols-1 md:grid-cols-[minmax(14rem,18rem)_minmax(20rem,1fr)] md:gap-8 lg:px-10 lg:pt-8">
        <section className="flex justify-center md:justify-start">
          <div className="group relative aspect-square w-full max-w-[16rem] md:max-w-[18rem] overflow-hidden rounded-[1rem] bg-[linear-gradient(135deg,#b7ff63_0%,#d6c18e_45%,#d84f93_100%)] shadow-2xl">
            {project.coverArt && <img src={project.coverArt} alt={project.title || project.name} onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" />}
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
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 overflow-hidden">
                <MarqueeInput
                  value={editableTitle}
                  onChange={(event) => setEditableTitle(event.target.value)}
                  onBlur={saveProjectMetadata}
                  className="w-full"
                  textClassName="text-3xl sm:text-4xl font-bold tracking-tight text-primary-label"
                  placeholder="Project title"
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="text-secondary-label hover:text-primary-label transition-colors" aria-label="Shuffle project">
                  <Shuffle className="h-5 w-5" />
                </button>
                <button onClick={() => leadTrack ? handlePlay(leadTrack) : setIsUploadOpen(true)} className="grid h-12 w-12 place-items-center rounded-full bg-primary-label text-primary-background transition-transform hover:scale-105" aria-label={leadTrack ? "Play project" : "Add tracks"}>
                  <Play className="h-6 w-6 fill-current translate-x-[2px]" />
                </button>
              </div>
            </div>

            <p className="flex flex-wrap items-center text-sm md:text-base text-secondary-label">
              <span className="min-w-0 max-w-[10rem] sm:max-w-[14rem] overflow-hidden mr-1">
                <MarqueeInput
                  value={editableArtist}
                  onChange={(event) => setEditableArtist(event.target.value)}
                  onBlur={saveProjectMetadata}
                  className="w-full"
                  textClassName="text-secondary-label font-medium"
                  placeholder="Artist"
                />
              </span>
              <span className="whitespace-nowrap font-medium">
                • {tracks.length} track{tracks.length !== 1 ? 's' : ''} • {
                  (() => {
                    const latestTrackTime = tracks.length > 0 
                      ? Math.max(...tracks.map(t => new Date(t.uploadedAt).getTime()))
                      : null;
                    const projTime = new Date(project.updatedAt || project.createdAt).getTime();
                    const lastUpdated = latestTrackTime ? Math.max(latestTrackTime, projTime) : projTime;
                    return timeAgo(new Date(lastUpdated).toISOString());
                  })()
                }
              </span>
            </p>
          </div>

          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-shading/50 p-10 text-center">
                <Music className="w-12 h-12 text-secondary-label mb-4" />
                <h3 className="text-lg font-medium mb-1">No tracks yet</h3>
                <p className="text-secondary-label text-sm mb-6">Upload a work-in-progress audio file.</p>
                <button onClick={() => setIsUploadOpen(true)} className="text-sm font-medium bg-shading hover:bg-highlight px-4 py-2 rounded-full transition-colors border border-border">
                  Upload Track
                </button>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div key={track.id} onClick={() => handlePlay(track)} className={`group grid cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-2xl px-3 py-4 transition-all ${currentTrack?.id === track.id ? 'bg-highlight' : 'hover:bg-shading'}`}>
                  <div className="text-center text-xl text-secondary-label">
                    {currentTrack?.id === track.id && isPlaying ? <Play className="mx-auto h-5 w-5 fill-current text-primary-label" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold text-primary-label">{track.title}</h3>
                    <p className="mt-1 text-base text-secondary-label">{timeAgo(track.uploadedAt)}</p>
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

      {/* Desktop Add Tracks Button */}
      <button onClick={() => setIsUploadOpen(true)} className="fixed bottom-4 right-4 sm:bottom-7 sm:right-8 lg:right-12 z-40 hidden md:grid h-14 w-14 place-items-center rounded-full bg-primary-label text-primary-background shadow-2xl transition-transform hover:scale-105" aria-label="Add tracks">
        <Plus className="h-7 w-7" />
      </button>

      {/* Mobile Add Tracks Button */}
      <button onClick={() => setIsUploadOpen(true)} className="fixed bottom-4 right-4 z-40 md:hidden grid h-14 w-14 place-items-center rounded-full bg-primary-label text-primary-background shadow-2xl transition-transform hover:scale-105" aria-label="Add tracks">
        <Plus className="h-7 w-7" />
      </button>

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

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete project?"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
      />

      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        type="project"
        targetId={id}
        userId={user?.id}
      />
    </div>
  );
}
