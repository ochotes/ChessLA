import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, attachUserIfPresent } from "../middleware/auth.js";
import { gameManager } from "../game/GameManager.js";
import { getEngineTier } from "../engine/engineTiers.js";
import { analyzeGame, type GameAnalysis } from "../engine/analyzeGame.js";

// Dedupes concurrent "analyze this game" requests for the same game so two
// browser tabs (or a retry) never queue up two full engine passes at once.
const analysisInFlight = new Map<string, Promise<GameAnalysis>>();

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

/**
 * Runs (or returns the cached result of) a full engine analysis of a
 * finished game. Deliberately requires COMPLETED status — analysis must
 * never be reachable while a game is still being played, or it would hand
 * either player engine-assisted look-ahead moves mid-game.
 */
gamesRouter.post("/:id/analyze", requireAuth, async (req, res) => {
  const gameId = req.params.id;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: { orderBy: { moveNumber: "asc" } } },
  });
  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.status !== "COMPLETED") {
    return res.status(400).json({ error: "Only completed games can be analyzed." });
  }

  if (game.analysisJson) {
    return res.json({ analysis: JSON.parse(game.analysisJson) as GameAnalysis });
  }

  try {
    let pending = analysisInFlight.get(gameId);
    if (!pending) {
      pending = analyzeGame(
        game.startingFen,
        game.moves.map((m) => m.san)
      );
      analysisInFlight.set(gameId, pending);
      pending.finally(() => analysisInFlight.delete(gameId));
    }
    const analysis = await pending;
    await prisma.game.update({ where: { id: gameId }, data: { analysisJson: JSON.stringify(analysis) } });
    res.json({ analysis });
  } catch (err) {
    console.error("Game analysis failed:", err);
    res.status(502).json({ error: "The analysis engine could not finish. Please try again." });
  }
});
