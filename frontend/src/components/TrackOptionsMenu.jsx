import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BarChart3, Download, FileAudio, FileText, Layers,
  ListPlus, MoreHorizontal, Pencil, Play, Share2, Trash2, Upload, X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatTrackDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function ModalShell({ isOpen, onClose, children, className = 'max-w-3xl', zIndex = 'z-[85]' }) {
  if (!isOpen) return null;
  return createPortal(
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm`} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.18 }}
        className={`w-full ${className} overflow-hidden rounded-[1.5rem] border border-border panel-bg shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>,
    document.body
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
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md" zIndex="z-[95]">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-label">Insights</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-shading text-secondary-label hover:bg-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-secondary-label">Loading...</p>
        ) : (
          <>
            <p className="mb-1 truncate text-sm font-semibold">{track?.title}</p>
            <p className="mb-4 text-3xl font-light">{insights?.totalPlays ?? 0} plays</p>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary-label">Listeners</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {(insights?.byListener || []).length === 0 ? (
                <p className="text-sm text-secondary-label">No listeners yet.</p>
              ) : (
                insights.byListener.map((listener) => (
                  <div key={listener.id} className="flex items-center justify-between rounded-xl bg-shading px-3 py-2 text-sm">
                    <span className="truncate font-medium">{listener.name}</span>
                    <span className="text-secondary-label">{listener.plays}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
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
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md" zIndex="z-[95]">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-label">Rename</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-shading text-secondary-label hover:bg-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-border bg-shading px-3 py-2.5 text-sm text-primary-label outline-none"
          placeholder="Track title"
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button onClick={save} disabled={saving || !title.trim()} className="mt-4 w-full rounded-full bg-primary-label py-2.5 text-sm font-semibold text-primary-background disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}

function TrackNotesModal({ isOpen, onClose, track, userId, onSaved }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (isOpen && track) setNotes(track.notes || '');
  }, [isOpen, track?.id]);

  const autoSave = (val) => {
    setNotes(val);
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`${apiUrl}/api/tracks/${track.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, notes: val })
        });
        setSaved(true);
        if (onSaved) onSaved({ ...track, notes: val });
      } catch (e) { console.error(e); }
      finally { setSaving(false); }
    }, 800);
  };

  if (!isOpen || !track) return null;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-xl" zIndex="z-[95]">
      <div className="flex flex-col" style={{ height: '75vh', maxHeight: '640px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-primary-label">Notes</h3>
            <p className="text-xs text-secondary-label mt-0.5 truncate max-w-[280px] font-medium">{track.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${saving ? 'text-amber-400' : saved ? 'text-green-400' : 'text-secondary-label/50'}`}>
              {saving ? '● Saving' : saved ? '✓ Saved' : '● Auto-save'}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-shading text-secondary-label hover:bg-highlight transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Divider with track name accent */}
        <div className="mx-6 mb-0 h-px bg-gradient-to-r from-primary-label/40 via-primary-label/10 to-transparent" />

        {/* Notepad */}
        <div className="relative flex-1 overflow-hidden">
          {/* Yellow legal pad lines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 33px, rgb(var(--color-border) / 0.35) 33px, rgb(var(--color-border) / 0.35) 34px)',
            backgroundPositionY: '56px',
          }} />
          {/* Red margin */}
          <div className="absolute top-0 bottom-0 left-16 w-px bg-red-500/25 pointer-events-none" />
          {/* Line numbers */}
          <div className="absolute top-0 left-0 w-14 bottom-0 flex flex-col pt-14 pb-4 pointer-events-none select-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="text-right pr-3 text-[9px] text-secondary-label/25 font-mono" style={{ height: '34px', lineHeight: '34px' }}>
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={e => autoSave(e.target.value)}
            placeholder={"Write your ideas, lyrics, mix notes…"}
            className="relative w-full h-full resize-none bg-transparent pl-20 pr-6 pt-14 pb-6 text-sm font-semibold text-primary-label placeholder:text-secondary-label/30 outline-none z-10"
            style={{ lineHeight: '34px', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.01em' }}
          />
        </div>
      </div>
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
      const updatedTrack = await replaceTrackAudio(track, file, userId);
      onSaved(updatedTrack);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md" zIndex="z-[95]">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-label">Replace audio</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-shading text-secondary-label hover:bg-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging ? 'border-primary-label bg-highlight' : 'border-border bg-shading hover:bg-highlight'}`}
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-secondary-label" />
          <p className="text-sm font-medium">Drag a WAV or MP3 here</p>
          {uploading && <p className="mt-3 text-xs text-secondary-label">Uploading...</p>}
        </div>
        <input ref={inputRef} type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
      </div>
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
      const query = `userId=${encodeURIComponent(userId)}`;
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}/split-stems?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start stem split.');

      await new Promise((resolve, reject) => {
        const source = new EventSource(`${apiUrl}/api/tracks/${track.id}/split-stems/status/${data.jobId}?${query}`);
        source.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          if (payload.error) { source.close(); reject(new Error(payload.error)); }
          else if (payload.done) { setProgress(100); setStems(payload.stems || []); source.close(); resolve(); }
          else if (payload.progress) setProgress(payload.progress);
        };
        source.onerror = () => { source.close(); reject(new Error('Stem split connection lost.')); };
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
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md" zIndex="z-[95]">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary-label">Split stems</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-shading text-secondary-label hover:bg-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-secondary-label">Uses Demucs to split into drums, bass, other, and vocals.</p>
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
      </div>
    </ModalShell>
  );
}

function VersionRowMenu({ onExport, onDelete, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[110]" onClick={onClose} />
      <div className="absolute right-0 top-full z-[111] mt-1 w-44 rounded-xl border border-border panel-bg p-1.5 shadow-2xl">
        <button onClick={onExport} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-highlight">
          <Download className="h-3.5 w-3.5" /> Export version
        </button>
        {onDelete && (
          <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete version
          </button>
        )}
      </div>
    </>
  );
}

function VersionRenameField({ label, onSave, disabled }) {
  const [value, setValue] = useState(label);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(label);
  }, [label]);

  const save = async () => {
    const next = value.trim();
    if (!next || next === label) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || saving}
        className="min-w-0 flex-1 rounded-lg border border-border bg-primary-background/50 px-2 py-1 text-sm font-semibold outline-none focus:border-secondary-label"
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button
        onClick={save}
        disabled={disabled || saving || !value.trim() || value.trim() === label}
        className="shrink-0 rounded-lg bg-shading px-2 py-1 text-xs font-semibold hover:bg-highlight disabled:opacity-40"
      >
        {saving ? '...' : 'Save'}
      </button>
    </div>
  );
}

function TrackVersionsModal({ isOpen, onClose, onBack, track, userId, onTrackUpdate, onPlay }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const addVersionRef = useRef(null);

  if (!isOpen || !track) return null;

  const currentEntry = {
    id: 'current',
    label: track.title,
    uploadedAt: track.uploadedAt,
    isCurrent: true
  };
  const allVersions = [currentEntry, ...(track.versions || []).map((v, i) => ({ ...v, isCurrent: false, label: v.label || `Version ${i + 1}` }))];

  const handleSwitch = async (versionId) => {
    if (versionId === 'current') return;
    try {
      const updated = await switchTrackVersion(track, versionId, userId);
      onTrackUpdate(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  const saveVersionLabel = async (version, nextLabel) => {
    try {
      if (version.isCurrent) {
        const res = await fetch(`${apiUrl}/api/tracks/${track.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title: nextLabel })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onTrackUpdate(data.track);
        return;
      }

      const res = await fetch(`${apiUrl}/api/tracks/${track.id}/versions/${version.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, label: nextLabel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onTrackUpdate(data.track);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExport = async (version) => {
    setOpenMenuId(null);
    const url = version.isCurrent
      ? track.url
      : `${apiUrl}/api/media/tracks/${track.id}/versions/${version.id}?userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) { alert('Export failed'); return; }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${version.label || track.title}.wav`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handleDeleteVersion = async (version) => {
    setOpenMenuId(null);
    if (!confirm('Delete this version?')) return;
    const res = await fetch(`${apiUrl}/api/tracks/${track.id}/versions/${version.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Could not delete version'); return; }
    onTrackUpdate(data.track);
  };

  const handleAddVersion = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const updated = await replaceTrackAudio(track, file, userId);
      onTrackUpdate(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-lg" zIndex="z-[90]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="truncate px-3 text-base font-bold">{track.title}</h2>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-5 py-3 text-center text-xs text-secondary-label">
        {track.mimeType?.includes('wav') ? 'WAV' : 'MP3'} · {formatTrackDate(track.uploadedAt)}
      </div>

      <div className="max-h-[50vh] space-y-1 overflow-y-auto px-3 py-3">
        {allVersions.map((version) => (
          <div
            key={version.id}
            className={`relative flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${version.isCurrent ? 'bg-highlight' : 'hover:bg-shading'}`}
          >
            <button
              onClick={() => version.isCurrent ? onPlay?.(track) : handleSwitch(version.id)}
              className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-shading hover:bg-highlight"
              aria-label="Play version"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                {version.isCurrent && (
                  <span className="shrink-0 rounded-full bg-primary-label px-2 py-0.5 text-[10px] font-bold text-primary-background">Current</span>
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary-label">Rename</span>
              </div>
              <VersionRenameField
                label={version.label}
                onSave={(nextLabel) => saveVersionLabel(version, nextLabel)}
              />
              <p className="mt-2 truncate text-xs text-secondary-label">{formatTrackDate(version.uploadedAt)}</p>
            </div>
            <div className="relative shrink-0">
              <button
                onClick={() => setOpenMenuId((id) => (id === version.id ? null : version.id))}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-shading"
                aria-label="Version options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {openMenuId === version.id && (
                <VersionRowMenu
                  onExport={() => handleExport(version)}
                  onDelete={version.isCurrent ? null : () => handleDeleteVersion(version)}
                  onClose={() => setOpenMenuId(null)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border p-4">
        <button
          onClick={() => addVersionRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-shading py-3 text-sm font-semibold hover:bg-highlight disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Add new version'}
        </button>
        <button onClick={onBack} className="w-full rounded-full bg-primary-label py-3 text-sm font-bold text-primary-background">
          Done
        </button>
        <input
          ref={addVersionRef}
          type="file"
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          className="hidden"
          onChange={(e) => { handleAddVersion(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </ModalShell>
  );
}

function TrackDetailsModal({
  isOpen,
  onClose,
  track,
  userId,
  onTrackUpdate,
  onTrackDelete,
  onAddToQueue,
  onPlay,
  onOpenSubModal
}) {
  const [showVersions, setShowVersions] = useState(false);
  const [duration, setDuration] = useState(null);

  useEffect(() => {
    if (!isOpen || !track?.url) return;
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = track.url;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    return () => { audio.src = ''; };
  }, [isOpen, track?.url, track?.id]);

  if (!isOpen || !track) return null;

  const exportTrack = async () => {
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
      alert(err.message);
    }
  };

  const actions = [
    { id: 'rename', label: 'Rename', icon: Pencil, onClick: () => onOpenSubModal('rename') },
    { id: 'insights', label: 'Insights', icon: BarChart3, onClick: () => onOpenSubModal('insights') },
    { id: 'notes', label: 'Notes', icon: FileText, onClick: () => onOpenSubModal('notes') },
    { id: 'replace', label: 'Replace audio', icon: FileAudio, onClick: () => onOpenSubModal('replace') },
    { id: 'stems', label: 'Split stems', icon: Layers, onClick: () => onOpenSubModal('stems') },
    { id: 'queue', label: 'Add to queue', icon: ListPlus, onClick: () => { onAddToQueue(track); onClose(); } },
    { id: 'export', label: 'Export', icon: Download, onClick: exportTrack },
    { id: 'delete', label: 'Delete', icon: Trash2, onClick: () => onOpenSubModal('delete'), danger: true }
  ];

  return (
    <>
      <ModalShell isOpen={isOpen && !showVersions} onClose={onClose} className="max-w-3xl">
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          {/* Left: track details */}
          <div className="border-b border-border p-5 md:border-b-0 md:border-r">
            <div className="mb-4 flex items-start justify-between gap-3">
              <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mb-2 text-2xl font-bold leading-tight">{track.title}</h2>
            <p className="mb-5 text-sm text-secondary-label">
              {formatDuration(duration)}
              {track.versions?.length > 0 && ` · ${track.versions.length + 1} versions`}
            </p>
            <button
              onClick={() => setShowVersions(true)}
              className="rounded-full border border-border bg-shading px-4 py-2 text-sm font-semibold hover:bg-highlight"
            >
              More info
            </button>
          </div>

          {/* Right: actions */}
          <div className="p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-secondary-label">Details</p>
            <button
              disabled
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-secondary-label/50"
            >
              <span className="flex items-center gap-3"><Share2 className="h-4 w-4" /> Share</span>
              <span className="text-xs">Disabled</span>
            </button>
            {actions.map(({ id, label, icon: Icon, onClick, danger }) => (
              <button
                key={id}
                onClick={onClick}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${danger ? 'text-red-500 hover:bg-red-500/10' : 'text-primary-label hover:bg-highlight'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </ModalShell>

      <TrackVersionsModal
        isOpen={showVersions}
        onClose={onClose}
        onBack={() => setShowVersions(false)}
        track={track}
        userId={userId}
        onTrackUpdate={onTrackUpdate}
        onPlay={onPlay}
      />
    </>
  );
}

export default function TrackOptionsMenu({
  track,
  userId,
  onTrackUpdate,
  onTrackDelete,
  onAddToQueue,
  onPlay
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subModal, setSubModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setConfirmDelete(false);
    setDetailsOpen(false);
    try {
      const res = await fetch(`${apiUrl}/api/tracks/${track.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete track.');
      onTrackDelete(track.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const openSubModal = (name) => {
    if (name === 'delete') {
      setConfirmDelete(true);
      return;
    }
    setSubModal(name);
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setDetailsOpen(true); }}
        className="grid h-9 w-9 place-items-center rounded-full text-secondary-label transition-colors hover:bg-highlight hover:text-primary-label"
        aria-label="Track options"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      <TrackDetailsModal
        isOpen={detailsOpen}
        onClose={() => { setDetailsOpen(false); setSubModal(null); }}
        track={track}
        userId={userId}
        onTrackUpdate={onTrackUpdate}
        onTrackDelete={onTrackDelete}
        onAddToQueue={onAddToQueue}
        onPlay={onPlay}
        onOpenSubModal={openSubModal}
      />

      <TrackRenameModal isOpen={subModal === 'rename'} onClose={() => setSubModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <TrackInsightsModal isOpen={subModal === 'insights'} onClose={() => setSubModal(null)} track={track} userId={userId} />
      <TrackNotesModal isOpen={subModal === 'notes'} onClose={() => setSubModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <TrackReplaceModal isOpen={subModal === 'replace'} onClose={() => setSubModal(null)} track={track} userId={userId} onSaved={onTrackUpdate} />
      <StemSplitModal isOpen={subModal === 'stems'} onClose={() => setSubModal(null)} track={track} userId={userId} />

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete track?"
        message="Are you sure you want to delete this track? This action cannot be undone."
        confirmText="Delete"
      />
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
