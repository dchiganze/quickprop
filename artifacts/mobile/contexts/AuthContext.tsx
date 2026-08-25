import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types';
import { clearDataContextMemory } from './dataReset';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: (password: string, confirmation: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const MOCK_USER: User = {
  id: 'agent-001',
  name: 'John Mitchell',
  email: 'john.mitchell@prime-properties.co.zw',
  phone: '+263 77 123 4567',
  agency: 'Prime Properties',
  branch: 'Borrowdale Branch',
  licenceNumber: 'ZW-RE-2024-0891',
  role: 'agent',
};

const DEMO_EMAIL = 'demo@quickprop.co.zw';
const DEMO_PASSWORD = 'demo1234';
const AUTH_KEY = '@quickprop_user';
const AUTH_TOKEN_KEY = 'quickprop_access_token';
const LEGACY_AUTH_TOKEN_KEY = '@quickprop_access_token';
const ACCOUNT_DATA_KEYS = [
  AUTH_TOKEN_KEY,
  LEGACY_AUTH_TOKEN_KEY,
  '@qp_properties',
  '@qp_leads',
  '@qp_matches',
  '@qp_tasks',
  '@qp_viewings',
  '@qp_pending_sync',
  '@qp_alerts',
  '@qp_biometric',
];

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const apiBaseUrl = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : null);
export const apiOrigin = apiBaseUrl?.replace(/\/api$/, '') ?? null;
export const AUTH_TOKEN_STORAGE_KEY = AUTH_TOKEN_KEY;

async function getStoredToken(): Promise<string | null> {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(AUTH_TOKEN_KEY)
    : SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

async function storeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return getStoredToken();
}

type ApiUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  branchId?: number | null;
  avatarUrl?: string | null;
};

type LoginResult = ApiUser & { accessToken: string };

function apiUrl(path: string): string {
  return `${apiBaseUrl!.replace(/\/$/, '')}${path}`;
}

function toMobileUser(apiUser: ApiUser): User {
  const role: User['role'] = apiUser.role === 'admin' || apiUser.role === 'principal'
    ? 'administrator'
    : 'agent';
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,
    phone: apiUser.phone ?? '',
    agency: 'QuickProp',
    branch: apiUser.branchId ? `Branch ${apiUser.branchId}` : '',
    licenceNumber: '',
    role,
    photo: apiUser.avatarUrl ?? undefined,
  };
}

async function clearLocalAccountData(): Promise<void> {
  clearDataContextMemory();
  await Promise.all([
    // AUTH_TOKEN_KEY was formerly kept in AsyncStorage. Remove this legacy
    // value as well so a token is never left behind during the migration.
    AsyncStorage.multiRemove(ACCOUNT_DATA_KEYS),
    removeStoredToken(),
  ]);
}

async function clearAccountSession(): Promise<void> {
  await clearLocalAccountData();
  await AsyncStorage.removeItem(AUTH_KEY);
}

function storedUserIdentity(serializedUser: string | null): string | null {
  if (!serializedUser) return null;
  try {
    const stored = JSON.parse(serializedUser) as Partial<User>;
    if (typeof stored.id !== 'string' || typeof stored.email !== 'string') return null;
    return `${stored.id}:${stored.email.toLowerCase()}`;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  deleteAccount: async () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const [storedUser, storedToken] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEY),
        getStoredToken(),
      ]);
      const serializedUser = storedUser;
      const token = storedToken;
      if (!serializedUser) return;

      if (!apiBaseUrl) {
        // Local-demo fallback: no remote identity exists to validate.
        setUser(JSON.parse(serializedUser) as User);
        return;
      }

      if (!token) {
        await clearAccountSession();
        return;
      }

      try {
        const response = await fetch(apiUrl('/auth/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Session is no longer valid');
        const remoteUser = await response.json() as ApiUser;
        const restoredUser = toMobileUser(remoteUser);
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(restoredUser));
        setUser(restoredUser);
      } catch {
        // An expired or invalid native token simply returns the app to its
        // normal sign-in screen and removes only account-scoped local data.
        await clearAccountSession();
      }
    };

    restoreSession()
      .catch(() => clearAccountSession())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    if (apiBaseUrl) {
      try {
        const response = await fetch(apiUrl('/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json().catch(() => null) as (LoginResult & { error?: string }) | null;
        if (!response.ok || !result?.accessToken) {
          return { success: false, error: result?.error ?? 'Invalid credentials.' };
        }
        const loggedInUser = toMobileUser(result);
        const currentStoredIdentity = storedUserIdentity(await AsyncStorage.getItem(AUTH_KEY));
        const nextIdentity = `${loggedInUser.id}:${loggedInUser.email.toLowerCase()}`;
        if (currentStoredIdentity && currentStoredIdentity !== nextIdentity) {
          // Never let a newly authenticated account inherit the previous
          // account's hydrated DataContext state or persisted records.
          await clearLocalAccountData();
        }
        await Promise.all([
          AsyncStorage.setItem(AUTH_KEY, JSON.stringify(loggedInUser)),
          storeToken(result.accessToken),
        ]);
        setUser(loggedInUser);
        return { success: true };
      } catch {
        return { success: false, error: 'Unable to reach the QuickProp server.' };
      }
    }

    // LOCAL-DEMO ONLY: this fallback is used exclusively when no API endpoint
    // is configured and does not represent a QuickProp server account.
    const isValid =
      email.includes('@') ||
      (email === DEMO_EMAIL && password === DEMO_PASSWORD);

    if (!isValid) {
      return { success: false, error: 'Invalid credentials. Use demo@quickprop.co.zw / demo1234' };
    }

    const loggedInUser: User = { ...MOCK_USER, email };
    const currentStoredIdentity = storedUserIdentity(await AsyncStorage.getItem(AUTH_KEY));
    const nextIdentity = `${loggedInUser.id}:${loggedInUser.email.toLowerCase()}`;
    if (currentStoredIdentity && currentStoredIdentity !== nextIdentity) {
      await clearLocalAccountData();
    }
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return { success: true };
  };

  const logout = async () => {
    await clearAccountSession();
    setUser(null);
  };

  const deleteAccount = async (password: string, confirmation: string) => {
    if (!user) throw new Error('You must be signed in to delete your account.');
    if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm account deletion.');

    if (!apiBaseUrl) {
      // LOCAL-DEMO ONLY: permanently remove every local user-scoped record.
      // There is intentionally no server deletion request in this mode.
      await clearAccountSession();
      setUser(null);
      return;
    }

    const token = await getStoredToken();
    if (!token) throw new Error('Your session has expired. Please sign in again before deleting your account.');

    let response: Response;
    try {
      response = await fetch(apiUrl('/auth/account'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password, confirmation }),
      });
    } catch {
      throw new Error('Unable to reach the QuickProp server. Your account was not deleted.');
    }

    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response.ok || result?.ok !== true) {
      throw new Error(result?.error ?? 'Account deletion failed. Your account was not deleted.');
    }

    // Remove all user-scoped local data only after the server confirms the
    // irreversible deletion. DataContext restores from these storage keys.
    // Reset synchronously first, invalidating any in-flight DataContext
    // hydration before its persisted keys are removed.
    await clearAccountSession();
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, deleteAccount, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
