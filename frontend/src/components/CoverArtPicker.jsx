import { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';

export default function CoverArtPicker({ isOpen, onClose, onSelect, projectId, onRefresh, projectCoverUrl }) {
  const [covers, setCovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCovers();
    }
  }, [isOpen]);

  const fetchCovers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/workspace`);
      const data = await res.json();
      // Most recent first
      setCovers(data.coverArts.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)) || []);
    } catch (err) {
      console.error('Failed to fetch covers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/upload-cover`, {
        method: 'POST',
        body: formData,
      });
      const newCover = await res.json();
      
      if (res.ok) {
        setCovers([newCover, ...covers]);
        handleSelect(newCover.url);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this cover art?')) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/covers/${id}`, { method: 'DELETE' });
      const deletedCover = covers.find(c => c.id === id);
      setCovers(covers.filter(c => c.id !== id));
      if (deletedCover && deletedCover.url === projectCoverUrl) {
        // clear project's cover if it was the deleted one
        onRefresh();
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSelect = async (url) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects/${projectId}/cover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverUrl: url })
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className="relative glass w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-slide-up border-border border max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-6 right-6 text-secondary-label hover:text-primary-label transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-medium mb-6">Choose Cover Art</h2>

        <div className="flex-1 overflow-y-auto min-h-[300px] hide-scrollbar pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            
            {/* Upload Button */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-border hover:border-primary-label/30 bg-shading/30 hover:bg-shading rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-primary-label animate-spin" />
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 text-secondary-label mb-2" />
                  <span className="text-sm font-medium text-primary-label">Upload New</span>
                </>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
            </div>

            {/* Existing Covers */}
            {loading ? (
              <div className="col-span-2 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-secondary-label" />
              </div>
            ) : (
              covers.map(cover => (
                <div 
                  key={cover.id} 
                  onClick={() => handleSelect(cover.url)}
                  className="aspect-square relative group rounded-xl overflow-hidden cursor-pointer border border-border hover:ring-2 hover:ring-primary-label transition-all"
                >
                  <img src={cover.url} className="w-full h-full object-cover" alt="Cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white" />
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, cover.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
