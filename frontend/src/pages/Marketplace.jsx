import { useEffect, useState } from 'react';
import { ArrowLeft, Pause, Play, MoreHorizontal, Trash2, Upload, Store, X, Plus, Bookmark, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CATEGORIES = ['beat', 'song', 'sample'];
const INSTRUMENTS = ['Piano', 'Guitar', 'Bass', 'Drums', '808', 'Strings', 'Brass', 'Woodwind', 'Synth', 'Vocal', 'Percussion', 'Orchestral', 'FX', 'Other'];
const MUSICAL_KEYS = ['C major', 'D major', 'E major', 'F major', 'G major', 'A major', 'B major', 'C minor', 'D minor', 'E minor', 'F minor', 'G minor', 'A minor', 'B minor', 'C sharp major', 'D sharp major', 'F sharp major', 'G sharp major', 'A sharp major', 'C sharp minor', 'D sharp minor', 'F sharp minor', 'G sharp minor', 'A sharp minor'];
const GENRES = ['Afrobeats', 'Afro House', 'Amapiano', 'Alternative', 'Ambient', 'Blues', 'Classical', 'Country', 'Dancehall', 'Disco', 'Drill', 'Electronic', 'Folk', 'Funk', 'Gospel', 'Hip-Hop', 'House', 'Indie', 'Jazz', 'K-Pop', 'Latin', 'Lo-fi', 'Pop', 'R&B', 'Reggae', 'Rock', 'Soul', 'Trap', 'Techno', 'World'];

export default function Marketplace({ user }) {
  const [form, setForm] = useState({ title: '', price: '25000', licenseType: 'lease', category: 'beat', genre: '', bpm: '', key: '', instrument: '' });
  const [beat, setBeat] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [beats, setBeats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [playingBeatId, setPlayingBeatId] = useState(null);
  const [pendingDeleteBeat, setPendingDeleteBeat] = useState(null);
  const [savedBeatIds, setSavedBeatIds] = useState([]);
  const [filters, setFilters] = useState({ query: '', category: 'all', genre: 'all', bpm: 'all', key: 'all', instrument: 'all' });
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('marketplaceCart') || '[]'); } catch { return []; } });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { localStorage.setItem('marketplaceCart', JSON.stringify(cart)); }, [cart]);
  const addToCart = (item) => setCart((current) => current.some((entry) => entry.id === item.id) ? current : [...current, item]);
  const removeFromCart = (id) => setCart((current) => current.filter((item) => item.id !== id));

  useEffect(() => {
    fetch(`${apiUrl}/api/marketplace/beats`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : { beats: [] })
      .then((data) => { const listings = Array.isArray(data.beats) ? data.beats : []; setBeats(listings); setSavedBeatIds(listings.filter((item) => item.savedByMe).map((item) => item.id)); })
      .catch(() => setBeats([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!beat || !agreement) return setStatus('Add both the beat and agreement certification.');
    setSaving(true);
    setStatus('');
    try {
      const upload = async (file, kind) => {
        setStatus(`Preparing ${kind} upload...`);
        const signatureResponse = await fetch(`${apiUrl}/api/marketplace/upload/signature?kind=${kind}`, { credentials: 'include' });
        const signature = await signatureResponse.json();
        if (!signatureResponse.ok) throw new Error(signature.error || 'Cloudinary storage is unavailable.');
        const cloudForm = new FormData();
        cloudForm.append('file', file); cloudForm.append('api_key', signature.apiKey); cloudForm.append('timestamp', String(signature.timestamp)); cloudForm.append('folder', signature.folder); cloudForm.append('signature', signature.signature);
        return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open('POST', `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`); xhr.upload.onprogress = (progress) => { if (progress.lengthComputable) setStatus(`Uploading ${kind}... ${Math.round(progress.loaded / progress.total * 100)}%`); }; xhr.onload = () => { const data = JSON.parse(xhr.responseText || '{}'); xhr.status >= 200 && xhr.status < 300 ? resolve({ secureUrl: data.secure_url, publicId: data.public_id, resourceType: data.resource_type, format: data.format, bytes: data.bytes }) : reject(new Error(data.error?.message || `${kind} upload failed.`)); }; xhr.onerror = () => reject(new Error(`${kind} upload failed.`)); xhr.send(cloudForm); });
      };
      const uploadedBeat = await upload(beat, 'beat');
      const uploadedAgreement = await upload(agreement, 'agreement');
      setStatus('Saving marketplace listing...');
      const response = await fetch(`${apiUrl}/api/marketplace/beats/cloudinary`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, beat: uploadedBeat, agreement: uploadedAgreement }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not publish beat.');
      setBeats((current) => [data.beat, ...current]);
      setStatus('Beat listed successfully.');
      setForm({ title: '', price: '25000', licenseType: 'lease', genre: '', bpm: '', key: '' });
      setBeat(null);
      setAgreement(null);
      setShowForm(false);
    } catch (error) {
      setStatus(error.message || 'Could not publish beat.');
    } finally {
      setSaving(false);
    }
  };

  const [openActionId, setOpenActionId] = useState(null);
  const filteredBeats = beats.filter((item) => { const haystack = String(item.title || '') + ' ' + String(item.sellerUsername || '').toLowerCase(); return (!filters.query || haystack.includes(filters.query.toLowerCase())) && (filters.category === 'all' || (item.category || 'beat') === filters.category) && (filters.genre === 'all' || item.genre === filters.genre) && (filters.bpm === 'all' || (filters.bpm === 'slow' ? item.bpm < 100 : filters.bpm === 'mid' ? item.bpm >= 100 && item.bpm <= 140 : item.bpm > 140)) && (filters.key === 'all' || item.key === filters.key) && (filters.instrument === 'all' || item.instrument === filters.instrument); });

  const deleteBeat = async (beat) => {
    const response = await fetch(`${apiUrl}/api/marketplace/beats/${beat.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) {
      setBeats((current) => current.filter((item) => item.id !== beat.id));
      setOpenActionId(null);
      setPendingDeleteBeat(null);
    }
    else setStatus('Could not delete this listing.');
  };

  return <div className="min-h-screen bg-primary-background px-4 pb-24 text-primary-label sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between py-5">
      <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-2xl bg-shading hover:bg-highlight" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></Link>
      <h1 className="font-display text-xl font-bold tracking-wider">mArKeTpLaCe</h1>
      <button type="button" onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl bg-[#34483B] text-[#F4EBDD]" aria-label="Open cart"><ShoppingCart className="h-5 w-5" />{cart.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#F4EBDD] px-1 text-xs font-bold text-[#34483B]">{cart.length}</span>}</button>
    </header>
    <main className="mx-auto max-w-5xl py-8">
      <section><h2 className="text-4xl font-bold tracking-tight">Find the next sound.</h2><p className="mt-2 max-w-xl text-secondary-label">Buy beats from independent creators with clear licensing and downloadable agreements.</p><div className="mt-7 grid gap-3 rounded-2xl border border-border bg-[#34483B] p-4 text-[#F4EBDD] sm:grid-cols-2 lg:grid-cols-6"><input value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} placeholder="Search marketplace" className="h-10 rounded-xl bg-[#F4EBDD]/10 px-3 text-sm outline-none placeholder:text-[#F4EBDD]/60 lg:col-span-2" /><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="h-10 rounded-xl bg-[#34483B] px-3 text-sm"><option value="all">All types</option>{CATEGORIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><select value={filters.genre} onChange={(e) => setFilters({ ...filters, genre: e.target.value })} className="h-10 rounded-xl bg-[#34483B] px-3 text-sm"><option value="all">All genres</option>{GENRES.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={filters.bpm} onChange={(e) => setFilters({ ...filters, bpm: e.target.value })} className="h-10 rounded-xl bg-[#34483B] px-3 text-sm"><option value="all">Any tempo</option><option value="slow">Under 100 BPM</option><option value="mid">100-140 BPM</option><option value="fast">Over 140 BPM</option></select><select value={filters.instrument} onChange={(e) => setFilters({ ...filters, instrument: e.target.value })} className="h-10 rounded-xl bg-[#34483B] px-3 text-sm"><option value="all">All instruments</option>{INSTRUMENTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="my-6 flex justify-center"><button type="button" onClick={() => { setStatus(String()); setShowForm(true); }} className="grid h-10 w-10 place-items-center rounded-xl bg-[#34483B] text-[#F4EBDD] shadow-lg transition hover:-translate-y-0.5" aria-label="Add marketplace listing"><Plus className="h-5 w-5" /></button></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filteredBeats.length ? filteredBeats.map((beat) => <article key={beat.id} className="relative rounded-3xl border border-border bg-[#34483B] p-5 text-[#F4EBDD]">{beat.sellerId === user?.id && <div className="absolute right-3 top-3 z-10"><button type="button" onClick={() => setOpenActionId((current) => current === beat.id ? null : beat.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label hover:bg-highlight" aria-label="Marketplace listing actions" aria-expanded={openActionId === beat.id}><MoreHorizontal className="h-5 w-5" /></button>{openActionId === beat.id && <div className="absolute right-0 top-11 min-w-36 rounded-xl border border-border bg-primary-background p-1 shadow-xl"><button type="button" onClick={() => setPendingDeleteBeat(beat)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-highlight"><Trash2 className="h-4 w-4" />Delete listing</button></div>}</div>}<div className="flex items-start justify-between gap-4 pr-8"><div className="min-w-0"><h3 className="truncate text-lg font-bold">{beat.title}</h3><p className="mt-1 text-sm text-[#F4EBDD]/75">@{beat.sellerUsername || 'seller'} · {beat.genre || 'Beat'} · {beat.bpm || '--'} BPM · {beat.key || '--'}</p><p className="mt-2 text-base font-bold text-[#F4EBDD]">₦{Number(beat.price || 0).toLocaleString('en-NG')}</p></div></div><button type="button" onClick={async () => { const response = await fetch(`${apiUrl}/api/marketplace/beats/${beat.id}/save`, { method: "POST", credentials: "include" }); if (response.ok) { const data = await response.json(); setSavedBeatIds((current) => data.saved ? [...new Set([...current, beat.id])] : current.filter((id) => id !== beat.id)); } }} className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#34483B]" aria-label={savedBeatIds.includes(beat.id) ? "Unsave beat" : "Save beat"}><Bookmark className={`h-4 w-4 ${savedBeatIds.includes(beat.id) ? "text-[#F4EBDD]" : "text-[#34483B]"}`} fill={savedBeatIds.includes(beat.id) ? "currentColor" : "none"} />{savedBeatIds.includes(beat.id) ? "Saved" : "Save"}</button><button type="button" onClick={() => addToCart(beat)} disabled={cart.some((item) => item.id === beat.id)} className="mb-2 rounded-xl bg-[#F4EBDD] px-3 py-2 text-sm font-semibold text-[#34483B] disabled:opacity-60">{cart.some((item) => item.id === beat.id) ? 'In cart' : 'Add to cart'}</button><audio className="mt-4 w-full" controls preload="none" onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= 60) { event.currentTarget.pause(); event.currentTarget.currentTime = 0; } }} src={beat.beatUrl?.startsWith('/') ? `${apiUrl}${beat.beatUrl.replace('/api/media/uploads/', '/uploads/')}` : beat.beatUrl} /></article>) : <div className="rounded-3xl border border-border bg-shading/40 p-6"><p className="text-sm text-secondary-label">No beats listed yet. Publish the first one.</p></div>}</div></section>

      {cartOpen && <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setCartOpen(false)}><aside className="absolute right-4 top-20 w-80 rounded-2xl bg-[#34483B] p-5 text-[#F4EBDD] shadow-2xl"><h2 className="text-lg font-bold">Your cart</h2>{cart.length === 0 ? <p className="py-8 text-sm">Your cart is empty.</p> : cart.map((item) => <div key={item.id} className="mt-3 border-b border-[#F4EBDD]/20 pb-3"><p className="font-semibold">{item.title}</p><p className="text-xs">@{item.sellerUsername || 'seller'} · {item.licenseType}</p><p className="font-bold">₦{Number(item.price || 0).toLocaleString('en-NG')}</p><button type="button" onClick={() => removeFromCart(item.id)} className="text-xs">Remove</button></div>)}</aside></div>}<ConfirmModal isOpen={Boolean(pendingDeleteBeat)} onClose={() => setPendingDeleteBeat(null)} onConfirm={() => deleteBeat(pendingDeleteBeat)} title="Delete marketplace listing?" message="This will remove the listing and its uploaded beat files. This action cannot be undone." confirmText="Delete listing" />
      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-[#34483B]/45 p-4 backdrop-blur-xl"><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-primary-background p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">List a beat</h2><button type="button" onClick={() => setShowForm(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-shading" aria-label="Close"><X className="h-4 w-4" /></button></div>
        
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Listing type<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, licenseType: e.target.value === "beat" ? form.licenseType : "exclusive" })} className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none">{CATEGORIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Beat title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">Price (₦ NGN)<input type="number" min="25000" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">License<select value={form.licenseType} disabled={form.category !== "beat"} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="lease">For lease</option><option value="exclusive">Exclusive</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">Genre<select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="">Choose genre</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-semibold">BPM<input type="number" min="1" max="400" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label><label className="grid gap-2 text-sm font-semibold">Musical key<select value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="">Choose key</option>{MUSICAL_KEYS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          <label className="grid gap-2 text-sm font-semibold">Beat file<input type="file" accept="audio/*" onChange={(e) => setBeat(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          <label className="grid gap-2 text-sm font-semibold">Agreement certification<input type="file" accept="application/pdf,.pdf" onChange={(e) => setAgreement(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          {status && <p role="status" className="text-sm text-secondary-label">{status}</p>}
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-label px-4 text-sm font-semibold text-primary-background disabled:opacity-50"><Upload className="h-4 w-4" />{saving ? 'Publishing...' : 'Publish beat'}</button>
        </div>
      </form></div>}
    </main>
  </div>;
}





