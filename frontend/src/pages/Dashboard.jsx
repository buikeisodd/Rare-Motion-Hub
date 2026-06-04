import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Circle, Disc3, Edit3, FolderPlus, LogOut, MoreHorizontal, Music, Palette, Play, Plus, Search, Trash2, UploadCloud, Video, X } from 'lucide-react';

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
      <span className="absolute left-8 top-8 text-lg font-medium">[u]</span>
      <div className="absolute inset-[10%] rounded-full bg-[#d5d5d5]" />
      <div className="absolute inset-[15%] rounded-full bg-[conic-gradient(from_15deg,#eef9ff,#00f4ff,#7c7d87,#f7fdff,#fff4a8,#526578,#eef9ff)] shadow-inner" />
      <div className="absolute inset-[42%] rounded-full border-[6px] border-black bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_0_0_7px_rgba(0,0,0,0.75)]" />
      <div className="absolute inset-[47%] rounded-full bg-[#bdbdbd] shadow-inner" />
    </div>
  );
}

function ProfileAvatar({ user, size = 'h-11 w-11', className = '' }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${size} ${className} shrink-0 rounded-full object-cover shadow-lg`} />;
  }

  return (
    <div className={`${size} ${className} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-sm font-bold text-black shadow-lg`}>
      {user.name?.slice(0, 1).toUpperCase() || 'U'}
    </div>
  );
}

function NotificationsMenu({ notifications }) {
  return (
    <div className="absolute right-0 top-20 z-50 w-[min(24rem,90vw)] rounded-[1.5rem] border border-border bg-[#191919] p-4 shadow-2xl">
      <h2 className="px-3 pb-3 text-lg font-bold">Notifications</h2>
      {notifications.length === 0 ? (
        <p className="px-3 py-6 text-sm text-secondary-label">No shared-listening activity yet.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {notifications.map((notification) => (
            <div key={notification.id} className="flex gap-3 rounded-2xl bg-shading p-3">
              <ProfileAvatar user={notification.actor || { name: '?' }} size="h-10 w-10" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary-label">
                  {notification.actor?.name || 'Someone'} listened to {notification.track?.title || notification.project?.name || notification.folder?.name || 'your shared item'}
                </p>
                <p className="mt-1 text-xs text-secondary-label">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfilePanel({ user, theme, onThemeChange, onEditProfile, onLogout, onDeleteAccount }) {
  return (
    <div className="absolute right-0 top-20 z-50 w-[min(24rem,90vw)] rounded-[1.6rem] border border-border bg-[#191919] p-4 shadow-2xl">
      <div className="mb-4 flex items-center gap-4 rounded-2xl bg-shading p-4">
        <ProfileAvatar user={user} size="h-16 w-16" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{user.name}</h2>
          <p className="truncate text-sm text-secondary-label">{user.email}</p>
        </div>
      </div>

      <button onClick={onEditProfile} className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-lg font-semibold hover:bg-highlight">
        <Edit3 className="h-5 w-5" />
        Edit profile
      </button>

      <div className="my-2 rounded-xl px-4 py-4">
        <div className="mb-4 flex items-center gap-4 text-lg font-semibold">
          <Palette className="h-5 w-5" />
          Theme setting
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['dark', 'light'].map((mode) => (
            <button
              key={mode}
              onClick={() => onThemeChange(mode)}
              className={`h-11 rounded-full text-sm font-bold capitalize transition-colors ${theme === mode ? 'bg-primary-label text-primary-background' : 'bg-highlight text-primary-label hover:bg-primary-label/20'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onLogout} className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-lg font-semibold hover:bg-highlight">
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
      <button onClick={onDeleteAccount} className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-lg font-semibold text-red-500 hover:bg-red-500/10">
        <Trash2 className="h-5 w-5" />
        Delete Account
      </button>
    </div>
  );
}

function EditProfileModal({ user, onClose, onSave, saving, error }) {
  const [name, setName] = useState(user.name);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : user.avatarUrl;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, avatarFile });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="relative grid w-full max-w-[52rem] gap-10 rounded-[1.6rem] bg-[#1b1b1b] p-8 shadow-2xl md:grid-cols-[1fr_0.9fr] md:p-14">
        <button type="button" onClick={onClose} className="absolute right-8 top-8 grid h-14 w-14 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close edit profile">
          <X className="h-7 w-7" />
        </button>
        <h2 className="col-span-full text-center text-3xl font-bold">Edit Profile</h2>

        <section className="flex flex-col items-center justify-center">
          <DiscArtwork className="aspect-square w-full max-w-[22rem] rounded-[3rem]" />
        </section>

        <section className="flex flex-col items-center justify-center gap-7">
          <div className="w-full max-w-[23rem]">
            <p className="mb-5 text-xl text-secondary-label">Profile picture</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="relative mx-auto grid h-64 w-64 place-items-center overflow-hidden rounded-full bg-shading">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ProfileAvatar user={{ name }} size="h-64 w-64 text-7xl" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/45 hover:opacity-100">
                <UploadCloud className="h-9 w-9" />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
          </div>

          <label className="w-full max-w-[23rem]">
            <span className="mb-4 block text-center text-xl text-secondary-label">Username</span>
            <span className="flex h-16 items-center rounded-[1.4rem] bg-[#292929] px-7">
              <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-bold text-primary-label outline-none" required />
              <Edit3 className="h-5 w-5" />
            </span>
          </label>

          {error && <p className="max-w-[23rem] text-center text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={saving} className="h-14 w-full max-w-[23rem] rounded-full bg-primary-label text-lg font-bold text-primary-background disabled:opacity-60">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </section>
      </form>
    </div>
  );
}

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const [workspace, setWorkspace] = useState({ projects: [], tracks: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
            notifications: data.notifications || [],
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
    if (newProject?.id) navigate(`/project/${newProject.id}`);
  };

  const showComingSoon = (label) => {
    alert(`${label} is coming soon.`);
    setIsAddMenuOpen(false);
  };

  const saveProfile = async ({ name, avatarFile }) => {
    setProfileSaving(true);
    setProfileError('');
    try {
      const profileRes = await fetch(`${apiUrl}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData.error || 'Could not update profile.');

      let nextUser = profileData.user;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarRes = await fetch(`${apiUrl}/api/users/${user.id}/avatar`, {
          method: 'POST',
          body: formData
        });
        const avatarData = await avatarRes.json();
        if (!avatarRes.ok) throw new Error(avatarData.error || 'Could not update profile picture.');
        nextUser = avatarData.user;
      }

      onUserUpdate(nextUser);
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
          <div className="relative">
            <button onClick={() => { setIsNotificationsOpen((open) => !open); setIsProfileOpen(false); }} className="relative grid h-16 w-16 place-items-center rounded-3xl bg-primary-label text-primary-background transition-transform hover:scale-105" aria-label="Notifications">
              <Bell className="h-7 w-7 fill-current" />
              {workspace.notifications.length > 0 && <span className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-blue-500" />}
            </button>
            {isNotificationsOpen && <NotificationsMenu notifications={workspace.notifications} />}
          </div>

          <div className="relative">
            <button onClick={() => { setIsProfileOpen((open) => !open); setIsNotificationsOpen(false); }} className="grid h-16 w-16 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label={`Open ${user.name} profile`}>
              <ProfileAvatar user={user} size="h-8 w-8" />
            </button>
            {isProfileOpen && (
              <ProfilePanel
                user={user}
                theme={theme}
                onThemeChange={setTheme}
                onEditProfile={() => setIsEditProfileOpen(true)}
                onLogout={onLogout}
                onDeleteAccount={deleteAccount}
              />
            )}
          </div>

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
