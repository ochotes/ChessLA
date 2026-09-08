import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { COOKIE_NAMES } from "../auth/cookies.js";

/** Redirects http -> https and sends HSTS, but only once the deployment is
 * actually behind TLS (FORCE_HTTPS=true). Enabling this before a real
 * certificate is in place would just break local development. */
export function httpsEnforcement(req: Request, res: Response, next: NextFunction) {
  if (!config.forceHttps) return next();
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isSecure = req.secure || forwardedProto === "https";
  if (!isSecure) {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  next();
}

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", ...config.clientOrigins],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.forceHttps ? [] : null,
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
});

export const corsMiddleware = cors({
  origin: config.clientOrigins,
  credentials: true,
});

// Generous general limiter, tight limiters on sensitive auth endpoints below.
export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests. Please try again later." },
});

/** Double-submit-cookie CSRF check for state-changing requests made with
 * cookie-based auth. The browser's same-origin policy stops a third-party
 * site from ever reading chessla_csrf, so it cannot forge this header. */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerToken = req.header("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}

/** Simple honeypot spam check: a hidden field real users never fill in. */
export function honeypotCheck(fieldName = "website") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body?.[fieldName]) {
      // Silently succeed-looking response to not tip off bots, but do nothing.
      return res.status(200).json({ ok: true });
    }
    next();
  };
}
