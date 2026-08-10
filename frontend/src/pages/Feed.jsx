import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Pause, Play, Radio, Send, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StarlightLogo from '../components/StarlightLogo';
import { defaultGradient, gradientFor } from '../utils/gradients';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const dateLabel = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

function FeedCard({ item, user, onUpdate }) {
  const cardRef = useRef(null);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [comment, setComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  const stop = () => { audioRef.current?.pause(); setPlaying(false); };
  const play = async () => {
    if (!audioRef.current) return;
    try { await audioRef.current.play(); setPlaying(true); } catch { setPlaying(false); }
  };

  useEffect(() => {
    const audio = new Audio(item.url);
    audio.preload = 'metadata';
    audioRef.current = audio;
    const start = Number(item.previewStart || 0);
    const end = item.previewEnd === null || item.previewEnd === undefined ? null : Number(item.previewEnd);
    const seek = () => { if (start > 0) audio.currentTime = start; };
    const ended = () => { audio.currentTime = start; setPlaying(false); };
    const time = () => { if (end && audio.currentTime >= end) ended(); };
    audio.addEventListener('loadedmetadata', seek); audio.addEventListener('ended', ended); audio.addEventListener('timeupdate', time);
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && entry.intersectionRatio >= 0.65) play(); else stop(); }, { threshold: [0, 0.65, 1] });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => { observer.disconnect(); audio.pause(); audio.src = ''; };
  }, [item.id, item.url, item.previewStart, item.previewEnd]);

  const toggleLike = async () => {
    const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/like`, { method: 'POST' });
    if (res.ok) onUpdate(item.id, await res.json(), 'like');
  };
  const submitComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    const res = await fetch(`${apiUrl}/api/feed/tracks/${item.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment }) });
    if (res.ok) { const data = await res.json(); onUpdate(item.id, data.comment, 'comment'); setComment(''); setShowComments(true); }
  };

  return <motion.article ref={cardRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-border bg-shading/35">
    <div className="flex items-center gap-3 px-4 py-3">{item.owner?.avatarUrl ? <img src={item.owner.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-highlight text-sm font-semibold">{(item.owner?.name || user?.name || '?').slice(0, 1).toUpperCase()}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.owner?.name || 'Unknown artist'}</p><p className="text-xs text-secondary-label">{dateLabel(item.publishedAt || item.uploadedAt)}</p></div></div>
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">{item.project?.coverArt ? <img src={item.project.coverArt} alt="" className="h-full w-full object-cover" /> : <div className={`h-full w-full bg-gradient-to-br ${gradientFor(item.id) || defaultGradient}`} />}<button onClick={() => playing ? stop() : play()} className="absolute inset-0 m-auto grid h-12 w-12 place-items-center rounded-full bg-primary-label text-primary-background shadow-xl transition-transform hover:scale-105" aria-label={playing ? 'Pause preview' : 'Play preview'}>{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-1 h-4 w-4 fill-current" />}</button><div className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">{playing ? 'Previewing' : 'Preview'}</div></div>
    <div className="px-4 py-3"><h2 className="font-semibold">{item.title || 'Untitled track'}</h2><p className="mt-1 text-sm text-secondary-label">{item.project?.title || 'Project preview'}</p>{item.feedCaption && <p className="mt-2 text-sm">{item.feedCaption}</p>}<div className="mt-3 flex items-center gap-4"><button onClick={toggleLike} className={`inline-flex items-center gap-1.5 text-sm transition-colors ${item.likedByMe ? 'text-red-400' : 'text-secondary-label hover:text-primary-label'}`} aria-label="Like preview"><Heart className={`h-5 w-5 ${item.likedByMe ? 'fill-current' : ''}`} />{item.likeCount || 0}</button><button onClick={() => setShowComments((value) => !value)} className="inline-flex items-center gap-1.5 text-sm text-secondary-label hover:text-primary-label" aria-label="Show comments"><MessageCircle className="h-5 w-5" />{item.comments?.length || 0}</button></div>{showComments && <div className="mt-3 border-t border-border pt-3"><div className="max-h-36 space-y-2 overflow-y-auto">{(item.comments || []).map((entry) => <div key={entry.id} className="flex gap-2 text-sm"><span className="font-semibold">{entry.user?.name || 'User'}</span><span className="min-w-0 break-words text-secondary-label">{entry.text}</span></div>)}</div><form onSubmit={submitComment} className="mt-3 flex items-center gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full border border-border bg-shading px-3 py-2 text-sm outline-none" /><button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-label text-primary-background" aria-label="Post comment"><Send className="h-4 w-4" /></button></form></div>}</div>
  </motion.article>;
}

export default function Feed({ user }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { fetch(`${apiUrl}/api/feed`).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not load feed.'); setItems(data.items || []); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const updateItem = (id, value, type) => setItems((current) => current.map((item) => item.id !== id ? item : type === 'like' ? { ...item, ...value } : { ...item, comments: [...(item.comments || []), value] }));
  return <div className="min-h-screen bg-primary-background px-5 pb-20 text-primary-label sm:px-8"><header className="mx-auto flex max-w-2xl items-center justify-between border-b border-border/60 py-4"><Link to="/library" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back to library"><ArrowLeft className="h-5 w-5" /></Link><StarlightLogo className="logo-glow h-9 w-36 text-primary-label" /><Radio className="h-5 w-5 text-secondary-label" /></header><main className="mx-auto max-w-2xl py-7"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-label">Discover</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Feed</h1><p className="mt-2 text-sm text-secondary-label">Preview new music from the Rare Motion community.</p></div>{loading && <p className="py-16 text-center text-sm text-secondary-label">Loading previews...</p>}{error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}{!loading && !error && items.length === 0 && <div className="rounded-2xl border border-border bg-shading/40 px-6 py-16 text-center"><Radio className="mx-auto mb-4 h-8 w-8 text-secondary-label" /><p className="font-semibold">The feed is quiet for now.</p><p className="mt-2 text-sm text-secondary-label">Publish a track from its options menu to share a preview.</p></div>}<div className="space-y-6">{items.map((item) => <FeedCard key={item.id} item={item} user={user} onUpdate={updateItem} />)}</div></main></div>;
}
