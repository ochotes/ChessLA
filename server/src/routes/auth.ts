import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { signAccessToken, generateRefreshToken, hashOpaqueToken, generateCsrfToken, verifyAccessToken, asAppRole, type AppRole } from "../auth/tokens.js";
import { setAuthCookies, clearAuthCookies, COOKIE_NAMES } from "../auth/cookies.js";
import { validateBody } from "../middleware/validate.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../auth/schemas.js";
import { authRateLimit, passwordResetRateLimit } from "../middleware/security.js";
import { requireAuth } from "../middleware/auth.js";
import { sendEmail, passwordResetEmail } from "../email/mailer.js";
import { config } from "../config.js";
import { toPublicProfile } from "../lib/serialize.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validateBody(registerSchema), async (req, res) => {
  const { username, fullName, email, password, country, profilePicture } = req.body;

  const usernameLower = username.toLowerCase();
  const emailLower = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ usernameLower }, { emailLower }] },
    select: { usernameLower: true, emailLower: true },
  });
  if (existing) {
    if (existing.usernameLower === usernameLower) {
      return res.status(409).json({ error: "That username is already taken." });
    }
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      usernameLower,
      fullName,
      email,
      emailLower,
      passwordHash,
      country,
      profilePicture: profilePicture ?? null,
      rating: { create: {} },
      settings: { create: {} },
    },
    include: { rating: true },
  });

  await issueSession(res, user.id, user.username, "PLAYER");
  res.status(201).json({ user: toPublicProfile(user, user.rating!) });
});

authRouter.post("/login", authRateLimit, validateBody(loginSchema), async (req, res) => {
  const { identifier, password } = req.body;
  const lower = identifier.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ usernameLower: lower }, { emailLower: lower }] },
    include: { rating: true },
  });

  // Same generic error whether the account exists or the password is wrong,
  // so login failures don't leak which accounts exist.
  const genericError = () => res.status(401).json({ error: "Incorrect username/email or password." });

  if (!user) return genericError();
  if (user.status === "BANNED") {
    return res.status(403).json({ error: "This account has been suspended. Contact support if you believe this is an error." });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError();

  await issueSession(res, user.id, user.username, asAppRole(user.role));
  res.json({ user: toPublicProfile(user, user.rating!) });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAMES.refresh];
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashOpaqueToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAMES.refresh];
  if (!refreshToken) return res.status(401).json({ error: "Session expired. Please sign in again." });

  const tokenHash = hashOpaqueToken(refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.status === "BANNED") {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }

  // Rotate: revoke the old refresh token and issue a fresh pair. Limits the
  // blast radius if a refresh token cookie is ever stolen.
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  await issueSession(res, user.id, user.username, asAppRole(user.role));
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { rating: true } });
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ user: toPublicProfile(user, user.rating!) });
});

// A dedicated, always-200 "who am I" check for the app's initial session
// load. Every visitor hits this once on page load, logged in or not — a
// logged-out visitor is the normal case, not an error, so it should not
// surface as a 401 in the browser's network console.
authRouter.get("/session", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: { rating: true } });
  if (!user || !user.rating) return res.json({ user: null });
  res.json({ user: toPublicProfile(user, user.rating) });
});

authRouter.post("/forgot-password", passwordResetRateLimit, validateBody(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { emailLower: email.toLowerCase() } });

  // Always respond the same way, whether or not the email is registered, so
  // this endpoint cannot be used to discover which emails have accounts.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const resetUrl = `${config.clientOrigins[0]}/reset-password?token=${rawToken}`;
    const { subject, text } = passwordResetEmail(user.username, resetUrl);
    await sendEmail(user.email, subject, text);
  }

  res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
});

authRouter.post("/reset-password", passwordResetRateLimit, validateBody(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashOpaqueToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Revoke all existing sessions on password reset.
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  res.json({ ok: true, message: "Your password has been reset. You can now sign in." });
});

async function issueSession(res: import("express").Response, userId: string, username: string, role: AppRole) {
  const accessToken = signAccessToken({ sub: userId, username, role });
  const { token: refreshToken, hash } = generateRefreshToken();
  const csrfToken = generateCsrfToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60_000),
    },
  });

  setAuthCookies(res, { accessToken, refreshToken, csrfToken });
}

export { verifyAccessToken };
