// src/lib/auth.ts

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage } from './storage';
import { api } from './api';
import { registerPushToken } from './notifications';

import type { IAuthUser } from '@/interfaces';

type AuthContextType = {
  user: IAuthUser | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function buildAuthUser(userData: any): IAuthUser {
  const roles = userData.userRoles
    ? userData.userRoles.flatMap((ur: any) => [ur.role?.name?.toUpperCase(), ur.roleId].filter(Boolean))
    : userData.roles ?? [];

  return {
    id: userData.id,
    name: userData.name,
    username: userData.username,
    type: userData.type ?? 'CONTRIBUTOR',
    roles,
    sellers: userData.sellers ?? [],
    cells: userData.cells ?? [],
    cellNetworks: userData.cellNetworks ?? [],
    cellsMember: userData.cellsMember ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await storage.getItem('token');
      const u = await storage.getItem('user');
      if (t && u) {
        // Carrega o cache imediatamente para não travar a UI
        setToken(t);
        setUser(JSON.parse(u));
        setReady(true);
        // Depois faz refresh silencioso do perfil para garantir dados atualizados
        try {
          const data = await api.get<any>('/contributors/me');
          const fresh = buildAuthUser(data);
          await storage.setItem('user', JSON.stringify(fresh));
          setUser(fresh);
        } catch {
          // Se falhar (token expirado, offline), mantém o cache
        }
      } else {
        setToken(t);
        setUser(null);
        setReady(true);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.post<{ access_token: string; user: any }>(
      '/auth/contributor/login',
      { username, password },
    );

    const { access_token, user: userData } = data;
    const authUser = buildAuthUser(userData);

    await storage.setItem('token', access_token);
    await storage.setItem('user', JSON.stringify(authUser));
    setToken(access_token);
    setUser(authUser);
    // Registrar push token após login
    registerPushToken().catch(() => {});
  };

  const logout = async () => {
    await storage.deleteItem('token');
    await storage.deleteItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
