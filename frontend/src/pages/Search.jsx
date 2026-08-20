import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarlightLogo from '../components/StarlightLogo';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  const csrfToken = localStorage.getItem('csrfToken');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  return fetch(url, { ...options, headers, credentials: 'include' });
};

export default function Search({ user }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${apiUrl}/api/users`)
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users
      .filter((person) => person.id !== user?.id)
      .filter((person) => !term || `${person.name || ''} ${person.username || ''}`.toLowerCase().includes(term))
      .slice(0, 40);
  }, [query, user?.id, users]);

  return (
    <div className="min-h-screen bg-primary-background px-4 pb-32 pt-4 text-primary-label sm:px-6 md:px-10">
      <header className="mx-auto flex max-w-2xl items-center justify-between border-b border-border/60 pb-3">
        <StarlightLogo className="logo-glow h-9 w-36 text-primary-label" />
        <UserRound className="h-5 w-5 text-secondary-label" />
      </header>

      <main className="mx-auto max-w-2xl py-5">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-shading px-4">
          <SearchIcon className="h-5 w-5 shrink-0 text-secondary-label" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-secondary-label"
            autoFocus
          />
        </label>

        <section className="mt-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-secondary-label">Searching...</p>
          ) : results.length === 0 ? (
            <p className="py-12 text-center text-sm text-secondary-label">No users found.</p>
          ) : (
            <div className="divide-y divide-border/70">
              {results.map((person) => (
                <Link key={person.id} to={`/profile/${person.id}`} className="flex items-center gap-3 py-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight text-sm font-semibold">
                    {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : (person.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{person.name || 'Unknown user'}</p>
                    <p className="truncate text-xs text-secondary-label">@{person.username || person.name || 'user'}</p>
                  </div>
                  <span className="rounded-full bg-shading px-3 py-1.5 text-xs font-semibold text-primary-label">View</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
