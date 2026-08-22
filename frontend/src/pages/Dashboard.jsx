import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight, Circle, Compass, Disc3, Edit3, Folder, FolderOpen, FolderPlus, LogOut, MoreHorizontal, Music, Palette, Play, Pause, Plus, Settings, Trash2, UploadCloud, Video, X, User } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';
import ConfirmModal from '../components/ConfirmModal';
import PageLoading from '../components/PageLoading';
import MarqueeInput from '../components/MarqueeInput';
import { useAudio } from '../context/AudioContext';
import { defaultGradient, gradientFor } from '../utils/gradients';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
// Cookie-only auth — credentials:include sends HttpOnly cookies automatically.
// The global fetch interceptor in main.jsx adds the CSRF header.
const authHeaders = (json = false) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {})
});

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
          className="relative aspect-square overflow-hidden rounded-[1.25rem]"
          style={{ background: project.coverArt ? undefined : defaultGradient }}
        >
          {project.coverArt ? (
            <img
              src={project.coverArt}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Disc3 className="h-12 w-12 text-white/40 drop-shadow-lg" />
            </div>
          )}
          {leadTrack && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isThisProjectPlaying) {
                  setIsPlaying(!isPlaying);
                } else {
                  playTrack(leadTrack, projectTracks, title, project.coverArt, project.id);
                }
              }}
              className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-primary-background shadow-xl transition-transform hover:bg-accent-hover hover:scale-110 group-hover:scale-105"
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
                ? <FolderOpen className="h-20 w-20 text-[#FF8A3D] transition-transform duration-500 group-hover:scale-105" />
                : <Folder className="h-20 w-20 text-[#FF8A3D]/65 transition-transform duration-500 group-hover:scale-105" />}
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
      <User className="h-1/2 w-1/2 text-[#FF8A3D]" />
    </div>
  );
}

function NotificationsMenu({ isOpen, notifications, conversations, onRead }) {
  const [tab, setTab] = useState('unread');
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
  const visibleNotifications = allNotifications.filter((notification) => tab === 'unread' ? !notification.read : notification.read);

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
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-shading p-1">
            {['unread', 'read'].map((value) => (
              <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition-colors ${tab === value ? 'bg-primary-label text-primary-background' : 'text-secondary-label hover:text-primary-label'}`}>
                {value}
              </button>
            ))}
          </div>
          {visibleNotifications.length === 0 ? (
            <p className="px-3 py-6 text-sm text-secondary-label">No {tab} notifications.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto hide-scrollbar">
              {visibleNotifications.map((notification) => {
                const text = notification.type === 'chat' || notification.type === 'message' || notification.type === 'call' || notification.type === 'like' || notification.type === 'comment' || notification.type === 'comment_like' || notification.type === 'comment_reply' || notification.type === 'comment_mention' || notification.type === 'follow' || notification.type === 'follow_confirmation'
                  ? notification.message
                  : `${notification.actor?.name || 'Someone'} listened to ${notification.track?.title || notification.project?.name || notification.folder?.name || 'your shared item'}`;
                
                const itemContent = (
                  <div className={`flex gap-3 rounded-2xl p-3 transition-colors hover:bg-highlight/80 ${notification.read ? 'bg-shading' : 'bg-primary-label/10'}`}>
                    <ProfileAvatar user={notification.actor || { name: '?' }} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary-label">{text}</p>
                      {notification.preview && <p className="mt-1 truncate text-xs text-secondary-label">{notification.preview}</p>}
                      <p className="mt-1 text-xs text-secondary-label">{new Date(notification.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                );

                const handleClick = () => onRead?.(notification);

                if (notification.actor?.id) {
                  return (
                    <Link key={notification.id} to={'/profile/' + notification.actor.id} onClick={handleClick} className="block">
                      {itemContent}
                    </Link>
                  );
                }
                return <button type="button" key={notification.id} onClick={handleClick} className="block w-full text-left">{itemContent}</button>;
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfilePanel({ isOpen, user, onEditProfile, onLogout, onDeleteAccount }) {
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
  const [username, setUsername] = useState(user.username || user.name?.toLowerCase().replace(/\s+/g, '_'));
  const [bio, setBio] = useState(user.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : user.avatarUrl;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name, username, bio, avatarFile });
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

            <label className="w-full"><span className="mb-2 block text-center text-xs text-secondary-label">Handle</span><input value={username} onChange={(event) => setUsername(event.target.value)} className="h-11 w-full rounded-xl panel-input-bg px-4 text-sm text-primary-label outline-none" /></label>
            <label className="w-full"><span className="mb-2 block text-center text-xs text-secondary-label">Bio</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} rows={3} className="w-full resize-none rounded-xl panel-input-bg p-3 text-sm text-primary-label outline-none" placeholder="Tell people about yourself" /></label>

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
  const [notificationPanelVisited, setNotificationPanelVisited] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const { currentTrack } = useAudio();
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [conversionProgress, setConversionProgress] = useState(null);
  const [isConvertPickerOpen, setIsConvertPickerOpen] = useState(false);
  const [convertFormat, setConvertFormat] = useState('mp3');
  const [convertFile, setConvertFile] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const convertInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshWorkspace = () => {
    fetch(`${apiUrl}/api/workspace?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        const serverNotifications = data.notifications || [];
        setWorkspace((previous) => ({
          folders: data.folders || [],
          projects: data.projects || [],
          tracks: data.tracks || [],
          coverArts: data.coverArts || [],
          notifications: serverNotifications.map((notification) => {
            const current = previous.notifications.find((item) => String(item.id) === String(notification.id));
            return current?.read ? { ...notification, read: true } : notification;
          }),
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Re-fetch every time we land on /library (e.g. coming back from a project page)
  useEffect(() => {
    refreshWorkspace();
  }, [user.id, location.pathname]);

  // Notifications are created by other users, so navigation-only fetching is
  // not enough. Poll the lightweight workspace payload while the library is
  // mounted; read state is still committed only by the panel revisit flow.
  useEffect(() => {
    const timer = window.setInterval(refreshWorkspace, 3000);
    return () => window.clearInterval(timer);
  }, [user.id]);


  const saveFolderMetadata = async (folderId, updates) => {
    const res = await fetch(`${apiUrl}/api/folders/${folderId}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const savedFolder = await res.json();
      if (!res.ok) throw new Error(savedFolder.error || 'Could not update folder.');
      setWorkspace((prev) => ({ ...prev, folders: prev.folders.map((f) => (f.id === folderId ? savedFolder.folder || savedFolder : f)) }));
    }
  };



  const createProject = async () => {
    try {
      setIsAddMenuOpen(false);
      const res = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ userId: user.id, title: 'Untitled project', artist: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create project.');
      navigate(`/project/${data.id}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const createFolder = async () => {
    try {
      setIsAddMenuOpen(false);
      const res = await fetch(`${apiUrl}/api/folders`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ userId: user.id, title: 'Untitled folder', artist: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create folder.');
      setWorkspace((prev) => ({ ...prev, folders: [data, ...prev.folders] }));
    } catch (error) {
      alert(error.message);
    }
  };

  const moveItem = async (itemId, itemType, targetFolderId) => {
    if (itemType === 'project') {
      setWorkspace((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (
          p.id === itemId ? { ...p, folderId: targetFolderId } : p
        ))
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

  const handleConvert = async () => {
    const file = convertFile;
    if (!file) return;
    
    setIsAddMenuOpen(false);
    setConversionProgress(0);
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('userId', user.id);
    formData.append('format', convertFormat);
    
    try {
      const res = await fetch(`${apiUrl}/api/convert`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const pollStatus = async () => {
        const statusRes = await fetch(`${apiUrl}/api/convert/status/${data.jobId}?poll=1`);
        const parsed = await statusRes.json();
        if (!statusRes.ok) throw new Error(parsed.error || 'Conversion job is no longer available.');
        if (parsed.error) throw new Error(parsed.error);
        setConversionProgress(parsed.progress || 0);
        if (parsed.done) {
          setConversionProgress(null);
          navigate(`/project/${parsed.project.id}`);
          return;
        }
        window.setTimeout(pollStatus, 1500);
      };
      pollStatus().catch((error) => {
        setConversionProgress(null);
        alert(error.message || 'Conversion status could not be loaded.');
      });
    } catch (err) {
      setConversionProgress(null);
      alert('Upload failed: ' + err.message);
    } finally {
      if (convertInputRef.current) convertInputRef.current.value = '';
    }
  };

  const showComingSoon = (feature) => {
    setIsAddMenuOpen(false);
    setIsConvertPickerOpen(false);
    setIsConvertPickerOpen(false);
    alert(`${feature} is coming soon.`);
  };

  const saveProfile = async ({ name, username, bio, avatarFile }) => {
    setProfileSaving(true);
    setProfileError('');
    try {
      const profileRes = await fetch(`${apiUrl}/api/auth/${user.id}`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ name, username, bio })
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData.error || 'Could not update profile.');

      let nextUser = profileData.user;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarRes = await fetch(`${apiUrl}/api/auth/${user.id}/avatar`, {
          method: 'POST',
          headers: authHeaders(),
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

  if (loading) return <PageLoading />;

  const anyPanelOpen = isNotificationsOpen || isProfileOpen || isAddMenuOpen;
  
  const unreadChatsCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadNotificationsCount = workspace.notifications.filter((n) => !n.read).length;
  const totalNotifications = unreadNotificationsCount + unreadChatsCount;

  const handleReadNotification = async (notification) => {
    // Clicking an item does not consume it. Read state is committed when the
    // user leaves and later returns to the notification panel.
    return notification;
  };

  const handleOpenNotifications = () => {
    refreshWorkspace();
    if (isNotificationsOpen) {
      setIsNotificationsOpen(false);
      setNotificationPanelVisited(false);
      setWorkspace((prev) => ({ ...prev, notifications: prev.notifications.map((item) => ({ ...item, read: true })) }));
      fetch(`${apiUrl}/api/notifications/read`, { method: 'POST', credentials: 'include', headers: authHeaders(true) })
        .catch((error) => console.error('Failed to mark notifications read', error));
      return;
    }
    if (notificationPanelVisited) {
      setWorkspace((prev) => ({ ...prev, notifications: prev.notifications.map((item) => ({ ...item, read: true })) }));
      fetch(`${apiUrl}/api/notifications/read`, { method: 'POST', credentials: 'include', headers: authHeaders(true) })
        .catch((error) => console.error('Failed to mark notifications read', error));
      setNotificationPanelVisited(false);
    }
    setIsNotificationsOpen(true);
    setIsProfileOpen(false);
    setIsAddMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-primary-background text-primary-label px-4 py-4 pb-32 sm:px-6 sm:py-6 md:pb-10 lg:px-12">
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
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-transparent pb-4 pt-2">
        <div className="flex min-w-0 max-w-lg flex-1 items-center gap-4">
          <h1 className="font-display text-2xl font-bold tracking-wider text-[#F7F4EC] shrink-0">liBraRy</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="relative">
            <button onClick={handleOpenNotifications} className="relative grid h-10 w-10 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-11 sm:w-11" aria-label="Notifications">
              <Bell className="h-5 w-5 fill-current text-[#FF8A3D]" />
              {totalNotifications > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-primary-background" aria-label="New notifications" />}
            </button>
            <NotificationsMenu isOpen={isNotificationsOpen} notifications={workspace.notifications} conversations={conversations} onRead={handleReadNotification} />
          </div>

          <div className="relative">
            <button onClick={() => navigate('/settings')} className="hidden" aria-hidden="true">
              <Settings className="h-6 w-6" />
            </button>
          </div>

          <button onClick={() => navigate('/feed')} className="grid h-10 w-10 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight sm:h-14 sm:w-14 sm:rounded-3xl" aria-label="Open feed">
            <Compass className="h-6 w-6 text-[#FF8A3D]" />
          </button>
          <button onClick={onLogout} className="hidden h-14 w-14 place-items-center rounded-3xl bg-shading text-primary-label transition-colors hover:bg-highlight md:grid" aria-label="Log out">
            <LogOut className="h-6 w-6 text-[#FF8A3D]" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-16rem)] max-w-4xl items-center justify-center py-6 pb-40 sm:py-10 sm:pb-10">
        {workspace.projects.length === 0 && workspace.folders.length === 0 ? (
          <div className="text-center">
            <Disc3 className="mx-auto mb-5 h-12 w-12 text-[#FF8A3D]" />
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
      <div className={`fixed bottom-[4.9rem] z-50 sm:bottom-6 ${currentTrack ? 'left-3 sm:left-6' : 'left-1/2 -translate-x-1/2'}`}>
        <AnimatePresence>
          {isAddMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-3 left-0 w-52 rounded-2xl panel-bg border border-border p-2 shadow-2xl backdrop-blur-xl"
            >
              <button onClick={() => setIsConvertPickerOpen(true)} disabled={conversionProgress !== null} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors disabled:opacity-50">
                <Video className="h-4 w-4 shrink-0 text-[#FF8A3D]" />
                {conversionProgress !== null ? 'Converting...' : 'Convert'}
              </button>
              <button onClick={createFolder} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                <FolderPlus className="h-4 w-4 shrink-0 text-[#FF8A3D]" />
                New Folder
              </button>
              <button onClick={() => createProject()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
                <Plus className="h-4 w-4 shrink-0 text-[#FF8A3D]" />
                New Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => { setIsAddMenuOpen(o => !o); setIsProfileOpen(false); setIsNotificationsOpen(false); }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent border border-accent px-5 text-sm font-semibold text-primary-background shadow-xl backdrop-blur-md transition-colors hover:bg-accent-hover"
        >
          <Plus className={`h-4 w-4 transition-transform duration-200 ${isAddMenuOpen ? 'rotate-45' : ''}`} />
          {isAddMenuOpen ? 'Close' : currentTrack ? null : 'Add'}
        </button>
      </div>

      {isConvertPickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setIsConvertPickerOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border panel-bg p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-1 text-lg font-semibold text-primary-label">Convert file</h3>
            <p className="mb-4 text-sm text-secondary-label">Choose a source file and output format.</p>
            <button onClick={() => convertInputRef.current?.click()} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-left text-sm text-primary-label hover:bg-highlight">
              <UploadCloud className="h-4 w-4" />
              <span className="min-w-0 truncate">{convertFile?.name || 'Choose audio or video file'}</span>
            </button>
            <div className="grid grid-cols-3 gap-2">
              {['mp3', 'wav', 'm4a'].map((format) => (
                <button key={format} onClick={() => setConvertFormat(format)} className={`rounded-xl border px-3 py-3 text-sm font-semibold uppercase transition-colors ${convertFormat === format ? 'border-primary-label bg-primary-label text-primary-background' : 'border-border text-primary-label hover:bg-highlight'}`}>
                  {format}
                </button>
              ))}
            </div>
            <button onClick={handleConvert} disabled={!convertFile} className="mt-4 w-full rounded-xl bg-primary-label px-4 py-3 text-sm font-semibold text-primary-background disabled:cursor-not-allowed disabled:opacity-40">
              Convert to {convertFormat.toUpperCase()}
            </button>
          </div>
        </div>
      )}
      <input ref={convertInputRef} type="file" accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.webm" className="hidden" onChange={(event) => setConvertFile(event.target.files?.[0] || null)} />

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
