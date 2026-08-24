import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCheck, Copy, Inbox, MessageCircle, MoreHorizontal, Pin, Reply, Search, Send, Star, Trash2, UserPlus, Users, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Link } from 'react-router-dom';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const authFetch = (url, options = {}) => fetch(url, { ...options, credentials: 'include' });
const formatChatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function avatar(user, size = 'h-10 w-10') {
  const online = Boolean(user?.isOnline);
  const className = `${size} shrink-0 rounded-full object-cover ${online ? 'ring-2 ring-[#718A78] ring-offset-2 ring-offset-primary-background shadow-[0_0_12px_rgba(113,138,120,0.9)]' : ''}`;
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="" className={className} />;
  return <div className={`${className} grid place-items-center bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)] text-sm font-bold text-black`}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>;
}

function normalizeUser(value) {
  if (!value || typeof value !== 'object') return null;
  const id = value.id || value.userId || value._id;
  if (!id) return null;
  return { ...value, id, name: value.name || value.username || 'Unknown user', username: value.username || value.name || 'unknown', avatarUrl: value.avatarUrl || '' };
}

function normalizeConversation(value) {
  if (!value || typeof value !== 'object') return null;
  const type = value.type === 'group' ? 'group' : 'dm';
  const partner = normalizeUser(value.partner || value.user || value.recipient);
  const group = value.group && value.group.id ? { id: value.group.id, name: value.group.name || 'Group' } : null;
  if (type === 'dm' && !partner) return null;
  if (type === 'group' && !group) return null;
  return { type, partner, group, isRequest: Boolean(value.isRequest), unreadCount: Number(value.unreadCount) || 0, lastMessage: value.lastMessage && typeof value.lastMessage === 'object' ? value.lastMessage : null };
}

function normalizeMessage(value) {
  if (!value || typeof value !== 'object' || !value.id) return null;
  const text = typeof value.text === 'string' ? value.text : '';
  const isStoryReply = Boolean(value.storyId || value.messageKind === 'story_reply');
  return { ...value, id: value.id, storyId: value.storyId || (isStoryReply ? value.storyId : null), text, storyLabel: isStoryReply ? 'Story reply' : '', deleted: Boolean(value.deleted), senderId: value.senderId || '', sender: normalizeUser(value.sender), createdAt: value.createdAt || new Date().toISOString() };
}

function ConversationRow({ conversation, active, onClick }) {
  const person = conversation.type === 'group' ? conversation.group : conversation.partner;
  const name = conversation.type === 'group' ? person.name : person.name;
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${active ? 'bg-highlight' : 'hover:bg-highlight/60'}`}>
    {conversation.type === 'group' ? <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)]"><MessageCircle className="h-4 w-4 text-black" /></div> : avatar(person)}
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary-label">{name}</span><span className="block truncate text-xs text-secondary-label">{conversation.lastMessage?.storyId || conversation.lastMessage?.messageKind === 'story_reply' ? 'Story reply · ' : conversation.isRequest ? 'Message request' : ''}{conversation.lastMessage?.text || 'No messages yet'}</span></span>
    <span className="flex w-12 shrink-0 flex-col items-end gap-1"><span className="text-[10px] text-secondary-label">{formatChatTime(conversation.lastMessage?.createdAt)}</span>{conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-label px-1 text-[10px] text-primary-background">{conversation.unreadCount}</span>}</span>
  </button>;
}

export default function ChatInbox({ user, isOpen, onToggle, startConversationWith, onOpenStory }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('inbox');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [messageMenu, setMessageMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch(`${apiUrl}/api/conversations?userId=${encodeURIComponent(user.id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load inbox.');
      setConversations((Array.isArray(data.conversations) ? data.conversations : []).map(normalizeConversation).filter(Boolean));
    } catch (err) { setError(err.message || 'Could not load inbox.'); }
  }, [user?.id]);

  const openGroupCreator = async () => {
    setGroupOpen(true); setError(''); setSelectedFriends([]);
    try {
      const response = await authFetch(`${apiUrl}/api/friends`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load friends.');
      setFriends((Array.isArray(data.friends) ? data.friends : []).map(normalizeUser).filter(Boolean));
    } catch (err) { setError(err.message || 'Could not load friends.'); }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (!selectedFriends.length || creatingGroup) return;
    setCreatingGroup(true); setError('');
    try {
      const response = await authFetch(`${apiUrl}/api/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName.trim() || 'New group', participantIds: selectedFriends }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create group.');
      const created = normalizeConversation({ type: 'group', group: data.group, unreadCount: 0 });
      if (created) { setConversations((current) => [created, ...current]); setActive(created); setGroupOpen(false); setGroupName(''); setSelectedFriends([]); setTab('inbox'); }
    } catch (err) { setError(err.message || 'Could not create group.'); }
    finally { setCreatingGroup(false); }
  };

  useEffect(() => { if (isOpen) loadConversations(); }, [isOpen, loadConversations]);

  useEffect(() => {
    if (!isOpen || !startConversationWith?.id || startConversationWith.id === user?.id) return;
    const target = normalizeUser(startConversationWith);
    if (!target) return;
    const existing = conversations.find((item) => item.type === 'dm' && item.partner.id === target.id);
    setActive(existing || { type: 'dm', partner: target, isRequest: false, unreadCount: 0, lastMessage: null });
    setTab('inbox');
  }, [isOpen, startConversationWith, user?.id, conversations]);

  const loadMessages = useCallback(async (conversation, { silent = false } = {}) => {
    if (!conversation) return;
    const isGroup = conversation.type === 'group';
    const query = isGroup ? `type=group&groupId=${conversation.group.id}` : `type=dm&partnerId=${conversation.partner.id}`;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await authFetch(`${apiUrl}/api/messages?${query}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load conversation.');
      setMessages((Array.isArray(data.messages) ? data.messages : []).map(normalizeMessage).filter(Boolean));
    } catch (err) { if (!silent) setMessages([]); setError(err.message || 'Could not load conversation.'); }
    finally { if (!silent) setLoading(false); }
  }, []);

  const openConversation = (conversation) => {
    setConversations((current) => current.map((item) => (
      item.type === conversation.type &&
      (item.type === 'group' ? item.group?.id === conversation.group?.id : item.partner?.id === conversation.partner?.id)
        ? { ...item, unreadCount: 0 }
        : item
    )));
    setActive({ ...conversation, unreadCount: 0 });
    setMessages([]);
    loadMessages(conversation);
  };

  useEffect(() => {
    if (!isOpen || !active) return undefined;
    const timer = window.setInterval(() => loadMessages(active, { silent: true }), 3000);
    return () => window.clearInterval(timer);
  }, [isOpen, active, loadMessages]);

  const send = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !active || sending) return;
    setSending(true); setError('');
    try {
      const isGroup = active.type === 'group';
      const response = await authFetch(`${apiUrl}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: isGroup ? null : active.partner.id, groupId: isGroup ? active.group.id : null, conversationType: isGroup ? 'group' : 'dm', text: value, replyToMessageId: replyingTo?.id || null }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      const message = normalizeMessage(data.message);
      if (!message) throw new Error('The server returned an invalid message.');
      setMessages((current) => [...current, message]); setText(''); setReplyingTo(null); loadConversations();
    } catch (err) { setError(err.message || 'Message could not be sent.'); }
    finally { setSending(false); }
  };

  const messageAction = async (action, message) => {
    setMessageMenu(null);
    if (action === 'copy') { if (message.text) await navigator.clipboard?.writeText(message.text); return; }
    if (action === 'reply') { setReplyingTo(message); return; }
    if (action === 'delete') {
      const response = await authFetch(`${apiUrl}/api/messages/${message.id}`, { method: 'DELETE' });
      if (response.ok) setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deleted: true, text: '' } : item));
      return;
    }
    const endpoint = action === 'pin' ? 'pin' : 'star';
    const response = await authFetch(`${apiUrl}/api/messages/${message.id}/${endpoint}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'pin' ? { pinned: !message.pinned } : {}) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.message) setMessages((current) => current.map((item) => item.id === message.id ? normalizeMessage(data.message) : item));
  };

  const visible = useMemo(() => conversations.filter((item) => (tab === 'requests' ? item.isRequest : !item.isRequest) && `${item.partner?.name || item.group?.name || ''} ${item.partner?.username || ''}`.toLowerCase().includes(search.toLowerCase())), [conversations, tab, search]);
  if (!isOpen) return null;
  const activeName = active?.type === 'group' ? active.group.name : active?.partner ? `${active.partner.name}${active.partner.isOnline ? ' · Active now' : active.partner.lastSeenAt ? ` · Last seen ${formatChatTime(active.partner.lastSeenAt)}` : ''}` : '';

  return <div className="fixed inset-0 z-[80] flex bg-primary-background/80 p-0 backdrop-blur-xl sm:items-center sm:justify-center sm:p-5" onClick={onToggle}>
    <div className="panel-bg flex h-full min-w-0 w-full overflow-hidden border-border sm:h-[min(42rem,90vh)] sm:max-w-4xl sm:rounded-3xl sm:border sm:shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-border md:w-80`}>
        <header className="flex items-center gap-3 border-b border-border p-4"><button onClick={onToggle} className="grid h-9 w-9 place-items-center rounded-xl bg-shading md:hidden" aria-label="Close inbox"><ArrowLeft className="h-4 w-4" /></button><h2 className="text-lg font-bold">Inbox</h2><button onClick={openGroupCreator} className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-shading transition-colors hover:bg-highlight" aria-label="Create group chat" title="Create group chat"><Users className="h-4 w-4" /></button><button onClick={onToggle} className="hidden h-9 w-9 place-items-center rounded-xl bg-shading md:grid" aria-label="Close inbox"><X className="h-4 w-4" /></button></header>
        {groupOpen && <form onSubmit={createGroup} className="border-b border-border bg-shading/50 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">New group chat</h3><button type="button" onClick={() => setGroupOpen(false)} aria-label="Close group creator"><X className="h-4 w-4" /></button></div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" maxLength={60} className="mb-2 w-full rounded-xl bg-primary-background px-3 py-2 text-sm outline-none" /><div className="max-h-40 space-y-1 overflow-y-auto">{friends.length ? friends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-highlight/60"><input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={() => setSelectedFriends((current) => current.includes(friend.id) ? current.filter((id) => id !== friend.id) : [...current, friend.id])} /><span className="truncate">{friend.name}</span><span className="ml-auto truncate text-xs text-secondary-label">@{friend.username}</span></label>) : <p className="py-3 text-xs text-secondary-label">Only mutual followers can be added. No friends available yet.</p>}</div><button disabled={!selectedFriends.length || creatingGroup} className="mt-3 w-full rounded-xl bg-primary-label py-2 text-xs font-semibold text-primary-background disabled:opacity-40">{creatingGroup ? 'Creating...' : 'Create group'}</button></form>}
        <div className="flex gap-2 p-3"><button onClick={() => setTab('inbox')} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === 'inbox' ? 'bg-primary-label text-primary-background' : 'bg-shading'}`}>Inbox {conversations.filter((item) => !item.isRequest && item.unreadCount > 0).length > 0 && <span className="ml-1">{conversations.filter((item) => !item.isRequest && item.unreadCount > 0).length}</span>}</button><button onClick={() => setTab('requests')} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === 'requests' ? 'bg-primary-label text-primary-background' : 'bg-shading'}`}><UserPlus className="mr-1 inline h-3.5 w-3.5" />Requests {conversations.filter((item) => item.isRequest && item.unreadCount > 0).length > 0 && <span className="ml-1">{conversations.filter((item) => item.isRequest && item.unreadCount > 0).length}</span>}</button></div>
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-shading px-3 py-2"><Search className="h-4 w-4 text-secondary-label" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div className="flex-1 overflow-y-auto p-2">{visible.length ? visible.map((item) => <ConversationRow key={`${item.type}-${item.partner?.id || item.group?.id}`} conversation={item} active={active === item} onClick={() => openConversation(item)} />) : <div className="p-8 text-center text-sm text-secondary-label">No conversations yet.</div>}</div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
{active ? <><header className="flex items-center gap-3 border-b border-border p-4"><button onClick={() => setActive(null)} className="grid h-9 w-9 place-items-center rounded-xl bg-shading md:hidden" aria-label="Back to inbox"><ArrowLeft className="h-4 w-4" /></button>{active.type === 'group' ? <MessageCircle className="h-8 w-8 rounded-full bg-highlight p-2" /> : avatar(active.partner, 'h-9 w-9')}<h3 className="truncate font-semibold">{activeName}</h3></header><div className="flex-1 space-y-2 overflow-y-auto p-4">{active.type === 'dm' && active.partner && <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-border bg-shading/60 p-3"><div className="shrink-0">{avatar(active.partner, 'h-12 w-12')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-primary-label">{active.partner.name}</p><p className="truncate text-xs text-secondary-label">@{active.partner.username}</p><div className="mt-1 flex gap-3 text-[11px] text-secondary-label"><span><strong className="text-primary-label">{active.partner.followerCount || active.partner.followersCount || 0}</strong> followers</span><span><strong className="text-primary-label">{active.partner.previewCount || active.partner.postsCount || 0}</strong> previews</span></div></div><Link to={`/profile/${active.partner.id}`} onClick={onToggle} className="shrink-0 rounded-xl bg-primary-label px-3 py-2 text-xs font-semibold text-primary-background transition hover:opacity-85">View profile</Link></div>}{active.type === 'group' && <div className="mx-4 mt-4 rounded-2xl border border-border bg-shading/60 px-4 py-3"><p className="text-sm font-semibold">{active.group.name}</p><p className="mt-1 text-xs text-secondary-label">Group conversation</p></div>}{loading && <p className="text-center text-sm text-secondary-label">Loading messages...</p>}{!loading && !messages.length && <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-shading/60 px-5 py-4 text-center"><p className="text-sm font-semibold text-primary-label">Welcome to your conversation</p><p className="mt-1 text-xs text-secondary-label">Start chatting with {activeName || 'this group'}.</p></div>}{messages.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(a.createdAt) - new Date(b.createdAt)).map((message) => <div key={message.id} className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`} onMouseLeave={() => setMessageMenu(null)}><div className={`group relative min-w-0 max-w-[78%] rounded-2xl px-3.5 py-2 pr-10 text-sm ${message.senderId === user.id ? 'rounded-br-sm bg-primary-label text-primary-background' : 'rounded-bl-sm bg-shading text-primary-label'}`}>{active.type === 'group' && message.sender && <div className="mb-1 text-[11px] font-bold opacity-70">{message.senderId === user.id ? 'You' : message.sender.name}</div>}{(message.storyId || message.messageKind === 'story_reply') && <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-primary-background/20"><div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] opacity-75"><span>↳ Story reply</span></div><div onClick={() => message.storyId && onOpenStory?.(message.storyId)} className="h-20 w-full cursor-pointer bg-shading">{message.storyPreview?.coverArt ? <img src={message.storyPreview.coverArt} alt="Replied story" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs opacity-60">Story preview</div>}</div></div>}{message.deleted ? 'Message deleted' : message.text}<span className="ml-2 text-[10px] opacity-60">{formatChatTime(message.createdAt)}</span>{message.senderId === user.id && <CheckCheck className={`ml-1 inline h-3.5 w-3.5 align-text-bottom ${message.delivery?.read ? 'text-emerald-400' : 'text-secondary-label'}`} aria-label={message.delivery?.read ? 'Read' : 'Delivered'} />}<button type="button" onClick={() => setMessageMenu(messageMenu === message.id ? null : message.id)} className={`absolute right-1 bottom-1 top-auto grid h-6 w-6 place-items-center rounded-lg translate-x-2 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 hover:bg-[#34483B]/20 ${message.senderId === user.id ? 'text-[#F3EBDD]' : 'text-[#34483B]'}`} aria-label="Message actions"><MoreHorizontal className="h-4 w-4" /></button>{messageMenu === message.id && <div className="absolute right-0 top-8 z-20 max-h-64 w-40 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border panel-bg p-1 text-primary-label shadow-xl"><button onClick={() => messageAction('reply', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Reply className="h-3.5 w-3.5" />Reply</button><button onClick={() => messageAction('copy', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Copy className="h-3.5 w-3.5" />Copy</button><button onClick={() => messageAction('pin', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Pin className="h-3.5 w-3.5" />{message.pinned ? 'Unpin' : 'Pin'}</button><button onClick={() => messageAction('star', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Star className="h-3.5 w-3.5" />Star</button>{message.senderId === user.id && <button onClick={() => messageAction('delete', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete</button>}</div>}</div></div>)}</div>{error && <p className="px-4 py-2 text-xs text-red-300">{error}</p>}<form onSubmit={send} className="relative flex gap-2 border-t border-border p-3"><button type="button" onClick={() => setEmojiOpen((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shading text-lg" aria-label="Open emoji picker">☺</button>{emojiOpen && <div className="absolute bottom-16 left-3 z-20 max-w-[calc(100vw-1.5rem)]"><EmojiPicker theme="dark" previewConfig={{ showPreview: false }} onEmojiClick={(emoji) => { setText((value) => `${value}${emoji.emoji}`); setEmojiOpen(false); }} width="min(300px, calc(100vw - 24px))" height="min(320px, 45vh)" /></div>}<input value={text} onChange={(event) => setText(event.target.value)} placeholder={`Message ${activeName || 'user'}...`} className="min-w-0 flex-1 rounded-xl bg-shading px-3 py-2 text-sm outline-none" /><button disabled={sending || !text.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></form></> : <div className="m-auto hidden text-center text-secondary-label md:block"><Inbox className="mx-auto mb-3 h-10 w-10 opacity-40" /><p>Select a conversation</p></div>}
      </section>
    </div>
  </div>;
}

