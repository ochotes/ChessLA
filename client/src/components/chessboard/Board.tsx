import { useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { pieceGlyph, PIECE_NAMES } from "./pieceGlyphs";
import { PromotionPicker } from "./PromotionPicker";
import { getBoardTheme } from "./boardThemes";

export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  myColor: "w" | "b" | null;
  lastMove: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => void;
  showLegalMoves?: boolean;
  showCoordinates?: boolean;
  /** One of BOARD_THEMES' ids. Defaults to "classic" when omitted. */
  boardTheme?: string;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * A fully client-rendered 8x8 board. IMPORTANT: this component never decides
 * whether a move is legal. It uses a local, disposable chess.js instance
 * purely to compute which squares to highlight as legal destinations (a UX
 * aid so the player isn't guessing) — the move itself is only ever sent
 * upward via onMove, which the caller forwards to the server. The board you
 * see only updates once the server confirms the move and a new `fen` prop
 * comes back down; nothing here mutates local game state.
 */
export function Board({
  fen,
  orientation,
  interactive,
  myColor,
  lastMove,
  onMove,
  showLegalMoves = true,
  showCoordinates = true,
  boardTheme,
}: BoardProps) {
  const theme = getBoardTheme(boardTheme);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const board = chess.board();
  const turn = chess.turn();
  const inCheck = chess.isCheck();

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<string, { isCapture: boolean; isPromotion: boolean }>();
    const moves = chess.moves({ square: selected as Square, verbose: true });
    const map = new Map<string, { isCapture: boolean; isPromotion: boolean }>();
    for (const m of moves) {
      map.set(m.to, {
        isCapture: m.flags.includes("c") || m.flags.includes("e"),
        isPromotion: Boolean(m.promotion) || m.flags.includes("p"),
      });
    }
    return map;
  }, [chess, selected]);

  const checkedKingSquare = useMemo(() => {
    if (!inCheck) return null;
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === turn) return cell.square;
      }
    }
    return null;
  }, [board, inCheck, turn]);

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

  const canInteract = interactive && myColor === turn;

  function pieceAt(square: string) {
    const file = square.charCodeAt(0) - "a".charCodeAt(0);
    const rank = Number(square[1]) - 1;
    const row = 7 - rank; // board() is rank8..rank1
    return board[row]?.[file] ?? null;
  }

  function trySelect(square: string) {
    if (pendingPromotion) return;
    const piece = pieceAt(square);

    if (selected === square) {
      setSelected(null);
      return;
    }

    if (selected && legalTargets.has(square)) {
      const target = legalTargets.get(square)!;
      if (target.isPromotion) {
        setPendingPromotion({ from: selected, to: square });
      } else {
        onMove(selected, square);
      }
      setSelected(null);
      return;
    }

    if (canInteract && piece && piece.color === myColor) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  function handleDragStart(square: string, e: React.DragEvent) {
    const piece = pieceAt(square);
    if (!canInteract || !piece || piece.color !== myColor) {
      e.preventDefault();
      return;
    }
    setSelected(square);
    e.dataTransfer.setData("text/plain", square);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(square: string, e: React.DragEvent) {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain") || selected;
    if (!from) return;
    if (from === square) {
      setSelected(null);
      return;
    }
    const moves = chess.moves({ square: from as Square, verbose: true });
    const match = moves.find((m) => m.to === square);
    if (!match) {
      setSelected(null);
      return;
    }
    if (match.promotion || match.flags.includes("p")) {
      setPendingPromotion({ from, to: square });
    } else {
      onMove(from, square);
    }
    setSelected(null);
  }

  return (
    <div className="relative w-full select-none" style={{ touchAction: "none", ...(theme.vars as CSSProperties) }}>
      <div
        className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border border-border shadow-card"
        role="grid"
        aria-label="Chess board"
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = `${file}${rank}`;
            const piece = pieceAt(square);
            const isDark = (FILES.indexOf(file) + rank) % 2 === 0;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.has(square);
            const targetInfo = legalTargets.get(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheckedKing = checkedKingSquare === square;
            const isFileEdge = rank === ranks[ranks.length - 1];
            const isRankEdge = file === files[0];

            return (
              <button
                key={square}
                type="button"
                role="gridcell"
                aria-label={
                  piece
                    ? `${square}, ${piece.color === "w" ? "White" : "Black"} ${PIECE_NAMES[piece.type]}`
                    : `${square}, empty`
                }
                onClick={() => trySelect(square)}
                draggable={canInteract && Boolean(piece) && piece?.color === myColor}
                onDragStart={(e) => handleDragStart(square, e)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(square, e)}
                className="relative flex items-center justify-center focus-visible:z-10"
                style={{
                  backgroundColor: isDark ? "rgb(var(--board-dark))" : "rgb(var(--board-light))",
                  cursor: canInteract && piece && piece.color === myColor ? "grab" : canInteract && isLegalTarget ? "pointer" : "default",
                }}
              >
                {isLastMove && (
                  <span className="absolute inset-0" style={{ backgroundColor: "rgb(var(--board-last-move) / 0.55)" }} aria-hidden="true" />
                )}
                {isSelected && (
                  <span className="absolute inset-0" style={{ backgroundColor: "rgb(var(--board-selected) / 0.65)" }} aria-hidden="true" />
                )}
                {isCheckedKing && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: "inset 0 0 0 6px rgb(var(--board-check) / 0.85)" }}
                    aria-hidden="true"
                  />
                )}

                {piece && (
                  <span
                    className="pointer-events-none relative z-[1] leading-none"
                    style={{
                      fontSize: "min(7.2vw, 52px)",
                      color: piece.color === "w" ? "#f5f5f0" : "#15181a",
                      filter:
                        piece.color === "w"
                          ? "drop-shadow(0 1px 1px rgba(0,0,0,0.55))"
                          : "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
                    }}
                  >
                    {pieceGlyph(piece.type, piece.color)}
                  </span>
                )}

                {showLegalMoves && isLegalTarget && !targetInfo?.isCapture && (
                  <span
                    className="pointer-events-none absolute h-[28%] w-[28%] rounded-full"
                    style={{ backgroundColor: "rgb(var(--board-legal-dot) / 0.55)" }}
                    aria-hidden="true"
                  />
                )}
                {showLegalMoves && isLegalTarget && targetInfo?.isCapture && (
                  <span
                    className="pointer-events-none absolute inset-[6%] rounded-full"
                    style={{ boxShadow: "inset 0 0 0 4px rgb(var(--board-legal-dot) / 0.65)" }}
                    aria-hidden="true"
                  />
                )}
                {showCoordinates && isFileEdge && (
                  <span
                    className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-semibold"
                    style={{ color: "rgb(var(--board-coord) / 0.9)" }}
                  >
                    {file}
                  </span>
                )}
                {showCoordinates && isRankEdge && (
                  <span
                    className="pointer-events-none absolute left-1 top-0.5 text-[10px] font-semibold"
                    style={{ color: "rgb(var(--board-coord) / 0.9)" }}
                  >
                    {rank}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {pendingPromotion && (
        <PromotionPicker
          color={myColor ?? "w"}
          onCancel={() => setPendingPromotion(null)}
          onChoose={(piece) => {
            onMove(pendingPromotion.from, pendingPromotion.to, piece);
            setPendingPromotion(null);
          }}
        />
      )}
    </div>
  );
}
