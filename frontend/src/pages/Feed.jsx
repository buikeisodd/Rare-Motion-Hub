import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Heart, Library, MessageCircle, MoreHorizontal, Pause, Play, Plus, Radio, Search, Send, Settings, Trash2, UserRound, Volume2, VolumeX, X } from 'lucide-react';
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

function StoryViewer({ story, stories, user, onClose, onNavigate, onDelete }) {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liked, setLiked] = useState(() => (story?.likes || []).includes(user?.id));
  const [reply, setReply] = useState('');
  const [replyState, setReplyState] = useState('idle');
  const replyStateRef = useRef('idle');
  const isOwnStory = (story?.owner?.id || story?.userId) === user?.id;
  useEffect(() => { setLiked((story?.likes || []).includes(user?.id)); setReply(''); setReplyState('idle'); replyStateRef.current = 'idle'; setMenuOpen(false); }, [story?.id, user?.id]);
  const group = story?.storyGroup || [story];
  const storyIndex = Math.max(0, group.findIndex((item) => item?.id === story?.id));
  const start = Number(story?.previewStart || 0);
  const maxEnd = Math.min(Number(story?.previewEnd || 40), start + 40);
  const duration = Math.max(1, maxEnd - start);
  const go = (direction) => {
    const nextIndex = storyIndex + direction;
    if (nextIndex >= 0 && nextIndex < group.length) { onNavigate({ ...group[nextIndex], storyGroup: group }); return; }
    const currentOwner = story?.owner?.id || story?.userId;
    const ownerGroups = Object.values((stories || []).reduce((result, item) => { const key = item?.owner?.id || item?.userId || item?.id; (result[key] ||= []).push(item); return result; }, {}));
    const ownerIndex = ownerGroups.findIndex((items) => (items[0]?.owner?.id || items[0]?.userId) === currentOwner);
    const nextOwner = ownerGroups[ownerIndex + direction];
    if (nextOwner?.[0]) onNavigate({ ...nextOwner[0], storyGroup: nextOwner }); else onClose();
  };
  const toggleLike = async () => { if (isOwnStory) return; const next = !liked; setLiked(next); const response = await fetch(`${apiUrl}/api/stories/${story.id}/like`, { method: 'POST', credentials: 'include' }); if (!response.ok) setLiked(!next); };
  const sendReply = async (event) => { event?.preventDefault(); const recipientId = story.owner?.id || story.userId; if (isOwnStory || !recipientId || !reply.trim() || replyState === 'sending') return; const audio = audioRef.current; audio?.pause(); replyStateRef.current = 'sending'; setReplyState('sending'); const response = await fetch(`${apiUrl}/api/messages`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId, conversationType: 'dm', text: reply.trim(), storyId: story.id }) }); const nextState = response.ok ? 'sent' : 'error'; replyStateRef.current = nextState; setReplyState(nextState); if (response.ok) { setReply(''); audio?.play().catch(() => {}); } else if (audio) audio.play().catch(() => {}); };
  useEffect(() => {
    setProgress(0);
    const audio = audioRef.current;
    if (story?.contentType === 'track' && audio) {
      const ready = () => { audio.currentTime = start; audio.play().catch(() => {}); };
      audio.addEventListener('loadedmetadata', ready);
      if (audio.readyState >= 1) ready();
      return () => { audio.removeEventListener('loadedmetadata', ready); audio.pause(); };
    }
    const timer = window.setInterval(() => { if (replyStateRef.current === 'sending') return; setProgress((value) => { const next = value + 100 / (duration * 10); if (next >= 100) { window.clearInterval(timer); go(1); return 100; } return next; }); }, 100);
    return () => window.clearInterval(timer);
  }, [story?.id]);
  if (!story) return null;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#34483B]/75 p-3 backdrop-blur-2xl sm:p-6" onClick={onClose}>
    <button onClick={(event) => { event.stopPropagation(); go(-1); }} className="absolute left-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#F3EBDD]/90 text-[#34483B] shadow-lg sm:left-8" aria-label="Previous story"><ArrowLeft className="h-5 w-5" /></button>
    <div onClick={(event) => event.stopPropagation()} className="relative flex h-[min(88vh,720px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-[2rem] border border-[#F3EBDD]/30 bg-[#718A78] shadow-2xl">
      <div className="absolute inset-x-4 top-4 z-10 flex gap-1">{group.map((item, itemIndex) => <div key={item.id} className="h-1 flex-1 rounded-full bg-[#F3EBDD]/40"><div className="h-full rounded-full bg-[#F3EBDD]" style={{ width: itemIndex < storyIndex ? '100%' : itemIndex === storyIndex ? `${progress}%` : '0%' }} /></div>)}</div>
      <div className="relative z-10 mt-7 flex items-center justify-between rounded-2xl bg-[#34483B]/72 px-4 py-3 text-[#F3EBDD] shadow-lg backdrop-blur-xl"><span className="truncate text-sm font-semibold">{(story.owner?.id || story.userId) === user?.id ? 'You' : story.owner?.name || 'Story'}</span>{(story.owner?.id || story.userId) === user?.id && <div className="relative"><button onClick={() => setMenuOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-xl text-[#F3EBDD] hover:bg-[#F3EBDD]/15" aria-label="Story options"><MoreHorizontal className="h-5 w-5 !text-[#F3EBDD]" /></button>{menuOpen && <div className="absolute right-0 top-11 z-30 w-40 rounded-2xl border border-[#F3EBDD]/20 bg-[#F3EBDD]/95 p-1 text-[#34483B] shadow-2xl backdrop-blur-xl"><button onClick={() => onDelete(story.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Delete story</button></div>}</div>}</div>
      <div className="absolute inset-0 flex items-center justify-center text-center">{story.contentType === 'text' ? <p className="max-h-full overflow-auto break-words px-8 text-2xl font-semibold text-[#F3EBDD]">{story.text}</p> : story.project?.coverArt ? <img src={story.project.coverArt} alt="" className="h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(story.id) || defaultGradient}`} />}<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#34483B]/35 via-transparent to-[#34483B]/45" /></div>
      {story.contentType === 'track' && <audio ref={audioRef} preload="auto" src={story.url} onTimeUpdate={(event) => { const value = Math.max(0, event.currentTarget.currentTime - start); setProgress(Math.min(100, value / duration * 100)); if (event.currentTarget.currentTime >= maxEnd) { event.currentTarget.pause(); go(1); } }} onEnded={() => go(1)} />}
      {!isOwnStory && <div className="absolute inset-x-5 bottom-5 flex items-center gap-2"><form onSubmit={sendReply} className="flex min-w-0 flex-1 items-center gap-2"><input value={reply} onChange={(event) => { setReply(event.target.value); if (replyState !== 'idle') setReplyState('idle'); }} disabled={replyState === 'sending'} placeholder={replyState === 'sent' ? 'Reply sent' : replyState === 'error' ? 'Could not send - try again' : 'Reply to story...'} className="h-11 min-w-0 flex-1 rounded-full border border-[#F3EBDD]/70 bg-[#34483B]/45 px-4 text-sm text-[#F3EBDD] outline-none placeholder:text-[#F3EBDD]/75 backdrop-blur-xl" /><button type="submit" disabled={!reply.trim() || replyState === 'sending'} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-[#34483B] shadow-lg disabled:opacity-50" aria-label="Send story reply"><Send className="h-4 w-4" /></button></form><button type="button" onClick={toggleLike} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#F3EBDD]/70 backdrop-blur-xl ${liked ? 'bg-[#F3EBDD] text-red-500' : 'bg-[#34483B]/45 text-[#F3EBDD]'}`} aria-label={liked ? 'Unlike story' : 'Like story'}>♥</button></div>}
    </div>
    <button onClick={(event) => { event.stopPropagation(); go(1); }} className="absolute right-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#F3EBDD]/90 text-[#34483B] shadow-lg sm:right-8" aria-label="Next story"><ArrowLeft className="h-5 w-5 rotate-180" /></button>
  </div>;
}
function StoryRail({ stories, onCreate, onDelete, onOpen, user }) { return <section className="mb-7" aria-label="Stories"><div className="flex gap-3 overflow-x-auto pb-1"><div className="w-20 shrink-0 text-center"><button onClick={onCreate} className="grid h-28 w-20 place-items-center rounded-2xl border border-border bg-shading/40 text-[#34483B]/70 transition hover:-translate-y-0.5 hover:bg-highlight"><Plus className="h-6 w-6" /></button><span className="mt-2 block truncate text-[10px] font-semibold text-[#34483B]">Create</span></div>{stories.map((story) => <div key={story.id} className="w-20 shrink-0 text-center"><button onClick={() => onOpen(story)} className="group relative block h-28 w-20 overflow-hidden rounded-2xl border border-border bg-shading text-left"><div className="h-full w-full">{story.contentType === 'text' ? <div className="flex h-full items-center justify-center bg-[#718A78] p-2 text-center text-xs text-[#F3EBDD]">{story.text}</div> : story.project?.coverArt ? <img src={story.project.coverArt} alt="" className="h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(story.id) || defaultGradient}`} />}</div></button><span className="mt-2 block truncate text-[10px] font-semibold text-[#34483B]">{story.owner?.id === user?.id ? 'You' : story.owner?.name || 'Artist'}</span></div>)}</div></section>; }

function LegacyCreateModal({ open, onClose, projects, onCreated }) {
  const [step, setStep] = useState('destination'); const [track, setTrack] = useState(null); const [storyType, setStoryType] = useState('track'); const [start] = useState(0); const [end, setEnd] = useState(40); const [text, setText] = useState(''); const [caption, setCaption] = useState(''); const [displayStyle, setDisplayStyle] = useState('default'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!open) { setStep('destination'); setTrack(null); setError(''); } }, [open]);
  if (!open) return null;
  const tracks = projects.flatMap((project) => (project.tracks || []).map((item) => ({ ...item, project })));
  const chooseTrack = (item) => { setTrack(item); setEnd(Math.min(Number(item.duration) || 40, 40)); setStep('story'); };
  const save = async () => { if (storyType === 'text' && !text.trim()) return setError('Write something for your story first.'); if (storyType === 'track' && !track) return; setSaving(true); setError(''); const body = storyType === 'text' ? { contentType: 'text', text, displayStyle } : { contentType: 'track', trackId: track.id, versionId: track.activeVersionId, previewStart: 0, previewEnd: Math.min(Number(track.duration) || 40, 40), displayStyle }; const res = await fetch(`${apiUrl}/api/stories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json().catch(() => ({})); setSaving(false); if (!res.ok) { setError(data.error || 'Could not create story.'); return; } onCreated(data.story); onClose(); };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4 backdrop-blur-xl"><div className="w-full max-w-lg rounded-3xl border border-white/30 bg-[#F3EBDD]/90 p-5 text-[#34483B] shadow-2xl backdrop-blur-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Create</h2><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[#E4E0D4] hover:bg-[#D9DED0]" aria-label="Close"><X className="h-4 w-4" /></button></div>{step === 'destination' && <div className="grid gap-3"><p className="text-sm text-[#34483B]/70">What would you like to publish?</p><button onClick={() => setStep('track')} className="rounded-2xl bg-[#D9DED0] p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:bg-[#C8D2C4]">Story<span className="mt-1 block text-xs font-normal opacity-70">Share a timed preview for 24 hours.</span></button><button onClick={onClose} className="rounded-2xl border border-[#718A78]/30 p-4 text-left font-semibold">Feed<span className="mt-1 block text-xs font-normal opacity-70">Use Create from the feed preview composer.</span></button></div>}{step === 'track' && <div><p className="mb-3 text-sm text-[#34483B]/70">Choose a track from your public projects.</p><div className="max-h-64 space-y-2 overflow-y-auto">{tracks.length ? tracks.map((item) => <button key={item.id} onClick={() => chooseTrack(item)} className="flex w-full items-center justify-between rounded-2xl bg-[#D9DED0] p-3 text-left hover:bg-[#C8D2C4]"><span className="truncate font-semibold">{item.title || item.filename || 'Untitled track'}</span><span className="ml-3 shrink-0 text-xs opacity-70">{item.project.title || item.project.name}</span></button>) : <p className="py-8 text-center text-sm opacity-70">No tracks available yet.</p>}</div></div>}{step === 'story' && track && <div className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-widest opacity-60">Story preview</p><h3 className="mt-1 font-semibold">{track.title || track.filename}</h3></div><div><div className="mb-2 flex justify-between text-xs"><span>Start {Math.round(start)}s</span><span>End {Math.round(end)}s</span></div><input type="range" min="0" max={Math.max(1, Number(track.duration) || 60) - 1} value={start} onChange={(e) => setStart(Math.min(Number(e.target.value), end - 1))} className="w-full accent-[#718A78]" /><input type="range" min="1" max={Math.max(1, Number(track.duration) || 60)} value={end} onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 1))} className="w-full accent-[#718A78]" /></div><textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="Add a caption" className="min-h-20 w-full rounded-2xl border border-[#718A78]/30 bg-white/40 p-3 outline-none" /><div className="flex gap-2">{['default', 'zoom', 'fade'].map((style) => <button key={style} onClick={() => setDisplayStyle(style)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${displayStyle === style ? 'bg-[#718A78] text-[#F3EBDD]' : 'bg-[#D9DED0]'}`}>{style}</button>)}</div>{error && <p className="text-sm text-red-600">{error}</p>}<button onClick={save} disabled={saving} className="w-full rounded-2xl bg-[#718A78] px-4 py-3 font-semibold text-[#F3EBDD] disabled:opacity-50">{saving ? 'Publishing...' : 'Publish story'}</button></div>}</div></div>;
}

function CreateModal({ open, onClose, projects, onCreated }) {
  const [step, setStep] = useState('destination');
  const [type, setType] = useState('track');
  const [track, setTrack] = useState(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!open) { setStep('destination'); setType('track'); setTrack(null); setText(''); setError(''); } }, [open]);
  if (!open) return null;
  const tracks = projects.flatMap((project) => (project.tracks || []).map((item) => ({ ...item, project })));
  const publish = async () => {
    if (type === 'text' && !text.trim()) return setError('Write something first.');
    if (type === 'track' && !track) return;
    setSaving(true); setError('');
    const body = type === 'text' ? { contentType: 'text', text: text.trim() } : { contentType: 'track', trackId: track.id, versionId: track.activeVersionId, previewStart: 0, previewEnd: Math.min(Number(track.duration) || 40, 40) };
    const res = await fetch(`${apiUrl}/api/stories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({})); setSaving(false);
    if (!res.ok) return setError(data.error || 'Could not publish.');
    onCreated(data.story); onClose();
  };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#34483B]/45 p-4 backdrop-blur-xl"><div className="w-full max-w-lg rounded-3xl border border-white/30 bg-[#F3EBDD]/92 p-5 text-[#34483B] shadow-2xl backdrop-blur-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Create</h2><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[#E4E0D4]" aria-label="Close"><X className="h-4 w-4" /></button></div>{step === 'destination' && <div className="grid gap-3"><p className="text-sm opacity-70">Where would you like to publish?</p><button onClick={() => setStep('kind')} className="rounded-2xl bg-[#D9DED0] p-4 text-left font-semibold hover:bg-[#C8D2C4]">Story<span className="mt-1 block text-xs font-normal opacity-70">Share a note or a 40-second preview.</span></button><button onClick={onClose} className="rounded-2xl border border-[#718A78]/30 p-4 text-left font-semibold">Feed<span className="mt-1 block text-xs font-normal opacity-70">Create a feed post from a project preview.</span></button></div>}{step === 'kind' && <div className="grid gap-3"><p className="text-sm opacity-70">What would you like to share?</p><button onClick={() => { setType('text'); setStep('text'); }} className="rounded-2xl bg-[#D9DED0] p-4 text-left font-semibold hover:bg-[#C8D2C4]">Note / text</button><button onClick={() => { setType('track'); setStep('tracks'); }} className="rounded-2xl bg-[#D9DED0] p-4 text-left font-semibold hover:bg-[#C8D2C4]">Track preview</button></div>}{step === 'text' && <div className="space-y-4"><textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} placeholder="Write your story..." className="min-h-40 w-full resize-none rounded-2xl border border-[#718A78]/30 bg-white/40 p-4 outline-none" />{error && <p className="text-sm text-red-600">{error}</p>}<button onClick={publish} disabled={saving} className="w-full rounded-2xl bg-[#718A78] px-4 py-3 font-semibold text-[#F3EBDD] disabled:opacity-50">{saving ? 'Publishing...' : 'Post to story'}</button></div>}{step === 'tracks' && <div className="max-h-72 space-y-2 overflow-y-auto">{tracks.length ? tracks.map((item) => <button key={item.id} onClick={() => { setTrack(item); setStep('preview'); }} className="flex w-full items-center justify-between rounded-2xl bg-[#D9DED0] p-3 text-left hover:bg-[#C8D2C4]"><span className="truncate font-semibold">{item.title || item.filename || 'Untitled track'}</span><span className="ml-3 shrink-0 text-xs opacity-70">{item.project.title || item.project.name}</span></button>) : <p className="py-8 text-center text-sm opacity-70">No tracks available yet.</p>}</div>}{step === 'preview' && track && <div className="space-y-4"><h3 className="font-semibold">{track.title || track.filename}</h3><p className="text-sm opacity-70">Your story will play automatically for up to 40 seconds.</p>{error && <p className="text-sm text-red-600">{error}</p>}<button onClick={publish} disabled={saving} className="w-full rounded-2xl bg-[#718A78] px-4 py-3 font-semibold text-[#F3EBDD] disabled:opacity-50">{saving ? 'Publishing...' : 'Post preview to story'}</button></div>}</div></div>;
}

function FeedCard({ item, user, onUpdate, onDelete, muted, onMutedChange, volume, onVolumeChange }) {
  const cardRef = useRef(null); const audioRef = useRef(null);
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false); const [comment, setComment] = useState(''); const [replyTo, setReplyTo] = useState(null); const [showComments, setShowComments] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const stop = () => { audioRef.current?.pause(); setPlaying(false); };
  const play = async () => { if (!audioRef.current) return; try { await audioRef.current.play(); setPlaying(true); } catch { setPlaying(false); } };
  useEffect(() => {
    const audio = new Audio(item.url); audio.preload = 'metadata'; audio.muted = muted; audioRef.current = audio;
    const start = Number(item.previewStart || 0); const end = item.previewEnd == null ? null : Number(item.previewEnd);
    audio.volume = volume;
    const seek = () => { if (start > 0) audio.currentTime = start; }; const finish = () => { audio.currentTime = start; setPlaying(false); };
    audio.addEventListener('loadedmetadata', seek); audio.addEventListener('ended', finish); audio.addEventListener('timeupdate', () => { if (end && audio.currentTime >= end) finish(); });
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && entry.intersectionRatio >= 0.65 ? play() : stop(), { threshold: [0, 0.65, 1] });
    if (cardRef.current) observer.observe(cardRef.current); return () => { observer.disconnect(); audio.pause(); audio.src = ''; };
  }, [item.id, item.url, item.previewStart, item.previewEnd]);
  useEffect(() => { if (audioRef.current) { audioRef.current.muted = muted; audioRef.current.volume = volume; } }, [muted, volume]);
  const toggleMute = () => onMutedChange(!muted);
  const toggleLike = async () => { const next = !item.likedByMe; onUpdate(item.id, { likedByMe: next, likeCount: Math.max(0, (item.likeCount || 0) + (next ? 1 : -1)) }, 'like'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/like`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { likedByMe: !next, likeCount: item.likeCount || 0 }, 'like'); };
  const toggleSave = async () => { const next = !item.savedByMe; onUpdate(item.id, { savedByMe: next }, 'save'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/save`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { savedByMe: !next }, 'save'); };
  const commentAction = async (event) => { event.preventDefault(); if (!comment.trim()) return; const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment, parentId: replyTo?.id }) }); if (res.ok) { const data = await res.json(); onUpdate(item.id, data.comment, 'comment'); setComment(''); setReplyTo(null); setShowComments(true); } };
  const reactComment = async (entry) => { const next = !entry.likedByMe; onUpdate(item.id, { ...entry, likedByMe: next, likeCount: Math.max(0, (entry.likeCount || 0) + (next ? 1 : -1)) }, 'comment-like'); const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/comments/${entry.id}/like`, { method: 'POST' }); if (!res.ok) onUpdate(item.id, { ...entry, likedByMe: !next, likeCount: entry.likeCount || 0 }, 'comment-like'); };
  const roots = (item.comments || []).filter((entry) => !entry.parentId); const replies = (id) => (item.comments || []).filter((entry) => entry.parentId === id);
  return <motion.article ref={cardRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-shading/35">
    <header className="feed-post-header absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3 text-[#F3EBDD] shadow-[0_8px_22px_rgba(52,72,59,.38)]">
      <RouterLink to={'/profile/' + item.owner?.id} className="flex items-center gap-3 min-w-0 flex-1 group">
        {item.owner?.avatarUrl ? <img src={item.owner.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-highlight text-sm font-semibold">{(item.owner?.name || user?.name || '?').slice(0, 1).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#F3EBDD] group-hover:underline">{item.owner?.name || 'Unknown artist'}</p>
          <p className="text-xs text-[#F3EBDD]/70">{dateLabel(item.publishedAt || item.uploadedAt)}</p>
        </div>
      </RouterLink>
      <div className="relative"><button onClick={() => setMenuOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-xl bg-transparent text-[#F3EBDD] hover:bg-[#F3EBDD]/10 hover:text-[#F3EBDD]" aria-label="Post options"><MoreHorizontal className="h-5 w-5 !text-[#F3EBDD]" /></button>{menuOpen && <div className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-border bg-primary-background p-1 shadow-2xl">{item.owner?.id === user?.id ? <button onClick={() => { setMenuOpen(false); onDelete(item.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Delete preview</button> : <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#34483B] hover:bg-highlight">Not interested</button>}</div>}</div>
    </header>
    <div onClick={() => item.project?.id && navigate(`/project/${item.project.id}`)} className="group relative aspect-square w-full cursor-pointer overflow-hidden bg-black sm:aspect-[4/3]">{item.project?.coverArt ? <img src={item.project.coverArt} alt="" className="block h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(item.id) || defaultGradient}`} />}<button onClick={(event) => { event.stopPropagation(); playing ? stop() : play(); }} className={`absolute inset-0 m-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary-background shadow-xl transition-opacity hover:scale-105 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${playing ? 'opacity-100' : ''}`} aria-label={playing ? 'Pause preview' : 'Play preview'}>{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-1 h-4 w-4 fill-current" />}</button><button onClick={(event) => { event.stopPropagation(); toggleMute(); }} className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[#34483B]/85 text-[#F3EBDD] shadow-lg backdrop-blur-md hover:bg-[#34483B]" aria-label={muted ? 'Unmute preview' : 'Mute preview'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button><span className="absolute bottom-3 left-3 rounded-full bg-[#34483B]/85 px-2.5 py-1 text-[11px] font-semibold text-[#F3EBDD] shadow-lg backdrop-blur-md">{playing ? 'Previewing' : 'Preview'}</span></div>
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
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [muted, setMuted] = useState(true); const [volume, setVolume] = useState(0.8);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [stories, setStories] = useState([]); const [createOpen, setCreateOpen] = useState(false); const [storyViewer, setStoryViewer] = useState(null); const [workspaceProjects, setWorkspaceProjects] = useState([]);
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rmh_dismissed_suggestions') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => { fetch(`${apiUrl}/api/feed`, { credentials: 'include' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not load feed.'); setItems(Array.isArray(data.items) ? data.items.filter(Boolean) : []); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch(`${apiUrl}/api/stories`).then((res) => res.json()).then((data) => setStories(data.stories || [])).catch(() => {}); fetch(`${apiUrl}/api/workspace?userId=${encodeURIComponent(user?.id || '')}`).then((res) => res.json()).then((data) => { const projects = (data.projects || []).filter((project) => project.visibility !== 'private'); const tracks = data.tracks || []; setWorkspaceProjects(projects.map((project) => ({ ...project, tracks: tracks.filter((track) => track.projectId === project.id) }))); }).catch(() => {}); }, [user?.id]);
  useEffect(() => { if (new URLSearchParams(window.location.search).has('create')) setCreateOpen(true); }, []);
  
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

  const navItems = [{ label: 'pRoFiLe', icon: UserRound, to: '/profile/' + (user?.id || '') }, { label: 'sEaRcH', icon: Search, to: '/search' }, { label: 'sAvEd', icon: Bookmark, to: '/saved' }, { label: 'liBraRy', icon: Library, to: '/library' }];
  return <div className="feed-shell min-h-screen bg-primary-background pb-24 text-primary-label md:pb-0">
    <aside className="feed-sidebar group fixed bottom-4 left-4 top-4 z-40 hidden w-20 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/80 px-3 py-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-64 hover:border-white/20 lg:flex">
      <Link to="/feed" className="mb-8 flex h-14 w-full shrink-0 items-center overflow-hidden whitespace-nowrap px-2.5" aria-label="Feed">
        
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
      <Link to="/feed" className="grid h-9 w-9 place-items-center rounded-full bg-transparent" aria-label="Feed">
        
      </Link>
      <Link to="/settings" className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Open settings">
        <Settings className="h-4 w-4" />
      </Link>
    </header>
    <QuickAdd suggestions={activeSuggestions} onFollow={followSuggestion} onDismiss={dismissSuggestion} />
    <main className="feed-main px-4 pb-20 pt-4 sm:px-8 lg:ml-28 xl:mr-80">
      <div className="mx-auto max-w-2xl py-3">
        <CompactQuickAdd suggestions={activeSuggestions} onFollow={followSuggestion} onDismiss={dismissSuggestion} />
        <StoryRail stories={Object.values(stories.reduce((groups, story) => { const key = story.owner?.id || story.userId || story.id; (groups[key] ||= []).push(story); return groups; }, {})).map((group) => ({ ...group[0], storyGroup: group }))} user={user} onCreate={() => setCreateOpen(true)} onOpen={setStoryViewer} onDelete={async (id) => { const res = await fetch(`${apiUrl}/api/stories/${id}`, { method: 'DELETE' }); if (res.ok) setStories((current) => current.filter((story) => story.id !== id)); }} />
        {currentTrack && <div className="mb-6 w-full max-w-sm rounded-3xl bg-[#1c1c1e]/80 p-1.5 shadow-2xl backdrop-blur-xl xl:fixed xl:right-4 xl:top-[20rem] xl:z-20 xl:mb-0 xl:w-72"><AudioPlayer cardModal minimal /></div>}
        {loading && <p className="py-16 text-center text-sm text-[#34483B]/70">Loading previews...</p>}
        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        <div className="space-y-6">
          {items.map((item) => <FeedCard key={item.id} item={item} user={user} muted={muted} volume={volume} onMutedChange={setMuted} onVolumeChange={setVolume} onUpdate={updateItem} onDelete={deleteItem} />)}
        </div>
      </div>
    </main>
    <ChatInbox user={user} isOpen={inboxOpen} onToggle={() => setInboxOpen((value) => !value)} />
    <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} projects={workspaceProjects} onCreated={(story) => setStories((current) => [story, ...current])} />
    {storyViewer && <StoryViewer story={storyViewer} stories={stories} user={user} onNavigate={setStoryViewer} onClose={() => setStoryViewer(null)} onDelete={async (id) => { const res = await fetch(`${apiUrl}/api/stories/${id}`, { method: 'DELETE', credentials: 'include' }); if (res.ok) { setStories((current) => current.filter((story) => story.id !== id)); setStoryViewer(null); } }} />}
  </div>;
}







