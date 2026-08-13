import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then((stored) => {
        if (stored) setUser(JSON.parse(stored));
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, _password: string) => {
    // Accept any credentials for demo, or specific demo credentials
    const isValid =
      email.includes('@') ||
      (email === DEMO_EMAIL && _password === DEMO_PASSWORD);

    if (!isValid) {
      return { success: false, error: 'Invalid credentials. Use demo@quickprop.co.zw / demo1234' };
    }

    const loggedInUser: User = { ...MOCK_USER, email };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return { success: true };
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  /**
   * Permanently deletes the account: wipes all locally stored data and signs
   * the user out. In a production build this would also call DELETE /auth/account
   * on the API server to remove the record from the database.
   */
  const deleteAccount = async () => {
    await AsyncStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
