// Every call is a relative /api/... path. There is no base URL to configure
// and nothing resembling an API key or secret on this side of the app —
// the browser talks to whichever origin served it (proxied to the backend
// in dev, same-origin behind a reverse proxy in production), and the
// server's httpOnly session cookie is what actually authenticates.

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  status: number;
  issues?: { path: string; message: string }[];
  constructor(message: string, status: number, issues?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// The access token cookie is a short-lived JWT (15 minutes — see
// server/src/config.ts). Nothing else in the app ever calls /auth/refresh
// (AuthContext's own "refreshUser" just re-fetches the current profile via
// /auth/session, a different thing despite the similar name), and there is
// a real 30-day refresh token sitting unused in a cookie the whole time —
// so without this, every session would silently start failing every
// request 15 minutes in, mid-game included, with no way back short of a
// fresh login. One in-flight refresh is shared by every caller that hits
// this at once, so a burst of requests after expiry doesn't fire a dozen
// concurrent refresh calls.
let refreshInFlight: Promise<boolean> | null = null;

// Exported so every caller — this module's own 401-retry below, and
// AuthContext's fallback for /auth/session (which never returns a 401 to
// retry on in the first place, by design) — shares the exact same in-flight
// promise. Refresh tokens are rotated (single-use) on the server, so two
// independent, undeduped callers racing to refresh at once isn't just
// wasteful: only one can actually win, and the other(s) fail outright.
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Endpoints where a 401 means something other than "the access token
// expired" — retrying them after a refresh attempt would be pointless
// (login/register: wrong credentials) or actively wrong (refresh itself:
// would recurse forever if it also 401'd).
const NO_REFRESH_RETRY = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"]);

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Double-submit CSRF token: the server issues this as a readable cookie on
  // login/register; we just echo it back on anything that mutates state.
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCookie("chessla_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !isRetry && !NO_REFRESH_RETRY.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, init, true);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? "Something went wrong. Please try again.", res.status, body?.issues);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
