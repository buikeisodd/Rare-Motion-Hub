import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, CheckCheck, Copy, Inbox, Link2, Menu, MessageCircle, MoreHorizontal, Pin, Plus, Reply, Search, Send, ShieldCheck, Star, Trash2, UserPlus, Users, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Link } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const authFetch = (url, options = {}) => fetch(url, { ...options, credentials: 'include' });
const formatChatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const formatSeen = (value, prefix = 'Seen') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return `${prefix} now`;
  if (minutes < 60) return `${prefix} ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix} ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${prefix} ${days} day${days === 1 ? '' : 's'} ago`;
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
  const group = value.group && value.group.id ? { ...value.group, id: value.group.id, name: value.group.name || 'Group', avatarUrl: value.group.avatarUrl || '' } : null;
  if (type === 'dm' && !partner) return null;
  if (type === 'group' && !group) return null;
  return { type, partner, group, isRequest: Boolean(value.isRequest), unreadCount: Number(value.unreadCount) || 0, lastMessage: value.lastMessage && typeof value.lastMessage === 'object' ? value.lastMessage : null };
}

function normalizeMessage(value) {
  if (!value || typeof value !== 'object' || !value.id) return null;
  const text = typeof value.text === 'string' ? value.text : '';
  const isStoryReply = Boolean(value.storyId || value.messageKind === 'story_reply');
  return { ...value, id: value.id, storyId: value.storyId || (isStoryReply ? value.storyId : null), text, storyLabel: isStoryReply ? 'Story reply' : '', deleted: Boolean(value.deleted), deletedBy: value.deletedBy || null, senderId: value.senderId || '', sender: normalizeUser(value.sender), createdAt: value.createdAt || new Date().toISOString() };
}

function SettingToggle({ checked, disabled, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-10 shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-label disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-primary-label' : 'bg-shading'}`}><span className={`block h-4 w-4 rounded-full bg-primary-background shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} /></button>;
}

function ChatMenu({ user, privacy, setPrivacy, onBack, onProfile, onClear }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const privacyOptions = [['lastSeen', 'Last seen'], ['online', 'Online status'], ['readReceipts', 'Read receipts']];
  return <><header className="flex items-center gap-3 border-b border-border p-4"><button onClick={privacyOpen ? () => setPrivacyOpen(false) : onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-shading" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button><h3 className="font-semibold">{privacyOpen ? 'Privacy' : 'Chat settings'}</h3></header><div className="flex-1 space-y-2 overflow-y-auto p-4">{privacyOpen ? privacyOptions.map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-2xl bg-shading p-4 text-sm"><span>{label}</span><input type="checkbox" checked={privacy[key]} onChange={() => setPrivacy((current) => ({ ...current, [key]: !current[key] }))} /></label>) : <><Link to={`/profile/${user?.id}`} onClick={onProfile} className="flex items-center gap-3 rounded-2xl bg-shading p-4 hover:bg-highlight"><Users className="h-5 w-5" /><strong className="text-sm">Account</strong></Link><button onClick={() => setPrivacyOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-shading p-4 text-left hover:bg-highlight"><ShieldCheck className="h-5 w-5" /><strong className="text-sm">Privacy</strong></button><button className="flex w-full items-center gap-3 rounded-2xl bg-shading p-4 text-left hover:bg-highlight"><Link2 className="h-5 w-5" /><strong className="text-sm">Linked devices</strong></button><button onClick={onClear} className="flex w-full items-center gap-3 rounded-2xl bg-shading p-4 text-left hover:bg-highlight"><Trash2 className="h-5 w-5" /><strong className="text-sm">Storage management</strong></button><div className="rounded-2xl bg-shading p-4"><button onClick={() => onOpenStarred(null)} className="flex w-full items-center gap-3 text-left hover:text-primary-label"><Star className="h-5 w-5 fill-current" /><strong className="text-sm">Starred messages</strong></button>{starred.length ? <div className="mt-3 space-y-2 border-t border-border pt-3">{starred.map((message) => <button key={message.id} onClick={() => onOpenStarred(message.id)} className="flex w-full items-start gap-2 rounded-xl p-2 text-left hover:bg-highlight"><Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{message.senderId === user?.id ? "You" : message.sender?.name || "User"}</span><span className="block truncate text-xs text-secondary-label">{message.text || "Deleted message"}</span><span className="block text-[10px] text-secondary-label">{new Date(message.createdAt).toLocaleDateString()} · {formatChatTime(message.createdAt)}</span></span></button>)}</div> : <p className="mt-2 text-xs text-secondary-label">No starred messages in this chat.</p>}</div></>}</div></>;
}

function ConversationRow({ conversation, active, onClick }) {
  const person = conversation.type === 'group' ? conversation.group : conversation.partner;
  const name = conversation.type === 'group' ? person.name : person.name;
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${active ? 'bg-highlight' : 'hover:bg-highlight/60'}`}>
    {conversation.type === 'group' ? (person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)]"><MessageCircle className="h-4 w-4 text-black" /></div>) : avatar(person)}
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary-label">{name}</span><span className="block truncate text-xs text-secondary-label">{conversation.lastMessage?.storyId || conversation.lastMessage?.messageKind === 'story_reply' ? 'Story reply · ' : conversation.isRequest ? 'Message request' : ''}{conversation.lastMessage?.deleted ? (conversation.lastMessage.senderId === user?.id ? 'You deleted this message' : 'The user deleted this message') : conversation.lastMessage?.text || 'No messages yet'}</span></span>
    <span className="flex w-12 shrink-0 flex-col items-end gap-1"><span className="text-[10px] text-secondary-label">{formatChatTime(conversation.lastMessage?.createdAt)}</span>{conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-label px-1 text-[10px] text-primary-background">{conversation.unreadCount}</span>}</span>
  </button>;
}

function GroupRequests({ apiUrl, onBack }) {
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/api/groups/requests`, { credentials: 'include' });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || 'Could not load group requests.');
    setRequests(Array.isArray(value.requests) ? value.requests : []);
  }, [apiUrl]);
  useEffect(() => { load().catch((error) => setNotice(error.message)); }, [load]);
  const respond = async (request, action) => {
    const response = await fetch(`${apiUrl}/api/groups/${request.groupId}/request`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(value.error || 'Could not update request.');
    setRequests((current) => current.filter((item) => item.groupId !== request.groupId));
  };
  return <div className="flex h-full min-w-0 flex-col"><header className="flex items-center gap-3 border-b border-border p-4"><button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-shading" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button><Users className="h-5 w-5" /><h3 className="font-semibold">Group requests</h3></header><div className="flex-1 space-y-3 overflow-y-auto p-4">{requests.length ? requests.map((request) => <div key={request.groupId} className="flex items-center gap-3 rounded-2xl bg-shading p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight">{request.avatarUrl ? <img src={request.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{request.groupName}</p><p className="text-xs text-secondary-label">You were invited to join this group</p></div><button onClick={() => respond(request, 'decline')} className="rounded-lg px-2 py-1 text-xs text-secondary-label">Decline</button><button onClick={() => respond(request, 'accept')} className="rounded-lg bg-primary-label px-3 py-1 text-xs font-semibold text-primary-background">Accept</button></div>) : <p className="py-10 text-center text-sm text-secondary-label">No group requests.</p>}{notice && <p className="text-sm text-red-400">{notice}</p>}</div></div>;
}

function GroupSettings({ group, user, apiUrl, onBack, onUpdated }) {
  const [data, setData] = useState(group || {}); const [friends, setFriends] = useState([]); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const [avatarFile, setAvatarFile] = useState(null); const [avatarPreview, setAvatarPreview] = useState(''); const [pendingGroupAction, setPendingGroupAction] = useState(null);
  const isAdmin = data.adminId === user?.id || data.createdById === user?.id;
  useEffect(() => { fetch(`${apiUrl}/api/groups/${group.id}`, { credentials: 'include' }).then((res) => res.json()).then((value) => setData(value.group || group)).catch(() => {}); fetch(`${apiUrl}/api/friends`, { credentials: 'include' }).then((res) => res.json()).then((value) => setFriends(value.friends || [])).catch(() => {}); }, [group.id]);
  const update = async (changes) => { setSaving(true); setNotice(''); try { const res = await fetch(`${apiUrl}/api/groups/${group.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }); const value = await res.json().catch(() => ({})); if (!res.ok) throw new Error(value.error || 'Could not update group.'); setData(value.group); onUpdated(value.group); setNotice('Group updated.'); } catch (error) { setNotice(error.message); } finally { setSaving(false); } };
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);
  const selectAvatar = (event) => { const file = event.target.files?.[0]; if (!file) return; if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) { setNotice('Choose a JPG, PNG, WEBP, or GIF image.'); return; } setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); };
  const uploadAvatar = async () => { if (!avatarFile) return; setSaving(true); setNotice(''); try { const body = new FormData(); body.append('avatar', avatarFile); const res = await fetch(`${apiUrl}/api/groups/${group.id}/avatar`, { method: 'POST', credentials: 'include', body }); const value = await res.json().catch(() => ({})); if (!res.ok) throw new Error(value.error || 'Could not upload group image.'); setData(value.group); onUpdated(value.group); setAvatarFile(null); setAvatarPreview(''); setNotice('Group image updated.'); } catch (error) { setNotice(error.message); } finally { setSaving(false); } };
  const removeMember = async (memberId) => { setPendingGroupAction({ type: 'remove', memberId }); };
  const confirmGroupAction = async () => { const action = pendingGroupAction; setPendingGroupAction(null); if (!action) return; const endpoint = action.type === 'remove' ? `${apiUrl}/api/groups/${group.id}/members/${action.memberId}` : `${apiUrl}/api/groups/${group.id}`; const res = await fetch(endpoint, { method: 'DELETE', credentials: 'include' }); const value = await res.json().catch(() => ({})); if (!res.ok) return setNotice(value.error || 'Could not complete group action.'); if (action.type === 'delete') return onBack(); setData(value.group); onUpdated(value.group); };
  const deleteGroup = async () => { setPendingGroupAction({ type: 'delete' }); };
  const invite = async (friend) => { const res = await fetch(`${apiUrl}/api/groups/${group.id}/invite`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: friend.id }) }); if (res.ok) { const value = await res.json(); setData(value.group); onUpdated(value.group); setFriends((current) => current.filter((item) => item.id !== friend.id)); } else { const value = await res.json().catch(() => ({})); setNotice(value.error || 'Could not invite friend.'); } };
  return <div className="flex h-full min-w-0 flex-col"><header className="flex items-center gap-3 border-b border-border p-4"><button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-shading" aria-label="Back to group chat"><ArrowLeft className="h-4 w-4" /></button><h3 className="font-semibold">Group settings</h3></header><div className="flex-1 space-y-4 overflow-y-auto p-4"><div className="flex items-center gap-3"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-highlight">{avatarPreview || data.avatarUrl ? <img src={avatarPreview || data.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users className="h-7 w-7" />}</div><div className="min-w-0 flex-1"><input disabled={!isAdmin && !data.membersCanEdit} value={data.name || ''} onChange={(event) => setData((current) => ({ ...current, name: event.target.value }))} onBlur={() => update({ name: data.name })} className="w-full bg-transparent text-lg font-semibold outline-none" /><div className="mt-2 flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg bg-shading px-3 py-2 text-xs font-semibold">Choose group picture<input disabled={!isAdmin && !data.membersCanEdit} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAvatar} className="sr-only" /></label>{avatarFile && <button type="button" disabled={saving} onClick={uploadAvatar} className="rounded-lg bg-primary-label px-3 py-2 text-xs font-semibold text-primary-background">{saving ? 'Uploading...' : 'Save picture'}</button>}</div></div></div>{isAdmin && <div className="space-y-2 rounded-2xl bg-shading/60 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-secondary-label">Admin controls</p><label className="flex items-center justify-between text-sm">Messaging open<SettingToggle checked={data.messagingOpen !== false} onChange={(checked) => update({ messagingOpen: checked })} label="Messaging open" /></label><label className="flex items-center justify-between text-sm">Members can edit group<SettingToggle checked={Boolean(data.membersCanEdit)} onChange={(checked) => update({ membersCanEdit: checked })} label="Members can edit group" /></label><label className="flex items-center justify-between text-sm">Members can invite<SettingToggle checked={Boolean(data.membersCanInvite)} onChange={(checked) => update({ membersCanInvite: checked })} label="Members can invite" /></label></div>}<div>{isAdmin && <div className="mb-4 space-y-2"><h4 className="text-sm font-semibold">Members</h4>{(data.participantIds || []).filter((id) => id !== user?.id).map((id) => <div key={id} className="flex items-center justify-between rounded-xl bg-shading/60 p-2 text-sm"><span className="truncate">{data.participants?.find((member) => member.id === id)?.name || friends.find((member) => member.id === id)?.name || id}</span><button type="button" onClick={() => removeMember(id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10">Remove</button></div>)}</div>}</div><div><h4 className="mb-2 text-sm font-semibold">Invite friends</h4><div className="space-y-2">{friends.filter((friend) => !(data.participantIds || []).includes(friend.id)).map((friend) => <div key={friend.id} className="flex items-center justify-between rounded-xl bg-shading/60 p-2 text-sm"><span className="truncate">{friend.name}</span><button disabled={saving} onClick={() => invite(friend)} className="rounded-lg bg-primary-label px-3 py-1 text-xs font-semibold text-primary-background">Invite</button></div>)}</div></div><button type="button" onClick={deleteGroup} className="mx-auto block rounded-lg px-3 py-2 text-center text-xs font-semibold text-red-500 hover:bg-red-500/10">Delete group</button>{notice && <p className="text-sm text-secondary-label">{notice}</p>}<ConfirmModal isOpen={Boolean(pendingGroupAction)} onClose={() => setPendingGroupAction(null)} onConfirm={confirmGroupAction} title={pendingGroupAction?.type === "delete" ? "Delete group?" : "Remove member?"} message={pendingGroupAction?.type === "delete" ? "This group and its messages will be removed for every participant." : "This member will lose access to the group chat."} confirmText={pendingGroupAction?.type === "delete" ? "Delete group" : "Remove member"} /></div></div>;
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
  const [groupOpen, setGroupOpen] = useState(false); const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [messageMenu, setMessageMenu] = useState(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null);
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupRemoved, setGroupRemoved] = useState(false);
  const [privacy, setPrivacy] = useState({ lastSeen: true, online: true, readReceipts: true });
  const [menuConversation, setMenuConversation] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const handledTargetId = useRef(null);

  useEffect(() => {
    if (!deleteFeedback) return undefined;
    const timer = window.setTimeout(() => setDeleteFeedback(''), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteFeedback]);

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
    if (!isOpen || !startConversationWith?.id || startConversationWith.id === user?.id || handledTargetId.current === startConversationWith.id) return;
    const target = normalizeUser(startConversationWith);
    if (!target) return;
    handledTargetId.current = target.id;
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
    } catch (err) { if (!silent) setMessages([]); if (conversation.type === 'group' && err.message === 'Group not found.') setGroupRemoved(true); setError(conversation.type === 'group' && err.message === 'Group not found.' ? 'You were removed from this group by the admin.' : (err.message || 'Could not load conversation.')); }
    finally { if (!silent) setLoading(false); }
  }, []);

  const openConversation = (conversation) => {
    setChatMenuOpen(false);
    setGroupSettingsOpen(false);
    setConversations((current) => current.map((item) => (
      item.type === conversation.type &&
      (item.type === 'group' ? item.group?.id === conversation.group?.id : item.partner?.id === conversation.partner?.id)
        ? { ...item, unreadCount: 0 }
        : item
    )));
    setActive({ ...conversation, unreadCount: 0 });
    setGroupRemoved(false);
    setMessages([]);
    loadMessages(conversation);
  };

  useEffect(() => {
    if (!isOpen || !active) return undefined;
    const timer = window.setInterval(() => loadMessages(active, { silent: true }), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, active, loadMessages]);

  const send = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !active || sending || groupRemoved) return;
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
    if (action === 'delete') { setPendingDeleteMessage(message); return; }
    const endpoint = action === 'pin' ? 'pin' : 'star';
    const response = await authFetch(`${apiUrl}/api/messages/${message.id}/${endpoint}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'pin' ? { pinned: !message.pinned } : {}) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.message) setMessages((current) => current.map((item) => item.id === message.id ? normalizeMessage(data.message) : item));
  };
  const confirmDeleteMessage = async () => {
    if (!pendingDeleteMessage) return;
    try {
      const response = await authFetch(`${apiUrl}/api/messages/${pendingDeleteMessage.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: pendingDeleteMessage.senderId === user.id ? 'everyone' : 'me' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not delete message.');
      const deletedMessage = normalizeMessage(data.message);
      setMessages((current) => current.map((item) => item.id === pendingDeleteMessage.id ? (deletedMessage || { ...item, deleted: true, deletedBy: user.id, text: '' }) : item));
      setDeleteFeedback('Message deleted successfully.');
    } catch (error) { setDeleteFeedback(error.message || 'Could not delete message.'); }
    setPendingDeleteMessage(null);
  };

  const visible = useMemo(() => conversations.filter((item) => (tab === 'requests' ? item.isRequest : !item.isRequest) && `${item.partner?.name || item.group?.name || ''} ${item.partner?.username || ''}`.toLowerCase().includes(search.toLowerCase())), [conversations, tab, search]);
  const openChatMenu = () => { setMenuConversation(active); setActive(null); setMessages([]); setReplyingTo(null); setMessageMenu(null); setChatMenuOpen(true); };
  const openStarredMessage = (messageId) => { if (!menuConversation) return; setChatMenuOpen(false); setActive(menuConversation); setMessages([]); loadMessages(menuConversation).then(() => setHighlightedMessageId(messageId)); };
  if (!isOpen) return null;
  const activeGroupMembers = active?.type === 'group' ? (active.group.participants || []).filter((member) => member.isOnline) : [];
  const activeName = active?.type === 'group' ? active.group.name : active?.partner ? `${active.partner.name}${active.partner.isOnline ? ' · Active now' : active.partner.lastSeenAt ? ` · Last seen ${formatChatTime(active.partner.lastSeenAt)}` : ''}` : '';
  const activeGroupStatus = activeGroupMembers.length === 1 ? `${activeGroupMembers[0].name} is active` : activeGroupMembers.length > 1 ? `${activeGroupMembers[0].name} and ${activeGroupMembers.length - 1} other${activeGroupMembers.length - 1 === 1 ? '' : 's'} are active` : 'No members active';

  return <div className="fixed inset-0 z-[80] flex bg-primary-background/80 p-0 backdrop-blur-xl sm:items-center sm:justify-center sm:p-5" onClick={onToggle}>
    <div className="panel-bg flex h-full min-w-0 w-full overflow-hidden border-border sm:h-[min(42rem,90vh)] sm:max-w-4xl sm:rounded-3xl sm:border sm:shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-border md:w-80`}>
        <header className="flex items-center gap-3 border-b border-border p-4"><button onClick={onToggle} className="grid h-9 w-9 place-items-center rounded-xl bg-shading md:hidden" aria-label="Close inbox"><ArrowLeft className="h-4 w-4" /></button><h2 className="text-lg font-bold">Inbox</h2><button onClick={() => setCreateChoiceOpen((value) => !value)} className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-shading transition-colors hover:bg-highlight" aria-label="Create or message" title="Create or message"><Plus className="h-4 w-4" /></button><button onClick={openChatMenu} className="hidden h-9 w-9 place-items-center rounded-xl bg-shading md:grid" aria-label="Open group requests"><Users className="h-4 w-4" /></button></header>{createChoiceOpen && <div className="absolute right-3 top-12 z-30 w-48 rounded-2xl border border-border panel-bg p-1.5 shadow-xl"><button type="button" onClick={() => { setCreateChoiceOpen(false); openGroupCreator(); }} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-xs hover:bg-highlight"><Users className="h-4 w-4" />Create group chat</button><button type="button" onClick={() => { setCreateChoiceOpen(false); setSearch(""); setTab("inbox"); }} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-xs hover:bg-highlight"><MessageCircle className="h-4 w-4" />Message a new user</button></div>}
        {groupOpen && <form onSubmit={createGroup} className="border-b border-border bg-shading/50 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">New group chat</h3><button type="button" onClick={() => setGroupOpen(false)} aria-label="Close group creator"><X className="h-4 w-4" /></button></div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" maxLength={60} className="mb-2 w-full rounded-xl bg-primary-background px-3 py-2 text-sm outline-none" /><div className="max-h-40 space-y-1 overflow-y-auto">{friends.length ? friends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-highlight/60"><input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={() => setSelectedFriends((current) => current.includes(friend.id) ? current.filter((id) => id !== friend.id) : [...current, friend.id])} /><span className="truncate">{friend.name}</span><span className="ml-auto truncate text-xs text-secondary-label">@{friend.username}</span></label>) : <p className="py-3 text-xs text-secondary-label">Only mutual followers can be added. No friends available yet.</p>}</div><button disabled={!selectedFriends.length || creatingGroup} className="mt-3 w-full rounded-xl bg-primary-label py-2 text-xs font-semibold text-primary-background disabled:opacity-40">{creatingGroup ? 'Creating...' : 'Create group'}</button></form>}
        <div className="flex gap-2 p-3"><button onClick={() => setTab('inbox')} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === 'inbox' ? 'bg-primary-label text-primary-background' : 'bg-shading'}`}>Inbox {conversations.filter((item) => !item.isRequest && item.unreadCount > 0).length > 0 && <span className="ml-1">{conversations.filter((item) => !item.isRequest && item.unreadCount > 0).length}</span>}</button><button onClick={() => setTab('requests')} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === 'requests' ? 'bg-primary-label text-primary-background' : 'bg-shading'}`}><UserPlus className="mr-1 inline h-3.5 w-3.5" />Requests {conversations.filter((item) => item.isRequest && item.unreadCount > 0).length > 0 && <span className="ml-1">{conversations.filter((item) => item.isRequest && item.unreadCount > 0).length}</span>}</button></div>
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-shading px-3 py-2"><Search className="h-4 w-4 text-secondary-label" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div className="flex-1 overflow-y-auto p-2">{visible.length ? visible.map((item) => <ConversationRow key={`${item.type}-${item.partner?.id || item.group?.id}`} conversation={item} active={active === item} onClick={() => openConversation(item)} />) : <div className="p-8 text-center text-sm text-secondary-label">No conversations yet.</div>}</div>
      </aside>
      <section className={`${active || chatMenuOpen ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
{groupSettingsOpen && active?.type === 'group' ? <GroupSettings group={active.group} user={user} apiUrl={apiUrl} onBack={() => setGroupSettingsOpen(false)} onUpdated={(next) => { setActive((current) => ({ ...current, group: { ...current.group, ...next } })); setConversations((current) => current.map((item) => item.group?.id === next.id ? { ...item, group: { ...item.group, ...next } } : item)); }} /> : chatMenuOpen ? <GroupRequests apiUrl={apiUrl} onBack={() => setChatMenuOpen(false)} /> : active ? <><header className="flex items-center gap-3 border-b border-border p-4"><button onClick={() => setActive(null)} className="grid h-9 w-9 place-items-center rounded-xl bg-shading md:hidden" aria-label="Back to inbox"><ArrowLeft className="h-4 w-4" /></button>{active.type === 'group' ? (active.group?.avatarUrl ? <img src={active.group.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <MessageCircle className="h-8 w-8 rounded-full bg-highlight p-2" />) : avatar(active.partner, 'h-9 w-9')}<button type="button" onClick={() => active?.type === 'group' && setGroupSettingsOpen(true)} className="min-w-0 truncate text-left font-semibold">{activeName}</button></header><div className="flex-1 space-y-2 overflow-y-auto p-4">{active.type === 'dm' && active.partner && <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-border bg-shading/60 p-3"><div className="shrink-0">{avatar(active.partner, 'h-12 w-12')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-primary-label">{active.partner.name}</p><p className="truncate text-xs text-secondary-label">@{active.partner.username}</p><div className="mt-1 flex gap-3 text-[11px] text-secondary-label"><span><strong className="text-primary-label">{active.partner.followerCount || active.partner.followersCount || 0}</strong> followers</span><span><strong className="text-primary-label">{active.partner.previewCount || active.partner.postsCount || 0}</strong> previews</span></div></div><Link to={`/profile/${active.partner.id}`} onClick={onToggle} className="shrink-0 rounded-xl bg-primary-label px-3 py-2 text-xs font-semibold text-primary-background transition hover:opacity-85">View profile</Link></div>}{active.type === 'group' && <div className="mx-4 mt-4 rounded-2xl border border-border bg-shading/60 px-4 py-3"><p className="text-sm font-semibold">{active.group.name}</p><p className="mt-1 text-xs text-secondary-label">{activeGroupStatus}</p></div>}{loading && <p className="text-center text-sm text-secondary-label">Loading messages...</p>}{!loading && !messages.length && <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-shading/60 px-5 py-4 text-center"><p className="text-sm font-semibold text-primary-label">Welcome to your conversation</p><p className="mt-1 text-xs text-secondary-label">Start chatting with {activeName || 'this group'}.</p></div>}{messages.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(a.createdAt) - new Date(b.createdAt)).map((message) => <div key={message.id} className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`} onMouseLeave={() => setMessageMenu(null)}><div onClick={(event) => { if (!message.deleted && !event.target.closest('button')) setReplyingTo(message); }} className={`group relative min-w-0 max-w-[78%] rounded-2xl px-3.5 py-2 pr-10 text-sm ${replyingTo?.id === message.id ? 'ring-2 ring-[#718A78] ring-offset-2 ring-offset-primary-background' : ''} ${message.senderId === user.id ? 'rounded-br-sm bg-primary-label text-primary-background' : 'rounded-bl-sm bg-shading text-primary-label'}`}>{active.type === 'group' && message.sender && <div className="mb-1 text-[11px] font-bold opacity-70">{message.senderId === user.id ? 'You' : message.sender.name}</div>}{(message.storyId || message.messageKind === 'story_reply') && <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-primary-background/20"><div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] opacity-75"><span>↳ Story reply</span></div><div onClick={() => message.storyId && onOpenStory?.(message.storyId)} className="h-20 w-full cursor-pointer bg-shading">{message.storyPreview?.coverArt ? <img src={message.storyPreview.coverArt} alt="Replied story" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs opacity-60">Story preview</div>}</div></div>}{message.replyTo && <div className="mb-2 rounded-lg border-l-2 border-current/30 pl-2 text-xs opacity-70"><span className="block font-semibold">{message.replyTo.senderId === user.id ? 'You' : 'Reply'}</span><span className="block truncate">{message.replyTo.deleted ? 'Deleted message' : message.replyTo.text || 'Message'}</span></div>}{message.deleted ? <i className="inline-flex items-center gap-1 opacity-70"><Ban className="h-3.5 w-3.5" />{message.deletedBy === user.id ? 'You deleted this message' : 'This message was deleted'}</i> : message.text}<span className="ml-2 text-[10px] opacity-60">{formatChatTime(message.createdAt)}</span><button type="button" onClick={() => setMessageMenu(messageMenu === message.id ? null : message.id)} className={`${message.deleted ? 'hidden ' : ''}absolute right-1 bottom-1 top-auto grid h-6 w-6 place-items-center rounded-lg translate-x-2 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 hover:bg-[#34483B]/20 ${message.senderId === user.id ? 'text-[#F3EBDD]' : 'text-[#34483B]'}`} aria-label="Message actions"><MoreHorizontal className="h-4 w-4" /></button>{messageMenu === message.id && <div className="absolute right-0 top-8 z-20 max-h-64 w-40 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border panel-bg p-1 text-primary-label shadow-xl"><button onClick={() => messageAction('reply', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Reply className="h-3.5 w-3.5" />Reply</button><button onClick={() => messageAction('copy', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Copy className="h-3.5 w-3.5" />Copy</button><button onClick={() => messageAction('star', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-highlight"><Star className="h-3.5 w-3.5" />Star</button>{!message.deleted && <button onClick={() => messageAction('delete', message)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete</button>}</div>}</div>{message.senderId === user.id && message.id === messages.slice().reverse().find((item) => item.senderId === user.id)?.id && <span className="mt-1 block text-right text-[10px] font-medium text-[#34483B]">{message.seenAt ? formatSeen(message.seenAt) : formatSeen(message.createdAt, 'Sent')}</span>}</div>)}</div>{replyingTo && <div className="flex items-center justify-between border-t border-border bg-shading/50 px-4 py-2 text-xs"><span className="min-w-0 truncate">Replying to {replyingTo.sender?.name || 'message'}: {replyingTo.deleted ? 'Deleted message' : replyingTo.text || 'Message'}</span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}{error && <p className="px-4 py-2 text-xs text-red-300">{error}</p>}{groupRemoved && <p className="border-t border-border bg-shading/60 px-4 py-3 text-center text-xs font-semibold text-secondary-label">You were removed from this group by the admin.</p>}<form onSubmit={send} className="relative flex gap-2 border-t border-border p-3"><button type="button" onClick={() => setEmojiOpen((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shading text-lg" aria-label="Open emoji picker">☺</button>{emojiOpen && <div className="absolute bottom-16 left-3 z-20 max-w-[calc(100vw-1.5rem)]"><EmojiPicker theme="dark" previewConfig={{ showPreview: false }} onEmojiClick={(emoji) => { setText((value) => `${value}${emoji.emoji}`); setEmojiOpen(false); }} width="min(300px, calc(100vw - 24px))" height="min(320px, 45vh)" /></div>}<input value={text} onChange={(event) => setText(event.target.value)} placeholder={`Message ${activeName || 'user'}...`} className="min-w-0 flex-1 rounded-xl bg-shading px-3 py-2 text-sm outline-none" /><button disabled={sending || !text.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></form></> : <div className="m-auto hidden text-center text-secondary-label md:block"><Inbox className="mx-auto mb-3 h-10 w-10 opacity-40" /><p>Select a conversation</p></div>}
      </section>
      {deleteFeedback && <div role="status" className="fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 rounded-xl bg-[#F3EBDD]/95 px-4 py-2 text-sm font-semibold text-[#34483B] shadow-xl">{deleteFeedback}</div>}
      <ConfirmModal isOpen={Boolean(pendingDeleteMessage)} onClose={() => setPendingDeleteMessage(null)} onConfirm={confirmDeleteMessage} title="Delete message?" message="This message will be replaced with a deleted-message notice for both people." confirmText="Delete message" />
    </div>
  </div>;
}

