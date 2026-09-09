import { Chess } from "chess.js";
import { analyzePosition, type PositionEval } from "./stockfishRunner.js";

// A per-position engine search budget. For a typical 30-40 full-move game
// this puts total analysis time at roughly 15-25 seconds — noticeable, but
// this only ever runs once per game (see the analysisJson cache on Game)
// and only on request, the same trade-off every "Game Review" feature makes.
const ANALYSIS_MOVETIME_MS = 300;

// Standard centipawn-loss thresholds for classifying a move, in the same
// spirit as lichess's own move-quality labels.
const BLUNDER_THRESHOLD = 300;
const MISTAKE_THRESHOLD = 100;
const INACCURACY_THRESHOLD = 50;
const BEST_THRESHOLD = 10;

export type MoveClassification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface MoveAnalysis {
  moveNumber: number;
  player: "white" | "black";
  san: string;
  /** Position evaluation immediately after this move, from White's perspective. */
  evalCp: number | null;
  mateIn: number | null;
  classification: MoveClassification;
  /** How much worse off the mover ended up versus the engine's top choice, in centipawns. Always >= 0. */
  lossCp: number;
  /** The engine's suggested move instead, in SAN — omitted when the played move already was the top choice. */
  betterMoveSan: string | null;
}

export interface SideStats {
  best: number;
  good: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  white: SideStats;
  black: SideStats;
  /** The starting position's own evaluation, from White's perspective — the first point on the eval graph. */
  startingEvalCp: number | null;
  startingMateIn: number | null;
}

function emptyStats(): SideStats {
  return { best: 0, good: 0, inaccuracies: 0, mistakes: 0, blunders: 0 };
}

/** Converts an engine eval (always reported from the side-to-move's
 * perspective, per the UCI protocol) into a single comparable number, from
 * White's perspective, positive favoring White. Mate scores are mapped to
 * a magnitude far outside any real centipawn score so they always dominate
 * the comparison, while still ordering "mate in 1" ahead of "mate in 5". */
function toWhiteRelativeValue(evaluation: PositionEval, sideToMove: "w" | "b"): number {
  const flip = sideToMove === "b" ? -1 : 1;
  if (evaluation.mateIn !== null) {
    const sign = evaluation.mateIn > 0 ? 1 : -1;
    return flip * sign * (100_000 - Math.abs(evaluation.mateIn) * 100);
  }
  return flip * (evaluation.evalCp ?? 0);
}

function classify(lossCp: number, isBestMove: boolean): MoveClassification {
  if (isBestMove || lossCp < BEST_THRESHOLD) return "best";
  if (lossCp < INACCURACY_THRESHOLD) return "good";
  if (lossCp < MISTAKE_THRESHOLD) return "inaccuracy";
  if (lossCp < BLUNDER_THRESHOLD) return "mistake";
  return "blunder";
}

function bumpStats(stats: SideStats, classification: MoveClassification) {
  if (classification === "best") stats.best += 1;
  else if (classification === "good") stats.good += 1;
  else if (classification === "inaccuracy") stats.inaccuracies += 1;
  else if (classification === "mistake") stats.mistakes += 1;
  else stats.blunders += 1;
}

/**
 * Analyzes a completed game move-by-move with a full-strength engine.
 * `sans` must be the game's actual, already-validated move list (from the
 * stored Move rows) — this function trusts them and replays them with
 * chess.js purely to reconstruct each position's FEN, it does not re-check
 * legality (the server already guaranteed that when the moves were played).
 */
export async function analyzeGame(startingFen: string, sans: string[]): Promise<GameAnalysis> {
  const chess = new Chess(startingFen);
  const positions: string[] = [chess.fen()];
  const actualUci: string[] = [];

  for (const san of sans) {
    const move = chess.move(san);
    if (!move) throw new Error(`Could not replay stored move "${san}" — game history is corrupt.`);
    actualUci.push(`${move.from}${move.to}${move.promotion ?? ""}`);
    positions.push(chess.fen());
  }

  const evaluations: PositionEval[] = [];
  for (const fen of positions) {
    evaluations.push(await analyzePosition(fen, ANALYSIS_MOVETIME_MS));
  }

  const white = emptyStats();
  const black = emptyStats();
  const moves: MoveAnalysis[] = [];

  for (let i = 0; i < sans.length; i++) {
    const mover: "white" | "black" = i % 2 === 0 ? "white" : "black";
    const sideToMoveBefore: "w" | "b" = i % 2 === 0 ? "w" : "b";
    const sideToMoveAfter: "w" | "b" = sideToMoveBefore === "w" ? "b" : "w";

    const beforeValue = toWhiteRelativeValue(evaluations[i], sideToMoveBefore);
    const afterValue = toWhiteRelativeValue(evaluations[i + 1], sideToMoveAfter);

    const moverBefore = mover === "white" ? beforeValue : -beforeValue;
    const moverAfter = mover === "white" ? afterValue : -afterValue;
    const lossCp = Math.max(0, Math.round(moverBefore - moverAfter));

    const isBestMove = Boolean(evaluations[i].bestMove.from) && actualUci[i] === `${evaluations[i].bestMove.from}${evaluations[i].bestMove.to}${evaluations[i].bestMove.promotion ?? ""}`;
    const classification = classify(lossCp, isBestMove);
    bumpStats(mover === "white" ? white : black, classification);

    let betterMoveSan: string | null = null;
    if (classification !== "best" && evaluations[i].bestMove.from) {
      try {
        const replay = new Chess(positions[i]);
        const mv = replay.move({ from: evaluations[i].bestMove.from, to: evaluations[i].bestMove.to, promotion: evaluations[i].bestMove.promotion });
        betterMoveSan = mv?.san ?? null;
      } catch {
        betterMoveSan = null;
      }
    }

    moves.push({
      moveNumber: Math.floor(i / 2) + 1,
      player: mover,
      san: sans[i],
      evalCp: evaluations[i + 1].mateIn !== null ? null : toWhiteRelativeValue(evaluations[i + 1], sideToMoveAfter),
      mateIn: evaluations[i + 1].mateIn !== null ? (sideToMoveAfter === "b" ? -evaluations[i + 1].mateIn! : evaluations[i + 1].mateIn) : null,
      classification,
      lossCp,
      betterMoveSan,
    });
  }

  return {
    moves,
    white,
    black,
    startingEvalCp: evaluations[0].mateIn !== null ? null : toWhiteRelativeValue(evaluations[0], "w"),
    startingMateIn: evaluations[0].mateIn,
  };
}
