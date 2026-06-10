import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bell, ChevronRight, Circle, Copy, Disc3, FolderPlus, FolderOpen, Home, LogOut, MessageSquare, MoreHorizontal, Plus, Trash2, Video, X } from 'lucide-react';
import { LibraryProject, LibraryFolder } from './Dashboard';
import ChatInbox from '../components/ChatInbox';
import StarlightLogo from '../components/StarlightLogo';
import ConfirmModal from '../components/ConfirmModal';
import ShareLinkModal from '../components/ShareLinkModal';
import MarqueeInput from '../components/MarqueeInput';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Folder({ user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableArtist, setEditableArtist] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const fetchFolder = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/folders/${id}?userId=${user.id}`);
      if (!res.ok) { navigate('/library'); return; }
      const json = await res.json();
      setData(json);
      setEditableTitle(json.folder?.title || json.folder?.name || 'Folder');
      setEditableArtist(json.folder?.artist || '');
    } catch {
      navigate('/library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchFolder();
  }, [id]);

  const saveFolderMetadata = async (folderId, updates) => {
    const res = await fetch(`${apiUrl}/api/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, userId: user.id }),
    });
    if (res.ok) {
      const saved = await res.json();
      if (folderId === id) {
        // Updating the current folder title
        setData((prev) => ({ ...prev, folder: saved.folder || saved }));
      } else {
        setData((prev) => ({
          ...prev,
          folders: prev.folders.map((f) => (f.id === folderId ? saved.folder || saved : f)),
        }));
      }
    }
  };

  const saveCurrentFolder = async () => {
    const nextTitle = editableTitle.trim() || 'Untitled folder';
    const nextArtist = editableArtist.trim() || '';
    setEditableTitle(nextTitle);
    setEditableArtist(nextArtist);
    await saveFolderMetadata(id, { title: nextTitle, artist: nextArtist });
  };

  const createProject = async () => {
    const res = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title: 'Untitled project', artist: user.name, folderId: id }),
    });
    const json = await res.json();
    if (res.ok) navigate(`/project/${json.id}`);
  };

  const createSubFolder = async () => {
    const res = await fetch(`${apiUrl}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title: 'Untitled folder', artist: user.name, parentFolderId: id }),
    });
    const json = await res.json();
    if (res.ok) setData((prev) => ({ ...prev, folders: [json, ...prev.folders] }));
  };

  const moveItem = async (itemId, itemType, targetFolderId) => {
    if (itemType === 'project') {
      setData((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== itemId) }));
      await fetch(`${apiUrl}/api/projects/${itemId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, folderId: targetFolderId }),
      });
    } else if (itemType === 'folder') {
      setData((prev) => ({ ...prev, folders: prev.folders.filter((f) => f.id !== itemId) }));
      await fetch(`${apiUrl}/api/folders/${itemId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, parentFolderId: targetFolderId }),
      });
    }
    setDraggingId(null);
  };

  const deleteItem = async (itemId, itemType) => {
    if (itemType === 'project') {
      try {
        const res = await fetch(`${apiUrl}/api/projects/${itemId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete project');
        setData((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== itemId) }));
      } catch (err) { alert(err.message); console.error(err); }
    } else if (itemType === 'folder') {
      try {
        const res = await fetch(`${apiUrl}/api/folders/${itemId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete folder');
        setData((prev) => ({
          ...prev,
          folders: prev.folders.filter((f) => f.id !== itemId),
          projects: prev.projects.map((p) => p.folderId === itemId ? { ...p, folderId: prev.folder?.id || null } : p)
        }));
      } catch (err) { alert(err.message); console.error(err); }
    }
  };


  const handleDeleteClick = (e) => {
    setIsFolderMenuOpen(false);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsConfirmOpen(false);
    try {
      const res = await fetch(`${apiUrl}/api/folders/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete folder');
      navigate('/library');
    } catch (err) {
      alert(err.message);
      console.error(err);
    }
  };

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  if (loading) return null;

  const folder = data?.folder;
  const folders = data?.folders || [];
  const projects = data?.projects || [];
  const tracks = data?.tracks || [];
  const breadcrumbs = data?.breadcrumbs || [];
  const isEmpty = folders.length === 0 && projects.length === 0;

  return (
    <div className="min-h-screen bg-primary-background px-5 py-5 pb-28 sm:px-8 sm:py-6 lg:px-14 lg:py-8">
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-start justify-between gap-3 border-b border-border/60 bg-primary-background/95 pb-4 backdrop-blur-md">
        <Link to="/" aria-label="Starlight Station home">
          <StarlightLogo className="logo-glow h-14 w-48 text-primary-label opacity-90 hover:opacity-100 transition-opacity" />
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          
          <div className="relative">
            <button
              onClick={() => { setIsFolderMenuOpen((o) => !o); setIsAddMenuOpen(false); }}
              className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight"
              aria-label="Folder options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {isFolderMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-14 z-50 w-48 rounded-[1rem] border border-border panel-bg p-2 shadow-2xl origin-top-right"
                >
                  <button onClick={() => {
                    setIsShareModalOpen(true);
                    setIsFolderMenuOpen(false);
                  }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                    <Copy className="h-4 w-4" />
                    Copy share link
                  </button>
                  <button onClick={handleDeleteClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                    Delete folder
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {onLogout && (
            <button onClick={onLogout} className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Breadcrumbs */}
      <nav className="mt-4 flex items-center gap-2 text-sm text-secondary-label" aria-label="Breadcrumb">
        <Link to="/library" className="flex items-center gap-1 hover:text-primary-label transition-colors">
          <Home className="h-4 w-4" />
          Library
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 opacity-50" />
            <Link to={`/folder/${crumb.id}`} className="hover:text-primary-label transition-colors">
              {crumb.title}
            </Link>
          </span>
        ))}
        <ChevronRight className="h-4 w-4 opacity-50" />
        <span className="font-semibold text-primary-label">{folder?.title || folder?.name || 'Folder'}</span>
      </nav>

      <div className="mt-4 mb-8 overflow-hidden">
        <MarqueeInput
          value={editableTitle}
          onChange={(event) => setEditableTitle(event.target.value)}
          onBlur={saveCurrentFolder}
          className="w-full"
          textClassName="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-primary-label"
          placeholder="Folder title"
        />
        <p className="mt-4 flex items-center gap-2 text-base md:text-lg text-secondary-label">
          <FolderOpen className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          <span className="min-w-0 flex-1 overflow-hidden">
            <MarqueeInput
              value={editableArtist}
              onChange={(event) => setEditableArtist(event.target.value)}
              onBlur={saveCurrentFolder}
              className="w-full"
              textClassName="text-secondary-label"
              placeholder="Add artist..."
            />
          </span>
        </p>
      </div>

      {/* Grid */}
      <main className="mx-auto flex min-h-[calc(100vh-22rem)] max-w-4xl items-start justify-center py-4 pb-36">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 pt-16 text-center">
            <Disc3 className="h-12 w-12 text-secondary-label" />
            <h2 className="text-2xl font-semibold">This folder is empty</h2>
            <p className="text-secondary-label">Drag projects here or create new ones inside this folder.</p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 justify-items-center gap-x-6 gap-y-10 lg:gap-x-8 lg:gap-y-12">
            {folders.map((subFolder) => {
              const subProjects = projects.filter((p) => p.folderId === subFolder.id);
              return (
                <LibraryFolder
                  key={subFolder.id}
                  folder={subFolder}
                  projects={subProjects}
                  tracks={tracks}
                  onSave={saveFolderMetadata}
                  onDrop={moveItem}
                  onDragStart={() => setDraggingId(subFolder.id)}
                  isDragging={draggingId === subFolder.id}
                  onDelete={deleteItem}
                />
              );
            })}
            {projects.filter((p) => !p.folderId || p.folderId === id).map((project) => (
              <LibraryProject
                key={project.id}
                project={project}
                tracks={tracks}
                onDragStart={() => setDraggingId(project.id)}
                isDragging={draggingId === project.id}
                onDelete={deleteItem}
              />
            ))}
          </div>
        )}
      </main>

      {/* Desktop Add Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-7 sm:right-8 lg:right-12 z-40 hidden md:flex flex-col items-end">
        <AnimatePresence>
          {isAddMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-56 mb-4 rounded-2xl panel-bg border border-border p-2 shadow-2xl backdrop-blur-xl origin-bottom-right"
            >
              <button onClick={createSubFolder} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-lg font-semibold hover:bg-highlight transition-colors">
                <FolderPlus className="h-5 w-5" />
                New Folder
              </button>
              <button onClick={createProject} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-lg font-semibold hover:bg-highlight transition-colors">
                <Plus className="h-5 w-5" />
                New Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => { setIsAddMenuOpen((o) => !o); setIsFolderMenuOpen(false); }}
          className="grid h-14 w-14 place-items-center rounded-full bg-primary-label text-primary-background shadow-2xl transition-transform hover:scale-105"
          aria-label="Add"
        >
          {isAddMenuOpen ? <X className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
        </button>
      </div>

      {/* Mobile Add Button */}
      <div className="fixed bottom-4 right-4 z-40 md:hidden flex flex-col items-end">
        <AnimatePresence>
          {isAddMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-56 mb-4 rounded-2xl panel-bg border border-border p-2 shadow-2xl backdrop-blur-xl origin-bottom-right"
            >
              <button onClick={createSubFolder} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-lg font-semibold hover:bg-highlight transition-colors">
                <FolderPlus className="h-5 w-5" />
                New Folder
              </button>
              <button onClick={createProject} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-lg font-semibold hover:bg-highlight transition-colors">
                <Plus className="h-5 w-5" />
                New Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => { setIsAddMenuOpen((o) => !o); setIsFolderMenuOpen(false); }}
          className="grid h-14 w-14 place-items-center rounded-full bg-primary-label text-primary-background shadow-2xl transition-transform hover:scale-105"
          aria-label="Add"
        >
          {isAddMenuOpen ? <X className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
        </button>
      </div>

      <ChatInbox user={user} isOpen={isChatOpen} onToggle={() => setIsChatOpen((o) => !o)} />
      
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete folder?"
        message="Are you sure you want to delete this folder? Projects inside it will be moved to the library root."
        confirmText="Delete"
      />

      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        type="folder"
        targetId={id}
        userId={user?.id}
      />
    </div>
  );
}
