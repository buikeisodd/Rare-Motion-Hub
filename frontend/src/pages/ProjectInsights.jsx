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
    <div className="min-h-screen bg-primary-background px-4 py-6 pb-24 text-primary-label animate-fade-in sm:px-6 sm:py-8 md:px-10 lg:px-14">
      <header>
        <Link to={`/project/${id}`} className="grid h-11 w-11 place-items-center rounded-2xl bg-shading transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Back to project">
          <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center pt-8 text-center sm:pt-10">
        <div className="grid h-36 w-36 place-items-center overflow-hidden rounded-[1.1rem] bg-shading shadow-2xl sm:h-44 sm:w-44 md:h-52 md:w-52">
          {project.coverArt ? (
            <img src={project.coverArt} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" />
          ) : (
            <Music className="h-20 w-20 text-secondary-label" />
          )}
        </div>

        <h1 className="mt-8 text-3xl font-semibold tracking-normal sm:text-4xl md:text-5xl">{project.name}</h1>
        <p className="mt-3 text-base text-secondary-label sm:text-lg">
          {project.ownerName} · {project.trackCount} track{project.trackCount === 1 ? '' : 's'}
        </p>

        <div className="mt-10 sm:mt-12">
          <p className="text-5xl font-light leading-none sm:text-6xl">{totalPlays}</p>
          <p className="mt-2 text-base font-semibold sm:text-lg">Plays</p>
        </div>

        <div className="mt-10 grid w-full max-w-[28rem] grid-cols-2 rounded-full border-2 border-primary-label p-1.5 sm:mt-12 sm:border-4 sm:p-2">
          <button onClick={() => setView('track')} className={`h-12 rounded-full text-base font-bold transition-colors sm:h-14 sm:text-lg ${view === 'track' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By track
          </button>
          <button onClick={() => setView('listener')} className={`h-12 rounded-full text-base font-bold transition-colors sm:h-14 sm:text-lg ${view === 'listener' ? 'bg-shading' : 'hover:bg-highlight'}`}>
            By listener
          </button>
        </div>

        <section className="mt-10 w-full max-w-[32rem] space-y-2 text-left sm:mt-12 sm:space-y-3">
          {view === 'track' ? (
            byTrack.length === 0 ? (
              <p className="text-center text-secondary-label">No tracks yet.</p>
            ) : (
              byTrack.map((track, index) => (
                <div key={track.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-2xl px-3 py-3 hover:bg-shading sm:grid-cols-[2rem_1fr_auto] sm:gap-5 sm:px-4">
                  <span className="text-base text-secondary-label sm:text-xl">{index + 1}</span>
                  <span className="truncate text-base font-bold sm:text-xl">{track.title}</span>
                  <span className="inline-flex items-center gap-2 text-base text-secondary-label sm:text-xl">
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
              <div key={listener.id} className="grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-3 rounded-2xl px-3 py-3 hover:bg-shading sm:grid-cols-[2rem_auto_1fr_auto] sm:gap-4 sm:px-4">
                <span className="text-base text-secondary-label sm:text-xl">{index + 1}</span>
                <ListenerAvatar listener={listener} />
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold sm:text-xl">{listener.name}</span>
                  <span className="mt-1 block truncate text-sm text-secondary-label">{new Date(listener.lastListenedAt).toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-2 text-base text-secondary-label sm:text-xl">
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
