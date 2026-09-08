export type GameOutcome = "win" | "loss" | "draw";

/**
 * Standard Elo update with a rating-band-based K-factor, similar in spirit
 * to how most online chess servers weight newer / lower-rated players'
 * results more heavily so their rating converges faster.
 */
export function kFactorFor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < 30) return 40;
  if (rating < 2100) return 20;
  if (rating < 2400) return 16;
  return 10;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function scoreFor(outcome: GameOutcome): number {
  if (outcome === "win") return 1;
  if (outcome === "draw") return 0.5;
  return 0;
}

export interface EloUpdateInput {
  rating: number;
  opponentRating: number;
  gamesPlayed: number;
  outcome: GameOutcome;
}

export interface EloUpdateResult {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
}

export function computeEloUpdate(input: EloUpdateInput): EloUpdateResult {
  const k = kFactorFor(input.rating, input.gamesPlayed);
  const expected = expectedScore(input.rating, input.opponentRating);
  const actual = scoreFor(input.outcome);
  const raw = k * (actual - expected);
  const ratingAfter = Math.max(100, Math.round(input.rating + raw));
  return {
    ratingBefore: input.rating,
    ratingAfter,
    delta: ratingAfter - input.rating,
  };
}
