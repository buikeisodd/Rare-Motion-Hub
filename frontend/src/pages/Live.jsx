import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Video, X, LogOut, Users, ArrowLeft, Mic, MicOff, Camera, CameraOff, Send, Heart } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/live');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) { setMessage(error.message || 'Live rooms are temporarily unavailable.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        room.on(RoomEvent.TrackSubscribed, (track) => {
          const element = track.attach();
          if (track.kind === Track.Kind.Video) element.className = 'absolute inset-0 h-full w-full object-contain';
          if (track.kind === Track.Kind.Audio) element.className = 'hidden';
          document.getElementById('live-media-stage')?.appendChild(element);
        });
        await room.connect(data.serverUrl, data.token);
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
              element.className = 'h-full w-full object-cover';
              document.getElementById('live-media-stage')?.appendChild(element);
            }
          });
        }
        setPublishing(Boolean(data.canPublish)); setConnected(true);
      } catch (error) { setMessage(error.message || 'Could not connect to the live room.'); }
    };
    connect();
    return () => { cancelled = true; setConnected(false); setPublishing(false); setVideoUnavailable(false); setCameraOn(true); setMicOn(true); setLiveMessages([]); roomRef.current = null; room?.disconnect(); document.getElementById('live-media-stage')?.replaceChildren(); };
  }, [active]);

  const start = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setMessage('');
    try {
      const data = await apiRequest('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
      setSessions((current) => [data.session, ...current]); setActive(data.session); setTitle(''); setDescription(''); setShowCreate(false);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const join = async (session) => {
    setBusy(true); setMessage('');
    try {
      const data = await apiRequest(`/api/live/${session.id}/join`, { method: 'POST' });
      setActive(data.session || session); setSessions((current) => current.map((item) => item.id === session.id ? { ...item, viewerCount: data.viewerCount } : item));
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const end = async () => {
    if (!active || active.hostId !== user?.id) return;
    setBusy(true);
    try { await fetch(`${apiUrl}/api/live/${active.id}/end`, { method: 'POST', credentials: 'include' }); setActive(null); setSessions((current) => current.filter((item) => item.id !== active.id)); }
    catch { setMessage('Could not end live room.'); } finally { setBusy(false); }
  };

  const toggleCamera = async () => { const next = !cameraOn; await roomRef.current?.localParticipant.setCameraEnabled(next); setCameraOn(next); };
  const toggleMic = async () => { const next = !micOn; await roomRef.current?.localParticipant.setMicrophoneEnabled(next); setMicOn(next); };
  const sendLiveData = async (event) => { if (!roomRef.current || !connected) return; const payload = { ...event, sender: user?.username || user?.name || 'Listener' }; setLiveMessages((current) => [...current.slice(-49), payload]); await roomRef.current.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true }); };
  const sendChat = async (event) => { event.preventDefault(); if (!chatText.trim()) return; const text = chatText.trim(); setChatText(''); await sendLiveData({ type: 'chat', text }); };
  const sendReaction = async () => { await sendLiveData({ type: 'reaction', emoji: '♥️', text: '♥️ reaction' }); };

  return <main className="min-h-screen bg-primary-background px-4 pb-24 pt-6 text-primary-label sm:px-8 lg:px-12">
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><Link to="/feed" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-label/70 hover:text-primary-label"><ArrowLeft size={16} /> Back to feed</Link><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Live</h1><p className="mt-2 max-w-xl text-primary-label/70">Listen together in real time, with room for conversation.</p></div>
        <button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-label px-5 py-3 font-semibold text-primary-background shadow-lg transition hover:-translate-y-0.5 active:translate-y-0"><Radio size={18} /> Go live</button>
      </header>
      {message && <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{message}</p>}
      {active ? <Surface className="fixed inset-3 z-40 mb-0 flex min-h-0 flex-col overflow-hidden sm:inset-6 lg:inset-10"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-label/10 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-label/60">Live room</p><h2 className="mt-1 text-2xl font-semibold">{active.title}</h2></div><div className="flex items-center gap-3 text-sm text-primary-label/70"><span className="inline-flex items-center gap-1"><Users size={15} /> {active.viewerCount || active.viewerIds?.length || 0}</span>{active.hostId === user?.id && <button type="button" onClick={end} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><LogOut size={16} /> End</button>}<button type="button" onClick={() => setActive(null)} aria-label="Close live room" className="grid h-10 w-10 place-items-center rounded-xl bg-primary-label/10"><X size={18} /></button></div></div><div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem]"><div id="live-media-stage" className="relative grid min-h-[18rem] place-items-center gap-3 overflow-hidden bg-primary-label px-6 py-12 text-center text-primary-background [&_video]:absolute [&_video]:inset-0">{!connected && <div className="pointer-events-none relative z-10 rounded-xl bg-primary-label/70 p-4"><Video size={42} className="mx-auto mb-4 opacity-70" /><h3 className="text-xl font-semibold">Connecting...</h3><p className="mt-2 max-w-md text-sm text-primary-background/70">Joining the live room...</p></div>}</div><aside className="flex min-h-0 flex-col border-t border-primary-background/10 bg-[#F3EBDD] p-4 text-primary-label lg:border-l lg:border-t-0"><div className="mb-3 flex items-center justify-between"><strong>Live chat</strong><button type="button" onClick={sendReaction} aria-label="Send reaction" className="rounded-xl p-2 text-red-600"><Heart size={18} /></button></div><div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">{liveMessages.map((item, index) => <p key={`${item.sender}-${index}`}><strong>{item.sender}</strong> {item.text}</p>)}</div><form onSubmit={sendChat} className="mt-3 flex gap-2"><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Say something..." className="min-w-0 flex-1 rounded-xl border border-primary-label/15 bg-white/60 px-3 py-2 outline-none" /><button type="submit" aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background"><Send size={16} /></button></form></aside></div><div className="flex flex-wrap items-center justify-center gap-2 bg-primary-label px-4 py-3 text-primary-background">{publishing && <><button type="button" onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} className="grid h-11 w-11 place-items-center rounded-xl bg-primary-background/15">{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button><button type="button" onClick={toggleCamera} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} className="grid h-11 w-11 place-items-center rounded-xl bg-primary-background/15">{cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}</button></>}</div></Surface> : <Surface className="p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">Currently live</h2><span className="text-sm text-primary-label/60">{sessions.length} room{sessions.length === 1 ? '' : 's'}</span></div>{sessions.length === 0 ? <div className="rounded-xl border border-dashed border-primary-label/20 px-5 py-14 text-center text-primary-label/65">No one is live right now.</div> : <div className="grid gap-3 sm:grid-cols-2">{sessions.map((session) => <button key={session.id} type="button" onClick={() => join(session)} className="flex min-w-0 items-center gap-4 rounded-xl border border-primary-label/10 bg-white/35 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/60"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-label text-primary-background"><Radio size={21} /></span><span className="min-w-0 flex-1"><strong className="block truncate">{session.title}</strong><span className="mt-1 block truncate text-sm text-primary-label/65">{session.host?.username || session.host?.name || 'Host'} · {session.viewerCount || 0} listening</span></span><span className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">LIVE</span></button>)}</div>}</Surface>}
    </div>
    {showCreate && <div className="fixed inset-0 z-50 grid place-items-center bg-primary-label/35 p-4 backdrop-blur-md"><Surface className="w-full max-w-lg p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">Start a live room</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl bg-primary-label/10"><X size={18} /></button></div><form onSubmit={start} className="space-y-4"><label className="block text-sm font-semibold">Room title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-primary-label/15 bg-white/50 px-4 outline-none focus:ring-2 focus:ring-primary-label/30" placeholder="Late night listening session" /></label><label className="block text-sm font-semibold">Description <span className="font-normal text-primary-label/60">(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-y rounded-xl border border-primary-label/15 bg-white/50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-label/30" placeholder="What are we listening to?" /></label><button disabled={busy} className="min-h-12 w-full rounded-xl bg-primary-label px-4 font-semibold text-primary-background disabled:opacity-50">{busy ? 'Starting...' : 'Start live room'}</button></form></Surface></div>}
  </main>;
}


