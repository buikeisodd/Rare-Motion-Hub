import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

const apiUrl = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4000');

export default function CoverArtStorage({ user }) {
  const [covers, setCovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const inputRef = useRef(null);

  const loadCovers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/covers?userId=${encodeURIComponent(user.id)}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load cover art.');
      setCovers((data.covers || []).sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0)));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCovers(); }, [user.id]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('cover', file);
      const response = await fetch(`${apiUrl}/api/upload-cover`, { method: 'POST', credentials: 'include', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not upload cover art.');
      setCovers((current) => [data, ...current]);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const cover = pendingDelete;
    setPendingDelete(null);
    try {
      const response = await fetch(`${apiUrl}/api/covers/${cover.id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not delete cover art.');
      setCovers((current) => current.filter((item) => item.id !== cover.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return <div className="min-h-screen bg-primary-background px-5 pb-20 text-primary-label sm:px-8">
    <header className="mx-auto flex max-w-4xl items-center gap-4 py-4">
      <Link to="/settings" className="grid h-10 w-10 place-items-center rounded-xl bg-shading hover:bg-highlight" aria-label="Back to settings"><ArrowLeft className="h-5 w-5" /></Link>
      <div><h1 className="font-display text-xl font-bold tracking-wider">Cover art storage</h1><p className="mt-1 text-sm text-secondary-label">Keep artwork ready for your next project.</p></div>
    </header>
    <main className="mx-auto max-w-4xl py-8">
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
      <div className="mb-6 flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Your collection</h2><p className="mt-1 text-sm text-secondary-label">Use these covers from any project cover-art picker.</p></div><label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary-label text-primary-background shadow-lg transition hover:-translate-y-0.5" aria-label="Upload cover art" title="Upload cover art"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={upload} disabled={uploading} />{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}</label></div>
      {loading ? <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-secondary-label" /></div> : covers.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{covers.map((cover) => <article key={cover.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-shading shadow-sm"><img src={cover.url} alt="Stored cover art" className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 p-2 opacity-0 backdrop-blur-sm transition group-hover:opacity-100"><span className="flex items-center gap-1 text-xs text-white"><ImageIcon className="h-3.5 w-3.5" />Stored</span><button type="button" onClick={() => setPendingDelete(cover)} className="grid h-8 w-8 place-items-center rounded-lg text-red-300 hover:bg-red-500 hover:text-white" aria-label="Delete cover art"><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center"><ImageIcon className="mx-auto h-9 w-9 text-secondary-label" /><p className="mt-3 font-semibold">No stored cover art yet.</p><p className="mt-1 text-sm text-secondary-label">Upload artwork here and it will appear whenever you pick a project cover.</p></div>}
    </main>
    <ConfirmModal isOpen={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} onConfirm={remove} title="Delete cover art?" message="This removes the artwork from your personal cover collection. Projects using it will keep their current image." confirmText="Delete cover art" />
  </div>;
}
