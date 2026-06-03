import { useState, useRef } from 'react';
import { X, UploadCloud, Loader2, Music } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onSuccess, userId, projectId }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [producer, setProducer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith('audio/')) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
      setError('');
    } else {
      setFile(null);
      setError('Please select a valid audio file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('audio/')) {
      setFile(dropped);
      if (!title) {
        setTitle(dropped.name.replace(/\.[^/.]+$/, ""));
      }
      setError('');
    } else {
      setError('Please drop a valid audio file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('track', file);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('producer', producer);
    formData.append('userId', userId);
    if (projectId) formData.append('projectId', projectId);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setFile(null);
        setTitle('');
        setArtist('');
        setProducer('');
        onSuccess(data.track);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative glass w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-slide-up border-border border max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-secondary-label hover:text-primary-label transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-medium mb-6">Upload Track</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
              file ? 'border-primary-label/50 bg-highlight/30' : 'border-border hover:border-primary-label/30 bg-shading/30 hover:bg-shading'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {file ? (
              <>
                <div className="w-12 h-12 bg-primary-label text-primary-background rounded-full flex items-center justify-center mb-4">
                  <Music className="w-6 h-6" />
                </div>
                <p className="font-medium text-primary-label">{file.name}</p>
                <p className="text-xs text-secondary-label mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(''); }}
                  className="mt-4 text-xs font-medium bg-shading hover:bg-highlight px-3 py-1.5 rounded-full"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-shading text-primary-label rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-medium text-primary-label mb-1">Click or drag file to upload</p>
                <p className="text-sm text-secondary-label">MP3, WAV, FLAC, AAC</p>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="audio/*" 
              onChange={handleFileChange} 
            />
          </div>

          {file && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-label mb-2">Track Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-shading border border-border rounded-xl px-4 py-3 text-primary-label focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-label mb-2">Artist (Optional)</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full bg-shading border border-border rounded-xl px-4 py-3 text-primary-label focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-label mb-2">Producer (Optional)</label>
                  <input
                    type="text"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                    className="w-full bg-shading border border-border rounded-xl px-4 py-3 text-primary-label focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 py-2 px-3 rounded-lg border border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-secondary-label">Timestamp will be auto-generated</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium rounded-xl hover:bg-shading transition-colors text-primary-label"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !file}
                className="bg-primary-label text-primary-background font-medium rounded-xl px-6 py-2.5 hover:opacity-90 transition-opacity flex items-center justify-center min-w-[120px] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
