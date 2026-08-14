import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  getStoredToken,
  getStoredRefreshToken,
  getStoredCsrfToken,
  storeToken,
  storeRefreshToken,
  storeCsrfToken,
  clearAuth,
} from './storage';

const fallbackLocalUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  fallbackLocalUrl;

export function resolveMediaUrl(url) {
  if (!url) return url;
  try {
    const api = new URL(API_URL);
    const media = new URL(url);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(media.hostname)) {
      media.protocol = api.protocol;
      media.hostname = api.hostname;
      media.port = api.port;
      return media.toString();
    }
    return url;
  } catch {
    if (url.startsWith('/')) return `${API_URL.replace(/\/$/, '')}${url}`;
    return url;
  }
}

// Auth-exempt paths that should never trigger a token refresh attempt
const AUTH_EXEMPT = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];
const isAuthExempt = (path) => AUTH_EXEMPT.some((p) => path.includes(p));

// Single-flight refresh: concurrent 401s share one refresh call
let refreshPromise = null;

async function attemptTokenRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await getStoredRefreshToken();
        if (!refreshToken) return null;
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'mobile',
          },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.token) return null;
        await Promise.all([
          storeToken(data.token),
          data.refreshToken ? storeRefreshToken(data.refreshToken) : Promise.resolve(),
          data.csrfToken ? storeCsrfToken(data.csrfToken) : Promise.resolve(),
        ]);
        return data.token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// onForceLogout is set by the app root so it can clear React state
let _onForceLogout = null;
export function setForceLogoutHandler(fn) { _onForceLogout = fn; }

async function forceLogout() {
  await clearAuth();
  _onForceLogout?.();
}

async function buildHeaders(options = {}) {
  const token = await getStoredToken();
  const csrfToken = await getStoredCsrfToken();
  return {
    'Content-Type': 'application/json',
    'X-Client-Type': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(options.headers || {}),
  };
}

export async function api(path, options = {}) {
  const headers = await buildHeaders(options);
  let response = await fetch(`${API_URL}${path}`, { ...options, headers });

  // 401 — attempt a single token refresh then retry, unless this is an
  // auth-exempt endpoint (where a 401 is a real failure, not an expiry).
  if (response.status === 401 && !isAuthExempt(path)) {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      const retryHeaders = await buildHeaders(options);
      response = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders });
    }
    if (response.status === 401) {
      await forceLogout();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 140);
      throw new Error(
        response.ok
          ? `Server returned an invalid response: ${preview || 'empty response'}`
          : `Server error ${response.status}: ${preview || response.statusText || 'invalid response'}`
      );
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

// FormData upload variant — does NOT set Content-Type (browser/RN sets it
// with the correct multipart boundary automatically). Auth headers are
// still attached, and 401 refresh-and-retry still applies.
export async function apiUpload(path, formData) {
  const token = await getStoredToken();
  const csrfToken = await getStoredCsrfToken();
  const headers = {
    'X-Client-Type': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
  };

  let response = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });

  if (response.status === 401 && !isAuthExempt(path)) {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      const retryHeaders = {
        'X-Client-Type': 'mobile',
        Authorization: `Bearer ${newToken}`,
        ...(await getStoredCsrfToken().then((t) => t ? { 'x-csrf-token': t } : {}).catch(() => ({}))),
      };
      response = await fetch(`${API_URL}${path}`, { method: 'POST', headers: retryHeaders, body: formData });
    }
    if (response.status === 401) {
      await forceLogout();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON response */ }
  if (!response.ok) throw new Error(data?.error || 'Upload failed');
  return data;
}
