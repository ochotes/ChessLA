import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const statsRouter = Router();

/** Real, live counts from the database for the landing page — never a
 * hardcoded or fabricated number. A brand-new deployment will honestly show
 * small numbers until it has real players, which is the correct behavior. */
statsRouter.get("/public", async (_req, res) => {
  const [totalUsers, totalGamesCompleted] = await Promise.all([
    prisma.user.count(),
    prisma.game.count({ where: { status: "COMPLETED" } }),
  ]);
  res.json({ totalUsers, totalGamesCompleted });
});
