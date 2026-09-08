import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({ notifications });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.sub }, data: { isRead: true } });
  res.json({ ok: true });
});

notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.sub, isRead: false }, data: { isRead: true } });
  res.json({ ok: true });
});
