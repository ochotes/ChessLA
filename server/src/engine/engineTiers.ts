// ChessLA's computer opponents, named after Claude model generations in
// their real, increasing order of capability. Each tier is a 400-point Elo
// band, from beginner (Haiku, 400-800) up to engine-strength (Mythos,
// 2800-3200) — seven rungs in total.
//
// Strength is implemented two different ways depending on the band:
//
//  - Haiku and Sonnet (target Elo below 1320) sit below Stockfish's own
//    supported floor for UCI_LimitStrength (see stockfishRunner.ts) — no
//    engine can calibrate itself that low natively. These two tiers instead
//    blend a real (but shallow) Stockfish search with a large chance of
//    playing a uniformly random legal move, which is the standard technique
//    for simulating beginner-level blundering play.
//  - Opus and above (1320-3190) use Stockfish's native UCI_LimitStrength +
//    UCI_Elo, which the Stockfish team calibrated directly against real
//    human game databases — the most honest strength estimate available
//    here, rather than a hand-rolled guess.
//
// Mythos, the top tier, targets Stockfish's actual maximum supported rating
// (3190) rather than a literal 3200 — one point under the round number
// asked for, and the closest an honest implementation gets to it.
export interface EngineTier {
  id: string;
  name: string;
  eloMin: number;
  eloMax: number;
  /** The single rating this tier is calibrated to play at. */
  targetElo: number;
  blurb: string;
  /** How the move is actually produced — see file header. */
  behavior:
    | { kind: "weak"; randomMoveChance: number; searchDepth: number }
    | { kind: "calibrated"; moveTimeMs: number };
}

export const ENGINE_TIERS: EngineTier[] = [
  {
    id: "haiku",
    name: "Haiku",
    eloMin: 400,
    eloMax: 800,
    targetElo: 600,
    blurb: "Still learning the rules. Expect hung pieces and missed checks.",
    behavior: { kind: "weak", randomMoveChance: 0.8, searchDepth: 1 },
  },
  {
    id: "sonnet",
    name: "Sonnet",
    eloMin: 800,
    eloMax: 1200,
    targetElo: 1000,
    blurb: "Knows basic tactics and development, but drops material often.",
    behavior: { kind: "weak", randomMoveChance: 0.45, searchDepth: 2 },
  },
  {
    id: "opus",
    name: "Opus",
    eloMin: 1200,
    eloMax: 1600,
    targetElo: 1400,
    blurb: "Solid club-level play. Punishes obvious mistakes.",
    behavior: { kind: "calibrated", moveTimeMs: 500 },
  },
  {
    id: "sonnet-4-5",
    name: "Sonnet 4.5",
    eloMin: 1600,
    eloMax: 2000,
    targetElo: 1800,
    blurb: "Sharp tactics and real positional pressure.",
    behavior: { kind: "calibrated", moveTimeMs: 700 },
  },
  {
    id: "opus-4-5",
    name: "Opus 4.5",
    eloMin: 2000,
    eloMax: 2400,
    targetElo: 2200,
    blurb: "Master-strength calculation. Few club players hold this.",
    behavior: { kind: "calibrated", moveTimeMs: 900 },
  },
  {
    id: "fable",
    name: "Fable",
    eloMin: 2400,
    eloMax: 2800,
    targetElo: 2600,
    blurb: "Grandmaster-caliber. Errors are the only way in.",
    behavior: { kind: "calibrated", moveTimeMs: 1200 },
  },
  {
    id: "mythos",
    name: "Mythos",
    eloMin: 2800,
    eloMax: 3200,
    targetElo: 3190,
    blurb: "Full engine strength. As close to unbeatable as ChessLA gets.",
    behavior: { kind: "calibrated", moveTimeMs: 1500 },
  },
];

export function getEngineTier(id: string): EngineTier | undefined {
  return ENGINE_TIERS.find((t) => t.id === id);
}

export function isEngineSeatId(id: string | null | undefined): boolean {
  return typeof id === "string" && ENGINE_TIERS.some((t) => t.id === id);
}
