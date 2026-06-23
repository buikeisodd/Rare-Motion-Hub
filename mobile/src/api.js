import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fallbackLocalUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

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

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}
