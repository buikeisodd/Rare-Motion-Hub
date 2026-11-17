import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Radio, Video, X, LogOut, Users, ArrowLeft, Mic, MicOff, Camera, CameraOff, Send, Heart } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

// Production uses the same-origin Vercel /api proxy so auth cookies stay first-party.
const apiUrl = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4000');

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, { ...options, credentials: 'include' });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new Error(body?.error || `Live service returned HTTP ${response.status}.`);
  }
  if (!body) throw new Error('Live service returned an invalid response. Check that the backend is deployed and VITE_API_URL points to it.');
  return body;
}

function Surface({ children, className = '' }) {
  return <section className={`rounded-[1.5rem] border border-[#34483B]/10 bg-[#F3EBDD]/85 shadow-[0_18px_55px_rgba(52,72,59,0.12)] backdrop-blur-xl ${className}`}>{children}</section>;
}

export default function Live({ user }) {
  const navigate = useNavigate();
  const { id: liveId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [liveMessages, setLiveMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const roomRef = useRef(null);
  const attachedTrackIds = useRef(new Set());
  const [requestStatus, setRequestStatus] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/live');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) { setMessage(error.message || 'Live rooms are temporarily unavailable.'); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 20000);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => { if (liveId && sessions.length) { const room = sessions.find((item) => item.id === liveId); if (room) setActive(room); } }, [liveId, sessions]);

  useEffect(() => {
    if (!active) return undefined;
    let room;
    let cancelled = false;
    const connect = async () => {
      try {
        const data = await apiRequest(`/api/live/${active.id}/token`);
        if (cancelled) return;
        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const event = JSON.parse(new TextDecoder().decode(payload));
            if (event.type === 'chat') setLiveMessages((current) => [...current.slice(-49), event]);
            if (event.type === 'reaction') setLiveMessages((current) => [...current.slice(-49), { ...event, text: `${event.emoji} reaction` }]);
          } catch { /* Ignore malformed room data from clients. */ }
        });
        const attachTrack = (track) => {
          const trackId = track.sid || track.mediaStreamTrack?.id;
          if (trackId && attachedTrackIds.current.has(trackId)) return;
          if (trackId) attachedTrackIds.current.add(trackId);
          const element = track.attach();
          if (track.kind === Track.Kind.Video) element.className = 'h-full min-h-[16rem] w-full rounded-xl object-contain';
          if (track.kind === Track.Kind.Audio) element.className = 'hidden';
          document.getElementById('live-media-stage')?.appendChild(element);
        };
        room.on(RoomEvent.TrackSubscribed, attachTrack); room.on(RoomEvent.TrackPublished, async (publication) => { try { await publication.setSubscribed(true); } catch { /* already subscribed */ } });
        await room.connect(data.serverUrl, data.token, { autoSubscribe: true });
        if (data.canPublish) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch (error) {
            // A host may be on a device without a camera. Keep the room live audio-first.
            if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') setVideoUnavailable(true);
          }
          try { await room.localParticipant.setMicrophoneEnabled(true); } catch (error) { setMessage(error?.message || 'Microphone access was unavailable.'); }
          room.localParticipant.videoTrackPublications.forEach((publication) => {
            const element = publication.track?.attach();
            if (element) {
              element.className = 'h-full min-h-[16rem] w-full rounded-xl object-cover';
              const trackId = publication.track.sid || publication.track.mediaStreamTrack?.id;
              if (trackId) attachedTrackIds.current.add(trackId);
              document.getElementById('live-media-stage')?.appendChild(element);
            }
          });
        }
        room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => {
          if (publication.isSubscribed && publication.track) attachTrack(publication.track);
        }));
        setPublishing(Boolean(data.canPublish)); setConnected(true);
      } catch (error) { setMessage(error.message || 'Could not connect to the live room.'); }
    };
    connect();
    return () => { cancelled = true; setConnected(false); setPublishing(false); setVideoUnavailable(false); setCameraOn(true); setMicOn(true); setLiveMessages([]); attachedTrackIds.current.clear(); roomRef.current = null; room?.disconnect(); document.getElementById('live-media-stage')?.replaceChildren(); };
  }, [active]);

  const start = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setMessage('');
    try {
      const data = await apiRequest('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
      setSessions((current) => [data.session, ...current]); setActive(data.session); navigate(`/live/${data.session.id}`); setTitle(''); setDescription(''); setShowCreate(false);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const join = async (session) => {
    setBusy(true); setMessage('');
    try {
      const data = await apiRequest(`/api/live/${session.id}/join`, { method: 'POST' });
      setActive(data.session || session); setSessions((current) => current.map((item) => item.id === session.id ? { ...item, viewerCount: data.viewerCount } : item)); navigate(`/live/${session.id}`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const end = async () => {
    if (!active || active.hostId !== user?.id) return;
    setBusy(true);
    try { await fetch(`${apiUrl}/api/live/${active.id}/end`, { method: 'POST', credentials: 'include' }); setActive(null); setSessions((current) => current.filter((item) => item.id !== active.id)); navigate('/live'); }
    catch { setMessage('Could not end live room.'); } finally { setBusy(false); }
  };

  const toggleCamera = async () => { const next = !cameraOn; await roomRef.current?.localParticipant.setCameraEnabled(next); setCameraOn(next); };
  const toggleMic = async () => { const next = !micOn; await roomRef.current?.localParticipant.setMicrophoneEnabled(next); setMicOn(next); };
  const sendLiveData = async (event) => { if (!roomRef.current || !connected) return; const payload = { ...event, sender: user?.username || user?.name || 'Listener' }; setLiveMessages((current) => [...current.slice(-49), payload]); await roomRef.current.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true }); };
  const sendChat = async (event) => { event.preventDefault(); if (!chatText.trim()) return; const text = chatText.trim(); setChatText(''); await sendLiveData({ type: 'chat', text }); };
  const sendReaction = async () => { await sendLiveData({ type: 'reaction', emoji: '♥️', text: '♥️ reaction' }); };
  const requestToSpeak = async () => { try { const data = await apiRequest(`/api/live/${active.id}/request`, { method: 'POST' }); setRequestStatus(data.status); } catch (error) { setMessage(error.message?.toLowerCase().includes('source not found') ? 'This live room is no longer available. The room will close shortly.' : error.message || 'We could not send your request right now.'); } };
  const resolveRequest = async (request, action) => { try { await apiRequest(`/api/live/${active.id}/requests/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: request.userId, action }) }); setJoinRequests((current) => current.filter((item) => item.userId !== request.userId)); } catch (error) { setMessage(error.message); } };
  useEffect(() => { if (!active || active.hostId !== user?.id) return undefined; const timer = window.setInterval(async () => { try { const data = await apiRequest(`/api/live/${active.id}/requests`); setJoinRequests(data.requests || []); } catch { /* host request polling is best effort */ } }, 3000); return () => window.clearInterval(timer); }, [active, user?.id]);
  useEffect(() => { if (!active || active.hostId === user?.id || requestStatus !== 'pending') return undefined; const timer = window.setInterval(async () => { try { const data = await apiRequest(`/api/live/${active.id}/request-status`); if (data.status === 'accepted') { setRequestStatus('accepted'); setActive({ ...active }); } } catch { /* request polling is best effort */ } }, 2000); return () => window.clearInterval(timer); }, [active, requestStatus, user?.id]);

  return <main className={`live-page min-h-screen bg-primary-background text-primary-label ${active ? 'live-page-active' : ''}`}>
    <div className="live-page-inner mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-8 lg:px-12">
      <header className="live-page-header mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><Link to="/feed" className="live-back-nav inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-primary-label/70 hover:bg-primary-label/10 hover:text-primary-label"><ArrowLeft size={16} /> Back to feed</Link>{!active && <><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Live</h1><p className="mt-2 max-w-xl text-primary-label/70">Listen together in real time, with room for conversation.</p></>}</div>
        {!active && <button type="button" onClick={() => setShowCreate(true)} className="live-create-button grid h-11 w-11 place-items-center rounded-xl bg-primary-label text-xl font-semibold text-primary-background shadow-lg transition hover:-translate-y-0.5 active:translate-y-0" aria-label="Create live room" title="Create live room"><span aria-hidden="true">+</span></button>}
      </header>
      {message && <p role="status" className="live-warning mb-4 rounded-xl border border-primary-label/10 bg-primary-label/5 px-4 py-3 text-sm text-primary-label/80">{message}</p>}
      {active ? (
        <Surface className="live-room-shell relative flex min-h-[calc(100vh-8rem)] min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-label/10 px-5 py-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-label/60">Live room</p><h2 className="mt-1 text-2xl font-semibold">{active.title}</h2></div>
            <div className="flex items-center gap-3 text-sm text-primary-label/70">
              <span className="inline-flex items-center gap-1"><Users size={15} /> {active.viewerCount || active.viewerIds?.length || 0}</span>
              {active.hostId !== user?.id && !publishing && <button type="button" onClick={requestToSpeak} disabled={requestStatus === 'pending'} className="rounded-xl bg-primary-label px-3 py-2 text-xs font-semibold text-primary-background">{requestStatus === 'pending' ? 'Request sent' : 'Request to join'}</button>}
              {active.hostId === user?.id && <button type="button" onClick={end} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><LogOut size={16} /> End</button>}
              <button type="button" onClick={() => navigate('/live')} aria-label="Close live room" className="grid h-10 w-10 place-items-center rounded-xl bg-primary-label/10"><X size={18} /></button>
            </div>
          </div>
          <div className="live-room-content relative min-h-0 flex-1 overflow-hidden">
            <div id="live-media-stage" className="live-stage absolute inset-0 grid min-h-[18rem] grid-cols-1 content-center items-center justify-items-stretch gap-2 overflow-y-auto px-6 py-12 text-center text-primary-background sm:grid-cols-2 xl:grid-cols-3">
              {!connected && <div className="pointer-events-none relative z-10 rounded-xl bg-primary-label/70 p-4"><Video size={42} className="mx-auto mb-4 opacity-70" /><h3 className="text-xl font-semibold">Connecting...</h3><p className="mt-2 max-w-md text-sm text-primary-background/70">Joining the live room...</p></div>}
            </div>
            <aside className="live-chat-panel live-chat-overlay absolute bottom-0 right-0 top-0 flex min-h-0 w-full max-w-sm flex-col border-l border-primary-background/10 p-4 text-primary-label">
              <div className="mb-3 flex items-center justify-end"><button type="button" onClick={sendReaction} aria-label="Send reaction" className="rounded-xl p-2 text-red-600"><Heart size={18} /></button></div>
              <div className="live-chat-list min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">{liveMessages.map((item, index) => <p className="live-chat-message" key={`${item.sender}-${index}`}><strong>{item.sender}</strong> {item.text}</p>)}</div>
              <form onSubmit={sendChat} className="mt-3 flex gap-2"><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Say something..." className="min-w-0 flex-1 rounded-xl border border-primary-label/15 bg-white/60 px-3 py-2 outline-none" /><button type="submit" aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background"><Send size={16} /></button></form>
            </aside>
          </div>
          <div className="live-controls absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/75 px-3 py-2 text-white shadow-2xl backdrop-blur-xl">
            {publishing && joinRequests.length > 0 && <div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl bg-[#F3EBDD] p-3 text-xs text-primary-label shadow-xl">{joinRequests.map((request) => <span key={request.userId} className="flex items-center gap-2"><strong>{request.userId}</strong><button type="button" onClick={() => resolveRequest(request, 'accept')} className="rounded-lg bg-primary-label px-2 py-1 text-primary-background">Accept</button><button type="button" onClick={() => resolveRequest(request, 'decline')} className="rounded-lg bg-red-100 px-2 py-1 text-red-700">Decline</button></span>)}</div>}
            {publishing && <><button type="button" onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} className="grid h-11 w-11 place-items-center rounded-xl bg-primary-background/15">{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button><button type="button" onClick={toggleCamera} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} className="grid h-11 w-11 place-items-center rounded-xl bg-primary-background/15">{cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}</button></>}
          </div>
        </Surface>
      ) : (
        <section className="live-lobby-surface rounded-[2rem] p-5 shadow-2xl sm:p-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-label/55">On air now</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Find a room to step into</h2><p className="mt-2 max-w-xl text-sm text-primary-label/65">Preview the atmosphere before you join the conversation.</p></div><span className="rounded-full bg-primary-label/10 px-3 py-1.5 text-xs font-semibold text-primary-label/70">{sessions.length} live {sessions.length === 1 ? 'room' : 'rooms'}</span></div>
          {sessions.length === 0 ? <div className="live-empty-state rounded-2xl px-5 py-20 text-center"><Radio size={30} className="mx-auto mb-4 text-primary-label/45" /><p className="font-semibold">No one is live right now.</p><p className="mt-2 text-sm text-primary-label/55">Start a room and your preview will appear here.</p></div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{sessions.map((session) => { const hostName = session.host?.username || session.host?.name || 'Host'; const avatar = session.host?.avatarUrl; return <article key={session.id} className="live-preview-card group min-w-0 overflow-hidden rounded-2xl text-left"><button type="button" onClick={() => join(session)} className="block w-full text-left" aria-label={`Join ${session.title}`}><div className="live-preview-art relative aspect-[16/10] overflow-hidden">{avatar ? <img src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 live-preview-pattern" />}<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/25" /><div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#ff4d67] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live</div><div className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15 text-white backdrop-blur-md transition group-hover:scale-105"><Radio size={24} /></span></div><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white"><div className="min-w-0"><h3 className="truncate text-lg font-semibold">{session.title}</h3><p className="mt-1 truncate text-xs text-white/70">Hosted by {hostName}</p></div><span className="shrink-0 text-xs text-white/75"><Users size={13} className="mr-1 inline" />{session.viewerCount || 0}</span></div></div></button><div className="flex items-center justify-between gap-3 px-4 py-3"><p className="min-w-0 truncate text-xs text-primary-label/60">{session.description || 'Live conversation in progress'}</p><button type="button" onClick={() => join(session)} className="shrink-0 rounded-lg bg-primary-label px-3 py-2 text-xs font-semibold text-primary-background transition hover:-translate-y-0.5">Join room</button></div></article>; })}</div>}
        </section>
      )}
    </div>
    {showCreate && <div className="fixed inset-0 z-50 grid place-items-center bg-primary-label/35 p-4 backdrop-blur-md"><Surface className="w-full max-w-lg p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">Start a live room</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl bg-primary-label/10"><X size={18} /></button></div><form onSubmit={start} className="space-y-4"><label className="block text-sm font-semibold">Room title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-primary-label/15 bg-white/50 px-4 outline-none focus:ring-2 focus:ring-primary-label/30" placeholder="Late night listening session" /></label><label className="block text-sm font-semibold">Description <span className="font-normal text-primary-label/60">(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-y rounded-xl border border-primary-label/15 bg-white/50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-label/30" placeholder="What are we listening to?" /></label><button disabled={busy} className="min-h-12 w-full rounded-xl bg-primary-label px-4 font-semibold text-primary-background disabled:opacity-50">{busy ? 'Starting...' : 'Start live room'}</button></form></Surface></div>}
  </main>;
}





