import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const originalFetch = window.fetch;

// Single-flight refresh: if several requests 401 at once, only one
// /api/auth/refresh call should fire; the rest wait on the same promise.
let refreshPromise = null;

const isAuthExemptUrl = (url) => (
  url.includes('/api/auth/refresh') ||
  url.includes('/api/auth/register') ||
  url.includes('/api/auth/login') ||
  url.includes('/api/auth/verify-email') ||
  url.includes('/api/auth/resend-verification') ||
  url.includes('/api/auth/forgot-password') ||
  url.includes('/api/auth/reset-password')
);

const attemptRefresh = async () => {
  if (!refreshPromise) {
    refreshPromise = originalFetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.user || !data.token) return null;
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        if (data.csrfToken) localStorage.setItem('csrfToken', data.csrfToken);
        return data.token;
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const forceLogout = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('csrfToken');
  window.location.href = '/login';
};

window.fetch = async (url, options = {}) => {
  const isApiCall = typeof url === 'string' && url.includes('/api/');
  if (isApiCall) {
    const token = localStorage.getItem('token');
    if (token) {
      options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
    }
    if (options.credentials === undefined) options.credentials = 'include';
  }

  let res = await originalFetch(url, options);

  if (res.status === 401 && isApiCall && !isAuthExemptUrl(url)) {
    const newToken = await attemptRefresh();
    if (newToken) {
      // Retry the original request once with the fresh token.
      options.headers = { ...options.headers, Authorization: `Bearer ${newToken}` };
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
