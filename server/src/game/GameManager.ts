import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { ChessGameEngine, type PromotionPiece } from "../chess/engine.js";
import { GameClock, type Side } from "./clock.js";
import type { TimeControl } from "./timeControls.js";
import { ratingFieldFor, ratingFor } from "../rating/ratingField.js";
import { computeEloUpdate, type GameOutcome } from "../rating/elo.js";
import { evaluateMoveTiming, type MoveTimingSample } from "../anticheat/heuristics.js";
import { getEngineTier, type EngineTier } from "../engine/engineTiers.js";
import { getBotMove, quickEvalCp } from "../engine/stockfishRunner.js";
import type { GameBroadcaster, GameStateDTO, PlayerSummary, TerminationReason } from "./types.js";

const DISCONNECT_GRACE_MS = 60_000; // section 16: reconnection window before forfeiture
const DRAW_OFFER_COOLDOWN_MS = 20_000; // section 15: prevent draw-offer spam
const ENGINE_DRAW_RESPONSE_DELAY_MS = 1200; // a human-feeling pause before the bot answers a draw offer

interface PlayerRef {
  userId: string;
  summary: PlayerSummary;
  connected: boolean;
  disconnectedAt: number | null;
  lastDrawOfferAt: number;
  moveTimestamps: MoveTimingSample[];
  botTier: EngineTier | null;
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
  /** True while an engine's draw-offer answer is being computed. Guards the
   * narrow window between two settlement paths (a standalone timer, and
   * playEngineTurn noticing a still-pending offer) both racing to answer
   * the same offer — see settleDrawOfferAsEngine. */
  drawSettlingInProgress: boolean;
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
    const dbGame = await prisma.game.create({
      data: {
        whitePlayerId: params.white.id,
        blackPlayerId: params.black.id,
        timeControlCategory: params.timeControl.category,
        timeControlLabel: params.timeControl.label,
        initialTimeMs: params.timeControl.initialTimeMs,
        incrementMs: params.timeControl.incrementMs,
        currentFen: new ChessGameEngine().fen,
        status: "IN_PROGRESS",
        isRated: params.isRated,
        startedAt: new Date(),
      },
    });

    const game = this.spinUpGame(dbGame.id, params.timeControl, params.isRated, {
      white: { summary: params.white, botTier: null },
      black: { summary: params.black, botTier: null },
    });
    return { id: game.id, dto: this.toDTO(game) };
  }

  /** A human vs. one of the named Claude-tier bots (see engineTiers.ts).
   * Always unrated — see the schema comment on Game.whiteEngineTier. */
  async createEngineGame(params: {
    human: PlayerSummary;
    humanSide: Side;
    tier: EngineTier;
    timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">;
  }): Promise<{ id: string; dto: GameStateDTO }> {
    const engineSummary: PlayerSummary = {
      id: `engine:${params.tier.id}`,
      username: params.tier.name,
      country: "",
      profilePicture: null,
      rating: params.tier.targetElo,
      isEngine: true,
    };
    const humanIsWhite = params.humanSide === "white";

    const dbGame = await prisma.game.create({
      data: {
        whitePlayerId: humanIsWhite ? params.human.id : null,
        blackPlayerId: humanIsWhite ? null : params.human.id,
        whiteEngineTier: humanIsWhite ? null : params.tier.id,
        blackEngineTier: humanIsWhite ? params.tier.id : null,
        timeControlCategory: params.timeControl.category,
        timeControlLabel: params.timeControl.label,
        initialTimeMs: params.timeControl.initialTimeMs,
        incrementMs: params.timeControl.incrementMs,
        currentFen: new ChessGameEngine().fen,
        status: "IN_PROGRESS",
        isRated: false,
        startedAt: new Date(),
      },
    });

    const game = this.spinUpGame(dbGame.id, params.timeControl, false, {
      white: humanIsWhite ? { summary: params.human, botTier: null } : { summary: engineSummary, botTier: params.tier },
      black: humanIsWhite ? { summary: engineSummary, botTier: params.tier } : { summary: params.human, botTier: null },
    });

    if (game.white.botTier) void this.playEngineTurn(game.id);
    return { id: game.id, dto: this.toDTO(game) };
  }

  private spinUpGame(
    id: string,
    timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">,
    isRated: boolean,
    seats: { white: { summary: PlayerSummary; botTier: EngineTier | null }; black: { summary: PlayerSummary; botTier: EngineTier | null } }
  ): ActiveGame {
    const clock = new GameClock(timeControl.initialTimeMs, timeControl.incrementMs);
    clock.start();

    const toPlayerRef = (seat: { summary: PlayerSummary; botTier: EngineTier | null }): PlayerRef => ({
      userId: seat.summary.id,
      summary: seat.summary,
      connected: true,
      disconnectedAt: null,
      lastDrawOfferAt: 0,
      moveTimestamps: [],
      botTier: seat.botTier,
    });

    const game: ActiveGame = {
      id,
      engine: new ChessGameEngine(),
      clock,
      timeControl,
      isRated,
      white: toPlayerRef(seats.white),
      black: toPlayerRef(seats.black),
      status: "IN_PROGRESS",
      result: null,
      terminationReason: null,
      drawOfferBy: null,
      drawSettlingInProgress: false,
      lastMove: null,
      createdAt: Date.now(),
      moveCount: 0,
      lastMoveAt: Date.now(),
    };
    this.games.set(game.id, game);
    return game;
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

    const thinkTimeMs = Date.now() - game.lastMoveAt;
    const committed = await this.commitMove(game, side, from, to, promotion);
    if (!committed.ok) return { ok: false as const, error: committed.error };

    // Move-timing anti-cheat only makes sense for a human's own clock
    // discipline — the engine's "think time" is a deliberate search budget,
    // not a signal worth flagging, so this stays out of commitMove/playEngineTurn.
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

    void this.playEngineTurn(game.id);
    return { ok: true as const, dto: this.toDTO(game) };
  }

  /** The single move-application path shared by human moves (attemptMove)
   * and bot moves (playEngineTurn): chess-rule validation, clock, DB
   * persistence, broadcast, and game-over detection all happen exactly
   * once, here, regardless of who is moving. */
  private async commitMove(
    game: ActiveGame,
    side: Side,
    from: string,
    to: string,
    promotion?: PromotionPiece
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const result = game.engine.attemptMove(from, to, promotion);
    if (!result.ok) return { ok: false, error: "This move is illegal." };

    game.clock.onMovePlayed(side);
    game.lastMove = { from, to };
    game.moveCount += 1;
    game.lastMoveAt = Date.now();
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

    return { ok: true };
  }

  /** If it is now a bot's turn in an in-progress game, computes and plays
   * its move. A no-op otherwise, so it is safe to call unconditionally
   * after every human move and after creating a new game.
   *
   * A human can offer a draw at any moment, including the ~second this
   * function spends inside getBotMove computing its reply. If that happens,
   * committing the already-computed move would silently wipe the pending
   * offer via commitMove's "a move cancels any pending draw offer" rule —
   * so the offer is checked both before starting the computation (skip the
   * wasted search entirely in the common case) and again right after (to
   * catch an offer that arrived while the bot was thinking). */
  private async playEngineTurn(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS") return;

    const toMoveColor: Side = game.engine.turn === "w" ? "white" : "black";
    const player = toMoveColor === "white" ? game.white : game.black;
    if (!player.botTier) return;

    if (game.clock.isFlagged(toMoveColor)) {
      await this.finalizeGame(game, otherSide(toMoveColor), "timeout");
      return;
    }

    if (await this.settlePendingOfferBeforeEngineMoves(game, toMoveColor)) return;

    const remainingMs = game.clock.snapshot()[toMoveColor];
    const move = await getBotMove(game.engine.fen, player.botTier, remainingMs);
    if (game.status !== "IN_PROGRESS") return; // the game could have ended while we were thinking

    if (await this.settlePendingOfferBeforeEngineMoves(game, toMoveColor)) return;

    await this.commitMove(game, toMoveColor, move.from, move.to, move.promotion);
  }

  /** Returns true if the game is no longer in a state where this bot move
   * should be committed (either there was nothing to settle, or settling it
   * ended the game as a draw). */
  private async settlePendingOfferBeforeEngineMoves(game: ActiveGame, toMoveColor: Side): Promise<boolean> {
    if (!game.drawOfferBy || game.drawOfferBy === toMoveColor) return false;
    await this.settleDrawOfferAsEngine(game, toMoveColor, game.drawOfferBy);
    return game.status !== "IN_PROGRESS";
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

    const opponent = side === "white" ? game.black : game.white;
    if (opponent.botTier) void this.respondToDrawAsEngine(game.id, side);

    return { ok: true as const };
  }

  /** A bot's answer to a human's draw offer, used when it is not currently
   * the bot's turn (so nothing else will naturally settle the offer): after
   * a brief, human-feeling pause, defers to settleDrawOfferAsEngine. */
  private async respondToDrawAsEngine(gameId: string, offeredBy: Side): Promise<void> {
    await new Promise((r) => setTimeout(r, ENGINE_DRAW_RESPONSE_DELAY_MS));
    const game = this.games.get(gameId);
    if (!game || game.status !== "IN_PROGRESS" || game.drawOfferBy !== offeredBy) return;
    await this.settleDrawOfferAsEngine(game, otherSide(offeredBy), offeredBy);
  }

  /** Accepts only if a quick engine evaluation says the bot isn't clearly
   * better off continuing — otherwise declines and keeps playing. Shared by
   * the standalone-timer path above and by playEngineTurn's race guard. */
  private async settleDrawOfferAsEngine(game: ActiveGame, botSide: Side, offeredBy: Side): Promise<void> {
    // Claimed synchronously, before the first await, so the standalone timer
    // and playEngineTurn's race guard can never both answer the same offer.
    if (game.drawOfferBy !== offeredBy || game.drawSettlingInProgress) return;
    game.drawSettlingInProgress = true;

    try {
      const evalCp = await quickEvalCp(game.engine.fen).catch(() => 0);
      // evalCp is from the side-to-move's perspective; flip it to the bot's.
      const toMove: Side = game.engine.turn === "w" ? "white" : "black";
      const evalForBot = toMove === botSide ? evalCp : -evalCp;
      const accept = evalForBot <= 50; // roughly equal or worse for the bot

      if (accept) {
        await prisma.gameEvent.create({ data: { gameId: game.id, userId: null, type: "draw_accept" } });
        await this.finalizeGame(game, null, "draw_agreement");
      } else {
        game.drawOfferBy = null;
        await prisma.gameEvent.create({ data: { gameId: game.id, userId: null, type: "draw_decline" } });
        this.broadcaster?.emitDrawDeclined(game.id);
      }
    } finally {
      game.drawSettlingInProgress = false;
    }
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
