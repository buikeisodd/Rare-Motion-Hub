import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Circle, Disc3, FolderPlus, LogOut, MoreHorizontal, Music, Play, Plus, Search, User, Video, X } from 'lucide-react';

function LibraryProject({ project, tracks }) {
  const projectTracks = tracks.filter((track) => track.projectId === project.id);
  const leadTrack = projectTracks[0];
  const title = leadTrack?.title || project.name;
  const artist = leadTrack?.artist || leadTrack?.producer || project.name;

  return (
    <Link to={`/project/${project.id}`} className="group block w-56">
      <div className="relative aspect-square overflow-hidden rounded-[1.35rem] bg-shading">
        {project.coverArt ? (
          <img src={project.coverArt} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full grid-cols-2 gap-3 bg-[#242424] p-3">
            {projectTracks.slice(0, 4).map((track) => (
              <div key={track.id} className="rounded-xl bg-[radial-gradient(circle_at_50%_70%,#191919_0_24%,#3c3c3c_25%_100%)]" />
            ))}
            {projectTracks.length === 0 && (
              <div className="col-span-2 flex h-full items-center justify-center rounded-xl bg-[#303030] text-secondary-label">
                <Disc3 className="h-10 w-10" />
              </div>
            )}
          </div>
        )}

        {leadTrack && (
          <span className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-shading text-primary-label backdrop-blur-md transition-transform group-hover:scale-105">
            <Play className="h-7 w-7 fill-current translate-x-0.5" />
          </span>
        )}
      </div>

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
  );
}

export default function Dashboard({ user, onLogout }) {
  const [workspace, setWorkspace] = useState({ projects: [], tracks: [] });
  const [loading, setLoading] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const res = await fetch(`${apiUrl}/api/workspace`);
        const data = await res.json();
        if (!cancelled) {
          setWorkspace({
            projects: data.projects || [],
            tracks: data.tracks || [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch workspace', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const createFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;

    await fetch(`${apiUrl}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id })
    });
    setIsAddMenuOpen(false);
  };

  const createProject = async (defaultName = '') => {
    const name = prompt('Enter project name:', defaultName);
    if (!name) return null;

    const res = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id })
    });
    const newProject = await res.json();
    setWorkspace((prev) => ({ ...prev, projects: [...prev.projects, newProject] }));
    setIsAddMenuOpen(false);
    return newProject;
  };

  const createAudioProject = async () => {
    const newProject = await createProject('Untitled audio');
    if (newProject?.id) {
      navigate(`/project/${newProject.id}`);
    }
  };

  const showComingSoon = (label) => {
    alert(`${label} is coming soon.`);
    setIsAddMenuOpen(false);
  };

  if (loading) return null;

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

      <main className="mx-auto flex min-h-[calc(100vh-18rem)] max-w-5xl items-center justify-center">
        {workspace.projects.length === 0 ? (
          <div className="text-center">
            <Disc3 className="mx-auto mb-5 h-12 w-12 text-secondary-label" />
            <h1 className="text-2xl font-semibold">No projects yet</h1>
            <p className="mt-2 text-secondary-label">Create your first library project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-20 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.projects.map((project) => (
              <LibraryProject key={project.id} project={project} tracks={workspace.tracks} />
            ))}
          </div>
        )}
      </main>

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

        <button
          onClick={() => setIsAddMenuOpen((open) => !open)}
          className="inline-flex h-20 min-w-56 items-center justify-center gap-4 rounded-full bg-shading px-10 text-2xl font-semibold text-primary-label shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.02]"
        >
          {isAddMenuOpen ? <X className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
          {isAddMenuOpen ? 'Close' : 'Add'}
        </button>
      </div>
    </div>
  );
}
