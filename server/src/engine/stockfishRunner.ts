import { Chess } from "chess.js";
// @ts-expect-error -- the stockfish package ships no type declarations
import initStockfish from "stockfish";
import type { EngineTier } from "./engineTiers.js";

interface EngineHandle {
  sendCommand: (cmd: string) => void;
}

let enginePromise: Promise<EngineHandle> | null = null;

// Stockfish.js (Node build) writes UCI output straight to the process's real
// stdout rather than through a configurable callback — there is no
// `onmessage`/`print` hook that actually fires in this build. The only
// reliable way to read its replies is to intercept stdout for the brief
// window a command is in flight, which is also why every call to the engine
// goes through the single queue below: only one command may be "in the air"
// at a time or two replies could be captured by the wrong caller.
let queue: Promise<unknown> = Promise.resolve();

function withStdoutCapture<T>(fn: (onLine: (cb: (line: string) => void) => void) => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const realWrite = process.stdout.write.bind(process.stdout);
    let buf = "";
    let lineHandler: ((line: string) => void) | null = null;
    (process.stdout.write as unknown) = (chunk: unknown, ...args: unknown[]) => {
      buf += String(chunk);
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line && lineHandler) lineHandler(line);
      }
      // @ts-expect-error -- forwarding the exact write() call through
      return realWrite(chunk, ...args);
    };
    try {
      return await fn((cb) => {
        lineHandler = cb;
      });
    } finally {
      process.stdout.write = realWrite;
    }
  });
  queue = next.catch(() => {});
  return next;
}

async function getEngine(): Promise<EngineHandle> {
  if (!enginePromise) {
    enginePromise = withStdoutCapture(async (onLine) => {
      const engine = await (initStockfish as (path: string) => Promise<EngineHandle>)("lite-single");
      return new Promise<EngineHandle>((resolve) => {
        onLine((line) => {
          if (line.trim() === "uciok") resolve(engine);
        });
        engine.sendCommand("uci");
      });
    });
  }
  return enginePromise;
}

function sendAndWaitFor(engine: EngineHandle, commands: string[], stopPredicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
  return withStdoutCapture(
    (onLine) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Engine timed out.")), timeoutMs);
        onLine((line) => {
          if (stopPredicate(line)) {
            clearTimeout(timer);
            resolve(line);
          }
        });
        for (const cmd of commands) engine.sendCommand(cmd);
      })
  );
}

interface BotMoveResult {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

function parseUciMove(uci: string): BotMoveResult {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as BotMoveResult["promotion"]) || undefined,
  };
}

function randomLegalMove(fen: string): BotMoveResult {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  const pick = moves[Math.floor(Math.random() * moves.length)];
  return { from: pick.from, to: pick.to, promotion: pick.promotion as BotMoveResult["promotion"] };
}

/** Asks the engine for a bestmove at a shallow, fixed depth — used for the
 * "smart" half of the weak tiers' random/engine blend. */
async function shallowBestMove(fen: string, depth: number): Promise<BotMoveResult> {
  const engine = await getEngine();
  const line = await sendAndWaitFor(
    engine,
    ["setoption name UCI_LimitStrength value false", `position fen ${fen}`, `go depth ${depth}`],
    (l) => l.startsWith("bestmove"),
    5000
  );
  return parseUciMove(line.split(" ")[1]);
}

/** Asks the engine for a move calibrated to a specific real-world Elo via
 * Stockfish's own UCI_LimitStrength option (supported range 1320-3190). */
async function calibratedBestMove(fen: string, targetElo: number, moveTimeMs: number): Promise<BotMoveResult> {
  const engine = await getEngine();
  const elo = Math.max(1320, Math.min(3190, Math.round(targetElo)));
  const line = await sendAndWaitFor(
    engine,
    [
      "setoption name UCI_LimitStrength value true",
      `setoption name UCI_Elo value ${elo}`,
      `position fen ${fen}`,
      `go movetime ${moveTimeMs}`,
    ],
    (l) => l.startsWith("bestmove"),
    moveTimeMs + 5000
  );
  return parseUciMove(line.split(" ")[1]);
}

/**
 * Computes the bot's move for the given tier and position.
 * `remainingMs` clamps the calibrated tiers' thinking time so a bot can
 * never flag itself on the clock in a fast time control.
 */
export async function getBotMove(fen: string, tier: EngineTier, remainingMs: number): Promise<BotMoveResult> {
  try {
    if (tier.behavior.kind === "weak") {
      if (Math.random() < tier.behavior.randomMoveChance) {
        return randomLegalMove(fen);
      }
      return await shallowBestMove(fen, tier.behavior.searchDepth);
    }
    const budget = Math.max(50, Math.min(tier.behavior.moveTimeMs, Math.floor(remainingMs * 0.05)));
    return await calibratedBestMove(fen, tier.targetElo, budget);
  } catch (err) {
    // The engine process can hiccup (a stuck queue slot, a malformed
    // response); a human's game must never stall waiting on it, so fall
    // back to any legal move rather than propagating the error upward.
    console.error("stockfishRunner: falling back to a random legal move after an error:", err);
    return randomLegalMove(fen);
  }
}

/** A quick, cheap evaluation from the side to move's perspective, in
 * centipawns, used only to decide how the bot responds to a draw offer. */
export async function quickEvalCp(fen: string): Promise<number> {
  const engine = await getEngine();
  return withStdoutCapture(
    (onLine) =>
      new Promise<number>((resolve) => {
        let lastScore = 0;
        const timer = setTimeout(() => resolve(lastScore), 3000);
        onLine((l) => {
          const m = l.match(/score cp (-?\d+)/);
          if (m) lastScore = Number(m[1]);
          if (l.startsWith("bestmove")) {
            clearTimeout(timer);
            resolve(lastScore);
          }
        });
        engine.sendCommand("setoption name UCI_LimitStrength value false");
        engine.sendCommand(`position fen ${fen}`);
        engine.sendCommand("go depth 8");
      })
  );
}
