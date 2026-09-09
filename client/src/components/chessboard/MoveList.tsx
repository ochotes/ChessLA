import { useEffect, useRef } from "react";
import type { MoveClassification } from "../../lib/types";

// Standard chess annotation glyphs — real notation, not decoration, so a
// flaw reads the same way it would in an annotated game score, and never
// relies on color alone (blunder/mistake/inaccuracy all use a distinct
// symbol as well as a distinct color).
const CLASSIFICATION_BADGE: Partial<Record<MoveClassification, { symbol: string; className: string; title: string }>> = {
  inaccuracy: { symbol: "?!", className: "text-warning", title: "Inaccuracy" },
  mistake: { symbol: "?", className: "text-danger", title: "Mistake" },
  blunder: { symbol: "??", className: "text-danger", title: "Blunder" },
};

export interface MoveListProps {
  moves: string[];
  /** Index into `moves` (0-based) that is currently displayed, for replay mode. Omit for live play. */
  currentIndex?: number;
  onSelect?: (index: number) => void;
  /** Parallel to `moves` — only set once a game has been analyzed. */
  classifications?: (MoveClassification | undefined)[];
}

export function MoveList({ moves, currentIndex, onSelect, classifications }: MoveListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  const pairs: { number: number; white?: string; whiteIndex?: number; black?: string; blackIndex?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: i / 2 + 1,
      white: moves[i],
      whiteIndex: i,
      black: moves[i + 1],
      blackIndex: i + 1,
    });
  }

  return (
    <div ref={containerRef} className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface" role="log" aria-label="Move history">
      {pairs.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">No moves yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {pairs.map((pair) => (
              <tr key={pair.number} className="border-b border-border last:border-0">
                <td className="w-10 py-1.5 pl-3 text-text-muted">{pair.number}.</td>
                <MoveCell san={pair.white} index={pair.whiteIndex} currentIndex={currentIndex} onSelect={onSelect} classification={pair.whiteIndex !== undefined ? classifications?.[pair.whiteIndex] : undefined} />
                <MoveCell san={pair.black} index={pair.blackIndex} currentIndex={currentIndex} onSelect={onSelect} classification={pair.blackIndex !== undefined ? classifications?.[pair.blackIndex] : undefined} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MoveCell({
  san,
  index,
  currentIndex,
  onSelect,
  classification,
}: {
  san?: string;
  index?: number;
  currentIndex?: number;
  onSelect?: (index: number) => void;
  classification?: MoveClassification;
}) {
  if (san === undefined || index === undefined) return <td className="py-1.5" />;
  const isCurrent = currentIndex === index;
  const badge = classification ? CLASSIFICATION_BADGE[classification] : undefined;
  return (
    <td className="py-1.5">
      <button
        type="button"
        onClick={() => onSelect?.(index)}
        disabled={!onSelect}
        className={`rounded px-2 py-0.5 font-medium ${
          isCurrent ? "bg-accent/15 text-accent" : "text-text hover:bg-surface-raised"
        } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
      >
        {san}
        {badge && (
          <span className={`ml-0.5 font-bold ${badge.className}`} title={badge.title}>
            {badge.symbol}
          </span>
        )}
      </button>
    </td>
  );
}
