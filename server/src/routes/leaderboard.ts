import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { attachUserIfPresent } from "../middleware/auth.js";
import { ratingFieldFor } from "../rating/ratingField.js";
import type { TimeControlCategory } from "../game/timeControls.js";

export const leaderboardRouter = Router();

const CATEGORY_VALUES = ["bullet", "blitz", "rapid", "classical"] as const;

leaderboardRouter.get("/", attachUserIfPresent, async (req, res) => {
  const category = (CATEGORY_VALUES as readonly string[]).includes(String(req.query.category))
    ? (req.query.category as TimeControlCategory)
    : "blitz";
  const scope = String(req.query.scope ?? "global");
  const country = req.query.country ? String(req.query.country) : null;
  const field = ratingFieldFor(category);
  const limit = Math.min(100, Number(req.query.limit ?? 50));

  let friendIds: string[] | null = null;
  if (scope === "friends" && req.user) {
    const rows = await prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ userId: req.user.sub }, { friendId: req.user.sub }] },
    });
    friendIds = rows.map((r) => (r.userId === req.user!.sub ? r.friendId : r.userId));
    friendIds.push(req.user.sub);
  }

  const ratings = await prisma.rating.findMany({
    where: {
      gamesPlayed: { gt: 0 },
      user: {
        status: "ACTIVE",
        ...(country ? { country } : {}),
        ...(friendIds ? { id: { in: friendIds } } : {}),
      },
    },
    orderBy: { [field]: "desc" },
    take: limit,
    include: { user: true },
  });

  res.json({
    category,
    entries: ratings.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      username: r.user.username,
      country: r.user.country,
      rating: r[field],
      gamesPlayed: r.gamesPlayed,
    })),
  });
});
