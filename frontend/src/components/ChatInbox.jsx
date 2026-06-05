import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, Copy, Forward, MessageCircle, Mic, MicOff, MonitorUp, Paperclip, PhoneOff, Pin, PinOff, Reply, Send, Smile, Trash2, Users, Video, VideoOff, Volume2, X } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const emojis = ['😀', '😂', '😍', '🥹', '🔥', '🙏', '❤️', '🎧', '🎵', '✅', '😭', '😤', '🤝', '✨', '💿', '🚀'];

function ProfileAvatar({ user, size = 'h-10 w-10', isGroup = false }) {
  if (isGroup) {
    return (
      <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)] text-black shadow`}>
        <Users className="h-4 w-4" />
      </div>
    );
  }
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover shadow`} />;
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-xs font-bold text-black shadow`}>
      {user?.name?.slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

function MessageTicks({ message }) {
  if (!message.delivery?.delivered) return null;
  return (
    <CheckCheck className={`h-3.5 w-3.5 ${message.delivery.read ? 'text-green-400' : 'text-secondary-label/70'}`} />
  );
}

function ConvoItem({ convo, isActive, onClick }) {
  const isGroup = convo.type === 'group';
  const name = isGroup ? 'Group Chat' : convo.partner?.name || 'Unknown';
  const lastText = convo.lastMessage?.deleted
    ? 'Message deleted'
    : convo.lastMessage?.text || (convo.lastMessage?.attachments?.length ? 'Media message' : null);
  const lastSender = convo.lastMessage?.sender?.name || null;
  const time = convo.updatedAt ? new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const hasUnread = (convo.unreadCount || 0) > 0;

  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-highlight' : hasUnread ? 'bg-primary-label/10 hover:bg-primary-label/15' : 'hover:bg-shading'}`}>
      <ProfileAvatar user={convo.partner} isGroup={isGroup} size="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm text-primary-label ${hasUnread ? 'font-extrabold' : 'font-semibold'}`}>{name}</span>
          {time && <span className="shrink-0 text-[11px] text-secondary-label">{time}</span>}
        </div>
        {lastText ? (
          <p className="mt-0.5 truncate text-xs text-secondary-label">{isGroup && lastSender ? `${lastSender}: ` : ''}{lastText}</p>
        ) : (
          <p className="mt-0.5 text-xs italic text-secondary-label/50">No messages yet</p>
        )}
      </div>
      {hasUnread && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-green-400 px-1.5 text-[10px] font-bold text-black">{convo.unreadCount}</span>}
    </button>
  );
}

function GroupStreamPanel({ currentUser, participants }) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [participantVolumes, setParticipantVolumes] = useState({});
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const setLocalStream = (stream) => {
    stopStream();
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  };

  const joinVoice = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setLocalStream(stream);
    setJoined(true);
    setMicOn(true);
  };

  const toggleMic = async () => {
    if (!joined) return joinVoice();
    const audioTracks = streamRef.current?.getAudioTracks() || [];
    audioTracks.forEach((track) => { track.enabled = !micOn; });
    setMicOn((value) => !value);
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      stopStream();
      setCameraOn(false);
      setScreenOn(false);
      if (micOn) await joinVoice();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setLocalStream(stream);
    setJoined(true);
    setMicOn(true);
    setCameraOn(true);
    setScreenOn(false);
  };

  const shareScreen = async () => {
    if (screenOn) {
      stopStream();
      setScreenOn(false);
      if (micOn) await joinVoice();
      return;
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    setLocalStream(stream);
    setJoined(true);
    setScreenOn(true);
    setCameraOn(false);
    stream.getVideoTracks()[0]?.addEventListener('ended', () => setScreenOn(false));
  };

  const leave = () => {
    stopStream();
    setJoined(false);
    setMicOn(false);
    setCameraOn(false);
    setScreenOn(false);
  };

  return (
    <div className="border-b border-border bg-[#111111] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Group voice channel</p>
          <p className="text-[11px] text-secondary-label">{joined ? 'Connected locally' : 'Join voice, camera, or screen share'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleMic} className={`grid h-9 w-9 place-items-center rounded-xl ${micOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Toggle mic">
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button onClick={toggleCamera} className={`grid h-9 w-9 place-items-center rounded-xl ${cameraOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Toggle camera">
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
          <button onClick={shareScreen} className={`grid h-9 w-9 place-items-center rounded-xl ${screenOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Share screen">
            <MonitorUp className="h-4 w-4" />
          </button>
          <button onClick={leave} className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/20 text-red-300" aria-label="Leave call">
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(cameraOn || screenOn) && (
        <video ref={videoRef} autoPlay muted playsInline className="mb-3 aspect-video w-full rounded-xl bg-black object-cover" />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {participants.filter((participant) => participant.id !== currentUser.id).map((participant) => (
          <div key={participant.id} className="flex items-center gap-3 rounded-xl bg-shading px-3 py-2">
            <ProfileAvatar user={participant} size="h-8 w-8" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{participant.name}</span>
            <Volume2 className="h-4 w-4 text-secondary-label" />
            <input
              type="range"
              min="0"
              max="100"
              value={participantVolumes[participant.id] ?? 80}
              onChange={(event) => setParticipantVolumes((prev) => ({ ...prev, [participant.id]: event.target.value }))}
              className="w-20 accent-white"
              aria-label={`Volume for ${participant.name}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaPreview({ attachment }) {
  if (attachment.type === 'image') return <img src={attachment.url} alt="" className="mt-2 max-h-64 w-full rounded-xl object-cover" />;
  if (attachment.type === 'video') return <video src={attachment.url} controls className="mt-2 max-h-64 w-full rounded-xl" />;
  if (attachment.type === 'voice') return <audio src={attachment.url} controls className="mt-2 w-full" />;
  return null;
}

function MessageActions({ message, onReply, onCopy, onForward, onPin, onDelete }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 hidden min-w-44 rounded-2xl border border-border bg-[#191919] p-2 shadow-2xl group-hover:block">
      <button onClick={() => onReply(message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Reply className="h-4 w-4" /> Reply</button>
      <button onClick={() => onCopy(message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Copy className="h-4 w-4" /> Copy</button>
      <button onClick={() => onForward(message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Forward className="h-4 w-4" /> Forward</button>
      <button onClick={() => onPin(message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight">
        {message.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        {message.pinned ? 'Unpin' : 'Pin'}
      </button>
      <button onClick={() => onDelete(message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
    </div>
  );
}

function ChatWindow({ convo, currentUser, conversations, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isGroup = convo.type === 'group';
  const chatName = isGroup ? 'Group Chat' : convo.partner?.name || 'Unknown';
  const participants = convo.participants || [];

  const fetchMessages = useCallback(async () => {
    try {
      const url = isGroup
        ? `${apiUrl}/api/messages?type=group&userId=${currentUser.id}`
        : `${apiUrl}/api/messages?type=dm&userId=${currentUser.id}&partnerId=${convo.partner.id}`;
      const res = await fetch(url);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoading(false);
    }
  }, [isGroup, currentUser.id, convo.partner]);

  useEffect(() => {
    const firstLoad = window.setTimeout(fetchMessages, 0);
    const poll = window.setInterval(fetchMessages, 3000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(poll);
    };
  }, [fetchMessages]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);
  useEffect(() => inputRef.current?.focus(), [convo]);

  const pinned = useMemo(() => messages.find((message) => message.pinned && !message.deleted), [messages]);

  const sendPayload = async (payload) => {
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: isGroup ? null : convo.partner.id,
          conversationType: isGroup ? 'group' : 'dm',
          replyToMessageId: replyTo?.id || null,
          ...payload
        })
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    await sendPayload({ text: trimmed });
  };

  const sendMedia = async (file, mediaKind = '') => {
    if (!file) return;
    const formData = new FormData();
    formData.append('media', file);
    formData.append('senderId', currentUser.id);
    formData.append('recipientId', isGroup ? '' : convo.partner.id);
    formData.append('conversationType', isGroup ? 'group' : 'dm');
    formData.append('text', text.trim());
    formData.append('mediaKind', mediaKind);
    if (replyTo?.id) formData.append('replyToMessageId', replyTo.id);
    setText('');
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/messages/media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
      setReplyTo(null);
    } catch (err) {
      console.error('Media send failed', err);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      sendMedia(new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }), 'voice');
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => recorderRef.current?.stop();

  const handlePin = async (message) => {
    const res = await fetch(`${apiUrl}/api/messages/${message.id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, pinned: !message.pinned })
    });
    if (res.ok) fetchMessages();
  };

  const handleDelete = async (message) => {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`${apiUrl}/api/messages/${message.id}?userId=${currentUser.id}`, { method: 'DELETE' });
    if (res.ok) fetchMessages();
  };

  const handleForward = async (target) => {
    if (!forwarding) return;
    await fetch(`${apiUrl}/api/messages/${forwarding.id}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUser.id,
        targetType: target.type,
        recipientId: target.type === 'dm' ? target.partner.id : null
      })
    });
    setForwarding(null);
  };

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const grouped = [];
  let lastDate = null;
  for (const msg of sorted) {
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (dateStr !== lastDate) {
      grouped.push({ type: 'divider', label: dateStr });
      lastDate = dateStr;
    }
    grouped.push({ type: 'message', msg });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Back to projects">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ProfileAvatar user={convo.partner} isGroup={isGroup} size="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary-label">{chatName}</p>
          {isGroup && <p className="truncate text-[11px] text-secondary-label">etrange · sholabomii · aderoju · quarter21</p>}
        </div>
      </div>

      {isGroup && <GroupStreamPanel currentUser={currentUser} participants={participants} />}

      {pinned && (
        <button onClick={() => setReplyTo(pinned)} className="flex shrink-0 items-center gap-3 border-b border-border bg-shading px-4 py-2 text-left text-xs">
          <Pin className="h-4 w-4" />
          <span className="min-w-0 truncate">{pinned.text || pinned.attachments?.[0]?.name || 'Pinned media'}</span>
        </button>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4 sm:px-5">
        {loading && <div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary-label border-t-transparent" /></div>}
        {!loading && grouped.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-secondary-label">
            <MessageCircle className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No messages yet.</p>
          </div>
        )}
        {grouped.map((item, i) => {
          if (item.type === 'divider') {
            return <div key={`divider-${i}`} className="flex items-center gap-3 py-2"><div className="h-px flex-1 bg-border" /><span className="text-[10px] uppercase tracking-widest text-secondary-label/60">{item.label}</span><div className="h-px flex-1 bg-border" /></div>;
          }
          const { msg } = item;
          const isMine = msg.senderId === currentUser.id;
          const showSender = isGroup && !isMine;

          return (
            <div key={msg.id} className={`group relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && <ProfileAvatar user={msg.sender} size="h-6 w-6" />}
              <div className={`flex max-w-[78%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {showSender && <span className="mb-0.5 ml-1 text-[10px] font-semibold text-secondary-label">{msg.sender?.name}</span>}
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isMine ? 'rounded-br-sm bg-primary-label text-primary-background' : 'rounded-bl-sm bg-shading text-primary-label'}`}>
                  {msg.forwardedFrom && <p className="mb-1 text-[10px] opacity-60">Forwarded</p>}
                  {msg.replyTo && <div className="mb-2 rounded-lg bg-black/10 px-2 py-1 text-xs opacity-70">{msg.replyTo.text || 'Media message'}</div>}
                  {msg.deleted ? <span className="italic opacity-60">Message deleted</span> : <>{msg.text}{msg.attachments?.map((attachment) => <MediaPreview key={attachment.id} attachment={attachment} />)}</>}
                </div>
                <span className="mx-1 mt-0.5 inline-flex items-center gap-1 text-[10px] text-secondary-label/60">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && <MessageTicks message={msg} />}
                </span>
              </div>
              <MessageActions
                message={msg}
                onReply={setReplyTo}
                onCopy={(message) => navigator.clipboard?.writeText(message.text || '')}
                onForward={setForwarding}
                onPin={handlePin}
                onDelete={handleDelete}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {forwarding && (
        <div className="border-t border-border bg-[#191919] px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Forward to</span><button onClick={() => setForwarding(null)}><X className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {conversations.map((target) => (
              <button key={target.type === 'group' ? 'group' : target.partner.id} onClick={() => handleForward(target)} className="truncate rounded-xl bg-shading px-3 py-2 text-left text-xs hover:bg-highlight">
                {target.type === 'group' ? 'Group Chat' : target.partner.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-shading px-3 py-2 text-xs">
            <span className="truncate">Replying to: {replyTo.text || 'Media message'}</span>
            <button onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
          </div>
        )}
        {emojiOpen && (
          <div className="mb-2 grid grid-cols-8 gap-1 rounded-2xl bg-shading p-2">
            {emojis.map((emoji) => <button key={emoji} onClick={() => setText((value) => `${value}${emoji}`)} className="rounded-lg p-1 text-xl hover:bg-highlight">{emoji}</button>)}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-2xl bg-shading px-3 py-2">
          <button onClick={() => setEmojiOpen((open) => !open)} aria-label="Emoji"><Smile className="h-5 w-5" /></button>
          <button onClick={() => mediaInputRef.current?.click()} aria-label="Attach photo or video"><Paperclip className="h-5 w-5" /></button>
          <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => sendMedia(event.target.files?.[0])} />
          <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Message ${chatName}...`} rows={1} className="max-h-24 flex-1 resize-none bg-transparent text-sm text-primary-label outline-none placeholder:text-secondary-label/50" />
          <button onClick={recording ? stopRecording : startRecording} className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${recording ? 'bg-red-500 text-white' : 'bg-highlight'}`} aria-label="Record voice note"><Mic className="h-4 w-4" /></button>
          <button onClick={send} disabled={!text.trim() || sending} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background transition-opacity disabled:opacity-30" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-secondary-label/40">Photos, videos, voice notes, emoji, reply, forward, pin, copy</p>
      </div>
    </div>
  );
}

export default function ChatInbox({ user, isOpen, onToggle }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);

  const fetchConvos = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/conversations?userId=${user.id}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoadingConvos(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (!isOpen) return;
    const firstLoad = window.setTimeout(fetchConvos, 0);
    const interval = window.setInterval(fetchConvos, 5000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [isOpen, fetchConvos]);

  const handleCloseChat = () => {
    setActiveConvo(null);
    fetchConvos();
  };

  return (
    <>
      <div className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-[#161616] shadow-2xl transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ width: activeConvo ? '100vw' : 'min(22rem, 92vw)' }}>
        <div className="flex h-full overflow-hidden">
          <div className={`flex-col border-r border-border transition-all duration-300 ${activeConvo ? 'hidden sm:flex sm:w-[22rem]' : 'flex w-full'}`}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4">
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tighter text-primary-label">[untitled]</span>
                <span className="text-xs font-medium text-secondary-label">Messages</span>
              </div>
              <button onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close inbox">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {loadingConvos && <div className="flex items-center justify-center pt-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary-label border-t-transparent" /></div>}
              {!loadingConvos && conversations.map((convo) => (
                <ConvoItem
                  key={convo.type === 'group' ? 'group' : convo.partner?.id}
                  convo={convo}
                  isActive={activeConvo?.type === 'group' ? convo.type === 'group' : activeConvo?.partner?.id === convo.partner?.id}
                  onClick={() => setActiveConvo(convo)}
                />
              ))}
            </div>
          </div>
          {activeConvo && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatWindow convo={activeConvo} currentUser={user} conversations={conversations} onClose={handleCloseChat} />
            </div>
          )}
        </div>
      </div>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 sm:hidden" onClick={onToggle} />}
    </>
  );
}
