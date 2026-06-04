import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Music, Play } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ListenerAvatar({ listener }) {
  if (listener.avatarUrl) {
    return <img src={listener.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />;
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-sm font-bold text-black">
      {listener.name?.slice(0, 1).toUpperCase() || 'U'}
    </div>
  );
}

export default function ProjectInsights({ user }) {
  const { id } = useParams();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('track');

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      try {
        const res = await fetch(`${apiUrl}/api/projects/${id}/insights?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
        if (!cancelled) setInsights(res.ok ? data : null);
      } catch (err) {
        console.error('Failed to load insights', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInsights();
    return () => {
      cancelled = true;
    };
  }, [id, user.id]);

  if (loading) return null;
  if (!insights) return <div className="mt-20 text-center text-primary-label">Insights not found</div>;

  const { project, totalPlays, byTrack, byListener } = insights;

  return (
    <div className="min-h-screen bg-primary-background px-6 py-12 pb-32 text-primary-label md:px-20 animate-fade-in">
      <header>
        <Link to={`/project/${id}`} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading transition-colors hover:bg-highlight" aria-label="Back to project">
          <ChevronLeft className="h-8 w-8" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center pt-10 text-center">
        <div className="grid h-56 w-56 place-items-center overflow-hidden rounded-[1.4rem] bg-shading shadow-2xl">
          {project.coverArt ? (
            <img src={project.coverArt} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music className="h-20 w-20 text-secondary-label" />
          )}
        </div>

        <h1 className="mt-10 text-4xl font-semibold tracking-normal md:text-5xl">{project.name}</h1>
        <p className="mt-3 text-xl text-secondary-label">
          {project.ownerName} · {project.trackCount} track{project.trackCount === 1 ? '' : 's'}
        </p>

        <div className="mt-14">
          <p className="text-7xl font-light leading-none">{totalPlays}</p>
          <p className="mt-2 text-lg font-semibold">Plays</p>
        </div>

        <div className="mt-14 grid w-full max-w-[32rem] grid-cols-2 rounded-full border-4 border-primary-label p-2">
          <button onClick={() => setView('track')} className={`h-16 rounded-full text-xl font-bold transition-colors ${view === 'track' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By track
          </button>
          <button onClick={() => setView('listener')} className={`h-16 rounded-full text-xl font-bold transition-colors ${view === 'listener' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By listener
          </button>
        </div>

        <section className="mt-14 w-full max-w-[34rem] space-y-3 text-left">
          {view === 'track' ? (
            byTrack.length === 0 ? (
              <p className="text-center text-secondary-label">No tracks yet.</p>
            ) : (
              byTrack.map((track, index) => (
                <div key={track.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-5 rounded-2xl px-4 py-3 hover:bg-shading">
                  <span className="text-xl text-secondary-label">{index + 1}</span>
                  <span className="truncate text-xl font-bold">{track.title}</span>
                  <span className="inline-flex items-center gap-2 text-xl text-secondary-label">
                    <Play className="h-4 w-4 fill-current" />
                    {track.plays}
                  </span>
                </div>
              ))
            )
          ) : byListener.length === 0 ? (
            <p className="text-center text-secondary-label">No listeners yet.</p>
          ) : (
            byListener.map((listener, index) => (
              <div key={listener.id} className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-4 rounded-2xl px-4 py-3 hover:bg-shading">
                <span className="text-xl text-secondary-label">{index + 1}</span>
                <ListenerAvatar listener={listener} />
                <span className="min-w-0">
                  <span className="block truncate text-xl font-bold">{listener.name}</span>
                  <span className="mt-1 block truncate text-sm text-secondary-label">{new Date(listener.lastListenedAt).toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-2 text-xl text-secondary-label">
                  <Play className="h-4 w-4 fill-current" />
                  {listener.plays}
                </span>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
