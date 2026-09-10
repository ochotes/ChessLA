import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, refreshSession } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useTheme } from "./ThemeContext";
import type { PublicProfile, UserSettings } from "../lib/types";

interface AuthContextValue {
  user: PublicProfile | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; fullName: string; email: string; password: string; country: string; website?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: PublicProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  // Theme is persisted per-account (UserSettings.theme on the server), not
  // just in this browser's localStorage — but nothing previously actually
  // applied that saved value on a fresh device or a cleared browser, so a
  // dark-mode account would silently revert to the system default the first
  // time it was opened somewhere new. Whenever an identity is established
  // (initial load, login, or register), pull the real saved value and apply
  // it, so the account's preference actually follows the account.
  useEffect(() => {
    if (!user) return;
    api
      .get<{ settings: UserSettings }>("/users/me/settings")
      .then((r) => {
        if (r.settings?.theme) setTheme(r.settings.theme);
      })
      .catch(() => {});
  }, [user, setTheme]);

  // React StrictMode double-invokes the mount effect below in development,
  // calling refreshUser() twice back to back. The network-level dedup in
  // refreshSession() stops that from firing two /auth/refresh calls, but
  // without this, the two full "check session -> maybe refresh -> check
  // again -> setUser" sequences can still interleave and race on setUser
  // itself, with whichever happens to finish last winning regardless of
  // which actually reflects reality. One in-flight call per AuthProvider
  // instance, shared by every concurrent caller, removes that race too.
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshUser = useCallback((): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const run = (async () => {
      try {
        // /auth/session always resolves 200 (user: null when logged out) so
        // an anonymous visit doesn't show up as a 401 in the browser console
        // — but that also means api.ts's own 401-triggered refresh-and-retry
        // never fires for this specific call, since there is no 401 to react
        // to. A stale access token cookie (the common case: reopening the
        // app after the 15-minute TTL lapsed) would otherwise look identical
        // to a genuinely logged-out visitor. Try one refresh ourselves
        // before concluding that, so a valid 30-day refresh token actually
        // gets used. Uses the same shared refreshSession() as api.ts's own
        // retry logic — refresh tokens rotate on use, so two independent,
        // undeduped refresh calls racing each other would make one fail.
        let { user } = await api.get<{ user: PublicProfile | null }>("/auth/session");
        if (!user) {
          const refreshed = await refreshSession();
          if (refreshed) {
            ({ user } = await api.get<{ user: PublicProfile | null }>("/auth/session"));
          }
        }
        setUser(user);
        if (user) connectSocket();
        else disconnectSocket();
      } catch {
        setUser(null);
        disconnectSocket();
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  // The access token cookie expires after 15 minutes (server/src/config.ts).
  // api.ts's request() recovers from that reactively on the next REST call,
  // but a live game exchanges moves over the socket, not REST, so a session
  // could otherwise sit idle on the REST side for well over 15 minutes and
  // only discover the token is stale if the socket happens to reconnect
  // (a wifi blip, a laptop sleep) mid-game. Proactively renewing well inside
  // the TTL keeps the cookie perpetually valid so that never happens.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      void refreshSession();
    }, 10 * 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (identifier: string, password: string) => {
    const { user } = await api.post<{ user: PublicProfile }>("/auth/login", { identifier, password });
    setUser(user);
    connectSocket();
  }, []);

  const register = useCallback(
    async (data: { username: string; fullName: string; email: string; password: string; country: string; website?: string }) => {
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
