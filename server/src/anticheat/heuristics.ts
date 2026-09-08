/**
 * Lightweight, explainable anti-cheat heuristics that run inline on every
 * move, with zero added latency for legitimate players. This is not a
 * substitute for a full statistical/engine-correlation detector (the kind
 * lichess/chess.com run offline over completed games) — it is a first line
 * of defense that flags obviously abnormal patterns for moderator review via
 * the admin panel's Reports queue. Nothing here ever blocks a legal move;
 * it only ever logs a GameEvent of type "flag_suspicious".
 */

export interface MoveTimingSample {
  moveIndex: number;
  thinkTimeMs: number;
}

export interface AntiCheatFlag {
  type: "inhuman_speed" | "uniform_timing" | "perfect_long_game_no_time_use";
  detail: string;
}

const INHUMAN_MOVE_MS = 120; // a legal, non-trivial move made in under this is suspicious in isolation
const MIN_SAMPLES_FOR_UNIFORMITY_CHECK = 12;

export function evaluateMoveTiming(history: MoveTimingSample[]): AntiCheatFlag[] {
  const flags: AntiCheatFlag[] = [];
  if (history.length < 4) return flags;

  const recent = history.slice(-6);
  const veryFast = recent.filter((s) => s.thinkTimeMs < INHUMAN_MOVE_MS);
  if (veryFast.length >= 5) {
    flags.push({
      type: "inhuman_speed",
      detail: `${veryFast.length} of the last ${recent.length} moves were played in under ${INHUMAN_MOVE_MS}ms.`,
    });
  }

  if (history.length >= MIN_SAMPLES_FOR_UNIFORMITY_CHECK) {
    const times = history.slice(-MIN_SAMPLES_FOR_UNIFORMITY_CHECK).map((s) => s.thinkTimeMs);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
    const stdDev = Math.sqrt(variance);
    // Real human thinking time varies a lot move to move. A long run of
    // near-identical response times (bot-like) is suspicious, but only past
    // a sample size large enough to not flag naturally fast, simple games.
    if (mean > 200 && stdDev < mean * 0.08) {
      flags.push({
        type: "uniform_timing",
        detail: `Last ${times.length} moves had near-identical timing (mean ${Math.round(mean)}ms, stddev ${Math.round(stdDev)}ms).`,
      });
    }
  }

  return flags;
}
