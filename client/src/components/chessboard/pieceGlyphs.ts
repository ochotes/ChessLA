// Pieces are rendered as the standard Unicode chess symbols (U+2654–U+265F)
// rather than raster or AI-generated artwork or emoji: they are typographic
// characters, not pictographs, so they scale perfectly at any board size,
// respond to CSS color like any glyph, and are instantly recognizable.
const WHITE_GLYPHS: Record<string, string> = {
  k: "♔",
  q: "♕",
  r: "♖",
  b: "♗",
  n: "♘",
  p: "♙",
};
const BLACK_GLYPHS: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

export function pieceGlyph(type: string, color: "w" | "b"): string {
  return (color === "w" ? WHITE_GLYPHS : BLACK_GLYPHS)[type] ?? "";
}

export const PIECE_NAMES: Record<string, string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};
