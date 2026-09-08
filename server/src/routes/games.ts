import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, attachUserIfPresent } from "../middleware/auth.js";
import { gameManager } from "../game/GameManager.js";

export const gamesRouter = Router();

gamesRouter.get("/history", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const limit = Math.min(50, Number(req.query.limit ?? 20));
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  const games = await prisma.game.findMany({
    where: { status: "COMPLETED", OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }] },
    orderBy: { completedAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { whitePlayer: true, blackPlayer: true, _count: { select: { moves: true } } },
  });

  res.json({
    games: games.map((g) => {
      const isWhite = g.whitePlayerId === userId;
      const opponent = isWhite ? g.blackPlayer : g.whitePlayer;
      const myRatingBefore = isWhite ? g.whiteRatingBefore : g.blackRatingBefore;
      const myRatingAfter = isWhite ? g.whiteRatingAfter : g.blackRatingAfter;
      const outcome = g.result === "1/2-1/2" ? "draw" : g.result === (isWhite ? "1-0" : "0-1") ? "win" : "loss";
      return {
        id: g.id,
        opponent: opponent ? { username: opponent.username, country: opponent.country } : { username: "Unknown", country: "" },
        playedAs: isWhite ? "white" : "black",
        timeControl: g.timeControlLabel,
        timeControlCategory: g.timeControlCategory,
        result: outcome,
        terminationReason: g.terminationReason,
        moveCount: g._count.moves,
        ratingChange: myRatingBefore != null && myRatingAfter != null ? myRatingAfter - myRatingBefore : null,
        completedAt: g.completedAt,
      };
    }),
    nextCursor: games.length === limit ? games[games.length - 1].id : null,
  });
});

gamesRouter.get("/:id", attachUserIfPresent, async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    include: { whitePlayer: { include: { rating: true } }, blackPlayer: { include: { rating: true } }, moves: { orderBy: { moveNumber: "asc" } } },
  });
  if (!game) return res.status(404).json({ error: "Game not found." });

  res.json({
    game: {
      id: game.id,
      status: game.status,
      result: game.result,
      terminationReason: game.terminationReason,
      timeControl: game.timeControlLabel,
      timeControlCategory: game.timeControlCategory,
      startingFen: game.startingFen,
      currentFen: game.currentFen,
      pgn: game.pgn,
      isRated: game.isRated,
      white: game.whitePlayer
        ? { username: game.whitePlayer.username, country: game.whitePlayer.country, rating: game.whiteRatingBefore ?? game.whitePlayer.rating?.blitzRating }
        : null,
      black: game.blackPlayer
        ? { username: game.blackPlayer.username, country: game.blackPlayer.country, rating: game.blackRatingBefore ?? game.blackPlayer.rating?.blitzRating }
        : null,
      moves: game.moves.map((m) => ({ moveNumber: m.moveNumber, player: m.player, san: m.san, fenAfter: m.fenAfter, clockWhiteMs: m.clockWhiteMs, clockBlackMs: m.clockBlackMs })),
      createdAt: game.createdAt,
      completedAt: game.completedAt,
    },
  });
});

/** Live snapshot for a game currently in progress (used on page reload mid-game). */
gamesRouter.get("/:id/live", requireAuth, (req, res) => {
  const game = gameManager.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: "This game is not currently active." });
  res.json({ state: gameManager.toDTO(game) });
});
