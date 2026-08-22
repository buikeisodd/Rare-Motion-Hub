import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Heart, Library, MessageCircle, MoreHorizontal, Pause, Play, Radio, Search, Send, Settings, Trash2, UserRound, Volume2, VolumeX, X } from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { defaultGradient, gradientFor } from '../utils/gradients';
import ChatInbox from '../components/ChatInbox';
import AudioPlayer from '../components/AudioPlayer';
import { useAudio } from '../context/AudioContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const MAX_QUICK_ADD_SUGGESTIONS = 5;
const Link = (props) => <RouterLink {...props} to={(props.children === 'Settings' || (Array.isArray(props.children) && props.children.includes('Settings'))) ? '/settings' : props.to} />;
const dateLabel = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

function QuickAdd({ suggestions, onFollow, onDismiss }) {
  return (
    <aside className="fixed right-4 top-4 z-30 hidden w-72 xl:block">
      <div className="rounded-3xl border border-white/10 bg-primary-background/60 p-3.5 shadow-2xl backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold tracking-wider text-[#34483B]">qUiCk aDd</h2>
          <UserRound className="h-4 w-4 text-[#34483B]/70" />
        </div>
        {suggestions.length === 0 ? (
          <p className="text-xs text-[#34483B]/70">You are all caught up.</p>
        ) : (
          <div className="space-y-2.5">
            {suggestions.slice(0, Math.min(3, MAX_QUICK_ADD_SUGGESTIONS)).map((person) => {
              const buttonText = person.isFollowing
                ? 'Following'
                : person.followsYou
                ? 'Follow Back'
                : 'Follow';
              return (
                <div key={person.id} className="group relative flex items-center gap-2.5">
                  <RouterLink to={'/profile/' + person.id} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight text-xs font-semibold shadow-inner">
                    {person.avatarUrl ? (
                      <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (person.name || '?').slice(0, 1).toUpperCase()
                    )}
                  </RouterLink>
                  <div className="min-w-0 flex-1">
                    <RouterLink to={'/profile/' + person.id} className="truncate text-sm font-semibold block hover:underline text-[#34483B]">
                      {person.name}
                    </RouterLink>
                    <p className="truncate text-[11px] text-[#34483B]/70">
                      @{person.username || person.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onFollow(person)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition-all hover:scale-105 ${
                        person.isFollowing
                          ? 'bg-shading text-[#34483B]/70'
                          : person.followsYou
                          ? 'bg-accent text-[#F3EBDD] hover:bg-accent-hover'
                          : 'bg-accent text-[#F3EBDD] hover:bg-accent-hover'
                      }`}
                    >
                      {buttonText}
                    </button>
                    <button
                      onClick={() => onDismiss(person)}
                      className="grid h-6 w-6 place-items-center rounded-full text-[#34483B]/70 opacity-60 transition-colors hover:bg-accent hover:text-[#F3EBDD] hover:opacity-100"
                      title="Remove suggestion"
                      aria-label="Remove suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-5 border-t border-white/5 pt-4 text-[11px] text-[#34483B]/60">Â© 2026 Rare Motion Hub</p>
      </div>
    </aside>
  );
}

function CompactQuickAdd({ suggestions, onFollow, onDismiss }) {
  if (!suggestions.length) return null;
  return (
    <section className="mb-6 xl:hidden" aria-label="Quick Add">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold tracking-wider text-[#34483B]">qUiCk aDd</h2>
        <UserRound className="h-4 w-4 text-[#34483B]/70" />
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {suggestions.slice(0, MAX_QUICK_ADD_SUGGESTIONS).map((person) => {
          const buttonText = person.isFollowing
            ? 'Following'
            : person.followsYou
            ? 'Follow Back'
            : 'Follow';
          return (
            <div key={person.id} className="relative flex min-w-[220px] snap-start items-center gap-2 rounded-2xl border border-border bg-shading/30 p-3">
              <RouterLink to={'/profile/' + person.id} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight text-sm font-semibold">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (person.name || '?').slice(0, 1).toUpperCase()
                )}
              </RouterLink>
              <div className="min-w-0 flex-1">
                <RouterLink to={'/profile/' + person.id} className="truncate text-xs font-semibold block hover:underline text-[#34483B]">
                  {person.name}
                </RouterLink>
                <p className="truncate text-[11px] text-[#34483B]/70">@{person.username || person.name}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onFollow(person)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    person.isFollowing
                      ? 'bg-shading text-[#34483B]/70'
                      : person.followsYou
                      ? 'bg-accent text-[#F3EBDD] hover:bg-accent-hover'
                      : 'bg-accent text-[#F3EBDD] hover:bg-accent-hover'
                  }`}
                >
                  {buttonText}
                </button>
                <button
                  onClick={() => onDismiss(person)}
                  className="grid h-6 w-6 place-items-center rounded-full text-[#34483B]/70 opacity-60 transition-colors hover:bg-accent hover:text-[#F3EBDD] hover:opacity-100"
                  aria-label="Remove suggestion"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[#34483B]/70">Â© 2026 Rare Motion Hub</p>
    </section>
  );
}

function FeedCard({ item, user, onUpdate, onDelete, muted, onMutedChange }) {
  const cardRef = useRef(null); const audioRef = useRef(null);
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false); const [comment, setComment] = useState(''); const [replyTo, setReplyTo] = useState(null); const [showComments, setShowComments] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const stop = () => { audioRef.current?.pause(); setPlaying(false); };
  const play = async () => { if (!audioRef.current) return; try { await audioRef.current.play(); setPlaying(true); } catch { setPlaying(false); } };
  useEffect(() => {
    const audio = new Audio(item.url); audio.preload = 'metadata'; audio.muted = muted; audioRef.current = audio;
    const start = Number(item.previewStart || 0); const end = item.previewEnd == null ? null : Number(item.previewEnd);
    const seek = () => { if (start > 0) audio.currentTime = start; }; const finish = () => { audio.currentTime = start; setPlaying(false); };
    audio.addEventListener('loadedmetadata', seek); audio.addEventListener('ended', finish); audio.addEventListener('timeupdate', () => { if (end && audio.currentTime >= end) finish(); });
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && entry.intersectionRatio >= 0.65 ? play() : stop(), { threshold: [0, 0.65, 1] });
    if (cardRef.current) observer.observe(cardRef.current); return () => { observer.disconnect(); audio.pause(); audio.src = ''; };
  }, [item.id, item.url, item.previewStart, item.previewEnd]);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; }, [muted]);
  const toggleMute = () => onMutedChange(!muted);
  const toggleLike = async () => { const next = !item.likedByMe; onUpdate(item.id, { likedByMe: next, likeCount: Math.max(0, (item.likeCount || 0) + (next ? 1 : -1)) }, 'like'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/like`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { likedByMe: !next, likeCount: item.likeCount || 0 }, 'like'); };
  const toggleSave = async () => { const next = !item.savedByMe; onUpdate(item.id, { savedByMe: next }, 'save'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/save`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { savedByMe: !next }, 'save'); };
  const commentAction = async (event) => { event.preventDefault(); if (!comment.trim()) return; const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment, parentId: replyTo?.id }) }); if (res.ok) { const data = await res.json(); onUpdate(item.id, data.comment, 'comment'); setComment(''); setReplyTo(null); setShowComments(true); } };
  const reactComment = async (entry) => { const next = !entry.likedByMe; onUpdate(item.id, { ...entry, likedByMe: next, likeCount: Math.max(0, (entry.likeCount || 0) + (next ? 1 : -1)) }, 'comment-like'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/comments/${entry.id}/like`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { ...entry, likedByMe: !next, likeCount: entry.likeCount || 0 }, 'comment-like'); };
  const roots = (item.comments || []).filter((entry) => !entry.parentId); const replies = (id) => (item.comments || []).filter((entry) => entry.parentId === id);
  return <motion.article ref={cardRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-shading/35">
    <div className="flex items-center gap-3 px-4 py-3">
      <RouterLink to={'/profile/' + item.owner?.id} className="flex items-center gap-3 min-w-0 flex-1 group">
        {item.owner?.avatarUrl ? <img src={item.owner.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-highlight text-sm font-semibold">{(item.owner?.name || user?.name || '?').slice(0, 1).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#34483B] group-hover:underline">{item.owner?.name || 'Unknown artist'}</p>
          <p className="text-xs text-[#34483B]/70">{dateLabel(item.publishedAt || item.uploadedAt)}</p>
        </div>
      </RouterLink>
      {item.owner?.id === user?.id && <div className="relative"><button onClick={() => setMenuOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-highlight" aria-label="Feed options"><MoreHorizontal className="h-5 w-5" /></button>{menuOpen && <div className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-border bg-primary-background p-1 shadow-2xl"><button onClick={() => { setMenuOpen(false); onDelete(item.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Delete preview</button></div>}</div>}
    </div>
    <div onClick={() => item.project?.id && navigate(`/project/${item.project.id}`)} className="group relative aspect-square w-full cursor-pointer overflow-hidden bg-black sm:aspect-[4/3]">{item.project?.coverArt ? <img src={item.project.coverArt} alt="" className="block h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(item.id) || defaultGradient}`} />}<button onClick={(event) => { event.stopPropagation(); playing ? stop() : play(); }} className={`absolute inset-0 m-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary-background shadow-xl transition-opacity hover:scale-105 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${playing ? 'opacity-100' : ''}`} aria-label={playing ? 'Pause preview' : 'Play preview'}>{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-1 h-4 w-4 fill-current" />}</button><button onClick={(event) => { event.stopPropagation(); toggleMute(); }} className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-[#34483B] hover:bg-black/85" aria-label={muted ? 'Unmute preview' : 'Mute preview'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button><span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-[#34483B]">{playing ? 'Previewing' : 'Preview'}</span></div>
    <div className="px-4 py-3"><h2 className="font-semibold">{item.title || 'Untitled track'}</h2><p className="mt-1 text-sm text-[#34483B]/70">{item.project?.title || 'Project preview'}</p>{item.feedCaption && <p className="mt-2 text-sm">{item.feedCaption}</p>}<div className="mt-3 flex items-center gap-4"><button onClick={toggleLike} className={`inline-flex items-center gap-1.5 text-sm ${item.likedByMe ? 'text-accent' : 'text-[#34483B]/70 hover:text-[#34483B]'}`} aria-label="Like preview"><Heart className={`h-5 w-5 ${item.likedByMe ? 'fill-current' : ''}`} />{item.likeCount || 0}</button><button onClick={() => setShowComments((value) => !value)} className="inline-flex items-center gap-1.5 text-sm text-[#34483B]/70 hover:text-[#34483B]" aria-label="Show comments"><MessageCircle className="h-5 w-5" />{item.comments?.length || 0}</button><button onClick={toggleSave} className={`ml-auto inline-flex items-center text-sm transition-colors ${item.savedByMe ? 'text-[#34483B]' : 'text-[#34483B]/70 hover:text-[#34483B]'}`} aria-label={item.savedByMe ? 'Remove from saved' : 'Save preview'} title={item.savedByMe ? 'Remove from saved' : 'Save preview'}><Bookmark className={`h-5 w-5 ${item.savedByMe ? 'fill-current' : ''}`} /></button></div>{showComments && <div className="mt-3 border-t border-border pt-3"><div className="max-h-48 space-y-3 overflow-y-auto">{roots.map((entry) => <div key={entry.id} className="text-sm"><div className="flex gap-2">
      {entry.user?.id ? (
        <RouterLink to={'/profile/' + entry.user.id} className="font-semibold text-[#34483B] hover:underline cursor-pointer shrink-0">
          {entry.user?.name || 'User'}
        </RouterLink>
      ) : (
        <span className="font-semibold text-[#34483B]">{entry.user?.name || 'User'}</span>
      )}
      <span className="min-w-0 flex-1 break-words text-[#34483B]/70">{entry.text}</span>
    </div><div className="mt-1 flex items-center gap-3 pl-1 text-xs text-[#34483B]/70"><button onClick={() => reactComment(entry)} className={entry.likedByMe ? 'text-accent' : ''}><Heart className={`mr-1 inline h-3.5 w-3.5 ${entry.likedByMe ? 'fill-current' : ''}`} />{entry.likeCount || 0}</button><button onClick={() => { setReplyTo(entry); setComment(`@${entry.user?.name || 'user'} `); }}>Reply</button></div>{replies(entry.id).map((reply) => <div key={reply.id} className="ml-5 mt-2 flex gap-2 border-l border-border pl-3">
      {reply.user?.id ? (
        <RouterLink to={'/profile/' + reply.user.id} className="font-semibold text-[#34483B] hover:underline cursor-pointer shrink-0">
          {reply.user?.name || 'User'}
        </RouterLink>
      ) : (
        <span className="font-semibold text-[#34483B]">{reply.user?.name || 'User'}</span>
      )}
      <span className="break-words text-[#34483B]/70">{reply.text}</span>
    </div>)}</div>)}</div><form onSubmit={commentAction} className="mt-3 flex items-center gap-2">{replyTo && <button type="button" onClick={() => { setReplyTo(null); setComment(''); }} className="text-xs text-[#34483B]/70">Cancel reply</button>}<input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder={replyTo ? `Reply to ${replyTo.user?.name || 'user'}...` : 'Add a comment...'} className="min-w-0 flex-1 rounded-full border border-border bg-shading px-3 py-2 text-sm outline-none" /><button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-primary-background" aria-label="Post comment"><Send className="h-4 w-4" /></button></form></div>}</div>
  </motion.article>;
}

export default function Feed({ user, savedOnly = false }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [muted, setMuted] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rmh_dismissed_suggestions') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => { fetch(`${apiUrl}/api/feed`).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not load feed.'); setItems(data.items || []); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  
  useEffect(() => {
    fetch(`${apiUrl}/api/users`)
      .then((res) => res.json())
      .then((data) => {
        setAllSuggestions((data.users || []).filter((person) => person.id !== user?.id));
      })
      .catch(() => {});
  }, [user?.id]);

  const updateItem = (id, value, type) => setItems((current) => current.map((item) => { if (item.id !== id) return item; if (type === 'like' || type === 'save') return { ...item, ...value }; if (type === 'comment-like') return { ...item, comments: (item.comments || []).map((entry) => entry.id === value.id ? value : entry) }; return { ...item, comments: [...(item.comments || []), value] }; }));
  const deleteItem = async (id) => { if (!window.confirm('Delete this feed preview?')) return; const res = await fetch(`${apiUrl}/api/feed/tracks/${id}`, { method: 'DELETE' }); if (res.ok) setItems((current) => current.filter((item) => item.id !== id)); };

  const dismissSuggestion = (person) => {
    setDismissedIds((prev) => {
      const next = [...prev, person.id];
      try { localStorage.setItem('rmh_dismissed_suggestions', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const followSuggestion = async (person) => {
    setAllSuggestions((current) => current.map((item) => item.id === person.id ? { ...item, isFollowing: true } : item));
    setTimeout(() => {
      setAllSuggestions((current) => current.filter((item) => item.id !== person.id));
    }, 600);
    const res = await fetch(`${apiUrl}/api/auth/${person.id}/follow`, { method: 'POST' });
    if (!res.ok) {
      setAllSuggestions((current) => current.map((item) => item.id === person.id ? { ...item, isFollowing: false } : item));
    }
  };

  const activeSuggestions = allSuggestions.filter((person) => !person.isFollowing && !dismissedIds.includes(person.id));
  const { currentTrack } = useAudio();

  const navItems = [{ label: 'pRoFiLe', icon: UserRound, to: '/profile/' + user.id }, { label: 'sEaRcH', icon: Search, to: '/search' }, { label: 'sAvEd', icon: Bookmark, to: '/saved' }, { label: 'liBraRy', icon: Library, to: '/library' }];
  return <div className="min-h-screen bg-primary-background pb-24 text-primary-label md:pb-0">
    <aside className="group fixed bottom-4 left-4 top-4 z-40 hidden w-20 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/80 px-3 py-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-64 hover:border-white/20 lg:flex">
      <Link to="/feed" className="mb-8 flex h-14 w-full shrink-0 items-center overflow-hidden whitespace-nowrap rounded-2xl bg-[#34483B] px-2.5 transition-colors hover:bg-accent" aria-label="Feed">
        
        <div className="ml-4 flex flex-col leading-none opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        </div>
      </Link>
      <nav className="space-y-2">
        {navItems.map(({ label, icon: Icon, to }) => (
          <Link key={label} to={to} className="flex h-12 w-full items-center whitespace-nowrap rounded-2xl px-3 text-sm font-semibold text-[#A6A09A] transition-all hover:bg-accent/80 hover:backdrop-blur-sm hover:text-[#F3EBDD]" title={label}>
            <Icon className="h-6 w-6 shrink-0" />
            <span className={`font-display ml-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${label === 'liBraRy' ? 'text-accent' : 'text-[#F3EBDD]'}`}>{label}</span>
          </Link>
        ))}
        <button onClick={() => setInboxOpen(true)} className="flex h-12 w-full items-center whitespace-nowrap rounded-2xl px-3 text-sm font-semibold text-[#F3EBDD] transition-all hover:bg-accent/80 hover:backdrop-blur-sm hover:text-[#F3EBDD]" title="Inbox">
          <MessageCircle className="h-6 w-6 shrink-0" />
          <span className="font-display ml-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">iNbOx</span>
        </button>
        <Link to="/settings" className="flex h-12 w-full items-center whitespace-nowrap rounded-2xl px-3 text-sm font-semibold text-[#F3EBDD] transition-all hover:bg-accent/80 hover:backdrop-blur-sm hover:text-[#F3EBDD]" title="Settings">
          <Settings className="h-6 w-6 shrink-0" />
          <span className="font-display ml-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">sEtTiNgS</span>
        </Link>
      </nav>
      <div className="mt-auto w-full overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="min-w-[200px] rounded-2xl border border-white/5 bg-[#141812]/50 p-4 text-xs leading-relaxed text-[#A6A09A] shadow-inner">
          Share previews, discover new work, and stay connected.
        </div>
      </div>
    </aside>
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-transparent px-4 py-4 lg:hidden">
      <Link to="/library" className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back to library">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <Link to="/feed" className="grid h-9 w-9 place-items-center rounded-full bg-shading text-[#34483B] hover:bg-highlight" aria-label="Feed">
        
      </Link>
      <Link to="/settings" className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Open settings">
        <Settings className="h-4 w-4" />
      </Link>
    </header>
    <QuickAdd suggestions={activeSuggestions} onFollow={followSuggestion} onDismiss={dismissSuggestion} />
    <main className="px-4 pb-20 pt-4 sm:px-8 lg:ml-28 xl:mr-80">
      <div className="mx-auto max-w-2xl py-3">
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-xs font-bold tracking-[0.2em] text-[#34483B]/70">dIsCoVeR</p>
              <h1 className="font-display mt-1 text-3xl font-bold tracking-wider text-[#34483B]">fEEd</h1>
            </div>
        </div>
        <p className="text-sm text-[#34483B]/70">Preview new music from the Rare Motion community.</p>
        </div>
        <CompactQuickAdd suggestions={activeSuggestions} onFollow={followSuggestion} onDismiss={dismissSuggestion} />
        {currentTrack && <div className="mb-6 w-full max-w-sm rounded-3xl bg-[#1c1c1e]/80 p-1.5 shadow-2xl backdrop-blur-xl xl:fixed xl:right-4 xl:top-[20rem] xl:z-20 xl:mb-0 xl:w-72"><AudioPlayer cardModal minimal /></div>}
        {loading && <p className="py-16 text-center text-sm text-[#34483B]/70">Loading previews...</p>}
        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        <div className="space-y-6">
          {items.map((item) => <FeedCard key={item.id} item={item} user={user} muted={muted} onMutedChange={setMuted} onUpdate={updateItem} onDelete={deleteItem} />)}
        </div>
      </div>
    </main>
    <ChatInbox user={user} isOpen={inboxOpen} onToggle={() => setInboxOpen((value) => !value)} />
  </div>;
}






