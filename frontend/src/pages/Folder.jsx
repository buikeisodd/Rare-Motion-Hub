import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, Circle, Disc3, FolderPlus, Home, LogOut, MessageSquare, MoreHorizontal, Plus, Trash2, Video, X } from 'lucide-react';
import { LibraryProject, LibraryFolder } from './Dashboard';
import ChatInbox from '../components/ChatInbox';
import StarlightLogo from '../components/StarlightLogo';

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
        await fetch(`${apiUrl}/api/projects/${itemId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        setData((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== itemId) }));
      } catch (err) { console.error(err); }
    } else if (itemType === 'folder') {
      try {
        await fetch(`${apiUrl}/api/folders/${itemId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        setData((prev) => ({
          ...prev,
          folders: prev.folders.filter((f) => f.id !== itemId),
          projects: prev.projects.map((p) => p.folderId === itemId ? { ...p, folderId: prev.folder?.id || null } : p)
        }));
      } catch (err) { console.error(err); }
    }
  };

  const handleDeleteCurrentFolder = async () => {
    if (!confirm('Are you sure you want to delete this folder? Projects inside it will be moved to the library root.')) return;
    try {
      await fetch(`${apiUrl}/api/folders/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      navigate('/library');
    } catch (err) {
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
    <div className="min-h-screen bg-primary-background px-10 py-8 pb-28 animate-fade-in lg:px-14">
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
      )}

      {/* Header */}
      <header className="relative z-50 flex items-start justify-between gap-3">
        <Link to="/" aria-label="Starlight Station home">
          <StarlightLogo className="h-14 w-48 text-primary-label opacity-90 hover:opacity-100 transition-opacity" />
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={() => setIsChatOpen((o) => !o)}
            className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight"
            aria-label="Open messages"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setIsFolderMenuOpen((o) => !o)}
              className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight"
              aria-label="Folder options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {isFolderMenuOpen && (
              <div className="absolute right-0 top-14 z-50 w-48 rounded-[1rem] border border-border panel-bg p-2 shadow-2xl">
                <button onClick={handleDeleteCurrentFolder} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-4 w-4" />
                  Delete folder
                </button>
              </div>
            )}
          </div>

          {onLogout && (
            <button onClick={onLogout} className="grid h-12 w-12 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Breadcrumbs */}
      <nav className="mt-6 flex items-center gap-2 text-sm text-secondary-label" aria-label="Breadcrumb">
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

      {/* Folder title - editable */}
      <div className="mt-8 mb-10">
        <input
          value={editableTitle}
          onChange={(e) => setEditableTitle(e.target.value)}
          onBlur={saveCurrentFolder}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="w-full bg-transparent text-4xl font-bold tracking-tight text-primary-label outline-none"
          aria-label="Folder title"
        />
        <input
          value={editableArtist}
          onChange={(e) => setEditableArtist(e.target.value)}
          onBlur={saveCurrentFolder}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="mt-1 w-full bg-transparent text-lg text-secondary-label outline-none"
          placeholder="Add artist..."
          aria-label="Folder artist"
        />
      </div>

      {/* Grid */}
      <main className="mx-auto flex min-h-[calc(100vh-22rem)] max-w-4xl items-start justify-center py-4">
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

      {/* Add button */}
      <div className="fixed inset-x-0 bottom-8 z-50 flex flex-col items-center gap-3 px-4">
        {isAddMenuOpen && (
          <div className="w-64 rounded-[1.2rem] panel-bg border border-border p-3 shadow-2xl backdrop-blur-xl animate-slide-up">
            <button onClick={createSubFolder} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <FolderPlus className="h-6 w-6" />
              New Folder
            </button>
            <button onClick={createProject} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <Plus className="h-6 w-6" />
              New Project
            </button>
          </div>
        )}
        <button
          onClick={() => setIsAddMenuOpen((o) => !o)}
          className="inline-flex h-16 min-w-48 items-center justify-center gap-3 rounded-full bg-shading px-7 text-xl font-semibold text-primary-label shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.02]"
        >
          {isAddMenuOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          {isAddMenuOpen ? 'Close' : 'Add'}
        </button>
      </div>

      <ChatInbox user={user} isOpen={isChatOpen} onToggle={() => setIsChatOpen((o) => !o)} />
    </div>
  );
}
