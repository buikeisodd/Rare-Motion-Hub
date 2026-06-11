import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import AudioPlayer from './AudioPlayer';
import { ArrowLeft, CheckCheck, Copy, Forward, MessageCircle, Mic, MicOff, MonitorUp, MoreHorizontal, Paperclip, PhoneCall, PhoneOff, Pin, PinOff, Reply, Send, Smile, Trash2, Users, Video, VideoOff, Volume2, X } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const emojis = ['😀', '😂', '😍', '🥹', '🔥', '🙏', '❤️', '🎧', '🎵', '✅', '😭', '😤', '🤝', '✨', '💿', '🚀'];

function requestDesktopNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

function showDesktopNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notification = new Notification(title, { icon: '/vite.svg', ...options });
  window.setTimeout(() => notification.close(), 6000);
}

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
    <div className={`${size} relative overflow-hidden shrink-0 rounded-full shadow-lg`}>
      <div className="absolute inset-0 bg-[linear-gradient(-45deg,#f7fbf1,#ff9bdf,#62e5ff,#a18cd1,#fbc2eb)] bg-[length:400%_400%] animate-cosmic" />
      <div className="absolute inset-0 flex items-center justify-center font-['Georgia'] italic font-bold text-black/60 mix-blend-overlay" style={{ fontSize: '110%' }}>
        S
      </div>
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
  const name = isGroup ? 'Rare Motion HQ' : convo.partner?.name || 'Unknown';
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

function RemoteMedia({ stream, volume, className = '' }) {
  const mediaRef = useRef(null);
  const hasVideo = stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (!mediaRef.current) return;
    mediaRef.current.srcObject = stream;
    mediaRef.current.volume = volume / 100;
  }, [stream, volume]);

  return hasVideo ? (
    <video ref={mediaRef} autoPlay playsInline className={className} />
  ) : (
    <audio ref={mediaRef} autoPlay />
  );
}

function GroupStreamPanel({ currentUser, participants, activeCall, onJoinCall, onLeaveCall }) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participantVolumes, setParticipantVolumes] = useState({});
  const [status, setStatus] = useState('');
  const [callStageOpen, setCallStageOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef({});
  const processedSignalsRef = useRef(new Set());
  const pendingCandidatesRef = useRef({});

  const sendSignal = useCallback(async (toUserId, type, payload) => {
    await fetch(`${apiUrl}/api/calls/group/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, toUserId, type, payload })
    });
  }, [currentUser.id]);

  const addLocalTracks = useCallback((pc) => {
    const stream = streamRef.current;
    if (!stream) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track) pc.removeTrack(sender);
    });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }, []);

  const createPeer = useCallback((remoteUserId) => {
    if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peersRef.current[remoteUserId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(remoteUserId, 'ice', event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: stream }));
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[remoteUserId];
          return next;
        });
      }
    };
    addLocalTracks(pc);
    return pc;
  }, [addLocalTracks, sendSignal]);

  const callParticipants = useMemo(() => activeCall?.participants || [], [activeCall]);
  const otherCallers = callParticipants.filter((participant) => participant.id !== currentUser.id);
  const isInActiveCall = callParticipants.some((participant) => participant.id === currentUser.id);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const setLocalStream = (stream) => {
    stopStream();
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    Object.values(peersRef.current).forEach(addLocalTracks);
  };

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [callStageOpen, cameraOn, screenOn, joined]);

  const connectToParticipants = useCallback(async (call) => {
    const remotes = (call?.participants || []).filter((participant) => participant.id !== currentUser.id);
    for (const participant of remotes) {
      const pc = createPeer(participant.id);
      if (pc.signalingState !== 'stable') continue;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(participant.id, 'offer', pc.localDescription);
    }
  }, [createPeer, currentUser.id, sendSignal]);

  const joinWithStream = async (stream, mode) => {
    setStatus('Connecting...');
    setLocalStream(stream);
    const call = await onJoinCall?.();
    setJoined(true);
    setCallStageOpen(true);
    setMicOn(stream.getAudioTracks().some((track) => track.enabled));
    setCameraOn(mode === 'camera');
    setScreenOn(mode === 'screen');
    await connectToParticipants(call);
    setStatus('Connected');
  };

  const joinVoice = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await joinWithStream(stream, 'voice');
  };

  const toggleMic = async () => {
    if (!joined) return joinVoice();
    const nextMic = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = nextMic; });
    setMicOn(nextMic);
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await joinWithStream(stream, 'voice');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    await joinWithStream(stream, 'camera');
  };

  const shareScreen = async () => {
    if (screenOn) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await joinWithStream(stream, 'voice');
      return;
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks()[0]?.addEventListener('ended', () => setScreenOn(false));
    await joinWithStream(stream, 'screen');
  };

  const leave = () => {
    stopStream();
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    processedSignalsRef.current = new Set();
    pendingCandidatesRef.current = {};
    setRemoteStreams({});
    setJoined(false);
    setMicOn(false);
    setCameraOn(false);
    setScreenOn(false);
    setCallStageOpen(false);
    setStatus('');
    onLeaveCall?.();
  };

  const handleSignal = useCallback(async (signal) => {
    if (processedSignalsRef.current.has(signal.id)) return;
    processedSignalsRef.current.add(signal.id);
    const pc = createPeer(signal.fromUserId);

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      const queued = pendingCandidatesRef.current[signal.fromUserId] || [];
      for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      pendingCandidatesRef.current[signal.fromUserId] = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(signal.fromUserId, 'answer', pc.localDescription);
    }

    if (signal.type === 'answer' && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      const queued = pendingCandidatesRef.current[signal.fromUserId] || [];
      for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      pendingCandidatesRef.current[signal.fromUserId] = [];
    }

    if (signal.type === 'ice') {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
      } else {
        pendingCandidatesRef.current[signal.fromUserId] ||= [];
        pendingCandidatesRef.current[signal.fromUserId].push(signal.payload);
      }
    }
  }, [createPeer, sendSignal]);

  useEffect(() => {
    if (!joined || !activeCall) return undefined;
    const fetchSignals = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/calls/group/signals?userId=${encodeURIComponent(currentUser.id)}`);
        const data = await res.json();
        for (const signal of data.signals || []) await handleSignal(signal);
      } catch (err) {
        console.error('Failed to process call signaling', err);
      }
    };
    const firstLoad = window.setTimeout(fetchSignals, 0);
    const interval = window.setInterval(fetchSignals, 1200);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [activeCall, currentUser.id, handleSignal, joined]);

  useEffect(() => {
    if (!joined || !activeCall) return;
    const activeIds = new Set(callParticipants.map((participant) => participant.id));
    Object.keys(peersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        peersRef.current[id].close();
        delete peersRef.current[id];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [activeCall, callParticipants, joined]);

  useEffect(() => () => {
    stopStream();
    Object.values(peersRef.current).forEach((pc) => pc.close());
  }, []);

  const connectedParticipants = participants.filter((participant) => participant.id !== currentUser.id && remoteStreams[participant.id]);
  const callStage = (
    <div className="fixed inset-0 z-[70] flex flex-col bg-primary-background text-primary-label">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-base font-bold sm:text-lg">Group call</p>
          <p className="truncate text-xs text-secondary-label">{joined ? `${status || 'Connected'} · ${connectedParticipants.length + 1} in call` : `${otherCallers.map((participant) => participant.name).join(', ') || 'Someone'} is on a call`}</p>
        </div>
        <div className="flex items-center gap-2">
          {!joined && (
            <button onClick={joinVoice} className="inline-flex h-10 items-center gap-2 rounded-xl bg-green-400 px-4 text-sm font-bold text-black">
              <PhoneCall className="h-4 w-4" />
              Join
            </button>
          )}
          <button onClick={() => setCallStageOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-shading" aria-label="Minimize call">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid flex-1 auto-rows-fr gap-3 overflow-y-auto p-3 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {joined && (
          <div className="relative min-h-52 overflow-hidden rounded-2xl bg-black">
            {(cameraOn || screenOn) ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-full min-h-52 w-full object-cover" />
            ) : (
              <div className="grid h-full min-h-52 place-items-center bg-shading">
                <ProfileAvatar user={currentUser} size="h-20 w-20" />
              </div>
            )}
            <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold">You</span>
          </div>
        )}
        {connectedParticipants.map((participant) => (
          <div key={participant.id} className="relative min-h-52 overflow-hidden rounded-2xl bg-black">
            <RemoteMedia stream={remoteStreams[participant.id]} volume={participantVolumes[participant.id] ?? 80} className="h-full min-h-52 w-full object-cover" />
            {!remoteStreams[participant.id]?.getVideoTracks().length && (
              <div className="absolute inset-0 grid place-items-center bg-shading">
                <ProfileAvatar user={participant} size="h-20 w-20" />
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1">
              <span className="text-xs font-bold">{participant.name}</span>
              <Volume2 className="h-3.5 w-3.5 text-secondary-label" />
              <input
                type="range"
                min="0"
                max="100"
                value={participantVolumes[participant.id] ?? 80}
                onChange={(event) => setParticipantVolumes((prev) => ({ ...prev, [participant.id]: Number(event.target.value) }))}
                className="w-20 accent-white"
                aria-label={`Volume for ${participant.name}`}
              />
            </div>
          </div>
        ))}
        {!joined && connectedParticipants.length === 0 && (
          <div className="col-span-full grid place-items-center text-center text-secondary-label">
            <div>
              <PhoneCall className="mx-auto mb-4 h-10 w-10" />
              <p className="text-sm">Join the call to see and hear everyone.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border px-4 py-4">
        <button onClick={toggleMic} className={`grid h-12 w-12 place-items-center rounded-2xl ${micOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Toggle mic">
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button onClick={toggleCamera} className={`grid h-12 w-12 place-items-center rounded-2xl ${cameraOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Toggle camera">
          {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button onClick={shareScreen} className={`grid h-12 w-12 place-items-center rounded-2xl ${screenOn ? 'bg-green-400 text-black' : 'bg-shading'}`} aria-label="Share screen">
          <MonitorUp className="h-5 w-5" />
        </button>
        <button onClick={leave} className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500 text-white" aria-label="Leave call">
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="border-b border-border bg-primary-background p-3">
      {callStageOpen && callStage}
      {activeCall && !joined && !isInActiveCall && (
        <button onClick={() => setCallStageOpen(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-green-400/30 bg-green-400/10 px-3 py-3 text-left transition-colors hover:bg-green-400/15">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-green-400 text-black">
            <PhoneCall className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-primary-label">{activeCall.startedBy?.name || otherCallers[0]?.name || 'Someone'} is on a group call</span>
            <span className="block truncate text-[11px] text-secondary-label">{otherCallers.map((participant) => participant.name).join(', ') || 'Tap to open the call'}</span>
          </span>
        </button>
      )}
      {activeCall && (joined || isInActiveCall) && !callStageOpen && (
        <button onClick={() => setCallStageOpen(true)} className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-highlight px-3 py-3 text-left">
          <span className="flex min-w-0 items-center gap-3">
            <PhoneCall className="h-5 w-5 text-green-300" />
            <span className="truncate text-sm font-bold">Return to group call</span>
          </span>
          <span className="text-xs text-secondary-label">{callParticipants.length} joined</span>
        </button>
      )}

      {(joined || connectedParticipants.length > 0) && !callStageOpen && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {joined && (
            <div className="relative overflow-hidden rounded-xl bg-black">
              {(cameraOn || screenOn) ? (
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              ) : (
                <div className="grid aspect-video place-items-center bg-shading">
                  <ProfileAvatar user={currentUser} size="h-14 w-14" />
                </div>
              )}
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold">You</span>
            </div>
          )}
          {connectedParticipants.map((participant) => (
            <div key={participant.id} className="relative overflow-hidden rounded-xl bg-black">
              <RemoteMedia stream={remoteStreams[participant.id]} volume={participantVolumes[participant.id] ?? 80} className="aspect-video w-full object-cover" />
              {!remoteStreams[participant.id]?.getVideoTracks().length && (
                <div className="absolute inset-0 grid place-items-center bg-shading">
                  <ProfileAvatar user={participant} size="h-14 w-14" />
                </div>
              )}
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold">{participant.name}</span>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}

function MediaPreview({ attachment }) {
  if (attachment.type === 'image') return <img src={attachment.url} alt="" className="mt-2 max-h-64 w-full rounded-xl object-cover" />;
  if (attachment.type === 'video') return <video src={attachment.url} controls className="mt-2 max-h-64 w-full rounded-xl" />;
  if (attachment.type === 'voice') return <audio src={attachment.url} controls className="mt-2 w-full" />;
  return null;
}

function MessageActions({ message, isOpen, onToggle, onClose, onReply, onCopy, onForward, onPin, onDelete }) {
  return (
    <div className="relative shrink-0 self-center">
      <button
        onClick={(event) => {
          event.stopPropagation();
          onToggle(message.id);
        }}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary-label transition-colors hover:bg-highlight hover:text-primary-label"
        aria-label="Message options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute bottom-full right-0 z-50 mb-2 min-w-44 rounded-2xl border border-border panel-bg p-2 shadow-2xl">
            <button onClick={() => { onReply(message); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Reply className="h-4 w-4" /> Reply</button>
            <button onClick={() => { onCopy(message); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Copy className="h-4 w-4" /> Copy</button>
            <button onClick={() => { onForward(message); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight"><Forward className="h-4 w-4" /> Forward</button>
            <button onClick={() => { onPin(message); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-highlight">
              {message.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {message.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => { onDelete(message); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

function ChatWindow({ convo, currentUser, conversations, activeCall, onJoinCall, onLeaveCall, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isGroup = convo.type === 'group';
  const chatName = isGroup ? 'Rare Motion HQ' : convo.partner?.name || 'Unknown';
  const participants = convo.participants || [];

  const fetchMessages = useCallback(async () => {
    try {
      const url = isGroup
        ? `${apiUrl}/api/messages?type=group&userId=${currentUser.id}`
        : `${apiUrl}/api/messages?type=dm&userId=${currentUser.id}&partnerId=${convo.partner.id}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;
      const data = await res.json();
      const incoming = data.messages;
      if (!Array.isArray(incoming)) return;
      // Only replace if server returned MORE or EQUAL messages — never wipe with fewer
      setMessages(prev => incoming.length >= prev.length ? incoming : prev);
    } catch (err) {
      // Silently ignore — abort, network error, Render sleeping
    } finally {
      setLoading(false);
    }
  }, [isGroup, currentUser.id, convo.partner]);

  useEffect(() => {
    // Initial load immediately
    fetchMessages();
    // Poll every 6s — longer interval reduces chance of catching Render mid-sleep
    const poll = window.setInterval(fetchMessages, 6000);
    return () => window.clearInterval(poll);
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-primary-label">{chatName}</p>
          {isGroup && <p className="truncate text-[11px] text-secondary-label">{participants.map(p => p.name).join(' · ')}</p>}
        </div>
        {isGroup && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onJoinCall}
              className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-green-500/20 hover:text-green-400"
              aria-label="Voice call"
              title="Voice call"
            >
              <PhoneCall className="h-4 w-4" />
            </button>
            <button
              onClick={() => { onJoinCall(); }}
              className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-blue-500/20 hover:text-blue-400"
              aria-label="Video call"
              title="Video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isGroup && <GroupStreamPanel currentUser={currentUser} participants={participants} activeCall={activeCall} onJoinCall={onJoinCall} onLeaveCall={onLeaveCall} />}

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
            <div key={msg.id} className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
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
                isOpen={openMessageMenuId === msg.id}
                onToggle={(messageId) => setOpenMessageMenuId((current) => (current === messageId ? null : messageId))}
                onClose={() => setOpenMessageMenuId(null)}
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
        <div className="border-t border-border panel-bg px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Forward to</span><button onClick={() => setForwarding(null)}><X className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {conversations.map((target) => (
              <button key={target.type === 'group' ? 'group' : target.partner.id} onClick={() => handleForward(target)} className="truncate rounded-xl bg-shading px-3 py-2 text-left text-xs hover:bg-highlight">
                {target.type === 'group' ? 'Rare Motion HQ' : target.partner.name}
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


// Mini audio player shown in sidebar below conversations
function MiniPlayer() {
  const { currentTrack, setCurrentTrack, setIsPlaying } = useAudio();
  if (!currentTrack) return null;
  return (
    <div className="shrink-0 border-t border-border p-3">
      <AudioPlayer
        cardModal={true}
        hideCover={true}
        onDismiss={() => { setIsPlaying(false); setCurrentTrack(null); }}
      />
    </div>
  );
}

export default function ChatInbox({ user, isOpen, onToggle, onConversationsChange }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);

  // Keepalive — prevents Render free tier from sleeping while chat is open
  useEffect(() => {
    if (!isOpen) return;
    const ping = () => fetch(`${apiUrl}/api/ping`).catch(() => {});
    ping();
    const interval = setInterval(ping, 25000);
    return () => clearInterval(interval);
  }, [isOpen]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const lastMessageRef = useRef(new Map());
  const lastCallRef = useRef('');
  const didPrimeNotificationsRef = useRef(false);

  const fetchConvos = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/conversations?userId=${user.id}`);
      const data = await res.json();
      const nextConversations = data.conversations || [];
      if (didPrimeNotificationsRef.current) {
        nextConversations.forEach((convo) => {
          const key = convo.type === 'group' ? 'group' : convo.partner?.id;
          const lastMessage = convo.lastMessage;
          if (!key || !lastMessage) return;
          const previousId = lastMessageRef.current.get(key);
          const isIncoming = lastMessage.senderId !== user.id && lastMessage.id !== previousId;
          if (isIncoming) {
            const title = convo.type === 'group' ? 'New message in Rare Motion HQ' : `${lastMessage.sender?.name || convo.partner?.name || 'Someone'} sent a message`;
            const body = lastMessage.deleted ? 'Message deleted' : lastMessage.text || (lastMessage.attachments?.length ? 'Media message' : 'New message');
            showDesktopNotification(title, { body });
          }
          lastMessageRef.current.set(key, lastMessage.id);
        });
      } else {
        nextConversations.forEach((convo) => {
          const key = convo.type === 'group' ? 'group' : convo.partner?.id;
          if (key && convo.lastMessage?.id) lastMessageRef.current.set(key, convo.lastMessage.id);
        });
        didPrimeNotificationsRef.current = true;
      }
      setConversations(nextConversations);
      if (onConversationsChange) onConversationsChange(nextConversations);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoadingConvos(false);
    }
  }, [user.id]);

  const fetchActiveCall = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/calls/group?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      const nextCall = data.call || null;
      const callToken = nextCall?.id || '';
      if (nextCall && lastCallRef.current && lastCallRef.current !== callToken && nextCall.startedBy?.id !== user.id && !nextCall.participants?.some((participant) => participant.id === user.id)) {
        showDesktopNotification('Group call started', {
          body: `${nextCall.startedBy?.name || 'Someone'} is on a group call. Open chat to join.`
        });
      }
      if (!lastCallRef.current && nextCall && nextCall.startedBy?.id !== user.id && !nextCall.participants?.some((participant) => participant.id === user.id)) {
        showDesktopNotification('Group call started', {
          body: `${nextCall.startedBy?.name || 'Someone'} is on a group call. Open chat to join.`
        });
      }
      lastCallRef.current = callToken;
      setActiveCall(nextCall);
    } catch (err) {
      console.error('Failed to fetch active call', err);
    }
  }, [user.id]);

  useEffect(() => {
    requestDesktopNotificationPermission();
    const firstLoad = window.setTimeout(fetchConvos, 0);
    const interval = window.setInterval(fetchConvos, 5000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [fetchConvos]);

  useEffect(() => {
    const firstLoad = window.setTimeout(fetchActiveCall, 0);
    const interval = window.setInterval(fetchActiveCall, 4000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [fetchActiveCall]);

  const joinGroupCall = async () => {
    const res = await fetch(`${apiUrl}/api/calls/group/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();
    setActiveCall(data.call || null);
    return data.call;
  };

  const leaveGroupCall = async () => {
    const res = await fetch(`${apiUrl}/api/calls/group/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();
    setActiveCall(data.call || null);
  };

  const handleCloseChat = () => {
    setActiveConvo(null);
    fetchConvos();
  };

  return (
    <>
      <div className={`fixed left-0 top-0 z-[60] flex h-full w-full flex-col bg-primary-background transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full overflow-hidden">
          <div className={`flex-col border-r border-border transition-all duration-300 ${activeConvo ? 'hidden sm:flex sm:w-[24rem]' : 'flex w-full sm:w-[24rem]'}`}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-5">
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-primary-label">Messages</span>
              </div>
              <button onClick={onToggle} className="grid h-10 w-10 place-items-center rounded-2xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close inbox">
                <X className="h-5 w-5" />
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
            <MiniPlayer />
          </div>
          {activeConvo ? (
            <div className="flex flex-1 flex-col overflow-hidden bg-primary-background">
              <ChatWindow key={activeConvo?.type === "group" ? "group" : activeConvo?.partner?.id} convo={activeConvo} currentUser={user} conversations={conversations} activeCall={activeCall} onJoinCall={joinGroupCall} onLeaveCall={leaveGroupCall} onClose={handleCloseChat} />
            </div>
          ) : (
            <div className="hidden sm:flex flex-1 flex-col items-center justify-center text-secondary-label bg-primary-background">
              <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
