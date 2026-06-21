import { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CoverArtPicker({ isOpen, onClose, onSelect, projectId, userId, onRefresh, projectCoverUrl }) {
  const [covers, setCovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !projectId) { setLoading(false); return; }

    async function loadCovers() {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/covers?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!cancelled) {
          setCovers((data.covers || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
      } catch (err) {
        console.error('Failed to fetch covers', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCovers();
    return () => { cancelled = true; };
  }, [isOpen, projectId, userId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('projectId', projectId);
    formData.append('cover', file);
    try {
      const res = await fetch(`${apiUrl}/api/upload-cover`, { method: 'POST', body: formData });
      const newCover = await res.json();
      if (res.ok) {
        setCovers(prev => [newCover, ...prev]);
        await handleSelect(newCover.url);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e, cover) => {
    e.stopPropagation();
    if (!confirm('Delete this cover art?')) return;
    try {
      await fetch(`${apiUrl}/api/covers/${cover.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      setCovers(prev => prev.filter(c => c.id !== cover.id));
      if (cover.url === projectCoverUrl) {
        onSelect(null);  // revert grid card to gradient immediately
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSelect = async (url) => {
    try {
      await fetch(`${apiUrl}/api/projects/${projectId}/cover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverUrl: url, userId })
      });
      onSelect(url);
      onClose();
    } catch (err) {
      console.error('Failed to update project cover', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-border max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-5 right-5 text-secondary-label hover:text-primary-label">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-1">Cover Art</h2>
        <p className="text-xs text-secondary-label mb-5">
          {covers.length === 0 && !loading ? 'No cover art yet — upload one below.' : 'Pick a previous cover or upload a new one.'}
        </p>

        <div className="flex-1 overflow-y-auto hide-scrollbar pb-4">
          <div className="grid grid-cols-3 gap-3">

            {/* Upload tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-border hover:border-primary-label/40 bg-shading/30 hover:bg-shading rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              {uploading
                ? <Loader2 className="w-7 h-7 text-primary-label animate-spin" />
                : <>
                    <UploadCloud className="w-7 h-7 text-secondary-label mb-1.5" />
                    <span className="text-xs font-medium text-primary-label">Upload</span>
                  </>
              }
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </div>

            {/* Project's own saved covers */}
            {loading
              ? <div className="col-span-2 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary-label" />
                </div>
              : covers.map(cover => (
                <div
                  key={cover.id}
                  onClick={() => handleSelect(cover.url)}
                  className={`aspect-square relative group rounded-xl overflow-hidden cursor-pointer border transition-all ${cover.url === projectCoverUrl ? 'border-primary-label ring-2 ring-primary-label' : 'border-border hover:ring-2 hover:ring-primary-label/50'}`}
                >
                  <img src={cover.url} className="w-full h-full object-cover" alt="Cover"
                    onError={e => e.currentTarget.style.display = 'none'} />
                  {/* Current indicator */}
                  {cover.url === projectCoverUrl && (
                    <div className="absolute top-2 left-2 rounded-full bg-primary-label text-primary-background text-[10px] font-bold px-2 py-0.5">
                      Current
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-7 h-7 text-white" />
                  </div>
                  <button
                    onClick={e => handleDelete(e, cover)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
