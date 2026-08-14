import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Keys
const USER_KEY = 'rare-motion-hub:user';
const EMAIL_KEY = 'rare-motion-hub:last-email';
const OFFLINE_TRACKS_KEY = 'rare-motion-hub:offline-tracks';

// Secure keys — stored in the OS keychain/keystore, encrypted at rest,
// sandboxed to this app. Not accessible to other apps or via iTunes backups.
const SECURE_TOKEN_KEY = 'rmh_access_token';
const SECURE_REFRESH_KEY = 'rmh_refresh_token';
const SECURE_CSRF_KEY = 'rmh_csrf_token';

// Non-sensitive profile data — AsyncStorage is fine
export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function storeUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Auth tokens — SecureStore (encrypted OS keychain/keystore)
export async function getStoredToken() {
  return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
}

export async function storeToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
}

export async function getStoredRefreshToken() {
  return await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
}

export async function storeRefreshToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(SECURE_REFRESH_KEY, token);
}

export async function getStoredCsrfToken() {
  return await SecureStore.getItemAsync(SECURE_CSRF_KEY);
}

export async function storeCsrfToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(SECURE_CSRF_KEY, token);
}

export async function clearAuth() {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(SECURE_REFRESH_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(SECURE_CSRF_KEY).catch(() => {}),
    AsyncStorage.removeItem(USER_KEY),
    // Clear legacy AsyncStorage token key from old mechanism
    AsyncStorage.removeItem('rare-motion-hub:token').catch(() => {}),
  ]);
}

// Kept for backward compatibility — calls clearAuth internally
export async function clearUser() {
  await clearAuth();
}

export async function getLastEmail() {
  return (await AsyncStorage.getItem(EMAIL_KEY)) || '';
}

export async function storeLastEmail(email) {
  await AsyncStorage.setItem(EMAIL_KEY, email);
}

export async function getOfflineTracks() {
  const raw = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function storeOfflineTracks(tracks) {
  await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(tracks));
}
