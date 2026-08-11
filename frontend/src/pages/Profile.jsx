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
      <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-border/60 py-4">
        <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <StarlightLogo className="logo-glow h-9 w-36 text-primary-label" />
        <span className="w-10" />
      </header>
      <main className="mx-auto max-w-3xl py-8 sm:py-10">
        <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-28 w-28 rounded-full object-cover ring-2 ring-border" /> : <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-highlight text-4xl font-semibold">{profile.name?.slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <div><h1 className="text-2xl font-semibold">{profile.name}</h1><p className="text-sm text-secondary-label">@{profile.username || profile.name}</p></div>
              {profile.id !== user?.id && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <button onClick={toggleFollow} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${following ? 'bg-shading' : 'bg-primary-label text-primary-background'}`}>{following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{following ? 'Following' : 'Follow'}</button>
                  <button onClick={openMessage} className="inline-flex items-center gap-2 rounded-full border border-border bg-shading px-4 py-2 text-sm font-semibold transition-colors hover:bg-highlight">
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </button>
                </div>
              )}
            </div>
            <p className="mt-4 max-w-md text-sm text-secondary-label">{profile.bio || 'Music maker and creative.'}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-6 text-sm sm:justify-start"><span><strong>{posts.length}</strong> posts</span><span><strong>{profile.followerCount || 0}</strong> followers</span><span><strong>{profile.followingCount || 0}</strong> following</span></div>
            {profile.id === user?.id && <><button onClick={() => setEditing((value) => !value)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-shading px-4 py-2 text-sm font-semibold hover:bg-highlight"><Edit3 className="h-4 w-4" />{editing ? 'Close editor' : 'Edit profile'}</button>{editing && <form onSubmit={saveProfile} className="mt-4 grid max-w-md gap-3"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-xl border border-border bg-shading px-3 py-2 text-sm outline-none" placeholder="Name" required /><input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="rounded-xl border border-border bg-shading px-3 py-2 text-sm outline-none" placeholder="Username" /><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} maxLength={160} rows={3} className="resize-none rounded-xl border border-border bg-shading p-3 text-sm outline-none" placeholder="Bio" /><button className="rounded-xl bg-primary-label px-4 py-2 text-sm font-semibold text-primary-background">Save profile</button></form>}</>}
          </div>
        </section>
        <section className="mt-12 border-t border-border pt-6"><h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-secondary-label">Posts</h2>{posts.length === 0 ? <p className="py-12 text-center text-sm text-secondary-label">No published previews yet.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{posts.map((post) => <Link key={post.id} to={`/project/${post.projectId}`} className="group relative aspect-square overflow-hidden rounded-xl bg-highlight">{post.coverArt && <img src={post.coverArt} alt="" className="h-full w-full object-cover" />}<div className="absolute inset-0 grid place-items-center bg-black/20 group-hover:bg-black/45"><Play className="h-8 w-8 fill-white text-white opacity-0 group-hover:opacity-100" /></div><div className="absolute bottom-2 left-2 right-2 truncate text-xs font-semibold text-white">{post.title}</div></Link>)}</div>}</section>
      </main>
      <ChatInbox user={user} isOpen={inboxOpen} onToggle={() => setInboxOpen((value) => !value)} startConversationWith={messageTarget} />
    </div>
  );
}
