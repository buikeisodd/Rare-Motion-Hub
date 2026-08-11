import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import AudioPlayer from './AudioPlayer';
import { ArrowLeft, Check, CheckCheck, Copy, Forward, Inbox, MessageCircle, Mic, MicOff, MonitorUp, MoreHorizontal, Paperclip, PhoneCall, PhoneOff, Pin, PinOff, Reply, Search, Send, Smile, Trash2, Users, UserPlus, Video, VideoOff, Volume2, X } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
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
  const name = isGroup ? convo.group?.name || 'Group' : convo.partner?.name || 'Unknown';
  const lastText = convo.lastMessage?.deleted
    ? 'Message deleted'
    : convo.lastMessage?.text || (convo.lastMessage?.attachments?.length ? 'Media message' : null);
  const lastSender = convo.lastMessage?.sender?.name || null;
  const time = convo.updatedAt ? new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const hasUnread = (convo.unreadCount || 0) > 0;

  return (
    <button onClick={onClick} className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${isActive ? 'bg-highlight shadow-inner' : hasUnread ? 'bg-primary-label/10 hover:bg-primary-label/15' : 'hover:bg-shading/80'}`}>
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
      <div className="flex shrink-0 flex-col items-end gap-1">
        {convo.isRequest && <span className="rounded-full bg-primary-label/10 px-2 py-0.5 text-[10px] font-bold text-primary-label">Request</span>}
        {hasUnread && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-label px-1.5 text-[10px] font-bold text-primary-background">{convo.unreadCount}</span>}
      </div>
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

function normalizeChatMessage(message) {
  return {
    attachments: [],
    readBy: [],
    delivery: { delivered: true, read: false, readCount: 0, recipientCount: 0 },
    ...message,
    attachments: Array.isArray(message?.attachments) ? message.attachments : [],
    sender: message?.sender || null,
    replyTo: message?.replyTo || null,
    createdAt: message?.createdAt || new Date().toISOString()
  };
}

class ChatWindowBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error) {
    console.error('Chat window failed to render', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col bg-primary-background">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <button onClick={this.props.onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Back to inbox">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary-label">Chat could not open</p>
            <p className="mt-0.5 text-xs text-secondary-label">Go back and try opening this conversation again.</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-secondary-label">
          This conversation had an unexpected payload. The rest of your inbox is still available.
        </div>
      </div>
    );
  }
}

function ChatWindow({ convo, currentUser, conversations, activeCall, onJoinCall, onLeaveCall, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState('');
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
  const partnerId = !isGroup ? convo.partner?.id : null;
  const groupId = isGroup ? convo.group?.id : null;
  const canLoadConversation = isGroup ? Boolean(groupId) : Boolean(partnerId);
  const chatName = isGroup ? convo.group?.name || 'Group' : convo.partner?.name || 'Unknown';
  const participants = convo.participants || [];

  const fetchMessages = useCallback(async () => {
    if (!canLoadConversation) {
      setLoading(false);
      setChatError('This conversation could not be opened. Please go back and try again.');
      return;
    }
    try {
      setChatError('');
      const url = isGroup
        ? `${apiUrl}/api/messages?type=group&userId=${currentUser.id}&groupId=${groupId}`
        : `${apiUrl}/api/messages?type=dm&userId=${currentUser.id}&partnerId=${partnerId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatError(data.error || 'Could not load this conversation.');
        return;
      }
      const data = await res.json();
      const incoming = data.messages;
      if (!Array.isArray(incoming)) return;
      const normalized = incoming.map(normalizeChatMessage);
      // Only replace if server returned MORE or EQUAL messages — never wipe with fewer
      setMessages(prev => normalized.length >= prev.length ? normalized : prev);
    } catch (err) {
      setChatError(err.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Could not connect to the chat server.');
    } finally {
      setLoading(false);
    }
  }, [canLoadConversation, isGroup, currentUser.id, partnerId, groupId]);

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
    if (!canLoadConversation) {
      setChatError('This conversation could not be opened. Please go back and try again.');
      return;
    }
    setSending(true);
    try {
      setChatError('');
      const res = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          recipientId: isGroup ? null : partnerId,
          groupId: isGroup ? groupId : null,
          conversationType: isGroup ? 'group' : 'dm',
          replyToMessageId: replyTo?.id || null,
          ...payload
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message could not be sent.');
      if (data.message) setMessages((prev) => [...prev, normalizeChatMessage(data.message)]);
      setReplyTo(null);
    } catch (err) {
      setChatError(err.message || 'Message could not be sent.');
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
    if (!canLoadConversation) {
      setChatError('This conversation could not be opened. Please go back and try again.');
      return;
    }
    const formData = new FormData();
    formData.append('media', file);
    formData.append('senderId', currentUser.id);
    formData.append('recipientId', isGroup ? '' : partnerId);
    if (isGroup) formData.append('groupId', groupId || '');
    formData.append('conversationType', isGroup ? 'group' : 'dm');
    formData.append('text', text.trim());
    formData.append('mediaKind', mediaKind);
    if (replyTo?.id) formData.append('replyToMessageId', replyTo.id);
    setText('');
    setSending(true);
    try {
      setChatError('');
      const res = await fetch(`${apiUrl}/api/messages/media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Media could not be sent.');
      if (data.message) setMessages((prev) => [...prev, normalizeChatMessage(data.message)]);
      setReplyTo(null);
    } catch (err) {
      console.error('Media send failed', err);
      setChatError(err.message || 'Media could not be sent.');
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
        recipientId: target.type === 'dm' ? target.partner.id : null,
        groupId: target.type === 'group' ? target.group?.id : null
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

      {chatError && (
        <div className="mx-4 mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:mx-5">
          {chatError}
        </div>
      )}

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
              <button key={target.type === 'group' ? target.group?.id : target.partner.id} onClick={() => handleForward(target)} className="truncate rounded-xl bg-shading px-3 py-2 text-left text-xs hover:bg-highlight">
                {target.type === 'group' ? target.group?.name || 'Group' : target.partner.name}
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

export default function ChatInbox({ user, isOpen, onToggle, onConversationsChange, startConversationWith }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [inboxTab, setInboxTab] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupError, setGroupError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

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
          const key = convo.type === 'group' ? convo.group?.id : convo.partner?.id;
          const lastMessage = convo.lastMessage;
          if (!key || !lastMessage) return;
          const previousId = lastMessageRef.current.get(key);
          const isIncoming = lastMessage.senderId !== user.id && lastMessage.id !== previousId;
          if (isIncoming) {
            const title = convo.type === 'group' ? `New message in ${convo.group?.name || 'group'}` : `${lastMessage.sender?.name || convo.partner?.name || 'Someone'} sent a message`;
            const body = lastMessage.deleted ? 'Message deleted' : lastMessage.text || (lastMessage.attachments?.length ? 'Media message' : 'New message');
            showDesktopNotification(title, { body });
          }
          lastMessageRef.current.set(key, lastMessage.id);
        });
      } else {
        nextConversations.forEach((convo) => {
          const key = convo.type === 'group' ? convo.group?.id : convo.partner?.id;
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

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/users`);
      const data = await res.json();
      setContacts(data.users || []);
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  }, []);

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
    if (isOpen) fetchContacts();
  }, [fetchContacts, isOpen]);

  useEffect(() => {
    if (!isOpen || !startConversationWith?.id || startConversationWith.id === user.id) return;
    const normalizedTarget = {
      id: startConversationWith.id,
      name: startConversationWith.name || startConversationWith.username || 'Unknown',
      username: startConversationWith.username || startConversationWith.name || 'unknown',
      avatarUrl: startConversationWith.avatarUrl || null
    };
    const existing = conversations.find((convo) => convo.type !== 'group' && convo.partner?.id === startConversationWith.id);
    const starterConvo = existing || {
      type: 'dm',
      partner: normalizedTarget,
      lastMessage: null,
      unreadCount: 0,
      isRequest: false,
      updatedAt: new Date().toISOString()
    };
    setInboxTab(starterConvo.isRequest ? 'requests' : 'inbox');
    setActiveConvo(starterConvo);
  }, [conversations, isOpen, startConversationWith, user.id]);

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

  const followerContacts = contacts.filter((person) => person.isFollowing || person.followsYou);
  const toggleGroupMember = (id) => {
    setSelectedMembers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const createNewGroup = async () => {
    setGroupError('');
    if (selectedMembers.length === 0) {
      setGroupError('Select at least one follower.');
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await fetch(`${apiUrl}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim() || 'New group', participantIds: selectedMembers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create group.');
      const groupConvo = {
        type: 'group',
        group: { id: data.group.id, name: data.group.name },
        participants: data.group.participants || [],
        lastMessage: null,
        unreadCount: 0,
        updatedAt: data.group.updatedAt || data.group.createdAt
      };
      setConversations((current) => [groupConvo, ...current]);
      setActiveConvo(groupConvo);
      setGroupOpen(false);
      setGroupName('');
      setSelectedMembers([]);
      setInboxTab('inbox');
      fetchConvos();
    } catch (err) {
      setGroupError(err.message || 'Could not create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const requestCount = conversations.filter((convo) => convo.isRequest).length;
  const unreadCount = conversations.reduce((sum, convo) => sum + (convo.unreadCount || 0), 0);
  const visibleConversations = conversations.filter((convo) => {
    const matchesTab = inboxTab === 'requests' ? convo.isRequest : !convo.isRequest;
    if (!matchesTab) return false;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const name = convo.type === 'group' ? `${convo.group?.name || ''}` : `${convo.partner?.name || ''} ${convo.partner?.username || ''}`;
    const last = convo.lastMessage?.text || '';
    return `${name} ${last}`.toLowerCase().includes(query);
  });

  return (
    <>
      <div className={`fixed left-0 top-0 z-[60] flex h-full w-full flex-col bg-primary-background text-primary-label transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full overflow-hidden">
          <div className={`flex-col border-r border-border/70 bg-primary-background transition-all duration-300 ${activeConvo ? 'hidden md:flex md:w-[25rem] xl:w-[27rem]' : 'flex w-full md:w-[25rem] xl:w-[27rem]'}`}>
            <div className="shrink-0 border-b border-border/70 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-2xl font-semibold tracking-tight text-primary-label">Inbox</span>
                  <span className="mt-1 block text-xs text-secondary-label">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span>
                </div>
                <button onClick={onToggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-shading text-primary-label transition-colors hover:bg-highlight" aria-label="Close inbox">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={() => setGroupOpen((value) => !value)}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-shading/60 text-sm font-semibold text-primary-label transition-colors hover:bg-highlight"
              >
                <Users className="h-4 w-4" />
                New group
              </button>

              {groupOpen && (
                <div className="mt-3 rounded-2xl border border-border bg-shading/35 p-3">
                  <input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Group name"
                    maxLength={60}
                    className="h-10 w-full rounded-full border border-border bg-primary-background px-4 text-sm outline-none focus:border-primary-label/30"
                  />
                  <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
                    {followerContacts.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-secondary-label">Follow someone first to create a group.</p>
                    ) : followerContacts.map((person) => {
                      const selected = selectedMembers.includes(person.id);
                      return (
                        <button key={person.id} onClick={() => toggleGroupMember(person.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-highlight">
                          <ProfileAvatar user={person} size="h-8 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold">{person.name}</span>
                            <span className="block truncate text-[11px] text-secondary-label">@{person.username || person.name}</span>
                          </span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? 'border-primary-label bg-primary-label text-primary-background' : 'border-border text-transparent'}`}>
                            <Check className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {groupError && <p className="mt-2 text-xs text-red-300">{groupError}</p>}
                  <button onClick={createNewGroup} disabled={creatingGroup || selectedMembers.length === 0} className="mt-3 h-10 w-full rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-opacity disabled:opacity-40">
                    {creatingGroup ? 'Creating...' : 'Create group'}
                  </button>
                </div>
              )}

              <label className="mt-4 flex h-11 items-center gap-3 rounded-full border border-border bg-shading/70 px-4 transition-colors focus-within:border-primary-label/30">
                <Search className="h-4 w-4 shrink-0 text-secondary-label" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search messages"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-secondary-label/55"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-shading/50 p-1">
                <button onClick={() => setInboxTab('inbox')} className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${inboxTab === 'inbox' ? 'bg-primary-label text-primary-background' : 'text-secondary-label hover:text-primary-label'}`}>
                  <Inbox className="h-4 w-4" />
                  Inbox
                </button>
                <button onClick={() => setInboxTab('requests')} className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${inboxTab === 'requests' ? 'bg-primary-label text-primary-background' : 'text-secondary-label hover:text-primary-label'}`}>
                  <UserPlus className="h-4 w-4" />
                  Requests
                  {requestCount > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${inboxTab === 'requests' ? 'bg-primary-background text-primary-label' : 'bg-highlight text-primary-label'}`}>{requestCount}</span>}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              {loadingConvos && <div className="flex items-center justify-center pt-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary-label border-t-transparent" /></div>}
              {!loadingConvos && visibleConversations.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center text-secondary-label">
                  {inboxTab === 'requests' ? <UserPlus className="mb-3 h-10 w-10 opacity-30" /> : <MessageCircle className="mb-3 h-10 w-10 opacity-30" />}
                  <p className="text-sm font-semibold text-primary-label">{searchTerm ? 'No matches found' : inboxTab === 'requests' ? 'No message requests' : 'No conversations yet'}</p>
                  <p className="mt-1 text-xs">{inboxTab === 'requests' ? 'One-time messages from non-followers will land here.' : 'Follow people from the feed to start cleaner conversations.'}</p>
                </div>
              )}
              {!loadingConvos && visibleConversations.map((convo) => (
                <ConvoItem
                  key={convo.type === 'group' ? convo.group?.id : convo.partner?.id}
                  convo={convo}
                  isActive={activeConvo?.type === 'group' ? activeConvo?.group?.id === convo.group?.id : activeConvo?.partner?.id === convo.partner?.id}
                  onClick={() => setActiveConvo(convo)}
                />
              ))}
            </div>
            <MiniPlayer />
          </div>
          {activeConvo ? (
            <div className="flex flex-1 flex-col overflow-hidden bg-primary-background">
              <ChatWindowBoundary resetKey={activeConvo?.type === 'group' ? activeConvo?.group?.id : activeConvo?.partner?.id} onClose={handleCloseChat}>
                <ChatWindow key={activeConvo?.type === 'group' ? activeConvo?.group?.id || 'group' : activeConvo?.partner?.id || 'dm'} convo={activeConvo} currentUser={user} conversations={conversations} activeCall={activeCall} onJoinCall={joinGroupCall} onLeaveCall={leaveGroupCall} onClose={handleCloseChat} />
              </ChatWindowBoundary>
            </div>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center bg-primary-background px-8 text-center text-secondary-label md:flex">
              <div className="grid h-20 w-20 place-items-center rounded-full border border-border bg-shading/40">
                <MessageCircle className="h-9 w-9 opacity-45" />
              </div>
              <p className="mt-5 text-lg font-semibold text-primary-label">Choose a conversation</p>
              <p className="mt-2 max-w-sm text-sm">Messages, requests, media, and calls now live in one cleaner workspace.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
