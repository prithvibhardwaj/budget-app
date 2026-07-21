import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { api, loadStored, setToken, saveRecoveryCode } from './api';

const AuthContext = createContext(null);

async function syncLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (status !== 'granted') {
      await api('/api/me/location', { method: 'PUT', body: { timezone } });
      return;
    }
    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    await api('/api/me/location', {
      method: 'PUT',
      body: { lat: pos.coords.latitude, lon: pos.coords.longitude, timezone },
    });
  } catch {
    // location sync is best-effort; expenses fall back to home currency
  }
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  const refreshUser = useCallback(async () => {
    const me = await api('/api/me');
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    (async () => {
      const { token } = await loadStored();
      if (token) {
        try {
          await refreshUser();
          syncLocation();
        } catch (err) {
          if (err.status === 401) await setToken(null);
        }
      }
      setReady(true);
    })();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncLocation();
    });
    return () => sub.remove();
  }, [user]);

  // Creates an anonymous account tied to this device and returns the recovery
  // code. Deliberately does NOT set `user` — otherwise the app would navigate
  // straight past the screen showing the code. Call finishOnboarding() after.
  const createDeviceAccount = useCallback(async (name) => {
    const { token, recovery_code } = await api('/api/auth/device', {
      method: 'POST',
      body: { name: name || 'Me' },
    });
    await setToken(token);
    await saveRecoveryCode(recovery_code);
    return recovery_code;
  }, []);

  const finishOnboarding = useCallback(async () => {
    await refreshUser();
    syncLocation();
  }, [refreshUser]);

  const restore = useCallback(async (recoveryCode) => {
    const { token } = await api('/api/auth/restore', {
      method: 'POST',
      body: { recovery_code: recoveryCode },
    });
    await setToken(token);
    await saveRecoveryCode(recoveryCode);
    await refreshUser();
    syncLocation();
  }, [refreshUser]);

  // Kept for accounts made before device identity existed.
  const loginWithEmail = useCallback(async (email, password) => {
    const { token } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    await setToken(token);
    await refreshUser();
    syncLocation();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, user, createDeviceAccount, finishOnboarding, restore, loginWithEmail, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
