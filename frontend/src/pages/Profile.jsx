import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Edit3, MessageCircle, Play, UserPlus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import StarlightLogo from '../components/StarlightLogo';
import ChatInbox from '../components/ChatInbox';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

export default function Profile({ user }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [draft, setDraft] = useState({ name: '', username: '', bio: '' });

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
    const res = await authFetch(`${apiUrl}/api/auth/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    const data = await res.json();
    if (res.ok) {
      setProfile((current) => ({ ...current, ...data.user }));
      setEditing(false);
    }
  };

  const openMessage = () => {
    setMessageTarget(profile);
    setInboxOpen(true);
  };

  if (!profile) return <div className="min-h-screen bg-primary-background p-8 text-secondary-label">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-primary-background px-4 pb-20 text-primary-label sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-border/60 py-4">
        <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <StarlightLogo className="logo-glow h-9 w-36 text-primary-label" />
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
            {profile.id === user?.id && editing && <form onSubmit={saveProfile} className="mt-5 grid max-w-xl gap-3 rounded-2xl border border-border bg-shading/30 p-4"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-xl border border-border bg-primary-background px-3 py-2 text-sm outline-none" placeholder="Name" required /><input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="rounded-xl border border-border bg-primary-background px-3 py-2 text-sm outline-none" placeholder="Username" /><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} maxLength={160} rows={3} className="resize-none rounded-xl border border-border bg-primary-background p-3 text-sm outline-none" placeholder="Bio" /><button className="rounded-xl bg-primary-label px-4 py-2 text-sm font-semibold text-primary-background">Save profile</button></form>}
          </div>
        </section>
        <section className="mt-12 border-t border-border pt-5"><div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary-label"><span className="h-px w-8 bg-primary-label" />Previews</div>{posts.length === 0 ? <p className="py-12 text-center text-sm text-secondary-label">No published previews yet.</p> : <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2">{posts.map((post) => <Link key={post.id} to={`/project/${post.projectId}`} className="group relative aspect-square overflow-hidden bg-highlight">{post.coverArt && <img src={post.coverArt} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}<div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"><Play className="h-8 w-8 fill-white text-white" /></div><div className="absolute bottom-2 left-2 right-2 truncate text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{post.title}</div></Link>)}</div>}</section>
      </main>
      <ChatInbox user={user} isOpen={inboxOpen} onToggle={() => setInboxOpen((value) => !value)} startConversationWith={messageTarget} />
    </div>
  );
}
