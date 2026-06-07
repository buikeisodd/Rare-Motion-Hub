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

export default function SharedItem({ user, isLink }) {
  const { type, id, token } = useParams();
  const navigate = useNavigate();
  const [sharedItem, setSharedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedItem() {
      try {
        const url = isLink ? `${apiUrl}/api/share/link/${token}` : `${apiUrl}/api/share/${type}/${id}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          if (res.status === 410 || data.expired) {
            setIsExpired(true);
          } else {
            setSharedItem(res.ok ? data : null);
          }
        }
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
  }, [id, type, token, isLink]);

  const tracks = sharedItem?.tracks || [];
  const itemName = sharedItem?.project?.name || sharedItem?.folder?.name || 'Shared item';

  const handlePlay = (track) => {
    const isSameTrack = currentTrack?.id === track.id;
    if (currentTrack?.id === track.id) {
      setIsPlaying((playing) => !playing);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }

    if (!isSameTrack || !isPlaying) {
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
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const actualType = isLink ? sharedItem?.type : type;
      const actualId = isLink ? (sharedItem?.folder?.id || sharedItem?.project?.id) : id;
      
      const res = await fetch(`${apiUrl}/api/share/${actualType}/${actualId}/save`, {
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
  if (isExpired) {
    return (
      <div className="min-h-screen bg-primary-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold text-primary-label mb-4">Link no longer accessible</h1>
        <p className="text-secondary-label text-lg max-w-md">This share link has expired and is no longer available.</p>
        <Link to="/library" className="mt-8 rounded-full bg-primary-label px-8 py-3 text-primary-background font-semibold hover:opacity-90 transition-opacity">
          Return to Library
        </Link>
      </div>
    );
  }
  if (!sharedItem) return <div className="mt-20 text-center text-primary-label">Shared item not found</div>;

  const actualType = isLink ? sharedItem?.type : type;
  const trackIndex = currentTrack ? tracks.findIndex((track) => track.id === currentTrack.id) : -1;
  const hasNext = trackIndex !== -1 && trackIndex < tracks.length - 1;
  const hasPrev = trackIndex > 0;

  return (
    <div className="min-h-screen bg-primary-background px-4 py-6 pb-36 text-primary-label sm:px-6 sm:py-8 md:px-10 lg:px-14">
      <header className="flex items-center justify-between">
        <Link to="/library" className="grid h-11 w-11 place-items-center rounded-2xl bg-shading transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Back to library">
          <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary-label px-5 text-sm font-bold text-primary-background disabled:opacity-60 sm:h-14 sm:gap-3 sm:px-6 sm:text-base">
          <Plus className="h-5 w-5" />
          {saving ? 'Saving' : 'Save to library'}
        </button>
      </header>

      <main className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-[minmax(16rem,28rem)_1fr] md:gap-12">
        <section className="flex justify-center md:justify-start">
          <div className="grid aspect-square w-full max-w-[24rem] place-items-center overflow-hidden rounded-[1.25rem] bg-shading shadow-2xl md:max-w-[28rem]">
            {sharedItem.project?.coverArt ? (
              <img src={sharedItem.project.coverArt} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" />
            ) : actualType === 'folder' ? (
              <Folder className="h-20 w-20 text-secondary-label sm:h-24 sm:w-24" />
            ) : (
              <Music className="h-20 w-20 text-secondary-label sm:h-24 sm:w-24" />
            )}
          </div>
        </section>

        <section>
          <div className="mb-8">
            <p className="mb-4 inline-flex items-center gap-3 text-secondary-label">
              <OwnerAvatar owner={sharedItem.owner} />
              Shared by {sharedItem.owner?.name || 'Unknown user'}
            </p>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl md:text-5xl">{itemName}</h1>
            <p className="mt-3 text-base text-secondary-label sm:text-lg">
              {actualType === 'folder' ? `${sharedItem.projects?.length || 0} project` : `${tracks.length} track`}{(actualType === 'folder' ? sharedItem.projects?.length : tracks.length) === 1 ? '' : 's'}
            </p>
          </div>

          <div className="space-y-2">
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-shading/50 p-8 text-center text-secondary-label sm:p-10">
                No tracks in this shared {actualType}.
              </div>
            ) : (
              tracks.map((track, index) => (
                <button key={track.id} onClick={() => handlePlay(track)} className={`grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-2xl px-2 py-3 text-left transition-all sm:grid-cols-[2rem_1fr_auto] sm:gap-4 sm:px-3 sm:py-4 ${currentTrack?.id === track.id ? 'bg-highlight' : 'hover:bg-shading'}`}>
                  <span className="text-center text-base text-secondary-label sm:text-xl">{currentTrack?.id === track.id && isPlaying ? <Play className="mx-auto h-5 w-5 fill-current text-primary-label" /> : index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold sm:text-xl">{track.title}</span>
                    <span className="mt-1 block truncate text-sm text-secondary-label sm:text-base">{track.artist || track.producer || sharedItem.owner?.name || 'Shared track'}</span>
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
