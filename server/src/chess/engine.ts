import { Chess, type Move as ChessJsMove, type Square } from "chess.js";

/**
 * Thin, carefully-scoped wrapper around chess.js — a mature, widely used,
 * MIT-licensed chess rules engine. We deliberately do NOT hand-roll our own
 * move generator: the single most important requirement of ChessLA is that
 * an illegal move can never be accepted, and a battle-tested library that
 * has been exercised by thousands of applications for years is a safer
 * foundation for that guarantee than a bespoke implementation would be.
 *
 * This class is used on the SERVER as the one and only source of truth for
 * game state. The client uses the same library only to compute which squares
 * to highlight as legal destinations (a UX nicety) — it never decides what
 * actually happened in the game. Every move a client sends is re-validated
 * here, from the position the server itself is holding, before anything is
 * broadcast or persisted.
 */

export type PromotionPiece = "q" | "r" | "b" | "n";

export type DrawReason =
  | "stalemate"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "insufficient_material";

export interface AppliedMove {
  ok: true;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion: PromotionPiece | null;
  fenBefore: string;
  fenAfter: string;
  capturedPiece: string | null;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason: DrawReason | null;
  isGameOver: boolean;
  turnAfter: "w" | "b";
}

export interface RejectedMove {
  ok: false;
  reason: "illegal_move" | "game_over" | "not_your_turn";
}

export interface LegalMove {
  from: string;
  to: string;
  promotion: PromotionPiece | null;
  san: string;
  isCapture: boolean;
}

export class ChessGameEngine {
  private chess: Chess;

  constructor(options?: { fen?: string; pgn?: string }) {
    this.chess = new Chess();
    if (options?.pgn) {
      this.chess.loadPgn(options.pgn);
    } else if (options?.fen) {
      this.chess.load(options.fen);
    }
  }

  static startingFen(): string {
    return new Chess().fen();
  }

  get fen(): string {
    return this.chess.fen();
  }

  get pgn(): string {
    return this.chess.pgn();
  }

  get turn(): "w" | "b" {
    return this.chess.turn();
  }

  get isCheck(): boolean {
    return this.chess.isCheck();
  }

  get isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  get isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  get isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  /** Every legal move for the side to move (or a single square), for the client's move-hint UI. */
  legalMoves(square?: string): LegalMove[] {
    const opts = square ? { square: square as Square, verbose: true as const } : { verbose: true as const };
    const moves = this.chess.moves(opts) as ChessJsMove[];
    return moves.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: (m.promotion as PromotionPiece) ?? null,
      san: m.san,
      isCapture: m.flags.includes("c") || m.flags.includes("e"),
    }));
  }

  history(): string[] {
    return this.chess.history();
  }

  halfMoveClock(): number {
    const parts = this.chess.fen().split(" ");
    return Number(parts[4] ?? 0);
  }

  fullMoveNumber(): number {
    const parts = this.chess.fen().split(" ");
    return Number(parts[5] ?? 1);
  }

  /**
   * The authoritative entry point. Attempts to play `from -> to` (with an
   * optional promotion piece) on the server's own board. If chess.js does
   * not consider it legal in the CURRENT position, the move is rejected and
   * the server's position does not change — no client input can ever mutate
   * the game state except through this validated path.
   */
  attemptMove(from: string, to: string, promotion?: PromotionPiece): AppliedMove | RejectedMove {
    if (this.chess.isGameOver()) {
      return { ok: false, reason: "game_over" };
    }
    const fenBefore = this.chess.fen();
    let move: ChessJsMove | null;
    try {
      move = this.chess.move({ from: from as Square, to: to as Square, promotion });
    } catch {
      move = null;
    }
    if (!move) {
      return { ok: false, reason: "illegal_move" };
    }

    const isStalemate = this.chess.isStalemate();
    const isThreefold = this.chess.isThreefoldRepetition();
    const isInsufficient = this.chess.isInsufficientMaterial();
    const isDraw = this.chess.isDraw();
    let drawReason: DrawReason | null = null;
    if (isStalemate) drawReason = "stalemate";
    else if (isThreefold) drawReason = "threefold_repetition";
    else if (isInsufficient) drawReason = "insufficient_material";
    else if (isDraw) drawReason = "fifty_move_rule";

    return {
      ok: true,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      from: move.from,
      to: move.to,
      promotion: (move.promotion as PromotionPiece) ?? null,
      fenBefore,
      fenAfter: this.chess.fen(),
      capturedPiece: move.captured ?? null,
      isCapture: move.flags.includes("c") || move.flags.includes("e"),
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate,
      isDraw,
      drawReason,
      isGameOver: this.chess.isGameOver(),
      turnAfter: this.chess.turn(),
    };
  }

  /** Used only to decide whether a draw offer is even plausible / for display, never for legality. */
  canClaimThreefoldOrFiftyMove(): boolean {
    return this.chess.isThreefoldRepetition() || this.chess.isDraw();
  }
}
