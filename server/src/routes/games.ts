import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, attachUserIfPresent } from "../middleware/auth.js";
import { gameManager } from "../game/GameManager.js";
import { getEngineTier } from "../engine/engineTiers.js";

/** A finished game's white/black player relation is null exactly when that
 * seat was one of the named engine bots — whiteEngineTier/blackEngineTier
 * records which one. This turns either shape into the same display info. */
function opponentInfo(player: { username: string; country: string } | null, engineTierId: string | null, ratingBefore: number | null | undefined, fallbackRating: number | undefined) {
  if (player) return { username: player.username, country: player.country, rating: ratingBefore ?? fallbackRating ?? null, isEngine: false };
  const tier = engineTierId ? getEngineTier(engineTierId) : undefined;
  return { username: tier?.name ?? "Unknown engine", country: "", rating: tier?.targetElo ?? null, isEngine: true };
}

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
      const opponentEngineTier = isWhite ? g.blackEngineTier : g.whiteEngineTier;
      const myRatingBefore = isWhite ? g.whiteRatingBefore : g.blackRatingBefore;
      const myRatingAfter = isWhite ? g.whiteRatingAfter : g.blackRatingAfter;
      const outcome = g.result === "1/2-1/2" ? "draw" : g.result === (isWhite ? "1-0" : "0-1") ? "win" : "loss";
      return {
        id: g.id,
        opponent: opponentInfo(opponent, opponentEngineTier, null, undefined),
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
      white: opponentInfo(game.whitePlayer, game.whiteEngineTier, game.whiteRatingBefore, game.whitePlayer?.rating?.blitzRating),
      black: opponentInfo(game.blackPlayer, game.blackEngineTier, game.blackRatingBefore, game.blackPlayer?.rating?.blitzRating),
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
