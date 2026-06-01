"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ApiUser } from "./types";
import {
  fetchUser,
  getToken,
  login as apiLogin,
  loginWithSms,
  loginWithWechat,
  logout as apiLogout,
  register as apiRegister,
  setToken,
} from "./api-client";

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginPhone: (
    phone: string,
    code: string,
    inviteCode?: string,
  ) => Promise<void>;
  loginWechat: (code: string, inviteCode?: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    inviteCode?: string,
  ) => Promise<Awaited<ReturnType<typeof apiRegister>>>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const u = await fetchUser();
      setUser(u);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await apiLogin(email, password);
    setUser(u);
  }, []);

  const loginPhone = useCallback(
    async (phone: string, code: string, inviteCode?: string) => {
      const { user: u } = await loginWithSms(phone, code, inviteCode);
      setUser(u);
    },
    [],
  );

  const loginWechat = useCallback(async (code: string, inviteCode?: string) => {
    const { user: u } = await loginWithWechat(code, inviteCode);
    setUser(u);
  }, []);

  const register = useCallback(
    async (email: string, password: string, inviteCode?: string) => {
      const data = await apiRegister(email, password, inviteCode);
      setUser(data.user);
      return data;
    },
    [],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginPhone,
      loginWechat,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, loginPhone, loginWechat, register, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
