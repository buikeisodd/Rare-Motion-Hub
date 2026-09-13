import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, Store, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const GENRES = ['Afrobeats', 'Afro House', 'Amapiano', 'Alternative', 'Ambient', 'Blues', 'Classical', 'Country', 'Dancehall', 'Disco', 'Drill', 'Electronic', 'Folk', 'Funk', 'Gospel', 'Hip-Hop', 'House', 'Indie', 'Jazz', 'K-Pop', 'Latin', 'Lo-fi', 'Pop', 'R&B', 'Reggae', 'Rock', 'Soul', 'Trap', 'Techno', 'World'];

export default function Marketplace({ user }) {
  const [form, setForm] = useState({ title: '', price: '', licenseType: 'lease', genre: '', bpm: '', key: '' });
  const [beat, setBeat] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [beats, setBeats] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/api/marketplace/beats`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : { beats: [] })
      .then((data) => setBeats(Array.isArray(data.beats) ? data.beats : []))
      .catch(() => setBeats([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!beat || !agreement) return setStatus('Add both the beat and agreement certification.');
    setSaving(true);
    setStatus('');
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('beat', beat);
    body.append('agreement', agreement);
    try {
      const response = await fetch(`${apiUrl}/api/marketplace/beats`, { method: 'POST', credentials: 'include', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not publish beat.');
      setBeats((current) => [data.beat, ...current]);
      setStatus('Beat listed successfully.');
      setForm({ title: '', price: '', licenseType: 'lease', genre: '', bpm: '', key: '' });
      setBeat(null);
      setAgreement(null);
      setShowForm(false);
    } catch (error) {
      setStatus(error.message || 'Could not publish beat.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="min-h-screen bg-primary-background px-4 pb-24 text-primary-label sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between py-5">
      <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-2xl bg-shading hover:bg-highlight" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></Link>
      <h1 className="font-display text-xl font-bold tracking-wider">mArKeTpLaCe</h1>
      <Store className="h-6 w-6 text-accent" />
    </header>
    <main className="mx-auto grid max-w-5xl gap-8 py-8 lg:grid-cols-[1fr_22rem]">
      <section><h2 className="text-4xl font-bold tracking-tight">Find the next sound.</h2><p className="mt-2 max-w-xl text-secondary-label">Buy beats from independent creators with clear licensing and downloadable agreements.</p><div className="mt-8 grid gap-3">{beats.length ? beats.map((beat) => <article key={beat.id} className="rounded-3xl border border-border bg-shading/40 p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate text-lg font-bold">{beat.title}</h3><p className="mt-1 text-sm text-secondary-label">{beat.licenseType === 'exclusive' ? 'Exclusive' : 'For lease'} · {Number(beat.price).toFixed(2)}</p></div><span className="shrink-0 rounded-xl bg-highlight px-3 py-1 text-xs font-semibold">Beat</span></div><audio className="mt-4 w-full" controls preload="none" src={beat.beatUrl?.startsWith('/') ? `${apiUrl}${beat.beatUrl.replace('/api/media/uploads/', '/uploads/')}` : beat.beatUrl} /></article>) : <div className="rounded-3xl border border-border bg-shading/40 p-6"><p className="text-sm text-secondary-label">No beats listed yet. Publish the first one.</p></div>}</div></section>
      <button type="button" onClick={() => { setStatus(''); setShowForm(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-label px-4 text-sm font-semibold text-primary-background"><Upload className="h-4 w-4" />List a beat</button>
      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-[#34483B]/45 p-4 backdrop-blur-xl"><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-primary-background p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">List a beat</h2><button type="button" onClick={() => setShowForm(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-shading" aria-label="Close"><X className="h-4 w-4" /></button></div>
        <h2 className="text-lg font-bold">List a beat</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Beat title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">Price<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">License<select value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="lease">For lease</option><option value="exclusive">Exclusive</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">Genre<select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="">Choose genre</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-semibold">BPM<input type="number" min="1" max="400" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label><label className="grid gap-2 text-sm font-semibold">Beat key<input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="C minor" required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label></div>
          <label className="grid gap-2 text-sm font-semibold">Beat file<input type="file" accept="audio/*" onChange={(e) => setBeat(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          <label className="grid gap-2 text-sm font-semibold">Agreement certification<input type="file" accept="application/pdf,.pdf" onChange={(e) => setAgreement(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          {status && <p role="status" className="text-sm text-secondary-label">{status}</p>}
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-label px-4 text-sm font-semibold text-primary-background disabled:opacity-50"><Upload className="h-4 w-4" />{saving ? 'Publishing...' : 'Publish beat'}</button>
        </div>
      </form></div>}
    </main>
  </div>;
}

