import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight, Circle, Disc3, Edit3, Folder, FolderOpen, FolderPlus, LogOut, MessageSquare, MoreHorizontal, Music, Palette, Play, Pause, Plus, Trash2, UploadCloud, Video, X, User } from 'lucide-react';
import ChatInbox from '../components/ChatInbox';
import StarlightLogo from '../components/StarlightLogo';
import ConfirmModal from '../components/ConfirmModal';
import MarqueeInput from '../components/MarqueeInput';
import { useAudio } from '../context/AudioContext';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const palettes = [
  ['#ff9a9e', '#fecfef', '#fbc2eb'],
  ['#a18cd1', '#fbc2eb', '#e0c3fc'],
  ['#84fab0', '#8fd3f4', '#a1c4fd'],
  ['#ffecd2', '#fcb69f', '#ff9a9e'],
  ['#cfd9df', '#e2ebf0', '#8fd3f4'],
  ['#fbc2eb', '#a6c1ee', '#fccb90'],
  ['#fdcbf1', '#fdcbf1', '#e6dee9'],
  ['#a1c4fd', '#c2e9fb', '#e0c3fc'],
];

function gradientFor(id) {
  const sum = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = palettes[sum % palettes.length];
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 48%, ${colors[2]} 100%)`;
}

export function LibraryProject({ project, tracks, onDragStart, isDragging, onDelete }) {
  const { addTracksToQueue, playTrack, currentTrack, isPlaying, setIsPlaying } = useAudio();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const projectTracks = (tracks || []).filter((track) => track.projectId === project.id);
  const leadTrack = projectTracks[0];
  const title = project.title || project.name || 'Untitled project';
  const artist = project.artist || leadTrack?.artist || leadTrack?.producer || 'Unknown artist';
  const isThisProjectPlaying = projectTracks.some(t => t.id === currentTrack?.id);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    setIsConfirmOpen(false);
    onDelete?.(project.id, 'project');
  };

  const handleQueue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!projectTracks.length) {
      alert('This project has no tracks to queue.');
      return;
    }
    addTracksToQueue(projectTracks, { projectName: title });
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', project.id);
        e.dataTransfer.setData('itemType', 'project');
        onDragStart?.();
      }}
      className={`relative w-full max-w-[15rem] transition-all duration-200 ${isDragging ? 'opacity-40 scale-95 rotate-1' : ''} ${isMenuOpen || isConfirmOpen ? 'z-50' : 'z-0'}`}
    >
      <Link to={`/project/${project.id}`} className="group block w-full" draggable={false}>
        <div 
          className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-shading"
          style={!project.coverArt ? { backgroundImage: gradientFor(project.id) } : undefined}
        >
          {project.coverArt ? (
            <img src={project.coverArt} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : projectTracks.length > 1 ? (
            <div className="grid h-full w-full grid-cols-2 gap-3 bg-black/20 p-3">
              {projectTracks.slice(0, 4).map((track) => (
                <div key={track.id} className="rounded-xl bg-black/30 backdrop-blur-sm" />
              ))}
            </div>
          ) : projectTracks.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-black/20 text-white/50">
              <Disc3 className="h-10 w-10" />
            </div>
          ) : null}
          {leadTrack && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isThisProjectPlaying) {
                  setIsPlaying(!isPlaying);
                } else {
                  playTrack(leadTrack, projectTracks, title, project.coverArt);
                }
              }}
              className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-110 group-hover:scale-105"
            >
              {isThisProjectPlaying && isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current translate-x-0.5" />
              )}
            </button>
          )}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3 overflow-hidden">
          <div className="min-w-0 flex-1">
            <MarqueeInput
              readOnly
              value={title}
              className="w-full"
              textClassName="text-lg font-semibold leading-tight tracking-normal text-primary-label"
              placeholder="Untitled project"
            />
            <MarqueeInput
              readOnly
              value={artist}
              className="mt-1 w-full"
              textClassName="text-lg text-secondary-label"
              placeholder="Unknown artist"
            />
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen((o) => !o); }}
            className="mt-8 shrink-0 text-primary-label opacity-90 transition-opacity hover:opacity-100 group-hover:opacity-100"
            aria-label="Project options"
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>
        </div>
      </Link>
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); }} />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-[1rem] border border-border panel-bg p-2 shadow-2xl">
            <button onClick={handleQueue} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
              <Plus className="h-4 w-4" />
              Add to queue
            </button>
            <button onClick={handleDeleteClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-4 w-4" />
              Delete project
            </button>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete project?"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
      />
    </div>
  );
}

export function LibraryFolder({ folder, projects, tracks, onSave, onDrop, onDragStart, isDragging, onDelete }) {
  const { addTracksToQueue } = useAudio();
  const [title, setTitle] = useState(folder.title || folder.name || 'Untitled folder');
  const [artist, setArtist] = useState(folder.artist || 'Unknown artist');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Up to 4 preview items — projects with cover art first, then placeholders
  const previewProjects = (projects || []).slice(0, 4);

  const save = (next = {}) => {
    const nextTitle = (next.title ?? title).trim() || 'Untitled folder';
    const nextArtist = (next.artist ?? artist).trim() || 'Unknown artist';
    setTitle(nextTitle);
    setArtist(nextArtist);
    onSave?.(folder.id, { title: nextTitle, artist: nextArtist });
  };

  const stop = (e) => e.stopPropagation();

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const itemId = e.dataTransfer.getData('itemId');
    const itemType = e.dataTransfer.getData('itemType');
    if (itemId && itemId !== folder.id) onDrop?.(itemId, itemType, folder.id);
  };

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    setIsConfirmOpen(false);
    onDelete?.(folder.id, 'folder');
  };

  const folderTracks = (projects || []).flatMap((project) =>
    (tracks || []).filter((track) => track.projectId === project.id)
  );

  const handleQueue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!folderTracks.length) {
      alert('This folder has no tracks to queue.');
      return;
    }
    addTracksToQueue(folderTracks, { projectName: title });
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', folder.id);
        e.dataTransfer.setData('itemType', 'folder');
        onDragStart?.();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group w-full max-w-[15rem] transition-all duration-200 ${
        isDragging ? 'opacity-40 scale-95 rotate-1' : ''
      } ${isDragOver ? 'scale-[1.03]' : ''} ${isMenuOpen || isConfirmOpen ? 'z-50' : 'z-0'}`}
    >
      <Link to={`/folder/${folder.id}`} draggable={false}>
        <div 
          className={`relative aspect-square overflow-hidden rounded-[1.25rem] transition-all duration-200 ${
            isDragOver
              ? 'ring-2 ring-green-400 shadow-[0_0_24px_4px_rgba(74,222,128,0.25)] bg-green-400/10'
              : 'bg-shading'
          }`}
          style={previewProjects.length === 0 ? { backgroundImage: gradientFor(folder.id) } : undefined}
        >
          {previewProjects.length > 0 ? (
            <div className="grid h-full w-full grid-cols-2 gap-2 p-3">
              {previewProjects.map((p) =>
                p.coverArt ? (
                  <img
                    key={p.id}
                    src={p.coverArt}
                    alt={p.title || p.name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <div
                    key={p.id}
                    className="flex h-full w-full items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm text-white/50"
                    style={{ backgroundImage: gradientFor(p.id) }}
                  >
                    <Disc3 className="h-6 w-6 mix-blend-overlay" />
                  </div>
                )
              )}
              {previewProjects.length < 4 &&
                Array.from({ length: 4 - previewProjects.length }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-[#242424]" />
                ))}
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center bg-black/10">
              {isDragOver
                ? <FolderOpen className="h-20 w-20 text-white transition-transform duration-500 group-hover:scale-105" />
                : <Folder className="h-20 w-20 text-white/60 transition-transform duration-500 group-hover:scale-105" />}
            </div>
          )}
        </div>
      </Link>
      <div className="mt-4 flex items-start justify-between gap-3 overflow-hidden">
        <div className="min-w-0 flex-1">
          <MarqueeInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => save()}
            className="w-full"
            textClassName="text-lg font-semibold leading-tight tracking-normal text-primary-label"
            placeholder="Folder title"
          />
          <MarqueeInput
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onBlur={() => save()}
            className="mt-1 w-full"
            textClassName="text-lg text-secondary-label"
            placeholder="Add artist..."
          />
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen((o) => !o); }}
          className="mt-8 shrink-0 text-primary-label opacity-90 transition-opacity hover:opacity-100 group-hover:opacity-100"
          aria-label="Folder options"
        >
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </div>
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); }} />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-[1rem] border border-border panel-bg p-2 shadow-2xl">
            <button onClick={handleQueue} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
              <Plus className="h-4 w-4" />
              Add to queue
            </button>
            <button onClick={handleDeleteClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-4 w-4" />
              Delete folder
            </button>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete folder?"
        message="Are you sure you want to delete this folder? Projects inside it will be moved to the library root."
        confirmText="Delete"
      />
    </div>
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
  const [failedSrc, setFailedSrc] = useState('');

  if (user.avatarUrl && failedSrc !== user.avatarUrl) {
    const separator = user.avatarUrl.includes('?') ? '&' : '?';
    const src = `${user.avatarUrl}${separator}v=${encodeURIComponent(user.updatedAt || user.avatarUpdatedAt || '')}`;
    return <img src={src} alt="" onError={() => setFailedSrc(user.avatarUrl)} className={`${size} ${className} shrink-0 rounded-full object-cover shadow-lg`} />;
  }

  return (
    <div className={`${size} ${className} relative overflow-hidden shrink-0 rounded-full shadow-lg bg-shading flex items-center justify-center`}>
      <User className="h-1/2 w-1/2 text-secondary-label" />
    </div>
  );
}

function NotificationsMenu({ isOpen, notifications, conversations }) {
  const allNotifications = [...notifications];

  if (conversations) {
    conversations.forEach((convo) => {
      if (convo.unreadCount > 0 && convo.lastMessage) {
        allNotifications.push({
          id: `chat-${convo.id}`,
          type: 'chat',
          actor: convo.type === 'group' ? null : convo.partner,
          message: convo.type === 'group' ? 'New message in Group Chat' : `${convo.partner?.name || 'Someone'} sent a message`,
          preview: convo.lastMessage.text || 'Media message',
          createdAt: convo.updatedAt,
          read: false,
        });
      }
    });
  }

  allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute left-auto right-0 top-full mt-2 z-50 w-72 rounded-[1.25rem] border border-border panel-bg p-3 shadow-2xl origin-top-right"
        >
          <h2 className="px-2 pb-2 text-sm font-bold text-primary-label">Notifications</h2>
          {allNotifications.length === 0 ? (
            <p className="px-3 py-6 text-sm text-secondary-label">No notifications yet.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto hide-scrollbar">
              {allNotifications.map((notification) => {
                const text = notification.type === 'chat' || notification.type === 'message' || notification.type === 'call'
                  ? notification.message
                  : `${notification.actor?.name || 'Someone'} listened to ${notification.track?.title || notification.project?.name || notification.folder?.name || 'your shared item'}`;
                return (
                  <div key={notification.id} className={`flex gap-3 rounded-2xl p-3 ${notification.read ? 'bg-shading' : 'bg-primary-label/10'}`}>
                    <ProfileAvatar user={notification.actor || { name: '?' }} size="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary-label">{text}</p>
                      {notification.preview && <p className="mt-1 truncate text-xs text-secondary-label">{notification.preview}</p>}
                      <p className="mt-1 text-xs text-secondary-label">{new Date(notification.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfilePanel({ isOpen, user, theme, onThemeChange, onEditProfile, onLogout, onDeleteAccount }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute left-auto right-0 top-full mt-2 z-50 w-64 rounded-[1.25rem] border border-border panel-bg p-2.5 shadow-2xl origin-top-right"
        >
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-shading p-2">
            <ProfileAvatar user={user} size="h-12 w-12" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-primary-label">{user.name}</h2>
              <p className="truncate text-xs text-secondary-label">{user.email}</p>
            </div>
          </div>

          <button onClick={onEditProfile} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
            <Edit3 className="h-5 w-5" />
            Edit profile
          </button>

          <div className="my-1 rounded-xl px-3 py-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-label">
              <Palette className="h-5 w-5" />
              Theme setting
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['dark', 'light'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onThemeChange(mode)}
                  className={`h-11 rounded-full text-sm font-bold capitalize transition-colors ${theme === mode ? 'bg-primary-label text-primary-background' : 'bg-highlight text-primary-label hover:opacity-80'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
          <button onClick={onDeleteAccount} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditProfileModal({ isOpen, user, onClose, onSave, saving, error }) {
  const [name, setName] = useState(user.name);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : user.avatarUrl;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, avatarFile });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm"
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="relative flex flex-col items-center w-full max-w-xs gap-4 rounded-[1.25rem] panel-bg border border-border p-5 shadow-2xl"
          >
            <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close edit profile">
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-primary-label">Edit Profile</h2>

            {/* Starlight Station logo replaces disc */}
            <StarlightLogo className="logo-glow h-16 w-52 text-primary-label opacity-80" />

            {/* Avatar with label directly below it */}
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-shading">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ProfileAvatar user={{ name }} size="h-24 w-24 text-3xl" />
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/40 hover:opacity-100">
                  <UploadCloud className="h-7 w-7" />
                </span>
              </button>
              <p className="text-xs text-secondary-label">Profile picture</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
            </div>

            {/* Username field */}
            <label className="w-full">
              <span className="mb-2 block text-center text-xs text-secondary-label">Username</span>
              <span className="flex h-11 items-center rounded-xl panel-input-bg px-4">
                <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary-label outline-none" required />
                <Edit3 className="h-4 w-4 text-secondary-label" />
              </span>
            </label>

            {error && <p className="text-center text-xs text-red-400">{error}</p>}

            <button type="submit" disabled={saving} className="h-11 w-full rounded-full bg-primary-label text-sm font-bold text-primary-background disabled:opacity-60">
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const [workspace, setWorkspace] = useState({ folders: [], projects: [], tracks: [], notifications: [] });
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const { currentTrack } = useAudio();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [conversionProgress, setConversionProgress] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const convertInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${apiUrl}/api/workspace?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setWorkspace({
          folders: data.folders || [],
          projects: data.projects || [],
          tracks: data.tracks || [],
          coverArts: data.coverArts || [],
          notifications: data.notifications || [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user.id]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const saveFolderMetadata = async (folderId, updates) => {
    const res = await fetch(`${apiUrl}/api/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const savedFolder = await res.json();
      if (!res.ok) throw new Error(savedFolder.error || 'Could not update folder.');
      setWorkspace((prev) => ({ ...prev, folders: prev.folders.map((f) => (f.id === folderId ? savedFolder.folder || savedFolder : f)) }));
    }
  };



  const createProject = async () => {
    setIsAddMenuOpen(false);
    const res = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title: 'Untitled project', artist: user.name }),
    });
    const data = await res.json();
    if (res.ok) navigate(`/project/${data.id}`);
  };

  const createFolder = async () => {
    setIsAddMenuOpen(false);
    const res = await fetch(`${apiUrl}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title: 'Untitled folder', artist: user.name }),
    });
    const data = await res.json();
    if (res.ok) setWorkspace((prev) => ({ ...prev, folders: [data, ...prev.folders] }));
  };

  const moveItem = async (itemId, itemType, targetFolderId) => {
    // Optimistically remove item from root grid
    if (itemType === 'project') {
      setWorkspace((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== itemId)
      }));
      await fetch(`${apiUrl}/api/projects/${itemId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, folderId: targetFolderId }),
      });
    } else if (itemType === 'folder') {
      setWorkspace((prev) => ({
        ...prev,
        folders: prev.folders.filter((f) => f.id !== itemId)
      }));
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
        setWorkspace((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== itemId) }));
      } catch (err) { alert(err.message); console.error(err); }
    } else if (itemType === 'folder') {
      try {
        const res = await fetch(`${apiUrl}/api/folders/${itemId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete folder');
        setWorkspace((prev) => ({
          ...prev,
          folders: prev.folders.filter((f) => f.id !== itemId),
          projects: prev.projects.map((p) => p.folderId === itemId ? { ...p, folderId: null } : p)
        }));
      } catch (err) { alert(err.message); console.error(err); }
    }
  };

  const handleConvert = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsAddMenuOpen(false);
    setConversionProgress(0);
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('userId', user.id);
    
    try {
      const res = await fetch(`${apiUrl}/api/convert`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const eventSource = new EventSource(`${apiUrl}/api/convert/status/${data.jobId}`);
      eventSource.onmessage = (e) => {
        const parsed = JSON.parse(e.data);
        if (parsed.error) {
          eventSource.close();
          setConversionProgress(null);
          alert(parsed.error);
        } else if (parsed.done) {
          eventSource.close();
          setConversionProgress(null);
          navigate(`/project/${parsed.project.id}`);
        } else {
          setConversionProgress(parsed.progress || 0);
        }
      };
      eventSource.onerror = () => {
        eventSource.close();
        setConversionProgress(null);
        alert('Lost connection to server during conversion.');
      };
    } catch (err) {
      setConversionProgress(null);
      alert('Upload failed: ' + err.message);
    } finally {
      if (convertInputRef.current) convertInputRef.current.value = '';
    }
  };

  const showComingSoon = (feature) => {
    setIsAddMenuOpen(false);
    alert(`${feature} is coming soon.`);
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

  const anyPanelOpen = isNotificationsOpen || isProfileOpen || isAddMenuOpen;
  
  const unreadChatsCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadNotificationsCount = workspace.notifications.filter((n) => !n.read).length;
  const totalNotifications = unreadNotificationsCount + unreadChatsCount;

  const handleOpenNotifications = () => {
    setIsNotificationsOpen((open) => !open);
    setIsProfileOpen(false);
    setIsAddMenuOpen(false);
    setIsChatOpen(false);

    if (!isNotificationsOpen && unreadNotificationsCount > 0) {
      fetch(`${apiUrl}/api/notifications/read?userId=${user.id}`, { method: 'POST' })
        .catch(err => console.error('Failed to mark notifications read', err));
      
      setWorkspace(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true }))
      }));
    }
  };

  return (
    <div className="min-h-screen bg-primary-background px-8 py-6 pb-10 lg:px-12">
      {conversionProgress !== null && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-80 rounded-3xl border border-border bg-shading p-8 shadow-2xl">
            <Video className="mx-auto mb-4 h-12 w-12 animate-pulse text-green-400" />
            <h3 className="mb-2 text-center text-xl font-bold text-primary-label">Converting Video</h3>
            <p className="mb-6 text-center text-sm text-secondary-label">Extracting high-quality audio...</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black">
              <div 
                className="h-full rounded-full bg-green-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, conversionProgress)}%` }}
              />
            </div>
            <p className="mt-3 text-center text-xs font-bold text-primary-label">{conversionProgress}%</p>
          </div>
        </div>
      )}

      {/* Invisible backdrop — click outside to close any open panel */}
      {anyPanelOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsNotificationsOpen(false);
            setIsProfileOpen(false);
            setIsAddMenuOpen(false);
          }}
        />
      )}
      <header className="sticky top-0 z-50 flex items-start justify-between gap-3 border-b border-border/60 bg-primary-background/95 pb-4 pt-2 backdrop-blur-md">
        {/* Starlight Station logo — blends with bg in dark, black in light */}
        <Link to="/" aria-label="Starlight Station home">
          <StarlightLogo className="logo-glow h-20 w-64 text-primary-label opacity-90 hover:opacity-100 transition-opacity" />
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          <div className="relative">
            <button onClick={handleOpenNotifications} className="relative grid h-11 w-11 place-items-center rounded-2xl bg-primary-label text-primary-background transition-transform hover:scale-105" aria-label="Notifications">
              <Bell className="h-5 w-5 fill-current" />
              {totalNotifications > 0 && <span className="absolute right-3 top-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-primary-background">{totalNotifications}</span>}
            </button>
            <NotificationsMenu isOpen={isNotificationsOpen} notifications={workspace.notifications} conversations={conversations} />
          </div>

          <div className="relative">
            <button onClick={() => { setIsProfileOpen((open) => !open); setIsNotificationsOpen(false); setIsAddMenuOpen(false); setIsChatOpen(false); }} className="grid h-14 w-14 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label={`Open ${user.name} profile`}>
              <ProfileAvatar user={user} size="h-8 w-8" />
            </button>
            <ProfilePanel
              isOpen={isProfileOpen}
              user={user}
              theme={theme}
              onThemeChange={setTheme}
              onEditProfile={() => setIsEditProfileOpen(true)}
              onLogout={onLogout}
              onDeleteAccount={deleteAccount}
            />
          </div>

          <button onClick={() => { setIsChatOpen((open) => !open); setIsProfileOpen(false); setIsNotificationsOpen(false); setIsAddMenuOpen(false); }} className="grid h-14 w-14 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Open messages">
            <MessageSquare className="h-6 w-6" />
          </button>
          <button onClick={onLogout} className="grid h-14 w-14 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Log out">
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-16rem)] max-w-4xl items-center justify-center py-10 pb-10">
        {workspace.projects.length === 0 && workspace.folders.length === 0 ? (
          <div className="text-center">
            <Disc3 className="mx-auto mb-5 h-12 w-12 text-secondary-label" />
            <h1 className="text-2xl font-semibold">No projects yet</h1>
            <p className="mt-2 text-secondary-label">Create your first library project.</p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 justify-items-center gap-x-6 gap-y-10 lg:gap-x-8 lg:gap-y-12">
            {workspace.folders.map((folder) => {
              const folderProjects = workspace.projects.filter((p) => p.folderId === folder.id);
              return (
                <LibraryFolder
                  key={folder.id}
                  folder={folder}
                  projects={folderProjects}
                  tracks={workspace.tracks}
                  onSave={saveFolderMetadata}
                  onDrop={moveItem}
                  onDragStart={() => setDraggingId(folder.id)}
                  isDragging={draggingId === folder.id}
                  onDelete={deleteItem}
                />
              );
            })}
            {workspace.projects.filter((p) => !p.folderId).map((project) => (
              <LibraryProject
                key={project.id}
                project={project}
                tracks={workspace.tracks}
                onDragStart={() => setDraggingId(project.id)}
                isDragging={draggingId === project.id}
                onDelete={deleteItem}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add button — anchored, menu pops above, never moves */}
      <div className={`fixed bottom-6 z-50 ${currentTrack ? 'left-6' : 'left-1/2 -translate-x-1/2'}`}>
        <AnimatePresence>
          {isAddMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-3 left-0 w-52 rounded-2xl panel-bg border border-border p-2 shadow-2xl backdrop-blur-xl"
            >
              <button onClick={() => convertInputRef.current?.click()} disabled={conversionProgress !== null} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors disabled:opacity-50">
                <Video className="h-4 w-4 shrink-0" />
                {conversionProgress !== null ? 'Converting...' : 'Convert'}
              </button>
              <button onClick={createFolder} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                <FolderPlus className="h-4 w-4 shrink-0" />
                New Folder
              </button>
              <button onClick={() => createProject()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                <Plus className="h-4 w-4 shrink-0" />
                New Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => { setIsAddMenuOpen(o => !o); setIsProfileOpen(false); setIsNotificationsOpen(false); setIsChatOpen(false); }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-shading border border-border px-5 text-sm font-semibold text-primary-label shadow-xl backdrop-blur-md transition-colors hover:bg-highlight"
        >
          <Plus className={`h-4 w-4 transition-transform duration-200 ${isAddMenuOpen ? 'rotate-45' : ''}`} />
          {isAddMenuOpen ? 'Close' : 'Add'}
        </button>
      </div>

      <input ref={convertInputRef} type="file" accept="video/*" className="hidden" onChange={handleConvert} />

      <ChatInbox user={user} isOpen={isChatOpen} onToggle={() => setIsChatOpen((open) => !open)} onConversationsChange={setConversations} />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        user={user}
        onClose={() => setIsEditProfileOpen(false)}
        onSave={saveProfile}
        saving={profileSaving}
        error={profileError}
      />
    </div>
  );
}