import { Platform } from 'react-native';

// expo-secure-store is native-only (Android/iOS keychain). On web we fall back
// to localStorage, which is origin-scoped but NOT encrypted at rest — a browser
// simply has no equivalent of the OS keychain. Everything stored here is a
// bearer credential, so the web build trades some at-rest protection for
// being installable without an app store.
const isWeb = Platform.OS === 'web';

// Required lazily: expo-secure-store is a native module with no web
// implementation, so it is never loaded in the browser bundle's code path.
function secureStore() {
  return require('expo-secure-store');
}

function webAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

// In-memory last resort (private browsing can throw on localStorage access).
const memory = new Map();

export async function getItem(key) {
  if (isWeb) {
    if (!webAvailable()) return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  }
  return secureStore().getItemAsync(key);
}

export async function setItem(key, value) {
  if (isWeb) {
    memory.set(key, value);
    if (!webAvailable()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch { /* quota or private mode — memory copy still serves this session */ }
    return;
  }
  return secureStore().setItemAsync(key, value);
}

export async function deleteItem(key) {
  if (isWeb) {
    memory.delete(key);
    if (!webAvailable()) return;
    try {
      window.localStorage.removeItem(key);
    } catch { /* nothing to clean up */ }
    return;
  }
  return secureStore().deleteItemAsync(key);
}
