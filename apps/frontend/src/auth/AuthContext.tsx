import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }
    try {
      const refreshResponse = await apiClient.post('/auth/refresh', { refreshToken });
      tokenStore.setAccessToken(refreshResponse.data.accessToken);
      const meResponse = await apiClient.get<User>('/auth/me');
      setUser(meResponse.data);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await apiClient.post('/auth/login', { email, password });
    tokenStore.setAccessToken(response.data.accessToken);
    tokenStore.setRefreshToken(response.data.refreshToken);
    setUser(response.data.user);
  }

  async function logout() {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
