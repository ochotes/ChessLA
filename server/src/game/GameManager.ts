import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { ChessGameEngine, type PromotionPiece } from "../chess/engine.js";
import { GameClock, type Side } from "./clock.js";
import type { TimeControl } from "./timeControls.js";
import { ratingFieldFor, ratingFor } from "../rating/ratingField.js";
import { computeEloUpdate, type GameOutcome } from "../rating/elo.js";
import { evaluateMoveTiming, type MoveTimingSample } from "../anticheat/heuristics.js";
import type { GameBroadcaster, GameStateDTO, PlayerSummary, TerminationReason } from "./types.js";

const DISCONNECT_GRACE_MS = 60_000; // section 16: reconnection window before forfeiture
const DRAW_OFFER_COOLDOWN_MS = 20_000; // section 15: prevent draw-offer spam

interface PlayerRef {
  userId: string;
  summary: PlayerSummary;
  connected: boolean;
  disconnectedAt: number | null;
  lastDrawOfferAt: number;
  moveTimestamps: MoveTimingSample[];
}

interface ActiveGame {
  id: string;
  engine: ChessGameEngine;
  clock: GameClock;
  timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">;
  isRated: boolean;
  white: PlayerRef;
  black: PlayerRef;
  status: "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  result: string | null;
  terminationReason: TerminationReason | null;
  drawOfferBy: Side | null;
  lastMove: { from: string; to: string } | null;
  createdAt: number;
  moveCount: number;
  lastMoveAt: number;
}

function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

export class GameManager {
  private games = new Map<string, ActiveGame>();
  private broadcaster: GameBroadcaster | null = null;
  private tickHandle: NodeJS.Timeout | null = null;

  setBroadcaster(broadcaster: GameBroadcaster) {
    this.broadcaster = broadcaster;
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  getGame(gameId: string): ActiveGame | undefined {
    return this.games.get(gameId);
  }

  toDTO(game: ActiveGame): GameStateDTO {
    const clocks = game.clock.snapshot();
    return {
      id: game.id,
      fen: game.engine.fen,
      turn: game.engine.turn,
      status: game.status,
      result: game.result,
      terminationReason: game.terminationReason,
      isRated: game.isRated,
      timeControl: game.timeControl,
      white: game.white.summary,
      black: game.black.summary,
      clocks: { white: clocks.white, black: clocks.black },
      moveHistorySan: game.engine.history(),
      lastMove: game.lastMove,
      isCheck: game.engine.isCheck,
      drawOfferBy: game.drawOfferBy,
      connection: { white: game.white.connected, black: game.black.connected },
    };
  }

  async createGame(params: {
    white: PlayerSummary;
    black: PlayerSummary;
    timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">;
    isRated: boolean;
  }): Promise<{ id: string; dto: GameStateDTO }> {
    const engine = new ChessGameEngine();
    const dbGame = await prisma.game.create({
      data: {
        whitePlayerId: params.white.id,
        blackPlayerId: params.black.id,
        timeControlCategory: params.timeControl.category,
        timeControlLabel: params.timeControl.label,
        initialTimeMs: params.timeControl.initialTimeMs,
        incrementMs: params.timeControl.incrementMs,
        currentFen: engine.fen,
        status: "IN_PROGRESS",
        isRated: params.isRated,
        startedAt: new Date(),
      },
    });

    const clock = new GameClock(params.timeControl.initialTimeMs, params.timeControl.incrementMs);
    clock.start();

    const game: ActiveGame = {
      id: dbGame.id,
      engine,
      clock,
      timeControl: params.timeControl,
      isRated: params.isRated,
      white: { userId: params.white.id, summary: params.white, connected: true, disconnectedAt: null, lastDrawOfferAt: 0, moveTimestamps: [] },
      black: { userId: params.black.id, summary: params.black, connected: true, disconnectedAt: null, lastDrawOfferAt: 0, moveTimestamps: [] },
      status: "IN_PROGRESS",
      result: null,
      terminationReason: null,
      drawOfferBy: null,
      lastMove: null,
      createdAt: Date.now(),
      moveCount: 0,
      lastMoveAt: Date.now(),
    };
    this.games.set(game.id, game);
    return { id: game.id, dto: this.toDTO(game) };
  }

  private sideFor(game: ActiveGame, userId: string): Side | null {
    if (game.white.userId === userId) return "white";
    if (game.black.userId === userId) return "black";
    return null;
  }

  async attemptMove(gameId: string, userId: string, from: string, to: string, promotion?: PromotionPiece) {
    const game = this.games.get(gameId);
    if (!game) return { ok: false as const, error: "This game no longer exists." };
    if (game.status !== "IN_PROGRESS") return { ok: false as const, error: "This game has already ended." };

    const side = this.sideFor(game, userId);
    if (!side) return { ok: false as const, error: "You are not a player in this game." };

    const toMoveColor: Side = game.engine.turn === "w" ? "white" : "black";
    if (side !== toMoveColor) return { ok: false as const, error: "It is not your turn." };

    // The clock is checked independently of the client's claim: even if the
    // move itself is legal, a flagged player has already lost on time.
    if (game.clock.isFlagged(toMoveColor)) {
      await this.finalizeGame(game, otherSide(toMoveColor), "timeout");
      return { ok: false as const, error: "Time is up." };
    }

    const beforeTimestamp = Date.now();
    const thinkTimeMs = beforeTimestamp - game.lastMoveAt;

    const result = game.engine.attemptMove(from, to, promotion);
    if (!result.ok) {
      return { ok: false as const, error: "This move is illegal." };
    }

    game.clock.onMovePlayed(side);
    game.lastMove = { from, to };
    game.moveCount += 1;
    game.lastMoveAt = beforeTimestamp;

    const player = side === "white" ? game.white : game.black;
    player.moveTimestamps.push({ moveIndex: game.moveCount, thinkTimeMs });
    const flags = evaluateMoveTiming(player.moveTimestamps);
    if (flags.length > 0) {
      await prisma.gameEvent.create({
        data: {
          gameId: game.id,
          userId,
          type: "flag_suspicious",
          metadata: JSON.stringify(flags),
        },
      });
    }

    // Any prior draw offer lapses the moment either side moves.
    game.drawOfferBy = null;

    const clocks = game.clock.snapshot();
    await prisma.move.create({
      data: {
        gameId: game.id,
        moveNumber: game.moveCount,
        player: side,
        san: result.san,
        uci: result.uci,
        fenAfter: result.fenAfter,
        clockWhiteMs: Math.round(clocks.white),
        clockBlackMs: Math.round(clocks.black),
      },
    });
    await prisma.game.update({ where: { id: game.id }, data: { currentFen: result.fenAfter, pgn: game.engine.pgn } });

    this.broadcaster?.emitMove(game.id, this.toDTO(game), result.san);
    this.broadcaster?.emitClock(game.id, clocks);

    if (result.isCheckmate) {
      await this.finalizeGame(game, side, "checkmate");
    } else if (result.isStalemate) {
      await this.finalizeGame(game, null, "stalemate");
    } else if (result.drawReason && result.drawReason !== "stalemate") {
      await this.finalizeGame(game, null, result.drawReason);
    }

    return { ok: true as const, dto: this.toDTO(game) };
  }

  async offerDraw(gameId: string, userId: string) {
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS") return { ok: false as const, error: "This game has already ended." };
    const side = this.sideFor(game, userId);
    if (!side) return { ok: false as const, error: "You are not a player in this game." };

    const player = side === "white" ? game.white : game.black;
    const now = Date.now();
    if (now - player.lastDrawOfferAt < DRAW_OFFER_COOLDOWN_MS) {
      return { ok: false as const, error: "Please wait before offering another draw." };
    }
    player.lastDrawOfferAt = now;
    game.drawOfferBy = side;
    await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "draw_offer" } });
    this.broadcaster?.emitDrawOffer(game.id, side);
    return { ok: true as const };
  }

  async respondToDraw(gameId: string, userId: string, accept: boolean) {
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS") return { ok: false as const, error: "This game has already ended." };
    const side = this.sideFor(game, userId);
    if (!side || !game.drawOfferBy || game.drawOfferBy === side) {
      return { ok: false as const, error: "There is no draw offer to respond to." };
    }

    if (accept) {
      await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "draw_accept" } });
      await this.finalizeGame(game, null, "draw_agreement");
    } else {
      game.drawOfferBy = null;
      await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "draw_decline" } });
      this.broadcaster?.emitDrawDeclined(game.id);
    }
    return { ok: true as const };
  }

  async resign(gameId: string, userId: string) {
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS") return { ok: false as const, error: "This game has already ended." };
    const side = this.sideFor(game, userId);
    if (!side) return { ok: false as const, error: "You are not a player in this game." };

    await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "resign" } });
    await this.finalizeGame(game, otherSide(side), "resignation");
    return { ok: true as const };
  }

  async handleDisconnect(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS") return;
    const side = this.sideFor(game, userId);
    if (!side) return;
    const player = side === "white" ? game.white : game.black;
    player.connected = false;
    player.disconnectedAt = Date.now();
    await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "disconnect" } });
    this.broadcaster?.emitConnectionChange(game.id, side, false);
  }

  async handleReconnect(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return null;
    const side = this.sideFor(game, userId);
    if (!side) return null;
    const player = side === "white" ? game.white : game.black;
    // Only a genuine reconnection (the player was actually marked
    // disconnected) is newsworthy. A normal first join — or a duplicate
    // "game:join" from the same still-connected client, e.g. React's
    // StrictMode double-invoking effects in development — must not spam
    // both players with a false "reconnected" notification.
    const wasDisconnected = !player.connected;
    player.connected = true;
    player.disconnectedAt = null;
    if (wasDisconnected && game.status === "IN_PROGRESS") {
      await prisma.gameEvent.create({ data: { gameId: game.id, userId, type: "reconnect" } });
      this.broadcaster?.emitConnectionChange(game.id, side, true);
    }
    return this.toDTO(game);
  }

  /** Runs every second: flags timed-out players and forfeits abandoned games. */
  private tick() {
    const now = Date.now();
    for (const game of this.games.values()) {
      if (game.status !== "IN_PROGRESS") continue;

      const toMove: Side = game.engine.turn === "w" ? "white" : "black";
      if (game.clock.isFlagged(toMove)) {
        void this.finalizeGame(game, otherSide(toMove), "timeout");
        continue;
      }

      for (const side of ["white", "black"] as Side[]) {
        const player = side === "white" ? game.white : game.black;
        if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > DISCONNECT_GRACE_MS) {
          void this.finalizeGame(game, otherSide(side), "abandonment");
        }
      }
    }
  }

  private async finalizeGame(game: ActiveGame, winner: Side | null, reason: TerminationReason) {
    if (game.status !== "IN_PROGRESS") return; // already finalized by another path this tick
    game.status = "COMPLETED";
    game.terminationReason = reason;
    game.result = winner === "white" ? "1-0" : winner === "black" ? "0-1" : "1/2-1/2";

    const clocks = game.clock.snapshot();

    let ratingChange: { white: number; black: number } | null = null;

    if (game.isRated) {
      ratingChange = await this.applyRatingChanges(game, winner);
    }

    await prisma.game.update({
      where: { id: game.id },
      data: {
        status: "COMPLETED",
        result: game.result,
        terminationReason: reason,
        currentFen: game.engine.fen,
        pgn: game.engine.pgn,
        completedAt: new Date(),
        whiteRatingAfter: ratingChange ? ratingChange.white : undefined,
        blackRatingAfter: ratingChange ? ratingChange.black : undefined,
      },
    });

    const dto = this.toDTO(game);
    dto.ratingChange = ratingChange;
    this.broadcaster?.emitGameOver(game.id, dto);

    // Keep completed games addressable for a short window (e.g. the result
    // screen re-fetching state right after the final broadcast), then evict.
    setTimeout(() => this.games.delete(game.id), 5 * 60_000);
  }

  private async applyRatingChanges(game: ActiveGame, winner: Side | null): Promise<{ white: number; black: number }> {
    const category = game.timeControl.category;
    const field = ratingFieldFor(category);

    const [whiteRating, blackRating] = await Promise.all([
      prisma.rating.findUniqueOrThrow({ where: { userId: game.white.userId } }),
      prisma.rating.findUniqueOrThrow({ where: { userId: game.black.userId } }),
    ]);

    const whiteOutcome: GameOutcome = winner === "white" ? "win" : winner === "black" ? "loss" : "draw";
    const blackOutcome: GameOutcome = winner === "black" ? "win" : winner === "white" ? "loss" : "draw";

    const whiteUpdate = computeEloUpdate({
      rating: ratingFor(whiteRating, category),
      opponentRating: ratingFor(blackRating, category),
      gamesPlayed: whiteRating.gamesPlayed,
      outcome: whiteOutcome,
    });
    const blackUpdate = computeEloUpdate({
      rating: ratingFor(blackRating, category),
      opponentRating: ratingFor(whiteRating, category),
      gamesPlayed: blackRating.gamesPlayed,
      outcome: blackOutcome,
    });

    await prisma.$transaction([
      prisma.rating.update({
        where: { userId: game.white.userId },
        data: {
          [field]: whiteUpdate.ratingAfter,
          highestRating: Math.max(whiteRating.highestRating, whiteUpdate.ratingAfter),
          gamesPlayed: { increment: 1 },
          wins: { increment: whiteOutcome === "win" ? 1 : 0 },
          losses: { increment: whiteOutcome === "loss" ? 1 : 0 },
          draws: { increment: whiteOutcome === "draw" ? 1 : 0 },
          currentStreak: nextStreak(whiteRating.currentStreak, whiteOutcome),
        },
      }),
      prisma.rating.update({
        where: { userId: game.black.userId },
        data: {
          [field]: blackUpdate.ratingAfter,
          highestRating: Math.max(blackRating.highestRating, blackUpdate.ratingAfter),
          gamesPlayed: { increment: 1 },
          wins: { increment: blackOutcome === "win" ? 1 : 0 },
          losses: { increment: blackOutcome === "loss" ? 1 : 0 },
          draws: { increment: blackOutcome === "draw" ? 1 : 0 },
          currentStreak: nextStreak(blackRating.currentStreak, blackOutcome),
        },
      }),
    ]);

    return { white: whiteUpdate.delta, black: blackUpdate.delta };
  }
}

function nextStreak(current: number, outcome: GameOutcome): number {
  if (outcome === "win") return current >= 0 ? current + 1 : 1;
  if (outcome === "loss") return current <= 0 ? current - 1 : -1;
  return 0;
}

export const gameManager = new GameManager();
export function generateGameCode(): string {
  return nanoid(8).toUpperCase();
}
