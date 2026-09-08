import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { toPublicProfile, toOwnProfile } from "../lib/serialize.js";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "../auth/passwords.js";

export const usersRouter = Router();

usersRouter.get("/search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ users: [] });
  const users = await prisma.user.findMany({
    where: { usernameLower: { contains: q.toLowerCase() } },
    include: { rating: true },
    take: 15,
  });
  res.json({ users: users.filter((u) => u.rating).map((u) => toPublicProfile(u, u.rating!)) });
});

usersRouter.get("/:username", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { usernameLower: req.params.username.toLowerCase() },
    include: { rating: true, settings: true },
  });
  if (!user || !user.rating) return res.status(404).json({ error: "Player not found." });
  if (user.settings && !user.settings.profileIsPublic && req.user?.sub !== user.id) {
    return res.status(403).json({ error: "This profile is private." });
  }
  res.json({ user: toPublicProfile(user, user.rating) });
});

const settingsSchema = z.object({
  boardTheme: z.string().max(40).optional(),
  pieceStyle: z.string().max(40).optional(),
  boardOrientation: z.enum(["auto", "white", "black"]).optional(),
  showLegalMoves: z.boolean().optional(),
  showCoordinates: z.boolean().optional(),
  moveAnimations: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  confirmResign: z.boolean().optional(),
  confirmDrawOffer: z.boolean().optional(),
  theme: z.enum(["dark", "light"]).optional(),
  profileIsPublic: z.boolean().optional(),
});

usersRouter.get("/me/settings", requireAuth, async (req, res) => {
  const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.sub } });
  res.json({ settings });
});

usersRouter.patch("/me/settings", requireAuth, validateBody(settingsSchema), async (req, res) => {
  const settings = await prisma.userSettings.update({ where: { userId: req.user!.sub }, data: req.body });
  res.json({ settings });
});

usersRouter.get("/me/profile", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { rating: true } });
  if (!user || !user.rating) return res.status(404).json({ error: "Account not found." });
  res.json({ user: toOwnProfile(user, user.rating) });
});

const accountUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(280).optional(),
  profilePicture: z.string().url().max(2048).nullable().optional(),
  country: z.string().trim().length(2).optional(),
});

usersRouter.patch("/me/account", requireAuth, validateBody(accountUpdateSchema), async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user!.sub }, data: req.body, include: { rating: true } });
  res.json({ user: toOwnProfile(user, user.rating!) });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

usersRouter.post("/me/change-password", requireAuth, validateBody(passwordChangeSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!isPasswordStrongEnough(newPassword)) {
    return res.status(400).json({ error: "New password must be at least 8 characters and include a letter and a number." });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect." });
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});
