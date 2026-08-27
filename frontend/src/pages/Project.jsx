import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Download, FileText, Image as ImageIcon, Link2, Lock, MoreHorizontal, Music, Pause, Play, Plus, Shuffle, Trash2, Unlock } from 'lucide-react';
import UploadModal from '../components/UploadModal';
import PageLoading from '../components/PageLoading';
import CoverArtPicker from '../components/CoverArtPicker';
import ConfirmModal from '../components/ConfirmModal';
import ShareLinkModal from '../components/ShareLinkModal';
import MarqueeInput from '../components/MarqueeInput';
import TrackOptionsMenu, { replaceTrackAudio } from '../components/TrackOptionsMenu';
import { useAudio } from '../context/AudioContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function timeAgo(dateStr) {
  const uploaded = new Date(dateStr);
  const now = new Date();
  const diffMs = now - uploaded;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60 || diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (uploaded.getFullYear() === now.getFullYear()) {
    return uploaded.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  return uploaded.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Project({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const { currentTrack, isPlaying, playTrack, addToQueue, setCurrentTrack, setIsPlaying, setProjectCover } = useAudio();
  const [loading, setLoading] = useState(true);
  const [dragTrackId, setDragTrackId] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableArtist, setEditableArtist] = useState('');
  const [uploadingTrack, setUploadingTrack] = useState(null);

  const fetchProject = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Project not found');
      setProject(data.project);
      setEditableTitle(data.project?.title || data.project?.name || 'Untitled project');
      setEditableArtist(data.project?.artist || user.name);
      const refreshedTracks = data.tracks || [];
      setTracks(refreshedTracks);
      // Keep the global player in sync after background Cloudinary promotion.
      // Without this, the page shows the ready version while the player keeps
      // the stale processing object returned by the upload callback.
      setCurrentTrack((current) => {
        if (!current) return current;
        return refreshedTracks.find((track) => track.id === current.id) || current;
      });
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
    playTrack(track, tracks, project.title || project.name, project.coverArt, project.id);
    fetch(`${apiUrl}/api/listen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: user.id, projectId: project?.id, trackId: track.id })
    }).catch((err) => console.error('Failed to record listening activity', err));
  };

  const handleUploadSuccess = (newTrack) => {
    setTracks((prev) => [...prev, newTrack]);
    setUploadingTrack(null);
    setIsUploadOpen(false);
  };
  const handleUploadStart = (title) => setUploadingTrack({ title, progress: 0 });

  const handleCoverSelect = (newCoverUrl) => {
    setProject((prev) => ({ ...prev, coverArt: newCoverUrl }));
    setProjectCover(newCoverUrl); // update spinning disc in AudioPlayer live
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

  const toggleVisibility = async () => {
    const visibility = project.visibility === 'public' ? 'private' : 'public';
    const res = await fetch(`${apiUrl}/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: project.title, artist: project.artist, visibility }) });
    if (res.ok) setProject(await res.json());
    setIsProjectMenuOpen(false);
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

  const handleDeleteTrack = async (trackId) => {
    try {
      setTracks((prev) => prev.filter((track) => track.id !== trackId));
      if (currentTrack?.id === trackId) {
        setIsPlaying(false);
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Failed to delete track', err);
    }
  };

  const handleTrackUpdate = (updatedTrack) => {
    const nextTracks = tracks.map((track) => (track.id === updatedTrack.id ? updatedTrack : track));
    const wasPlaying = currentTrack?.id === updatedTrack.id && isPlaying;
    setTracks(nextTracks);
    if (currentTrack?.id === updatedTrack.id) {
      setCurrentTrack(updatedTrack);
      if (wasPlaying) playTrack(updatedTrack, nextTracks, project?.title || project?.name, project?.coverArt, project?.id);
    }
    // Replacement uploads are acknowledged before Cloudinary promotion
    // completes. Refresh once shortly afterward so the player gets the
    // durable URL and final processing status.
    if (updatedTrack.playbackStatus === 'processing') {
      window.setTimeout(() => fetchProject(), 2500);
    }
  };

  const handleReplaceAudioDrop = async (track, file) => {
    if (!file || !/\.(wav|mp3)$/i.test(file.name)) {
      alert('Please drop a WAV or MP3 file.');
      return;
    }
    try {
      const updatedTrack = await replaceTrackAudio(track, file, user.id);
      handleTrackUpdate(updatedTrack);
    } catch (err) {
      alert(err.message);
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

  if (loading) return <PageLoading />;
  if (!project) return <div className="text-center mt-20">Project not found</div>;

  const isOwner = String(project.userId) === String(user.id);
  const leadTrack = tracks[0];

  return (
    <div className={`project-page-shell relative min-h-screen bg-primary-background pb-32 text-primary-label md:pb-10 ${currentTrack ? 'has-active-player' : ''}`}>
      {isProjectMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)} />
      )}
      <header className="sticky top-0 z-50 flex items-center justify-end bg-transparent px-6 py-6 lg:px-14">
        
        <div className="flex items-center gap-3">
          <button onClick={handleCopyShareLink} className="relative grid h-10 w-10 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-12 sm:w-12 sm:rounded-3xl" aria-label="Copy project link">
            <Link2 className="h-5 w-5 text-accent" />
          </button>

          <div className="relative">
            <button onClick={() => setIsProjectMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-12 sm:w-12 sm:rounded-3xl" aria-label="Project options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {isProjectMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 w-56 rounded-[1.25rem] border border-border panel-bg p-2 shadow-2xl origin-top-right sm:top-16 sm:w-64 sm:p-3"
                >
                  <button onClick={() => { setIsShareModalOpen(true); setIsProjectMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <Link2 className="h-6 w-6 text-accent" />
                    Share project
                  </button>
                  {project.userId === user.id && (
                    <button onClick={toggleVisibility} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                      {project.visibility === 'private' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      {project.visibility === 'private' ? 'Private Â· Make public' : 'Public Â· Make private'}
                    </button>
                  )}
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
                  {isOwner && <button onClick={handleDeleteClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-6 w-6" />
                    Delete project
                  </button>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <nav className="flex items-center gap-2 px-6 text-sm text-secondary-label lg:px-14" aria-label="Breadcrumb">
        <Link to="/library" className="font-semibold transition-colors hover:text-primary-label">Library</Link>
        <span className="opacity-50">/</span>
        <span className="truncate text-primary-label">{project.title || project.name || 'Project'}</span>
      </nav>

      <main className="project-workspace mx-auto grid max-w-5xl gap-6 px-4 pt-4 grid-cols-1 md:grid-cols-[minmax(14rem,18rem)_minmax(20rem,1fr)] md:gap-8 lg:px-10 lg:pt-8">
        <section className="project-cover-panel flex justify-center md:justify-start">
          <div className="group relative aspect-square w-full max-w-[16rem] md:max-w-[18rem] overflow-hidden rounded-[1rem] bg-[linear-gradient(135deg,#43e97b_0%,#38f9d7_48%,#4facfe_100%)] shadow-2xl">
            {project.coverArt && <img src={project.coverArt} alt={project.title || project.name} onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" />}
            <button
              type="button"
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => isOwner && setIsCoverPickerOpen(true)}
              disabled={!isOwner}
            >
              <ImageIcon className="w-8 h-8 text-[#34483B] mb-2" />
              <span className="text-[#34483B] text-sm font-medium">Change Cover</span>
            </button>
          </div>
        </section>

        <section className="project-track-panel pt-2">
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
                  readOnly={!isOwner}
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="text-secondary-label hover:text-primary-label transition-colors" aria-label="Shuffle project">
                  <Shuffle className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    if (!leadTrack) { setIsUploadOpen(true); return; }
                    if (currentTrack && isPlaying) {
                      setIsPlaying(false);
                    } else if (currentTrack) {
                      setIsPlaying(true);
                    } else {
                      handlePlay(leadTrack);
                    }
                  }}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary-background transition-transform hover:bg-accent-hover hover:scale-105"
                  aria-label={isPlaying ? "Pause project" : "Play project"}
                >
                  {isPlaying && currentTrack
                    ? <Pause className="h-6 w-6 fill-current" />
                    : <Play className="h-6 w-6 fill-current translate-x-[2px]" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {project.visibility === 'private' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {project.visibility === 'private' ? 'Private' : 'Public'}
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
                  readOnly={!isOwner}
                />
              </span>
              <span className="whitespace-nowrap font-medium">
                | {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>

          <div className={`project-track-list space-y-2 ${currentTrack ? 'has-active-player' : ''}`}>
            {uploadingTrack && <div className="grid grid-cols-[2rem_1fr] items-center gap-3 rounded-xl bg-shading/60 px-3 py-2.5 opacity-55"><div className="text-center text-xs text-secondary-label">{tracks.length + 1}</div><div className="min-w-0"><h3 className="truncate text-xl font-semibold text-primary-label">{uploadingTrack.title}</h3><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-label"><span>Just now</span><span>1 version</span></div><div className="mt-2 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-primary-background/70"><div className="h-full rounded-full bg-primary-label transition-[width] duration-300" style={{ width: `${uploadingTrack.progress}%` }} /></div></div></div>}
            {tracks.length === 0 && !uploadingTrack ? (
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
                <div
                  key={track.id}
                  onClick={() => handlePlay(track)}
                  onDragOver={(event) => {
                    if (!isOwner) return;
                    event.preventDefault();
                    setDragTrackId(track.id);
                  }}
                  onDragLeave={() => setDragTrackId(null)}
                  onDrop={(event) => {
                    if (!isOwner) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDragTrackId(null);
                    handleReplaceAudioDrop(track, event.dataTransfer.files?.[0]);
                  }}
                  className={`group grid cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-[#F3EBDD] transition-all ${currentTrack?.id === track.id ? 'bg-[#34483B]' : 'hover:bg-shading'} ${dragTrackId === track.id ? 'ring-2 ring-primary-label/40 bg-highlight' : ''}`}
                >
                  <div className="text-center text-xl text-secondary-label">
                    {currentTrack?.id === track.id && isPlaying ? (
                      <span className="flex items-end justify-center gap-[2px] h-5 w-5 mx-auto">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-[3px] rounded-full bg-primary-label"
                            style={{ animation: `audio-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`, height: `${[60,100,75][i]}%` }} />
                        ))}
                      </span>
                    ) : currentTrack?.id === track.id ? (
                      <span className="flex items-end justify-center gap-[2px] h-5 w-5 mx-auto">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-[3px] rounded-full bg-primary-label opacity-40" style={{ height: `${[60,40,75][i]}%` }} />
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-secondary-label">{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold text-primary-label">{track.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-label">
                      {track.uploadedAt && <span>{timeAgo(track.uploadedAt) || 'Just now'}</span>}
                      {track.versions?.length > 1 && <span>{track.activeVersionId ? track.versions.length : track.versions.length + 1} versions</span>}
                    </div>
                    {(track.notes || track.noteMemos?.length > 0) && (
                      <p className="mt-1 truncate text-xs text-secondary-label/80">
                        {track.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-primary-label" onClick={(event) => event.stopPropagation()}>
                    {isOwner && <TrackOptionsMenu
                      track={track}
                      userId={user.id}
                      onTrackUpdate={handleTrackUpdate}
                      onTrackDelete={handleDeleteTrack}
                      onAddToQueue={(queuedTrack) => addToQueue(queuedTrack)}
                      onPlay={handlePlay}
                    />}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Add Tracks Button â€” fixed position, never moves */}
      {isOwner && tracks.length > 0 && (
        <div className={currentTrack ? 'project-upload-active' : 'mt-8 flex justify-center px-4 pb-8'}>
          <button
            onClick={() => setIsUploadOpen(true)}
            className={currentTrack ? 'rmh-add-track-button project-upload-plus' : 'rmh-add-track-button project-upload-action inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold'}
            aria-label={currentTrack ? 'Add track' : 'Upload track'}
          >
            {currentTrack ? <Plus className="h-5 w-5" /> : <><Plus className="h-4 w-4" />Upload track</>}
          </button>
        </div>
      )}

      {isOwner && <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        userId={user.id}
        projectId={id}
        inline
        onStart={handleUploadStart}
        onProgress={(progress) => setUploadingTrack((current) => current ? { ...current, progress } : current)}
      />}

      {isOwner && <CoverArtPicker
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={handleCoverSelect}
        projectId={id}
        userId={user.id}
        onRefresh={fetchWorkspace}
        projectCoverUrl={project?.coverArt}
      />}

      {isOwner && <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete project?"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
      />}

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

