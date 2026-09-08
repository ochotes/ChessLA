import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const createReportSchema = z.object({
  reportedUsername: z.string().min(1),
  gameId: z.string().optional(),
  reason: z.enum(["cheating", "harassment", "spam", "abusive_chat", "other"]),
  details: z.string().max(1000).optional(),
});

reportsRouter.post("/", validateBody(createReportSchema), async (req, res) => {
  const { reportedUsername, gameId, reason, details } = req.body;
  const reported = await prisma.user.findUnique({ where: { usernameLower: reportedUsername.toLowerCase() } });
  if (!reported) return res.status(404).json({ error: "Player not found." });
  if (reported.id === req.user!.sub) return res.status(400).json({ error: "You can't report yourself." });

  const report = await prisma.report.create({
    data: { reporterId: req.user!.sub, reportedId: reported.id, gameId, reason, details },
  });
  res.status(201).json({ report });
});
