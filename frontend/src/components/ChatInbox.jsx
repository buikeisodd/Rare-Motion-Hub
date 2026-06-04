import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Send, Users, MessageCircle, X } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ProfileAvatar({ user, size = 'h-10 w-10', isGroup = false }) {
  if (isGroup) {
    return (
      <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)] text-black shadow`}>
        <Users className="h-4 w-4" />
      </div>
    );
  }
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover shadow`} />;
  }
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-xs font-bold text-black shadow`}>
      {user?.name?.slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

function ConvoItem({ convo, isActive, onClick }) {
  const isGroup = convo.type === 'group';
  const name = isGroup ? 'Group Chat' : convo.partner?.name || 'Unknown';
  const lastText = convo.lastMessage?.text || null;
  const lastSender = convo.lastMessage?.sender?.name || null;
  const time = convo.updatedAt
    ? new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isActive ? 'bg-highlight' : 'hover:bg-shading'
      }`}
    >
      <ProfileAvatar user={convo.partner} isGroup={isGroup} size="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-primary-label">{name}</span>
          {time && <span className="shrink-0 text-[11px] text-secondary-label">{time}</span>}
        </div>
        {lastText && (
          <p className="truncate text-xs text-secondary-label mt-0.5">
            {isGroup && lastSender ? `${lastSender}: ` : ''}{lastText}
          </p>
        )}
        {!lastText && (
          <p className="text-xs text-secondary-label/50 mt-0.5 italic">No messages yet</p>
        )}
      </div>
    </button>
  );
}

function ChatWindow({ convo, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  const isGroup = convo.type === 'group';
  const chatName = isGroup ? 'Group Chat' : convo.partner?.name || 'Unknown';

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
  }, [isGroup, currentUser.id, convo.partner?.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages();

    // Poll every 3s for new messages
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [convo]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: isGroup ? null : convo.partner.id,
          conversationType: isGroup ? 'group' : 'dm',
          text: trimmed
        })
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      console.error('Send failed', err);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Group messages by date
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
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight"
          aria-label="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ProfileAvatar user={convo.partner} isGroup={isGroup} size="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary-label">{chatName}</p>
          {isGroup && (
            <p className="text-[11px] text-secondary-label">etrange · sholabomii · aderoju · quarter21</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-1">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="h-5 w-5 rounded-full border-2 border-secondary-label border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && grouped.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-secondary-label">
            <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1 opacity-60">Say something first 👋</p>
          </div>
        )}
        {grouped.map((item, i) => {
          if (item.type === 'divider') {
            return (
              <div key={`divider-${i}`} className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-secondary-label/60">{item.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            );
          }
          const { msg } = item;
          const isMine = msg.senderId === currentUser.id;
          const showSender = isGroup && !isMine;

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <ProfileAvatar user={msg.sender} isGroup={false} size="h-6 w-6" />
              )}
              <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                {showSender && (
                  <span className="mb-0.5 ml-1 text-[10px] font-semibold text-secondary-label">{msg.sender?.name}</span>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isMine
                      ? 'rounded-br-sm bg-primary-label text-primary-background'
                      : 'rounded-bl-sm bg-shading text-primary-label'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-0.5 mx-1 text-[10px] text-secondary-label/50">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 rounded-2xl bg-shading px-4 py-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message ${chatName}...`}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-primary-label outline-none placeholder:text-secondary-label/50 max-h-24"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background disabled:opacity-30 transition-opacity"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-secondary-label/40">Enter to send · Shift+Enter for new line</p>
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
    fetchConvos();
    const interval = setInterval(fetchConvos, 5000);
    return () => clearInterval(interval);
  }, [isOpen, fetchConvos]);

  // When a chat is opened, refresh convos on close
  const handleCloseChat = () => {
    setActiveConvo(null);
    fetchConvos();
  };

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`fixed left-0 top-0 z-40 h-full flex flex-col bg-[#161616] border-r border-border shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: activeConvo ? '100vw' : 'min(22rem, 92vw)' }}
      >
        {/* Inner split: list + chat pane side by side when active */}
        <div className="flex h-full overflow-hidden">
          {/* Conversation list — always rendered, hidden when convo open on narrow screens */}
          <div
            className={`flex flex-col border-r border-border transition-all duration-300 ${
              activeConvo ? 'hidden sm:flex sm:w-[22rem]' : 'flex w-full'
            }`}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary-label" />
                <h2 className="text-base font-bold text-primary-label">Messages</h2>
              </div>
              <button
                onClick={onToggle}
                className="grid h-8 w-8 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight"
                aria-label="Close inbox"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2">
              {loadingConvos && (
                <div className="flex items-center justify-center pt-10">
                  <div className="h-5 w-5 rounded-full border-2 border-secondary-label border-t-transparent animate-spin" />
                </div>
              )}
              {!loadingConvos && conversations.map((convo, i) => (
                <ConvoItem
                  key={convo.type === 'group' ? 'group' : convo.partner?.id}
                  convo={convo}
                  isActive={
                    activeConvo?.type === 'group'
                      ? convo.type === 'group'
                      : activeConvo?.partner?.id === convo.partner?.id
                  }
                  onClick={() => setActiveConvo(convo)}
                />
              ))}
            </div>
          </div>

          {/* Chat window */}
          {activeConvo && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatWindow
                convo={activeConvo}
                currentUser={user}
                onClose={handleCloseChat}
              />
            </div>
          )}
        </div>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}