import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Download, FileAudio, FileText, Layers, ListPlus, MoreHorizontal,
  Pencil, Trash2, Upload, X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ModalShell({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[1.25rem] border border-border panel-bg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-label">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-shading text-secondary-label hover:bg-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TrackInsightsModal({ isOpen, onClose, track, userId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !track) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${apiUrl}/api/tracks/${track.id}/insights?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setInsights(data); })
      .catch(() => { if (!cancelled) setInsights(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, track, userId]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Track insights">
      {loading ? (
        <p className="text-sm text-secondary-label">Loading...</p>
      ) : (
        <>
          <p className="mb-1 truncate text-sm font-semibold text-primary-label">{track?.title}</p>
          <p className="mb-4 text-3xl font-light">{insights?.totalPlays ?? 0}</p>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary-label">Listeners</p>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {(insights?.byListener || []).length === 0 ? (
              <p className="text-sm text-secondary-label">No listeners yet.</p>
            ) : (
              insights.byListener.map((listener) => (
                <div key={listener.id} className="flex items-center justify-between rounded-xl bg-shading px-3 py-2 text-sm">
                  <span className="truncate font-medium">{listener.name}</span>
                  <span className="text-secondary-label">{listener.plays} play{listener.plays === 1 ? '' : 's'}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}

function TrackNotesModal({ isOpen, onClose, track, userId, onSaved }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && track) setNotes(track.notes || '');
  }, [isOpen, track]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save notes.');
      onSaved(data.track);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Track notes">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Add notes about this track..."
        className="w-full resize-none rounded-xl border border-border bg-shading px-3 py-2 text-sm text-primary-label outline-none focus:border-secondary-label"
      />
      <button onClick={save} disabled={saving} className="mt-4 w-full rounded-full bg-primary-label py-2.5 text-sm font-semibold text-primary-background disabled:opacity-60">
        {saving ? 'Saving...' : 'Save notes'}
      </button>
    </ModalShell>
  );
}

function TrackRenameModal({ isOpen, onClose, track, userId, onSaved }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && track) setTitle(track.title || '');
  }, [isOpen, track]);

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: nextTitle })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rename track.');
      onSaved(data.track);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Rename track">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-border bg-shading px-3 py-2.5 text-sm text-primary-label outline-none focus:border-secondary-label"
        placeholder="Track title"
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button onClick={save} disabled={saving || !title.trim()} className="mt-4 w-full rounded-full bg-primary-label py-2.5 text-sm font-semibold text-primary-background disabled:opacity-60">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </ModalShell>
  );
}

function TrackReplaceModal({ isOpen, onClose, track, userId, onSaved }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file || !/\.(wav|mp3)$/i.test(file.name)) {
      alert('Please upload a WAV or MP3 file.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('track', file);
      formData.append('userId', userId);
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}/replace-audio`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not replace audio.');
      onSaved(data.track);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Replace audio">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging ? 'border-primary-label bg-highlight' : 'border-border bg-shading hover:bg-highlight'}`}
      >
        <Upload className="mx-auto mb-3 h-8 w-8 text-secondary-label" />
        <p className="text-sm font-medium text-primary-label">Drag a WAV or MP3 here</p>
        <p className="mt-1 text-xs text-secondary-label">Previous versions stay switchable from the track row</p>
        {uploading && <p className="mt-3 text-xs text-secondary-label">Uploading...</p>}
      </div>
      <input ref={inputRef} type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
    </ModalShell>
  );
}

function StemSplitModal({ isOpen, onClose, track, userId }) {
  const [progress, setProgress] = useState(0);
  const [stems, setStems] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStems(null);
      setError('');
      setRunning(false);
    }
  }, [isOpen]);

  const startSplit = async () => {
    setRunning(true);
    setError('');
    setProgress(5);
    try {
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}/split-stems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start stem split.');

      await new Promise((resolve, reject) => {
        const source = new EventSource(`${apiUrl}/api/tracks/${track.id}/split-stems/status/${data.jobId}`);
        source.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          if (payload.error) {
            source.close();
            reject(new Error(payload.error));
          } else if (payload.done) {
            setProgress(100);
            setStems(payload.stems || []);
            source.close();
            resolve();
          } else if (payload.progress) {
            setProgress(payload.progress);
          }
        };
        source.onerror = () => {
          source.close();
          reject(new Error('Stem split connection lost.'));
        };
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const downloadStem = async (stem) => {
    const res = await fetch(stem.url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${track.title}-${stem.name}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Split stems">
      <p className="mb-4 text-sm text-secondary-label">Uses Demucs (htdemucs) to split into drums, bass, other, and vocals.</p>
      {!stems && !running && (
        <button onClick={startSplit} className="w-full rounded-full bg-primary-label py-2.5 text-sm font-semibold text-primary-background">
          Start stem split
        </button>
      )}
      {running && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-shading">
            <div className="h-full rounded-full bg-primary-label transition-all" style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <p className="mt-2 text-center text-xs text-secondary-label">{progress}%</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {stems?.length > 0 && (
        <div className="mt-4 space-y-2">
          {stems.map((stem) => (
            <button key={stem.name} onClick={() => downloadStem(stem)} className="flex w-full items-center justify-between rounded-xl bg-shading px-3 py-2 text-sm hover:bg-highlight">
              <span className="capitalize">{stem.name}</span>
              <Download className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

export default function TrackOptionsMenu({
  track,
  userId,
  onTrackUpdate,
  onTrackDelete,
  onAddToQueue,
  onReplaceAudioFile
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef(null);

  const closeMenu = () => setIsMenuOpen(false);
  const openModal = (name) => {
    closeMenu();
    setModal(name);
  };

  const exportTrack = async () => {
    closeMenu();
    try {
      const res = await fetch(track.url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${track.title || 'track'}.wav`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not export track.');
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete track.');
      onTrackDelete(track.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const menuItems = [
    { id: 'rename', label: 'Rename', icon: Pencil, action: () => openModal('rename') },
    { id: 'insights', label: 'Insights', icon: BarChart3, action: () => openModal('insights') },
    { id: 'notes', label: 'Notes', icon: FileText, action: () => openModal('notes') },
    { id: 'replace', label: 'Replace audio', icon: FileAudio, action: () => openModal('replace') },
    { id: 'stems', label: 'Split stems', icon: Layers, action: () => openModal('stems') },
    { id: 'queue', label: 'Add to queue', icon: ListPlus, action: () => { closeMenu(); onAddToQueue(track); } },
    { id: 'export', label: 'Export WAV', icon: Download, action: exportTrack },
    { id: 'delete', label: 'Delete', icon: Trash2, action: () => { closeMenu(); setConfirmDelete(true); }, danger: true }
  ];

  return (
    <>
      {isMenuOpen && <div className="fixed inset-0 z-40" onClick={closeMenu} />}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsMenuOpen((open) => !open); }}
          className="grid h-9 w-9 place-items-center rounded-full text-secondary-label transition-colors hover:bg-highlight hover:text-primary-label"
          aria-label="Track options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[1rem] border border-border panel-bg p-2 shadow-2xl origin-top-right"
              onClick={(e) => e.stopPropagation()}
            >
              {menuItems.map(({ id, label, icon: Icon, action, danger }) => (
                <button
                  key={id}
                  onClick={(e) => { e.stopPropagation(); action(); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${danger ? 'text-red-500 hover:bg-red-500/10' : 'text-primary-label hover:bg-highlight'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TrackRenameModal isOpen={modal === 'rename'} onClose={() => setModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <TrackInsightsModal isOpen={modal === 'insights'} onClose={() => setModal(null)} track={track} userId={userId} />
      <TrackNotesModal isOpen={modal === 'notes'} onClose={() => setModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <TrackReplaceModal isOpen={modal === 'replace'} onClose={() => setModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <StemSplitModal isOpen={modal === 'stems'} onClose={() => setModal(null)} track={track} userId={userId} />

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete track?"
        message="Are you sure you want to delete this track? This action cannot be undone."
        confirmText="Delete"
      />

      {onReplaceAudioFile && (
        <input
          type="file"
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          className="hidden"
          id={`replace-audio-${track.id}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onReplaceAudioFile(track, file);
            e.target.value = '';
          }}
        />
      )}
    </>
  );
}

export async function replaceTrackAudio(track, file, userId) {
  const formData = new FormData();
  formData.append('track', file);
  formData.append('userId', userId);
  const res = await fetch(`${apiUrl}/api/tracks/${track.id}/replace-audio`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not replace audio.');
  return data.track;
}

export async function switchTrackVersion(track, versionId, userId) {
  const res = await fetch(`${apiUrl}/api/tracks/${track.id}/switch-version`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, versionId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not switch version.');
  return data.track;
}
