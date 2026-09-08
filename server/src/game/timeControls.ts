export type TimeControlCategory = "bullet" | "blitz" | "rapid" | "classical";

export interface TimeControl {
  id: string;
  category: TimeControlCategory;
  label: string;
  initialTimeMs: number;
  incrementMs: number;
}

function tc(category: TimeControlCategory, minutes: number, incrementSeconds: number): TimeControl {
  const label = incrementSeconds > 0 ? `${minutes}+${incrementSeconds}` : `${minutes}+0`;
  return {
    id: `${category}-${label}`,
    category,
    label,
    initialTimeMs: minutes * 60_000,
    incrementMs: incrementSeconds * 1000,
  };
}

// Section 7: the built-in time control catalog. Administrators can extend
// this list (see server/src/admin/timeControls.ts) without touching the
// matchmaking or clock code, both of which only depend on this shape.
export const TIME_CONTROLS: TimeControl[] = [
  tc("bullet", 1, 0),
  tc("bullet", 2, 1),
  tc("blitz", 3, 0),
  tc("blitz", 3, 2),
  tc("blitz", 5, 0),
  tc("blitz", 5, 3),
  tc("rapid", 10, 0),
  tc("rapid", 10, 5),
  tc("rapid", 15, 10),
  tc("classical", 30, 0),
];

export function findTimeControl(id: string): TimeControl | undefined {
  return TIME_CONTROLS.find((t) => t.id === id);
}

/** FIDE-style classification by estimated game length: initial + 40*increment, in minutes. */
export function classifyTimeControl(initialTimeMs: number, incrementMs: number): TimeControlCategory {
  const estimateMinutes = (initialTimeMs + 40 * incrementMs) / 60_000;
  if (estimateMinutes < 3) return "bullet";
  if (estimateMinutes < 10) return "blitz";
  if (estimateMinutes < 30) return "rapid";
  return "classical";
}

export function isValidCustomTimeControl(initialTimeMs: number, incrementMs: number): boolean {
  return (
    Number.isInteger(initialTimeMs) &&
    Number.isInteger(incrementMs) &&
    initialTimeMs >= 15_000 &&
    initialTimeMs <= 180 * 60_000 &&
    incrementMs >= 0 &&
    incrementMs <= 60_000
  );
}
