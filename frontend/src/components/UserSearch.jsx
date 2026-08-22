import { useState, useEffect } from 'react';
import { Search, X, UserRound, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function UserSearch({ currentUser, onSelectUser }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`${apiUrl}/api/users`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const q = query.toLowerCase().trim();
          const matches = (data.users || []).filter((user) => {
            if (user.id === currentUser?.id) return false;
            const nameMatch = (user.name || '').toLowerCase().includes(q);
            const userMatch = (user.username || '').toLowerCase().includes(q);
            return nameMatch || userMatch;
          });
          setUsers(matches);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser?.id]);

  const handleFollow = async (e, person) => {
    e.preventDefault();
    e.stopPropagation();
    setUsers((current) =>
      current.map((u) => (u.id === person.id ? { ...u, isFollowing: !u.isFollowing } : u))
    );
    await fetch(`${apiUrl}/api/auth/${person.id}/follow`, { method: 'POST' });
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-4 w-4 text-secondary-label pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="sEaRcH uSeRs..."
          className="h-11 w-full rounded-2xl border border-white/10 bg-shading/60 pl-11 pr-10 text-sm text-[#34483B] placeholder-secondary-label outline-none backdrop-blur-md transition-all focus:border-[#FF8A3D]/50 focus:bg-shading/90"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setUsers([]);
            }}
            className="absolute right-3 grid h-6 w-6 place-items-center rounded-full text-secondary-label hover:bg-highlight hover:text-[#34483B]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-3xl border border-white/10 bg-[#0c0c0e]/95 p-3 shadow-2xl backdrop-blur-xl">
            {loading && users.length === 0 ? (
              <p className="py-4 text-center text-xs text-secondary-label">Searching users...</p>
            ) : users.length === 0 ? (
              <p className="py-4 text-center text-xs text-secondary-label">No users found for &quot;{query}&quot;</p>
            ) : (
              <div className="space-y-1">
                {users.map((person) => {
                  const buttonText = person.isFollowing
                    ? 'Following'
                    : person.followsYou
                    ? 'Follow Back'
                    : 'Follow';
                  return (
                    <Link
                      key={person.id}
                      to={'/profile/' + person.id}
                      onClick={() => {
                        setIsOpen(false);
                        if (onSelectUser) onSelectUser(person);
                      }}
                      className="flex items-center justify-between rounded-2xl p-2.5 transition-colors hover:bg-highlight/60 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight text-sm font-semibold text-[#34483B]">
                          {person.avatarUrl ? (
                            <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (person.name || '?').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#34483B] group-hover:underline">
                            {person.name}
                          </p>
                          <p className="truncate text-xs text-secondary-label">
                            @{person.username || person.name}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleFollow(e, person)}
                        className={`ml-2 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 ${
                          person.isFollowing
                            ? 'bg-shading text-secondary-label'
                            : person.followsYou
                            ? 'bg-[#FF8A3D] text-black'
                            : 'bg-primary-label text-primary-background'
                        }`}
                      >
                        {buttonText}
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
