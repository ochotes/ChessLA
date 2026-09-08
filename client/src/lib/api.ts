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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
