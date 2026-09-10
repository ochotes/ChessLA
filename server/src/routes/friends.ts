import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { notifyUser, isUserOnline } from "../sockets/notify.js";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ userId }, { friendId: userId }] },
  });
  const friendIds = rows.map((r) => (r.userId === userId ? r.friendId : r.userId));
  const friends = await prisma.user.findMany({ where: { id: { in: friendIds } }, include: { rating: true } });
  res.json({
    friends: friends
      .filter((f) => f.rating)
      .map((f) => ({
        id: f.id,
        username: f.username,
        country: f.country,
        profilePicture: f.profilePicture,
        rating: f.rating!.blitzRating,
        online: isUserOnline(f.id),
      })),
  });
});

friendsRouter.get("/requests", async (req, res) => {
  const userId = req.user!.sub;
  const incoming = await prisma.friendship.findMany({ where: { friendId: userId, status: "PENDING" }, include: { user: true } });
  const outgoing = await prisma.friendship.findMany({ where: { userId, status: "PENDING" }, include: { friend: true } });
  res.json({
    incoming: incoming.map((r) => ({ id: r.id, from: { id: r.user.id, username: r.user.username } })),
    outgoing: outgoing.map((r) => ({ id: r.id, to: { id: r.friend.id, username: r.friend.username } })),
  });
});

const requestSchema = z.object({ username: z.string().min(1) });

friendsRouter.post("/requests", validateBody(requestSchema), async (req, res) => {
  const userId = req.user!.sub;
  const target = await prisma.user.findUnique({ where: { usernameLower: req.body.username.toLowerCase() } });
  if (!target) return res.status(404).json({ error: "No player found with that username." });
  if (target.id === userId) return res.status(400).json({ error: "You can't send a friend request to yourself." });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId: target.id },
        { userId: target.id, friendId: userId },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: "A friend request or friendship already exists with this player." });

  const request = await prisma.friendship.create({ data: { userId, friendId: target.id, status: "PENDING" } });
  await prisma.notification.create({
    data: { userId: target.id, type: "friend_request", title: "New friend request", body: `${req.user!.username} sent you a friend request.` },
  });
  notifyUser(target.id, "friend:request", { from: req.user!.username });
  res.status(201).json({ request });
});

friendsRouter.post("/requests/:id/accept", async (req, res) => {
  const userId = req.user!.sub;
  const request = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!request || request.friendId !== userId || request.status !== "PENDING") {
    return res.status(404).json({ error: "Friend request not found." });
  }
  await prisma.friendship.update({ where: { id: request.id }, data: { status: "ACCEPTED" } });
  await prisma.notification.create({
    data: { userId: request.userId, type: "friend_accept", title: "Friend request accepted", body: `${req.user!.username} accepted your friend request.` },
  });
  notifyUser(request.userId, "friend:accepted", { by: req.user!.username });
  res.json({ ok: true });
});

friendsRouter.post("/requests/:id/decline", async (req, res) => {
  const userId = req.user!.sub;
  const request = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!request || request.friendId !== userId || request.status !== "PENDING") {
    return res.status(404).json({ error: "Friend request not found." });
  }
  await prisma.friendship.update({ where: { id: request.id }, data: { status: "DECLINED" } });
  res.json({ ok: true });
});

friendsRouter.delete("/:friendId", async (req, res) => {
  const userId = req.user!.sub;
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId, friendId: req.params.friendId },
        { userId: req.params.friendId, friendId: userId },
      ],
    },
  });
  res.json({ ok: true });
});
