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

// Attempt a silent token refresh. Captures the new CSRF token from the
// response header so it is immediately available for the retry.
const attemptRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = originalFetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then((res) => {
        if (!res.ok) return null;
        // Capture the fresh CSRF token echoed in the refresh response.
        const echoedCsrf = res.headers.get('x-csrf-token');
        if (echoedCsrf) localStorage.setItem('csrfToken', echoedCsrf);
        return res.json();
      })
      .then((data) => data?.user || null)
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const forceLogout = () => {
  localStorage.removeItem('csrfToken');
  window.dispatchEvent(new CustomEvent('auth:logout'));
  window.location.href = '/login';
};

// Read the CSRF double-submit token. Prefers the JS-readable cookie set by
// the server, keeping localStorage in sync as a fallback for cross-domain
// contexts where the cookie may not be readable (Safari ITP, new device
// before the first /me or /refresh response has been received).
const readCsrfToken = () => {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) =>
      c.startsWith('__Secure-csrfToken=') ||
      c.startsWith('__Host-csrfToken=') ||
      c.startsWith('csrfToken=')
    );
  if (match) {
    const val = decodeURIComponent(match.split('=').slice(1).join('='));
    localStorage.setItem('csrfToken', val); // keep in sync
    return val;
  }
  const stored = localStorage.getItem('csrfToken');
  if (stored) return stored;
  // Guaranteed non-empty fallback token so x-csrf-token header is never missing
  const fallback = 'csrf-' + Math.random().toString(36).substring(2);
  localStorage.setItem('csrfToken', fallback);
  return fallback;
};

// Global fetch interceptor.
// Every /api/ request automatically gets:
//   credentials: 'include'     — sends HttpOnly auth cookies
//   x-csrf-token: <value>      — CSRF double-submit pattern
//
// 401 handling: silent refresh → retry once → force logout.
// 403 CSRF handling: silent refresh (to get a fresh CSRF token) → retry once
//   → only force logout if the retry also fails. This prevents a fresh
//   device/tab (before /me has echoed a CSRF token) from being bounced to
//   the login page on its very first state-changing request.
window.fetch = async (url, options = {}) => {
  const isApiCall = typeof url === 'string' && url.includes('/api/');

  if (isApiCall) {
    options = { ...options };
    options.credentials = 'include';
    const csrf = readCsrfToken();
    const token = localStorage.getItem('accessToken');
    options.headers = { ...options.headers };
    if (csrf) options.headers['x-csrf-token'] = csrf;
    if (token) options.headers['authorization'] = `Bearer ${token}`;
  }

  let res = await originalFetch(url, options);

  // Capture CSRF & Access tokens echoed in API response headers.
  if (isApiCall) {
    const echoedCsrf = res.headers.get('x-csrf-token');
    if (echoedCsrf) localStorage.setItem('csrfToken', echoedCsrf);
    const echoedAccess = res.headers.get('x-access-token');
    if (echoedAccess) localStorage.setItem('accessToken', echoedAccess);
  }

  // ── 401: access token expired ─────────────────────────────────────────────
  if (res.status === 401 && isApiCall && !isAuthExemptUrl(url)) {
    const user = await attemptRefresh();
    if (user) {
      const csrf = readCsrfToken();
      const token = localStorage.getItem('accessToken');
      const retryOptions = { ...options, headers: { ...options.headers } };
      if (csrf) retryOptions.headers['x-csrf-token'] = csrf;
      if (token) retryOptions.headers['authorization'] = `Bearer ${token}`;
      res = await originalFetch(url, retryOptions);
      if (res.status !== 401) return res;
    }
    forceLogout();
    return res;
  }

  // ── 403: possible stale CSRF token ────────────────────────────────────────
  if (res.status === 403 && isApiCall && !isAuthExemptUrl(url)) {
    let isCsrfError = false;
    try {
      const data = await res.clone().json();
      isCsrfError =
        data.message === 'Forbidden: Invalid CSRF token' ||
        data.error === 'Forbidden: Invalid CSRF token';
    } catch { /* ignore JSON parse failures */ }

    if (isCsrfError) {
      // Silently refresh to rotate the session and receive a fresh CSRF token.
      const user = await attemptRefresh();
      if (user) {
        const csrf = readCsrfToken();
        const retryOptions = { ...options };
        if (csrf) retryOptions.headers = { ...retryOptions.headers, 'x-csrf-token': csrf };
        const retryRes = await originalFetch(url, retryOptions);

        // If the retry resolves (success or non-CSRF error), return it as-is.
        if (retryRes.status !== 403) return retryRes;

        // Retry also got a 403 — check if it's still a CSRF error.
        try {
          const retryData = await retryRes.clone().json();
          if (
            retryData.message === 'Forbidden: Invalid CSRF token' ||
            retryData.error === 'Forbidden: Invalid CSRF token'
          ) {
            forceLogout();
          }
        } catch { /* ignore */ }
        return retryRes;
      }
      // Refresh failed entirely (session fully expired) → log out.
      forceLogout();
    }
  }

  return res;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
