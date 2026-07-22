import { getItem, setItem, deleteItem } from './storage';

// Set this to your deployed backend URL (or change it from the login screen).
export const DEFAULT_API_URL = 'https://budget-app-production-7176.up.railway.app';

let baseUrl = DEFAULT_API_URL;
let token = null;

export async function loadStored() {
  const [storedUrl, storedToken] = await Promise.all([
    getItem('api_url'),
    getItem('token'),
  ]);
  if (storedUrl) baseUrl = storedUrl;
  token = storedToken || null;
  return { baseUrl, token };
}

export function getBaseUrl() {
  return baseUrl;
}

export async function setBaseUrl(url) {
  baseUrl = url.replace(/\/+$/, '');
  await setItem('api_url', baseUrl);
}

export async function setToken(t) {
  token = t;
  if (t) await setItem('token', t);
  else await deleteItem('token');
}

// Kept locally so Settings can redisplay it — the server stores only its hash.
export async function saveRecoveryCode(code) {
  await setItem('recovery_code', code);
}

export async function getRecoveryCode() {
  return getItem('recovery_code');
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach server. Check the server URL and your connection.');
  }
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(json?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}
