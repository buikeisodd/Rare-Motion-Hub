import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Check, Edit3, Loader2, MessageCircle, Play, UserPlus, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ChatInbox from '../components/ChatInbox';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const authFetch = (url, options = {}) => {
  return fetch(url, { ...options, credentials: 'include' });
};

export default function Profile({ user, onUserUpdate }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [draft, setDraft] = useState({ name: '', username: '', bio: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

  useEffect(() => {
    authFetch(`${apiUrl}/api/auth/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.user);
        setPosts(data.posts || []);
        setFollowing(Boolean(data.isFollowing));
        setDraft({ name: data.user?.name || '', username: data.user?.username || '', bio: data.user?.bio || '' });
      });
  }, [id]);

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    setProfile((current) => ({ ...current, followerCount: Math.max(0, (current.followerCount || 0) + (next ? 1 : -1)) }));
    const res = await authFetch(`${apiUrl}/api/auth/${id}/follow`, { method: 'POST' });
    if (!res.ok) setFollowing(!next);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveNotice('');
    try {
      const res = await authFetch(`${apiUrl}/api/auth/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save profile details.');
      let nextProfile = { ...profile, ...data.user };
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarRes = await authFetch(`${apiUrl}/api/auth/${id}/avatar`, { method: 'POST', body: formData });
        const avatarData = await avatarRes.json().catch(() => ({}));
        if (!avatarRes.ok) throw new Error(avatarData.error || 'Profile details saved, but the picture could not be uploaded.');
        nextProfile = { ...nextProfile, ...avatarData.user };
      }
      setProfile(nextProfile);
      if (profile.id === user?.id) {
        const nextUser = { ...user, ...nextProfile };
        // User state is managed in App.jsx React state only — no localStorage
        // for auth credentials. onUserUpdate propagates the change up.
        onUserUpdate?.(nextUser);
      }
      setAvatarFile(null);
      setSaveNotice('Profile updated successfully.');
      window.setTimeout(() => setEditing(false), 700);
    } catch (error) {
      setSaveError(error.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : profile?.avatarUrl;

  const openMessage = () => {
    setMessageTarget(profile);
    setInboxOpen(true);
  };

  if (!profile) return (
    <div className="min-h-screen bg-primary-background px-4 pb-32 text-primary-label sm:px-8 md:pb-20" role="status" aria-label="Loading profile">
      <div className="mx-auto max-w-5xl animate-pulse">
        <header className="flex items-center justify-between py-4">
          <div className="h-10 w-10 rounded-full bg-shading" />
          <div className="h-4 w-24 rounded bg-shading" />
          <div className="h-10 w-10 rounded-full bg-shading" />
        </header>
        <main className="py-8 sm:py-12">
          <section className="grid gap-7 sm:grid-cols-[9rem_1fr] sm:gap-10 lg:grid-cols-[12rem_1fr] lg:gap-14">
            <div className="mx-auto h-36 w-36 rounded-full bg-shading sm:mx-0 sm:h-40 sm:w-40 lg:h-48 lg:w-48" />
            <div className="w-full max-w-xl space-y-4">
              <div className="h-8 w-48 rounded bg-shading" />
              <div className="h-4 w-32 rounded bg-shading" />
              <div className="h-4 w-full rounded bg-shading" />
              <div className="h-11 w-40 rounded-xl bg-shading" />
            </div>
          </section>
          <section className="mt-12 grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-square rounded-xl bg-shading" />)}
          </section>
        </main>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-primary-background px-4 pb-32 text-primary-label sm:px-8 md:pb-20">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-4">
        <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-base font-bold tracking-wider text-[#34483B]">pRoFiLe</h1>
        <span className="w-10" />
      </header>
      <main className="mx-auto max-w-5xl py-8 sm:py-12">
        <section className="grid gap-7 sm:grid-cols-[9rem_1fr] sm:gap-10 lg:grid-cols-[12rem_1fr] lg:gap-14">
          <div className="mx-auto sm:mx-0">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-36 w-36 rounded-full object-cover ring-2 ring-border sm:h-40 sm:w-40 lg:h-48 lg:w-48" /> : <div className="grid h-36 w-36 place-items-center rounded-full bg-highlight text-5xl font-semibold sm:h-40 sm:w-40 lg:h-48 lg:w-48">{profile.name?.slice(0, 1).toUpperCase()}</div>}</div>
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5"><div><h1 className="text-2xl font-semibold sm:text-3xl">{profile.name}</h1><p className="mt-1 text-sm text-secondary-label">@{profile.username || profile.name}</p></div><div className="flex flex-wrap gap-2">
              {profile.id === user?.id ? <button onClick={() => setEditing((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-shading px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-highlight"><Edit3 className="h-4 w-4" />{editing ? 'Close editor' : 'Edit profile'}</button> : <button onClick={toggleFollow} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${following ? 'bg-shading hover:bg-highlight' : 'bg-primary-label text-primary-background hover:opacity-85'}`}>{following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{following ? 'Following' : 'Follow'}</button>}
              {profile.id !== user?.id && <button onClick={openMessage} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-shading px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-highlight"><MessageCircle className="h-4 w-4" />Message</button>}
            </div></div>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm"><span><strong className="text-base">{posts.length}</strong> previews</span><span><strong className="text-base">{profile.followerCount || 0}</strong> followers</span><span><strong className="text-base">{profile.followingCount || 0}</strong> following</span></div>
            <div className="mt-5 max-w-xl"><p className="whitespace-pre-wrap text-sm text-secondary-label">{profile.bio || 'Music maker and creative.'}</p></div>
          </div>
        </section>
        <section className="mt-12 border-t border-border pt-5"><div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary-label"><span className="h-px w-8 bg-primary-label" />Previews</div>{posts.length === 0 ? <p className="py-12 text-center text-sm text-secondary-label">No published previews yet.</p> : <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2">{posts.map((post) => <Link key={post.id} to={`/project/${post.projectId}`} className="group relative aspect-square overflow-hidden bg-highlight">{post.coverArt && <img src={post.coverArt} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}<div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"><Play className="h-8 w-8 fill-white text-[#34483B]" /></div><div className="absolute bottom-2 left-2 right-2 truncate text-xs font-semibold text-[#34483B] opacity-0 transition-opacity group-hover:opacity-100">{post.title}</div></Link>)}</div>}</section>
      </main>
      {editing && profile.id === user?.id && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <form onSubmit={saveProfile} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-primary-background p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Edit profile</h2><p className="mt-1 text-xs text-secondary-label">Update your public profile details.</p></div><button type="button" onClick={() => { setEditing(false); setSaveError(''); setSaveNotice(''); }} className="grid h-9 w-9 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Close edit profile"><X className="h-5 w-5" /></button></div>
          <div className="flex flex-col items-center"><label className="group relative cursor-pointer"><div className="h-28 w-28 overflow-hidden rounded-full bg-highlight ring-2 ring-border">{avatarPreview ? <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-4xl font-semibold">{profile.name?.slice(0, 1).toUpperCase()}</div>}</div><span className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-primary-label text-primary-background shadow-lg"><Camera className="h-4 w-4" /></span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} /></label><p className="mt-3 text-xs text-secondary-label">Change profile picture</p></div>
          <div className="mt-7 grid gap-4"><label className="grid gap-2 text-sm font-medium">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-12 rounded-xl border border-border bg-shading px-4 outline-none focus:border-primary-label/50" required /></label><label className="grid gap-2 text-sm font-medium">Username<input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="h-12 rounded-xl border border-border bg-shading px-4 outline-none focus:border-primary-label/50" placeholder="your_username" /></label><label className="grid gap-2 text-sm font-medium">Bio<textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} maxLength={160} rows={4} className="resize-none rounded-xl border border-border bg-shading p-4 outline-none focus:border-primary-label/50" placeholder="Tell people about yourself" /><span className="text-right text-xs text-secondary-label">{draft.bio.length}/160</span></label></div>
          {saveError && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{saveError}</p>}{saveNotice && <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{saveNotice}</p>}
          <button disabled={saving} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-label font-semibold text-primary-background transition-opacity disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving changes...' : 'Save changes'}</button>
        </form>
      </div>}
      <ChatInbox user={user} isOpen={inboxOpen} onToggle={() => setInboxOpen((value) => !value)} startConversationWith={messageTarget} />
    </div>
  );
}
