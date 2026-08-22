import { Bookmark, Compass, Inbox, Library, Search, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function MobileBottomNav({ user, onInbox }) {
  const location = useLocation();
  if (!user) return null;

  const items = [
    { label: 'Library', to: '/library', icon: Library },
    { label: 'Feed', to: '/feed', icon: Compass },
    { label: 'Search', to: '/search', icon: Search },
    { label: 'Saved', to: '/saved', icon: Bookmark },
    { label: 'Profile', to: `/profile/${user.id}`, icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-border/70 bg-primary-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 items-center">
        {items.map(({ label, to, icon: Icon }) => {
          const active = location.pathname === to || (label === 'Profile' && location.pathname.startsWith('/profile/'));
          return (
            <Link key={label} to={to} className={`group relative grid min-w-0 place-items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-colors ${active ? 'text-[#FF8A3D]' : 'text-secondary-label hover:bg-[#FF8A3D] hover:text-[#F3EBDD]'}`} aria-label={label}>
              <Icon className="h-5 w-5 transition-transform group-hover:scale-105" />
              {active && <span className="absolute -top-2 h-1 w-5 rounded-full bg-[#FF8A3D]" aria-hidden="true" />}
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onInbox} className="grid min-w-0 place-items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold text-secondary-label" aria-label="Inbox">
          <Inbox className="h-5 w-5" />
          <span className="truncate">Inbox</span>
        </button>
      </div>
    </nav>
  );
}
