import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Folder, Music, Play, Plus } from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function OwnerAvatar({ owner }) {
  if (owner?.avatarUrl) {
    return <img src={owner.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }

  return (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-sm font-bold text-black">
      {owner?.name?.slice(0, 1).toUpperCase() || 'U'}
    </div>
  );
}

export default function SharedItem({ user }) {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [sharedItem, setSharedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedItem() {
      try {
        const res = await fetch(`${apiUrl}/api/share/${type}/${id}`);
        const data = await res.json();
        if (!cancelled) setSharedItem(res.ok ? data : null);
      } catch (err) {
        console.error('Failed to load shared item', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSharedItem();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  const tracks = sharedItem?.tracks || [];
  const itemName = sharedItem?.project?.name || sharedItem?.folder?.name || 'Shared item';

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
      body: JSON.stringify({
        userId: user.id,
        projectId: track.projectId || sharedItem?.project?.id,
        folderId: sharedItem?.folder?.id,
        trackId: track.id
      })
    }).catch((err) => console.error('Failed to record listening activity', err));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/share/${type}/${id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save shared item.');

      const savedProjectId = data.project?.id || data.projects?.[0]?.id;
      if (savedProjectId) navigate(`/project/${savedProjectId}`);
      else navigate('/library');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!sharedItem) return <div className="mt-20 text-center text-primary-label">Shared item not found</div>;

  const trackIndex = currentTrack ? tracks.findIndex((track) => track.id === currentTrack.id) : -1;
  const hasNext = trackIndex !== -1 && trackIndex < tracks.length - 1;
  const hasPrev = trackIndex > 0;

  return (
    <div className="min-h-screen bg-primary-background px-6 py-12 pb-40 text-primary-label md:px-20 animate-fade-in">
      <header className="flex items-center justify-between">
        <Link to="/library" className="grid h-16 w-16 place-items-center rounded-3xl bg-shading transition-colors hover:bg-highlight" aria-label="Back to library">
          <ChevronLeft className="h-8 w-8" />
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex h-16 items-center gap-3 rounded-full bg-primary-label px-7 text-lg font-bold text-primary-background disabled:opacity-60">
          <Plus className="h-5 w-5" />
          {saving ? 'Saving' : 'Save to library'}
        </button>
      </header>

      <main className="mx-auto mt-16 grid max-w-6xl gap-14 md:grid-cols-[minmax(18rem,32rem)_1fr]">
        <section>
          <div className="grid aspect-square w-full max-w-[32rem] place-items-center overflow-hidden rounded-[1.5rem] bg-shading shadow-2xl">
            {sharedItem.project?.coverArt ? (
              <img src={sharedItem.project.coverArt} alt="" className="h-full w-full object-cover" />
            ) : type === 'folder' ? (
              <Folder className="h-28 w-28 text-secondary-label" />
            ) : (
              <Music className="h-28 w-28 text-secondary-label" />
            )}
          </div>
        </section>

        <section>
          <div className="mb-10">
            <p className="mb-4 inline-flex items-center gap-3 text-secondary-label">
              <OwnerAvatar owner={sharedItem.owner} />
              Shared by {sharedItem.owner?.name || 'Unknown user'}
            </p>
            <h1 className="text-4xl font-semibold tracking-normal md:text-6xl">{itemName}</h1>
            <p className="mt-4 text-xl text-secondary-label">
              {type === 'folder' ? `${sharedItem.projects?.length || 0} project` : `${tracks.length} track`}{(type === 'folder' ? sharedItem.projects?.length : tracks.length) === 1 ? '' : 's'}
            </p>
          </div>

          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-shading/50 p-12 text-center text-secondary-label">
                No tracks in this shared {type}.
              </div>
            ) : (
              tracks.map((track, index) => (
                <button key={track.id} onClick={() => handlePlay(track)} className={`grid w-full grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-2xl px-3 py-4 text-left transition-all ${currentTrack?.id === track.id ? 'bg-highlight' : 'hover:bg-shading'}`}>
                  <span className="text-center text-xl text-secondary-label">{currentTrack?.id === track.id && isPlaying ? <Play className="mx-auto h-5 w-5 fill-current text-primary-label" /> : index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xl font-semibold">{track.title}</span>
                    <span className="mt-1 block truncate text-lg text-secondary-label">{track.artist || track.producer || sharedItem.owner?.name || 'Shared track'}</span>
                  </span>
                  <Play className="h-5 w-5 fill-current" />
                </button>
              ))
            )}
          </div>
        </section>
      </main>

      {currentTrack && (
        <AudioPlayer
          track={currentTrack}
          projectName={itemName}
          isPlaying={isPlaying}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onPlayPause={() => setIsPlaying((playing) => !playing)}
          onNext={() => {
            if (hasNext) {
              setCurrentTrack(tracks[trackIndex + 1]);
              setIsPlaying(true);
            }
          }}
          onPrev={() => {
            if (hasPrev) {
              setCurrentTrack(tracks[trackIndex - 1]);
              setIsPlaying(true);
            }
          }}
        />
      )}
    </div>
  );
}
