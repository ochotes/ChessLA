import { pieceGlyph, PIECE_NAMES } from "./pieceGlyphs";

const CHOICES = ["q", "r", "b", "n"] as const;

export function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: "w" | "b";
  onChoose: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
      role="dialog"
      aria-label="Choose promotion piece"
    >
      <div className="card flex gap-2 p-3">
        {CHOICES.map((piece) => (
          <button
            key={piece}
            onClick={() => onChoose(piece)}
            aria-label={`Promote to ${PIECE_NAMES[piece]}`}
            className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface text-4xl leading-none hover:border-accent hover:bg-accent/10"
          >
            <span style={{ color: color === "w" ? "rgb(var(--color-text))" : "rgb(var(--color-text))" }}>
              {pieceGlyph(piece, color)}
            </span>
          </button>
        ))}
        <button
          onClick={onCancel}
          aria-label="Cancel promotion"
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-raised"
        >
          ×
        </button>
      </div>
    </div>
  );
}
