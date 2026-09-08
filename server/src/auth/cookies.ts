import type { Response } from "express";
import { config } from "../config.js";

export const COOKIE_NAMES = {
  access: "chessla_at",
  refresh: "chessla_rt",
  csrf: "chessla_csrf",
} as const;

const secure = config.isProduction || config.forceHttps;

export function setAuthCookies(
  res: Response,
  opts: { accessToken: string; refreshToken: string; csrfToken: string }
) {
  res.cookie(COOKIE_NAMES.access, opts.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: config.jwt.accessTtlMinutes * 60_000,
    path: "/",
  });
  res.cookie(COOKIE_NAMES.refresh, opts.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60_000,
    path: "/api/auth",
  });
  // Deliberately NOT httpOnly: the client reads this and echoes it back in a
  // header on state-changing requests (double-submit cookie CSRF defense).
  // It carries no secret value on its own.
  res.cookie(COOKIE_NAMES.csrf, opts.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60_000,
    path: "/",
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAMES.access, { path: "/" });
  res.clearCookie(COOKIE_NAMES.refresh, { path: "/api/auth" });
  res.clearCookie(COOKIE_NAMES.csrf, { path: "/" });
}
