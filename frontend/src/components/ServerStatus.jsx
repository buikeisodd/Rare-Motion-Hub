import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ServerStatus() {
  const [status, setStatus] = useState('online'); // 'online' | 'slow' | 'offline'
  const [show, setShow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const ping = async () => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${apiUrl}/api/ping`, { signal: controller.signal });
      clearTimeout(timeout);
      const ms = Date.now() - start;
      if (res.ok) {
        setStatus(ms > 3000 ? 'slow' : 'online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  };

  useEffect(() => {
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'online') {
      // Hide after 2s when back online
      const t = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(t);
    } else {
      setShow(true);
    }
  }, [status]);

  const retry = async () => {
    setRetrying(true);
    await ping();
    setRetrying(false);
  };

  if (!show) return null;

  const configs = {
    slow: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${retrying ? 'animate-spin' : 'animate-spin-slow'}`} />,
      text: 'text-amber-400',
      label: 'Server is waking up…',
      sub: 'This may take up to 30 seconds on free tier.',
    },
    offline: {
      bg: 'bg-red-500/10 border-red-500/30',
      icon: <WifiOff className="h-3.5 w-3.5 text-red-400" />,
      text: 'text-red-400',
      label: 'Cannot reach server',
      sub: 'Check your connection or try again.',
    },
    online: {
      bg: 'bg-green-500/10 border-green-500/30',
      icon: <Wifi className="h-3.5 w-3.5 text-green-400" />,
      text: 'text-green-400',
      label: 'Back online',
      sub: '',
    },
  };

  const c = configs[status];

  return (
    <div className={`fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-xl animate-slide-up ${c.bg}`}>
      {/* Animated dots for slow/offline */}
      {status !== 'online' && (
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${status === 'slow' ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      )}
      {c.icon}
      <div>
        <p className={`text-xs font-semibold ${c.text}`}>{c.label}</p>
        {c.sub && <p className="text-[10px] text-white/40">{c.sub}</p>}
      </div>
      {status !== 'online' && (
        <button
          onClick={retry}
          disabled={retrying}
          className="ml-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          {retrying ? 'Checking…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
