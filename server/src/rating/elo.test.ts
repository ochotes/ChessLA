import { describe, it, expect } from "vitest";
import { computeEloUpdate, expectedScore } from "./elo.js";

describe("Elo rating updates", () => {
  it("gives equal-rated players a 50% expected score", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it("awards more points for beating a higher-rated opponent than a lower-rated one", () => {
    const beatHigher = computeEloUpdate({ rating: 1500, opponentRating: 1700, gamesPlayed: 50, outcome: "win" });
    const beatLower = computeEloUpdate({ rating: 1500, opponentRating: 1300, gamesPlayed: 50, outcome: "win" });
    expect(beatHigher.delta).toBeGreaterThan(beatLower.delta);
  });

  it("never drops a rating below the floor", () => {
    const result = computeEloUpdate({ rating: 105, opponentRating: 2000, gamesPlayed: 100, outcome: "loss" });
    expect(result.ratingAfter).toBeGreaterThanOrEqual(100);
  });

  it("leaves rating unchanged on a draw between equally rated players", () => {
    const result = computeEloUpdate({ rating: 1500, opponentRating: 1500, gamesPlayed: 50, outcome: "draw" });
    expect(result.delta).toBe(0);
  });
});
