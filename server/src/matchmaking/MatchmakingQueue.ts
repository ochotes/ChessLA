import { prisma } from "../lib/prisma.js";
import { gameManager } from "../game/GameManager.js";
import { ratingFor } from "../rating/ratingField.js";
import type { TimeControl } from "../game/timeControls.js";
import type { PlayerSummary } from "../game/types.js";

interface QueueEntry {
  userId: string;
  summary: PlayerSummary;
  rating: number;
  timeControl: TimeControl;
  enqueuedAt: number;
}

export interface MatchFoundCallback {
  (gameId: string, players: { userId: string }[]): void;
}

const INITIAL_BAND = 100; // section 6: start narrow ("similar rating")...
const BAND_GROWTH_PER_SECOND = 25; // ...and widen the longer someone waits, so nobody waits forever
const MAX_BAND = 600;

/**
 * A simple, explainable matchmaker: one FIFO-ish queue per time control,
 * matching the closest available rating first and widening the acceptable
 * gap the longer a player has been searching. This intentionally favors
 * rating fairness over minimizing wait time when both players are online,
 * per section 6's "avoid pairing players with extremely different ratings
 * unless there are insufficient players".
 */
export class MatchmakingQueue {
  private queues = new Map<string, QueueEntry[]>();
  private onMatch: MatchFoundCallback | null = null;
  private tickHandle: NodeJS.Timeout | null = null;

  setOnMatch(cb: MatchFoundCallback) {
    this.onMatch = cb;
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => void this.tick(), 800);
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  enqueue(userId: string, summary: PlayerSummary, rating: number, timeControl: TimeControl) {
    this.dequeue(userId);
    const list = this.queues.get(timeControl.id) ?? [];
    list.push({ userId, summary, rating, timeControl, enqueuedAt: Date.now() });
    this.queues.set(timeControl.id, list);
  }

  dequeue(userId: string) {
    for (const [key, list] of this.queues) {
      const filtered = list.filter((e) => e.userId !== userId);
      this.queues.set(key, filtered);
    }
  }

  queuePosition(userId: string): { timeControlId: string; waitingMs: number } | null {
    for (const [key, list] of this.queues) {
      const entry = list.find((e) => e.userId === userId);
      if (entry) return { timeControlId: key, waitingMs: Date.now() - entry.enqueuedAt };
    }
    return null;
  }

  private async tick() {
    for (const [timeControlId, list] of this.queues) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.enqueuedAt - b.enqueuedAt);

      const matched = new Set<string>();
      for (const entry of sorted) {
        if (matched.has(entry.userId)) continue;
        const waitedSeconds = (Date.now() - entry.enqueuedAt) / 1000;
        const band = Math.min(MAX_BAND, INITIAL_BAND + waitedSeconds * BAND_GROWTH_PER_SECOND);

        let bestOpponent: QueueEntry | null = null;
        let bestDiff = Infinity;
        for (const candidate of sorted) {
          if (candidate.userId === entry.userId || matched.has(candidate.userId)) continue;
          const diff = Math.abs(candidate.rating - entry.rating);
          if (diff <= band && diff < bestDiff) {
            bestDiff = diff;
            bestOpponent = candidate;
          }
        }

        if (bestOpponent) {
          matched.add(entry.userId);
          matched.add(bestOpponent.userId);
          await this.createMatch(entry, bestOpponent);
        }
      }

      const remaining = list.filter((e) => !matched.has(e.userId));
      this.queues.set(timeControlId, remaining);
    }
  }

  private async createMatch(a: QueueEntry, b: QueueEntry) {
    // Randomize colors so nobody is systematically favored.
    const [whiteEntry, blackEntry] = Math.random() < 0.5 ? [a, b] : [b, a];
    const { id } = await gameManager.createGame({
      white: whiteEntry.summary,
      black: blackEntry.summary,
      timeControl: whiteEntry.timeControl,
      isRated: true,
    });
    this.onMatch?.(id, [{ userId: a.userId }, { userId: b.userId }]);
  }
}

export async function playerSummaryFor(userId: string, category: "bullet" | "blitz" | "rapid" | "classical"): Promise<{ summary: PlayerSummary; rating: number } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { rating: true } });
  if (!user || !user.rating) return null;
  const rating = ratingFor(user.rating, category);
  return {
    rating,
    summary: {
      id: user.id,
      username: user.username,
      country: user.country,
      profilePicture: user.profilePicture,
      rating,
    },
  };
}

export const matchmakingQueue = new MatchmakingQueue();
