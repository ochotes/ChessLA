export type Side = "white" | "black";

/**
 * Server-authoritative chess clock. Every timestamp used here is
 * `Date.now()` taken on the server — the client's own clock display is only
 * ever a countdown rendered from numbers the server sent it. A player
 * cannot "pause" or rewind their flag by messing with their device clock,
 * because the device clock is never consulted for anything that matters.
 */
export class GameClock {
  private remainingMs: Record<Side, number>;
  private readonly incrementMs: number;
  private turnStartedAt: number;
  private turn: Side;
  private running = false;

  constructor(initialTimeMs: number, incrementMs: number, startingTurn: Side = "white") {
    this.remainingMs = { white: initialTimeMs, black: initialTimeMs };
    this.incrementMs = incrementMs;
    this.turn = startingTurn;
    this.turnStartedAt = Date.now();
  }

  start() {
    this.running = true;
    this.turnStartedAt = Date.now();
  }

  /** Remaining time for `side`, accounting for elapsed time if it's currently their turn. */
  remaining(side: Side): number {
    if (this.running && this.turn === side) {
      const elapsed = Date.now() - this.turnStartedAt;
      return Math.max(0, this.remainingMs[side] - elapsed);
    }
    return Math.max(0, this.remainingMs[side]);
  }

  snapshot(): { white: number; black: number; turn: Side } {
    return { white: this.remaining("white"), black: this.remaining("black"), turn: this.turn };
  }

  /** Call the instant the server accepts a legal move from `side`. Deducts the
   * elapsed thinking time, applies increment, and hands the clock to the opponent. */
  onMovePlayed(side: Side) {
    if (!this.running) this.start();
    const elapsed = Date.now() - this.turnStartedAt;
    this.remainingMs[side] = Math.max(0, this.remainingMs[side] - elapsed) + this.incrementMs;
    this.turn = side === "white" ? "black" : "white";
    this.turnStartedAt = Date.now();
  }

  /** True if the side to move has run out of time right now. */
  isFlagged(side: Side): boolean {
    return this.remaining(side) <= 0;
  }

  pause() {
    // Used while a player is disconnected and a grace period is running, so
    // thinking time doesn't silently drain during a dropped connection grace
    // window (the reconnection window itself is tracked separately).
    this.remainingMs.white = this.remaining("white");
    this.remainingMs.black = this.remaining("black");
    this.running = false;
  }

  resume() {
    this.turnStartedAt = Date.now();
    this.running = true;
  }
}
