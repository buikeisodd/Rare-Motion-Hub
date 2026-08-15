import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const originalFetch = window.fetch;

// Single-flight refresh: if several requests 401 at once, only one
// /api/auth/refresh call fires; the rest wait on the same promise.
let refreshPromise = null;

const isAuthExemptUrl = (url) => (
  url.includes('/api/auth/me') ||
  url.includes('/api/auth/refresh') ||
  url.includes('/api/auth/register') ||
  url.includes('/api/auth/login') ||
  url.includes('/api/auth/verify-email') ||
  url.includes('/api/auth/resend-verification') ||
  url.includes('/api/auth/forgot-password') ||
  url.includes('/api/auth/reset-password')
);

const attemptRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = originalFetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.user || null)
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const forceLogout = () => {
  // No localStorage to clear — credentials live in HttpOnly cookies.
  // Dispatch a custom event so App.jsx can clear React state.
  window.dispatchEvent(new CustomEvent('auth:logout'));
  window.location.href = '/login';
};

// Read the CSRF double-submit cookie. The cookie name uses __Secure- prefix
// in production (cross-domain deployment) and no prefix in development.
const readCsrfCookie = () => {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) =>
      c.startsWith('__Secure-csrfToken=') ||
      c.startsWith('__Host-csrfToken=') ||
      c.startsWith('csrfToken=')
    );
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

// Global fetch interceptor — cookie-only auth, no Bearer tokens.
// Every /api/ request gets:
//   credentials: 'include'     → sends HttpOnly auth cookies automatically
//   x-csrf-token: <value>      → CSRF double-submit from the non-HttpOnly csrfToken cookie
// On 401: attempts a single silent refresh, retries once, then force-logouts.
window.fetch = async (url, options = {}) => {
  const isApiCall = typeof url === 'string' && url.includes('/api/');
  if (isApiCall) {
    options.credentials = 'include';
    const csrf = readCsrfCookie();
    if (csrf) {
      options.headers = { ...options.headers, 'x-csrf-token': csrf };
    }
  }

  let res = await originalFetch(url, options);

  if (res.status === 401 && isApiCall && !isAuthExemptUrl(url)) {
    const user = await attemptRefresh();
    if (user) {
      // Re-read CSRF after refresh — new cookies were set.
      const csrf = readCsrfCookie();
      if (csrf) options.headers = { ...options.headers, 'x-csrf-token': csrf };
      res = await originalFetch(url, options);
      if (res.status !== 401) return res;
    }
    forceLogout();
  }

  return res;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
