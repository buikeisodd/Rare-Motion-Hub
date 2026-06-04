import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Bell, Circle, Disc3, Folder, FolderPlus, LogOut, MoreHorizontal, Music, Play, Plus, Search, User, Video, X } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function gradientFor(id = '') {
  const palettes = [
    ['#b7ff63', '#d6c18e', '#d84f93'],
    ['#72e4ff', '#7467f0', '#ff7bbd'],
    ['#ffe27a', '#ff8f70', '#845ef7'],
    ['#8dffce', '#72a7ff', '#f584e3'],
  ];
  const sum = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = palettes[sum % palettes.length];
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 48%, ${colors[2]} 100%)`;
}

function ProjectArtwork({ project, tracks }) {
  const projectTracks = tracks.filter((track) => track.projectId === project.id);
  const leadTrack = projectTracks[0];

  return (
    <div className="relative aspect-square overflow-hidden rounded-[1.35rem]" style={{ backgroundImage: gradientFor(project.id) }}>
      {project.coverArt ? (
        <img src={project.coverArt} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : projectTracks.length > 1 ? (
        <div className="grid h-full w-full grid-cols-2 gap-3 bg-[#242424]/35 p-3">
          {projectTracks.slice(0, 4).map((track) => (
            <div key={track.id} className="rounded-xl bg-black/30" />
          ))}
        </div>
      ) : null}

      {leadTrack && (
        <span className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-shading text-primary-label backdrop-blur-md transition-transform group-hover:scale-105">
          <Play className="h-7 w-7 fill-current translate-x-0.5" />
        </span>
      )}
    </div>
  );
}

function LibraryProject({ project, tracks }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `project-${project.id}`,
    data: { type: 'project', project },
  });
  const projectTracks = tracks.filter((track) => track.projectId === project.id);
  const leadTrack = projectTracks[0];
  const title = leadTrack?.title || project.name;
  const artist = leadTrack?.artist || leadTrack?.producer || project.name;
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={`group block w-56 ${isDragging ? 'opacity-60' : ''}`}>
      <Link to={`/project/${project.id}`} {...listeners} {...attributes} className="block cursor-grab active:cursor-grabbing">
        <ProjectArtwork project={project} tracks={tracks} />
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-normal text-primary-label line-clamp-2">{title}</h2>
            <p className="mt-2 truncate text-xl text-secondary-label">{artist}</p>
          </div>
          <span className="mt-8 shrink-0 text-primary-label opacity-90 transition-opacity group-hover:opacity-100" aria-hidden="true">
            <MoreHorizontal className="h-6 w-6" />
          </span>
        </div>
      </Link>
    </div>
  );
}

function LibraryFolder({ folder, projects }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder },
  });

  return (
    <div ref={setNodeRef} className="group block w-56">
      <div className={`aspect-square rounded-[1.35rem] border transition-all ${isOver ? 'border-primary-label bg-highlight' : 'border-border bg-shading'}`}>
        <div className="grid h-full place-items-center p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[1.4rem] bg-primary-background/35 text-primary-label">
            <Folder className="h-12 w-12 fill-current" />
          </div>
        </div>
      </div>
      <div className="mt-5">
        <h2 className="truncate text-xl font-semibold leading-tight tracking-normal text-primary-label">{folder.name}</h2>
        <p className="mt-2 truncate text-xl text-secondary-label">{projects.length} project{projects.length === 1 ? '' : 's'}</p>
      </div>
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [workspace, setWorkspace] = useState({ folders: [], projects: [], tracks: [] });
  const [loading, setLoading] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const res = await fetch(`${apiUrl}/api/workspace`);
        const data = await res.json();
        if (!cancelled) {
          setWorkspace({
            folders: data.folders || [],
            projects: data.projects || [],
            tracks: data.tracks || [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch workspace', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const createFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;

    const res = await fetch(`${apiUrl}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id }),
    });
    const folder = await res.json();
    setWorkspace((prev) => ({ ...prev, folders: [...prev.folders, folder] }));
    setIsAddMenuOpen(false);
  };

  const createProject = async (defaultName = '') => {
    const name = prompt('Enter project name:', defaultName);
    if (!name) return null;

    const res = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id }),
    });
    const newProject = await res.json();
    setWorkspace((prev) => ({ ...prev, projects: [...prev.projects, newProject] }));
    setIsAddMenuOpen(false);
    return newProject;
  };

  const createAudioProject = async () => {
    const newProject = await createProject('Untitled audio');
    if (newProject?.id) navigate(`/project/${newProject.id}`);
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.data.current?.type !== 'project') return;
    const project = active.data.current.project;
    const folderId = over.data.current?.type === 'folder' ? over.data.current.folder.id : null;

    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => (item.id === project.id ? { ...item, folderId } : item)),
    }));

    try {
      await fetch(`${apiUrl}/api/projects/${project.id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
    } catch (err) {
      console.error('Failed to move project', err);
    }
  };

  const showComingSoon = (label) => {
    alert(`${label} is coming soon.`);
    setIsAddMenuOpen(false);
  };

  if (loading) return null;

  const rootProjects = workspace.projects.filter((project) => !project.folderId);

  return (
    <div className="min-h-screen bg-primary-background px-6 py-12 md:px-20 pb-36 animate-fade-in">
      <header className="flex items-start justify-between gap-6">
        <Link to="/" className="text-3xl font-bold tracking-tighter text-primary-label">[untitled]</Link>

        <div className="flex items-center gap-3">
          <button className="relative grid h-16 w-16 place-items-center rounded-3xl bg-primary-label text-primary-background transition-transform hover:scale-105" aria-label="Notifications">
            <Bell className="h-7 w-7 fill-current" />
            <span className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-blue-500" />
          </button>
          <button onClick={onLogout} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label={`Signed in as ${user.name}. Log out`}>
            <User className="h-7 w-7 fill-current" />
          </button>
          <button className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Search library">
            <Search className="h-7 w-7" />
          </button>
          <button onClick={onLogout} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Log out">
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </header>

      <DndContext onDragEnd={handleDragEnd}>
        <main className="mx-auto flex min-h-[calc(100vh-18rem)] max-w-5xl items-center justify-center">
          {workspace.projects.length === 0 && workspace.folders.length === 0 ? (
            <div className="text-center">
              <Disc3 className="mx-auto mb-5 h-12 w-12 text-secondary-label" />
              <h1 className="text-2xl font-semibold">No projects yet</h1>
              <p className="mt-2 text-secondary-label">Create your first library project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-20 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.folders.map((folder) => (
                <LibraryFolder key={folder.id} folder={folder} projects={workspace.projects.filter((project) => project.folderId === folder.id)} />
              ))}
              {rootProjects.map((project) => (
                <LibraryProject key={project.id} project={project} tracks={workspace.tracks} />
              ))}
            </div>
          )}
        </main>
      </DndContext>

      <div className="fixed inset-x-0 bottom-12 z-30 flex flex-col items-center gap-4 px-6">
        {isAddMenuOpen && (
          <div className="w-64 rounded-[1.4rem] bg-[#282828]/95 p-4 shadow-2xl backdrop-blur-xl animate-slide-up">
            <button onClick={createAudioProject} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <Music className="h-6 w-6" />
              Audio
            </button>
            <button onClick={() => showComingSoon('Convert')} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <Video className="h-6 w-6" />
              Convert
            </button>
            <button onClick={() => showComingSoon('Record')} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <Circle className="h-6 w-6 fill-red-500 text-red-500" />
              Record
            </button>
            <button onClick={createFolder} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <FolderPlus className="h-6 w-6" />
              New Folder
            </button>
            <button onClick={() => createProject()} className="flex w-full items-center gap-5 rounded-xl px-4 py-3 text-left text-xl font-semibold hover:bg-highlight transition-colors">
              <Plus className="h-6 w-6" />
              New Project
            </button>
          </div>
        )}

        <button onClick={() => setIsAddMenuOpen((open) => !open)} className="inline-flex h-20 min-w-56 items-center justify-center gap-4 rounded-full bg-shading px-10 text-2xl font-semibold text-primary-label shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.02]">
          {isAddMenuOpen ? <X className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
          {isAddMenuOpen ? 'Close' : 'Add'}
        </button>
      </div>
    </div>
  );
}
