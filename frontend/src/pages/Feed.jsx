import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Pause, Play, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StarlightLogo from '../components/StarlightLogo';
import { useAudio } from '../context/AudioContext';
import { defaultGradient, gradientFor } from '../utils/gradients';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function dateLabel(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Feed({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentTrack, isPlaying, setIsPlaying, playTrack } = useAudio();

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/api/feed`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load feed.');
        if (!cancelled) setItems(data.items || []);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const togglePlay = (item) => {
    if (currentTrack?.id === item.id) {
      setIsPlaying(!isPlaying);
      return;
    }
    playTrack(item, [item], item.project?.title || 'Feed', item.project?.coverArt || null, item.project?.id);
  };

  return (
    <div className="min-h-screen bg-primary-background px-5 pb-20 text-primary-label sm:px-8">
      <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-border/60 py-5">
        <Link to="/library" className="grid h-10 w-10 place-items-center rounded-full bg-shading transition-colors hover:bg-highlight" aria-label="Back to library">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <StarlightLogo className="logo-glow h-10 w-40 text-primary-label" />
        <div className="grid h-10 w-10 place-items-center rounded-full bg-shading text-secondary-label" aria-label="Your feed">
          <Radio className="h-5 w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-label">Discover</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Feed</h1>
          <p className="mt-2 text-sm text-secondary-label">Preview new music from the Rare Motion community.</p>
        </div>

        {loading && <p className="py-16 text-center text-sm text-secondary-label">Loading the latest previews...</p>}
        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-shading/40 px-6 py-16 text-center">
            <Radio className="mx-auto mb-4 h-8 w-8 text-secondary-label" />
            <p className="font-semibold">The feed is quiet for now.</p>
            <p className="mt-2 text-sm text-secondary-label">Publish a track from its options menu to share a preview.</p>
          </div>
        )}

        <div className="space-y-8">
          {items.map((item, index) => {
            const playing = currentTrack?.id === item.id && isPlaying;
            const cover = item.project?.coverArt;
            return (
              <motion.article key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="overflow-hidden rounded-2xl border border-border bg-shading/35">
                <div className="flex items-center gap-3 px-5 py-4">
                  {item.owner?.avatarUrl ? <img src={item.owner.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-highlight text-sm font-semibold">{(item.owner?.name || user?.name || '?').slice(0, 1).toUpperCase()}</div>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.owner?.name || 'Unknown artist'}</p><p className="text-xs text-secondary-label">{dateLabel(item.publishedAt || item.uploadedAt)}</p></div>
                </div>
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(item.id) || defaultGradient}`} />}
                  <button onClick={() => togglePlay(item)} className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-primary-label text-primary-background shadow-xl transition-transform hover:scale-105" aria-label={playing ? 'Pause preview' : 'Play preview'}>{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-1 h-5 w-5 fill-current" />}</button>
                </div>
                <div className="px-5 py-4"><h2 className="font-semibold">{item.title || 'Untitled track'}</h2><p className="mt-1 text-sm text-secondary-label">{item.project?.title || 'Project preview'}</p>{item.feedCaption && <p className="mt-3 text-sm">{item.feedCaption}</p>}<div className="mt-4 flex items-center gap-5 text-secondary-label"><Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><span className="text-xs">Preview</span></div></div>
              </motion.article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
