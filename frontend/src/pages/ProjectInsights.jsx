import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Music, Play } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ListenerAvatar({ listener }) {
  if (listener.avatarUrl) {
    return <img src={listener.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover sm:h-11 sm:w-11" />;
  }

  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-xs font-bold text-black sm:h-11 sm:w-11 sm:text-sm">
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
    <div className="min-h-screen bg-primary-background px-4 py-5 pb-24 text-primary-label sm:px-6 sm:py-6 md:px-10 lg:px-14">
      <header>
        <Link to={`/project/${id}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-shading transition-colors hover:bg-highlight sm:h-12 sm:w-12 sm:rounded-3xl" aria-label="Back to project">
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center pt-6 text-center sm:pt-8 lg:max-w-xl">
        <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-shading shadow-xl sm:h-32 sm:w-32 md:h-40 md:w-40">
          {project.coverArt ? (
            <img src={project.coverArt} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" />
          ) : (
            <Music className="h-12 w-12 text-secondary-label sm:h-16 sm:w-16" />
          )}
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-normal sm:mt-6 sm:text-2xl md:text-3xl">{project.name}</h1>
        <p className="mt-1.5 text-sm text-secondary-label sm:text-base">
          {project.ownerName} · {project.trackCount} track{project.trackCount === 1 ? '' : 's'}
        </p>

        <div className="mt-6 sm:mt-8">
          <p className="text-4xl font-light leading-none sm:text-5xl">{totalPlays}</p>
          <p className="mt-1.5 text-sm font-semibold sm:text-base">Plays</p>
        </div>

        <div className="mt-6 grid w-full max-w-xs grid-cols-2 rounded-full border border-border p-1 sm:mt-8 sm:max-w-sm sm:p-1.5">
          <button onClick={() => setView('track')} className={`h-9 rounded-full text-sm font-bold transition-colors sm:h-10 sm:text-base ${view === 'track' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By track
          </button>
          <button onClick={() => setView('listener')} className={`h-9 rounded-full text-sm font-bold transition-colors sm:h-10 sm:text-base ${view === 'listener' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By listener
          </button>
        </div>

        <section className="mt-6 w-full max-w-lg space-y-1 text-left sm:mt-8 sm:space-y-2">
          {view === 'track' ? (
            byTrack.length === 0 ? (
              <p className="text-center text-secondary-label">No tracks yet.</p>
            ) : (
              byTrack.map((track, index) => (
                <div key={track.id} className="grid grid-cols-[1.2rem_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 hover:bg-shading sm:grid-cols-[1.5rem_1fr_auto] sm:gap-3 sm:px-3 sm:py-2.5">
                  <span className="text-sm text-secondary-label sm:text-base">{index + 1}</span>
                  <span className="truncate text-sm font-bold sm:text-base">{track.title}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-secondary-label sm:text-base">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {track.plays}
                  </span>
                </div>
              ))
            )
          ) : byListener.length === 0 ? (
            <p className="text-center text-secondary-label">No listeners yet.</p>
          ) : (
            byListener.map((listener, index) => (
              <div key={listener.id} className="grid grid-cols-[1.2rem_auto_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 hover:bg-shading sm:grid-cols-[1.5rem_auto_1fr_auto] sm:gap-3 sm:px-3 sm:py-2.5">
                <span className="text-sm text-secondary-label sm:text-base">{index + 1}</span>
                <ListenerAvatar listener={listener} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold sm:text-base">{listener.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-secondary-label sm:text-sm">{new Date(listener.lastListenedAt).toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-secondary-label sm:text-base">
                  <Play className="h-3.5 w-3.5 fill-current" />
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
