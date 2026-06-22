import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'rare-motion-hub:user';
const EMAIL_KEY = 'rare-motion-hub:last-email';

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function storeUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function getLastEmail() {
  return (await AsyncStorage.getItem(EMAIL_KEY)) || '';
}

export async function storeLastEmail(email) {
  await AsyncStorage.setItem(EMAIL_KEY, email);
}
