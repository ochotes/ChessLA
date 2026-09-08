import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import type { PublicProfile } from "../lib/types";

interface AuthContextValue {
  user: PublicProfile | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; fullName: string; email: string; password: string; country: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: PublicProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      // /auth/session always resolves 200 (user: null when logged out) so an
      // anonymous visit doesn't show up as a 401 in the browser console.
      const { user } = await api.get<{ user: PublicProfile | null }>("/auth/session");
      setUser(user);
      if (user) connectSocket();
      else disconnectSocket();
    } catch {
      setUser(null);
      disconnectSocket();
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (identifier: string, password: string) => {
    const { user } = await api.post<{ user: PublicProfile }>("/auth/login", { identifier, password });
    setUser(user);
    connectSocket();
  }, []);

  const register = useCallback(
    async (data: { username: string; fullName: string; email: string; password: string; country: string }) => {
      const { user } = await api.post<{ user: PublicProfile }>("/auth/register", data);
      setUser(user);
      connectSocket();
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      disconnectSocket();
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refreshUser, setUser }),
    [user, isLoading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
