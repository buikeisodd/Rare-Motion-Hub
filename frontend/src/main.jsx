import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const originalFetch = window.fetch;

// Single-flight refresh: if several requests 401 at once, only one
// /api/auth/refresh call fires; the rest wait on the same promise.
let refreshPromise = null;
let isRefreshing = false;

const isAuthExemptUrl = (url) => (
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

// Global fetch interceptor: add credentials:include and CSRF header to all
// /api/ requests. On 401 attempts a single token refresh then retries once.
// No Bearer headers — authentication is cookie-only.
window.fetch = async (url, options = {}) => {
  const isApiCall = typeof url === 'string' && url.includes('/api/');
  if (isApiCall) {
    options.credentials = 'include';
    // CSRF double-submit: echo the csrfToken cookie value as a header.
    // The cookie is not HttpOnly so JS can read it; an attacker making a
    // cross-site request cannot read cookie values, so they can't echo it.
    const csrfMatch = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('csrfToken=') || c.startsWith('__Host-csrfToken='));
    if (csrfMatch) {
      const csrfValue = decodeURIComponent(csrfMatch.split('=').slice(1).join('='));
      options.headers = { ...options.headers, 'x-csrf-token': csrfValue };
    }
  }

  let res = await originalFetch(url, options);

  if (res.status === 401 && isApiCall && !isAuthExemptUrl(url)) {
    const user = await attemptRefresh();
    if (user) {
      // Retry the original request — the refresh set new cookies automatically.
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
