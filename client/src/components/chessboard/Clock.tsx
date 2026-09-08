import { useEffect, useRef, useState } from "react";

function formatMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.ceil(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  if (clamped < 10_000) {
    // Show tenths of a second once low on time — a real, useful signal, not decoration.
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * A purely cosmetic countdown. The number shown here is always re-synced
 * from the server's clock snapshots (see GamePage's `game:clock`/`game:move`
 * handlers) — the server independently tracks and enforces the real clock
 * server-side (see server/src/game/clock.ts), so nothing the player does to
 * their own device's clock can change who actually flags.
 */
export function Clock({
  remainingMs,
  isRunning,
  label,
  isLowTime,
}: {
  remainingMs: number;
  isRunning: boolean;
  label: string;
  isLowTime?: boolean;
}) {
  const [display, setDisplay] = useState(remainingMs);
  const baseRef = useRef({ remainingMs, syncedAt: Date.now() });

  useEffect(() => {
    baseRef.current = { remainingMs, syncedAt: Date.now() };
    setDisplay(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - baseRef.current.syncedAt;
      setDisplay(Math.max(0, baseRef.current.remainingMs - elapsed));
    }, 200);
    return () => clearInterval(interval);
  }, [isRunning]);

  const low = isLowTime ?? display < 30_000;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 font-mono text-xl font-semibold tabular-nums transition-colors ${
        isRunning ? "border-accent bg-accent/10" : "border-border bg-surface-raised"
      }`}
      aria-live={isRunning ? "polite" : "off"}
    >
      <span className="text-sm font-sans font-medium text-text-muted">{label}</span>
      <span className={low && isRunning ? "text-danger" : "text-text"}>{formatMs(display)}</span>
    </div>
  );
}
