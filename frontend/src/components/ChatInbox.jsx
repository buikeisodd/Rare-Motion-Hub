
function ProfileAvatar({ user, size = 'h-10 w-10', isGroup = false }) {
  if (isGroup) {
    return (
      <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#62e5ff,#ff9bdf)] text-black shadow`}>
        <Users className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f7fbf1,#ff9bdf,#62e5ff)] text-xs font-bold text-black shadow`}>
      {user?.name?.slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

    </button>
  );
}

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
    try {
      const res = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: isGroup ? null : convo.partner.id,
          conversationType: isGroup ? 'group' : 'dm',
    } finally {
      setSending(false);
    }
  };

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
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ProfileAvatar user={convo.partner} isGroup={isGroup} size="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary-label">{chatName}</p>
          </div>
        )}
        {grouped.map((item, i) => {
          if (item.type === 'divider') {
          }
          const { msg } = item;
          const isMine = msg.senderId === currentUser.id;
          const showSender = isGroup && !isMine;

          return (
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

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
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoadingConvos(false);
    }
  }, [user.id]);

  const handleCloseChat = () => {
    setActiveConvo(null);
    fetchConvos();
  };

  return (
    <>
                  onClick={() => setActiveConvo(convo)}
                />
              ))}
            </div>
          </div>
            </div>
          )}
        </div>
      </div>
