import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Circle, Disc3, Edit3, FolderPlus, LogOut, MoreHorizontal, Music, Palette, Play, Plus, Search, Trash2, UploadCloud, Video, X } from 'lucide-react';

function LibraryProject({ project, tracks }) {
  const projectTracks = tracks.filter((track) => track.projectId === project.id);
  const leadTrack = projectTracks[0];
  const title = leadTrack?.title || project.name;
  const artist = leadTrack?.artist || leadTrack?.producer || project.name;

  return (
    <Link to={`/project/${project.id}`} className="group block w-full max-w-[15rem]">
      <div className="relative aspect-square overflow-hidden rounded-[1.1rem] bg-shading sm:rounded-[1.25rem]">
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
          <span className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-shading text-primary-label backdrop-blur-md transition-transform group-hover:scale-105 sm:h-14 sm:w-14">
            <Play className="h-5 w-5 fill-current translate-x-0.5 sm:h-6 sm:w-6" />
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight tracking-normal text-primary-label line-clamp-2 sm:text-lg">{title}</h2>
          <p className="mt-1 truncate text-base text-secondary-label sm:text-lg">{artist}</p>
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
    <div className="fixed left-4 right-4 top-24 z-50 rounded-[1.25rem] border border-border bg-[#191919] p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-16 sm:w-[min(24rem,90vw)] sm:p-4">
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
    <div className="fixed left-4 right-4 top-24 z-50 rounded-[1.25rem] border border-border bg-[#191919] p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-16 sm:w-[min(24rem,90vw)] sm:p-4">
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-shading p-3 sm:mb-4 sm:gap-4 sm:p-4">
        <ProfileAvatar user={user} size="h-12 w-12 sm:h-16 sm:w-16" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold sm:text-xl">{user.name}</h2>
          <p className="truncate text-sm text-secondary-label">{user.email}</p>
        </div>
      </div>

      <button onClick={onEditProfile} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-semibold hover:bg-highlight sm:py-4 sm:text-lg">
        <Edit3 className="h-5 w-5" />
        Edit profile
      </button>

      <div className="my-2 rounded-xl px-4 py-4">
        <div className="mb-4 flex items-center gap-4 text-base font-semibold sm:text-lg">
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

      <button onClick={onLogout} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-semibold hover:bg-highlight sm:py-4 sm:text-lg">
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
      <button onClick={onDeleteAccount} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-semibold text-red-500 hover:bg-red-500/10 sm:py-4 sm:text-lg">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="relative grid w-full max-w-[44rem] gap-6 rounded-[1.25rem] bg-[#1b1b1b] p-5 shadow-2xl sm:gap-8 sm:p-8 md:grid-cols-[0.9fr_1fr]">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:right-6 sm:top-6 sm:h-12 sm:w-12" aria-label="Close edit profile">
          <X className="h-6 w-6" />
        </button>
        <h2 className="col-span-full pr-12 text-center text-2xl font-bold sm:text-3xl">Edit Profile</h2>

        <section className="flex flex-col items-center justify-center">
          <DiscArtwork className="aspect-square w-full max-w-[14rem] rounded-[2rem] sm:max-w-[18rem] md:max-w-[20rem] md:rounded-[2.5rem]" />
        </section>

        <section className="flex flex-col items-center justify-center gap-5 sm:gap-6">
          <div className="w-full max-w-[23rem]">
            <p className="mb-4 text-base text-secondary-label sm:text-lg">Profile picture</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="relative mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-shading sm:h-48 sm:w-48">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ProfileAvatar user={{ name }} size="h-36 w-36 text-5xl sm:h-48 sm:w-48 sm:text-6xl" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/45 hover:opacity-100">
                <UploadCloud className="h-9 w-9" />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
          </div>

          <label className="w-full max-w-[23rem]">
            <span className="mb-3 block text-center text-base text-secondary-label sm:text-lg">Username</span>
            <span className="flex h-14 items-center rounded-[1.1rem] bg-[#292929] px-5 sm:h-16 sm:rounded-[1.4rem] sm:px-7">
              <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg font-bold text-primary-label outline-none sm:text-xl" required />
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
    <div className="min-h-screen bg-primary-background px-4 py-6 pb-28 animate-fade-in sm:px-6 sm:py-8 md:px-10 lg:px-14">
      <header className="flex items-start justify-between gap-3">
        <Link to="/" className="min-w-0 truncate text-2xl font-bold tracking-tighter text-primary-label sm:text-3xl">[untitled]</Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative">
            <button onClick={() => { setIsNotificationsOpen((open) => !open); setIsProfileOpen(false); }} className="relative grid h-11 w-11 place-items-center rounded-2xl bg-primary-label text-primary-background transition-transform hover:scale-105 sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Notifications">
              <Bell className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
              {workspace.notifications.length > 0 && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-500 sm:right-4 sm:top-4" />}
            </button>
            {isNotificationsOpen && <NotificationsMenu notifications={workspace.notifications} />}
          </div>

          <div className="relative">
            <button onClick={() => { setIsProfileOpen((open) => !open); setIsNotificationsOpen(false); }} className="grid h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label={`Open ${user.name} profile`}>
              <ProfileAvatar user={user} size="h-7 w-7 sm:h-8 sm:w-8" />
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

          <button className="hidden h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:grid sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Search library">
            <Search className="h-6 w-6" />
          </button>
          <button onClick={onLogout} className="hidden h-11 w-11 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:grid sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Log out">
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-4xl items-center justify-center py-10 sm:min-h-[calc(100vh-16rem)]">
        {workspace.projects.length === 0 ? (
          <div className="text-center">
            <Disc3 className="mx-auto mb-5 h-12 w-12 text-secondary-label" />
            <h1 className="text-2xl font-semibold">No projects yet</h1>
            <p className="mt-2 text-secondary-label">Create your first library project.</p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 justify-items-center gap-x-4 gap-y-10 sm:gap-x-8 sm:gap-y-12 md:grid-cols-3">
            {workspace.projects.map((project) => (
              <LibraryProject key={project.id} project={project} tracks={workspace.tracks} />
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-6 z-30 flex flex-col items-center gap-3 px-4 sm:bottom-8">
        {isAddMenuOpen && (
          <div className="w-[min(16rem,92vw)] rounded-[1.2rem] bg-[#282828]/95 p-3 shadow-2xl backdrop-blur-xl animate-slide-up">
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
          className="inline-flex h-14 min-w-40 items-center justify-center gap-3 rounded-full bg-shading px-7 text-lg font-semibold text-primary-label shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.02] sm:h-16 sm:min-w-48 sm:text-xl"
        >
          {isAddMenuOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
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