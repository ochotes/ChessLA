import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../auth/tokens.js";
import { COOKIE_NAMES } from "../auth/cookies.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAMES.access];
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) req.user = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Please sign in to continue.", code: "UNAUTHENTICATED" });
  }
  next();
}

export function requireRole(...roles: Array<"PLAYER" | "MODERATOR" | "ADMIN">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do that." });
    }
    next();
  };
}
