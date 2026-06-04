import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, ChevronLeft, Circle, Disc3, Download, Edit3, FolderPlus, Laptop, LogOut, MoreHorizontal, Music, Palette, Play, Plus, Search, ShoppingBag, Trash2, User, Video, X } from 'lucide-react';

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

function DiscArtwork({ className = '' }) {
  return (
    <div className={`relative overflow-hidden bg-[#eeeeee] text-[#777777] shadow-2xl ${className}`}>
      <span className="absolute left-9 top-9 text-xl font-medium">[u]</span>
      <div className="absolute inset-[10%] rounded-full bg-[#d5d5d5]" />
      <div className="absolute inset-[15%] rounded-full bg-[conic-gradient(from_15deg,#eef9ff,#00f4ff,#7c7d87,#f7fdff,#fff4a8,#526578,#eef9ff)] shadow-inner" />
      <div className="absolute inset-[42%] rounded-full border-[6px] border-black bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_0_0_7px_rgba(0,0,0,0.75)]" />
      <div className="absolute inset-[47%] rounded-full bg-[#bdbdbd] shadow-inner" />
    </div>
  );
}

function ProfileAvatar({ user, size = 'h-10 w-10' }) {
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-sm font-bold text-black shadow-lg`}>
      {user.name?.slice(0, 1).toUpperCase() || 'U'}
    </div>
  );
}

function ProfilePanel({ user, tracksUsed, theme, onThemeChange, onBack, onEditProfile, onLogout, onDeleteAccount }) {
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-primary-background px-6 py-12 animate-fade-in md:px-20">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Back to library">
          <ChevronLeft className="h-8 w-8" />
        </button>

        <div className="relative">
          <button onClick={() => setActionsOpen((open) => !open)} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Account actions">
            <MoreHorizontal className="h-7 w-7" />
          </button>
          {actionsOpen && (
            <div className="absolute right-0 top-20 w-64 rounded-[1.6rem] border border-border bg-[#191919] p-4 shadow-2xl">
              <button onClick={onLogout} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-semibold hover:bg-highlight">
                <LogOut className="h-7 w-7" />
                Sign out
              </button>
              <button onClick={onDeleteAccount} className="flex w-full items-center gap-5 rounded-xl px-4 py-4 text-left text-xl font-semibold text-red-500 hover:bg-red-500/10">
                <Trash2 className="h-7 w-7" />
                Delete Account
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl items-center gap-16 py-14 lg:grid-cols-[minmax(20rem,28rem)_minmax(24rem,34rem)]">
        <section className="flex flex-col items-center gap-9">
          <div className="w-full max-w-[23.5rem] overflow-hidden rounded-[4.25rem] bg-[#eeeeee] p-0 pb-10 text-black shadow-2xl">
            <DiscArtwork className="aspect-square w-full rounded-[4.25rem]" />
            <div className="mt-[-1.75rem] flex items-center justify-center gap-3 px-8">
              <ProfileAvatar user={user} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-medium text-black">{user.name}</h1>
                <p className="mt-2 text-base text-[#8a8a8a]">Joined 06.06.2024</p>
              </div>
            </div>
          </div>
          <button onClick={onEditProfile} className="text-xl font-bold text-primary-label transition-colors hover:text-secondary-label">
            Edit profile
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-[1.4rem] bg-shading px-6 py-7">
            <span className="text-2xl font-bold">Subscription</span>
            <span className="text-2xl text-secondary-label">Free plan</span>
          </div>

          <div className="rounded-[1.4rem] bg-shading px-6 py-7 text-center">
            <p className="text-xl font-bold">{tracksUsed} of 25 tracks used</p>
            <div className="mt-6 h-4 overflow-hidden rounded-full bg-highlight">
              <div className="h-full rounded-full bg-primary-label" style={{ width: `${Math.min((tracksUsed / 25) * 100, 100)}%` }} />
            </div>
            <h2 className="mt-9 text-3xl font-bold">Try [membership]</h2>
            <p className="mt-3 text-lg text-secondary-label">Unlock unlimited tracks and premium features</p>
            <button className="mt-7 h-16 w-full rounded-full bg-primary-label text-xl font-bold text-primary-background transition-transform hover:scale-[1.01]">
              Subscribe now
            </button>
          </div>

          <div className="rounded-[1.4rem] bg-shading">
            <button className="flex w-full items-center justify-between px-6 py-7 text-left text-xl font-bold">
              <span className="flex items-center gap-5"><Download className="h-7 w-7" /> Download apps</span>
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[1.4rem] bg-shading">
            <button className="flex w-full items-center gap-5 border-b border-border px-6 py-7 text-left text-xl font-bold">
              <ShoppingBag className="h-7 w-7" />
              Selling
            </button>
            <button className="flex w-full items-center gap-5 px-6 py-7 text-left text-xl font-bold">
              <Laptop className="h-7 w-7" />
              Purchases
            </button>
          </div>

          <div className="rounded-[1.4rem] bg-shading px-6 py-6">
            <div className="mb-5 flex items-center gap-4 text-xl font-bold">
              <Palette className="h-6 w-6" />
              Theme settings
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['dark', 'light'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onThemeChange(mode)}
                  className={`h-12 rounded-full text-base font-bold capitalize transition-colors ${theme === mode ? 'bg-primary-label text-primary-background' : 'bg-highlight text-primary-label hover:bg-primary-label/20'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function EditProfileModal({ user, onClose, onSave, saving, error }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, email });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="relative grid w-full max-w-[52.5rem] gap-12 rounded-[1.6rem] bg-[#1b1b1b] p-9 shadow-2xl md:grid-cols-[1fr_0.9fr] md:p-14">
        <button type="button" onClick={onClose} className="absolute right-9 top-9 grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close edit profile">
          <X className="h-8 w-8" />
        </button>
        <h2 className="col-span-full text-center text-3xl font-bold">Edit Profile</h2>

        <section className="flex flex-col items-center gap-6">
          <DiscArtwork className="aspect-square w-full max-w-[23.5rem] rounded-[3.1rem]" />
          <button type="button" className="h-16 w-full max-w-[23.5rem] rounded-full bg-white text-xl font-bold text-black transition-transform hover:scale-[1.01]">
            Change disc
          </button>
        </section>

        <section className="flex flex-col items-center justify-center gap-7">
          <div className="w-full max-w-[23.5rem]">
            <p className="mb-5 text-xl text-secondary-label">Profile image</p>
            <div className="relative mx-auto h-72 w-72">
              <ProfileAvatar user={{ name }} size="h-72 w-72 text-7xl" />
              <button type="button" className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-full bg-[#1b1b1b] text-white" aria-label="Remove profile image">
                <X className="h-7 w-7" />
              </button>
            </div>
          </div>

          <label className="w-full max-w-[23.5rem]">
            <span className="mb-4 block text-center text-xl text-secondary-label">Username</span>
            <span className="flex h-16 items-center rounded-[1.4rem] bg-[#292929] px-7">
              <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-bold text-primary-label outline-none" required />
              <Edit3 className="h-5 w-5" />
            </span>
          </label>

          <label className="w-full max-w-[23.5rem]">
            <span className="mb-4 block text-center text-xl text-secondary-label">Email</span>
            <span className="flex h-16 items-center rounded-[1.4rem] bg-[#292929] px-7">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg font-bold text-primary-label outline-none" required />
              <Edit3 className="h-5 w-5" />
            </span>
          </label>

          {error && <p className="max-w-[23.5rem] text-center text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={saving} className="h-14 w-full max-w-[23.5rem] rounded-full bg-primary-label text-lg font-bold text-primary-background disabled:opacity-60">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </section>
      </form>
    </div>
  );
}

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const [workspace, setWorkspace] = useState({ projects: [], tracks: [] });
  const [loading, setLoading] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const res = await fetch(`${apiUrl}/api/workspace?userId=${encodeURIComponent(user.id)}`);
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
  }, [apiUrl, user.id]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const saveProfile = async ({ name, email }) => {
    setProfileSaving(true);
    setProfileError('');
    try {
      const res = await fetch(`${apiUrl}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update profile.');
      onUserUpdate(data.user);
      setIsEditProfileOpen(false);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteAccount = async () => {
    const confirmed = confirm('Delete this account and all of its projects, tracks, folders, and cover art?');
    if (!confirmed) return;

    const res = await fetch(`${apiUrl}/api/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      onLogout();
    } else {
      const data = await res.json();
      alert(data.error || 'Could not delete account.');
    }
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
          <button onClick={() => setIsProfileOpen(true)} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label={`Open ${user.name} profile`}>
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

      {isProfileOpen && (
        <ProfilePanel
          user={user}
          tracksUsed={workspace.tracks.length}
          theme={theme}
          onThemeChange={setTheme}
          onBack={() => setIsProfileOpen(false)}
          onEditProfile={() => setIsEditProfileOpen(true)}
          onLogout={onLogout}
          onDeleteAccount={deleteAccount}
        />
      )}

      {isEditProfileOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setIsEditProfileOpen(false)}
          onSave={saveProfile}
          saving={profileSaving}
          error={profileError}
        />
      )}
    </div>
  );
}
