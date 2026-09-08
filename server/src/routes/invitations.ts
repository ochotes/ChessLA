import { Router } from "express";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { requireAuth, attachUserIfPresent } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { findTimeControl, isValidCustomTimeControl, classifyTimeControl, TIME_CONTROLS } from "../game/timeControls.js";
import { gameManager } from "../game/GameManager.js";
import { ratingFor } from "../rating/ratingField.js";
import { notifyUser } from "../sockets/notify.js";

export const invitationsRouter = Router();

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const createSchema = z.object({
  timeControlId: z.string().optional(),
  customInitialTimeMs: z.number().int().optional(),
  customIncrementMs: z.number().int().optional(),
  recipientUsername: z.string().optional(),
});

invitationsRouter.post("/", requireAuth, validateBody(createSchema), async (req, res) => {
  const { timeControlId, customInitialTimeMs, customIncrementMs, recipientUsername } = req.body;

  let initialTimeMs: number;
  let incrementMs: number;
  let category: string;
  let label: string;

  const preset = timeControlId ? findTimeControl(timeControlId) : undefined;
  if (preset) {
    ({ initialTimeMs, incrementMs, category, label } = preset);
  } else if (customInitialTimeMs != null && customIncrementMs != null && isValidCustomTimeControl(customInitialTimeMs, customIncrementMs)) {
    initialTimeMs = customInitialTimeMs;
    incrementMs = customIncrementMs;
    category = classifyTimeControl(initialTimeMs, incrementMs);
    label = `${Math.round(initialTimeMs / 60000)}+${Math.round(incrementMs / 1000)}`;
  } else {
    return res.status(400).json({ error: "Choose a valid time control." });
  }

  let recipientId: string | null = null;
  if (recipientUsername) {
    const recipient = await prisma.user.findUnique({ where: { usernameLower: recipientUsername.toLowerCase() } });
    if (!recipient) return res.status(404).json({ error: "No player found with that username." });
    recipientId = recipient.id;
  }

  const invitation = await prisma.invitation.create({
    data: {
      senderId: req.user!.sub,
      recipientId,
      code: generateCode(),
      timeControlCategory: category,
      timeControlLabel: label,
      initialTimeMs,
      incrementMs,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  if (recipientId) {
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: "challenge",
        title: "New challenge",
        body: `${req.user!.username} challenged you to a ${label} game.`,
        data: JSON.stringify({ invitationId: invitation.id, code: invitation.code }),
      },
    });
    notifyUser(recipientId, "invitation:received", {
      id: invitation.id,
      code: invitation.code,
      from: req.user!.username,
      timeControlLabel: label,
    });
  }

  res.status(201).json({ invitation });
});

invitationsRouter.get("/incoming", requireAuth, async (req, res) => {
  const invitations = await prisma.invitation.findMany({
    where: { recipientId: req.user!.sub, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { sender: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    invitations: invitations.map((i) => ({
      id: i.id,
      code: i.code,
      from: { username: i.sender.username, country: i.sender.country },
      timeControlLabel: i.timeControlLabel,
      createdAt: i.createdAt,
    })),
  });
});

invitationsRouter.get("/code/:code", attachUserIfPresent, async (req, res) => {
  const invitation = await prisma.invitation.findUnique({ where: { code: req.params.code.toUpperCase() }, include: { sender: true } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return res.status(404).json({ error: "This invitation has expired or does not exist." });
  }
  res.json({
    invitation: {
      id: invitation.id,
      code: invitation.code,
      from: { username: invitation.sender.username, country: invitation.sender.country },
      timeControlLabel: invitation.timeControlLabel,
    },
  });
});

invitationsRouter.post("/code/:code/accept", requireAuth, async (req, res) => {
  const invitation = await prisma.invitation.findUnique({ where: { code: req.params.code.toUpperCase() }, include: { sender: { include: { rating: true } } } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return res.status(404).json({ error: "This invitation has expired or does not exist." });
  }
  if (invitation.senderId === req.user!.sub) {
    return res.status(400).json({ error: "You can't accept your own invitation." });
  }
  if (invitation.recipientId && invitation.recipientId !== req.user!.sub) {
    return res.status(403).json({ error: "This invitation was sent to someone else." });
  }
  if (!invitation.sender.rating) return res.status(500).json({ error: "Could not load sender's rating." });

  const category = invitation.timeControlCategory as "bullet" | "blitz" | "rapid" | "classical";
  const acceptor = await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { rating: true } });
  if (!acceptor || !acceptor.rating) return res.status(404).json({ error: "Account not found." });

  const senderSummary = {
    id: invitation.sender.id,
    username: invitation.sender.username,
    country: invitation.sender.country,
    profilePicture: invitation.sender.profilePicture,
    rating: ratingFor(invitation.sender.rating, category),
  };
  const acceptorSummary = {
    id: acceptor.id,
    username: acceptor.username,
    country: acceptor.country,
    profilePicture: acceptor.profilePicture,
    rating: ratingFor(acceptor.rating, category),
  };

  const asWhite = Math.random() < 0.5;
  const { id: gameId } = await gameManager.createGame({
    white: asWhite ? senderSummary : acceptorSummary,
    black: asWhite ? acceptorSummary : senderSummary,
    timeControl: { category, label: invitation.timeControlLabel, initialTimeMs: invitation.initialTimeMs, incrementMs: invitation.incrementMs },
    isRated: true,
  });

  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", gameId } });
  notifyUser(invitation.senderId, "invitation:accepted", { gameId });

  res.json({ gameId });
});

invitationsRouter.post("/:id/cancel", requireAuth, async (req, res) => {
  const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!invitation || invitation.senderId !== req.user!.sub) return res.status(404).json({ error: "Invitation not found." });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "CANCELLED" } });
  res.json({ ok: true });
});

export { TIME_CONTROLS };
