import type { Side } from "./clock.js";
import type { TimeControl } from "./timeControls.js";
import type { DrawReason } from "../chess/engine.js";

export interface PlayerSummary {
  id: string;
  username: string;
  country: string;
  profilePicture: string | null;
  rating: number;
}

export interface GameStateDTO {
  id: string;
  fen: string;
  turn: "w" | "b";
  status: "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  result: string | null;
  terminationReason: string | null;
  isRated: boolean;
  timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">;
  white: PlayerSummary;
  black: PlayerSummary;
  clocks: { white: number; black: number };
  moveHistorySan: string[];
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  drawOfferBy: Side | null;
  connection: { white: boolean; black: boolean };
  ratingChange?: { white: number; black: number } | null;
}

export interface GameBroadcaster {
  emitState(gameId: string, state: GameStateDTO): void;
  emitMove(gameId: string, state: GameStateDTO, san: string): void;
  emitClock(gameId: string, clocks: { white: number; black: number; turn: Side }): void;
  emitGameOver(gameId: string, state: GameStateDTO): void;
  emitDrawOffer(gameId: string, from: Side): void;
  emitDrawDeclined(gameId: string): void;
  emitConnectionChange(gameId: string, side: Side, connected: boolean): void;
  emitChat(gameId: string, message: { id: string; userId: string; username: string; text: string; createdAt: string; isSystem: boolean }): void;
  emitError(gameId: string, userId: string, message: string): void;
}

export type GameOutcomeResult = "1-0" | "0-1" | "1/2-1/2";

export type TerminationReason =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "draw_agreement"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "insufficient_material"
  | "abandonment"
  | "aborted";
