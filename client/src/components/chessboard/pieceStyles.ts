export interface PieceStyle {
  id: string;
  label: string;
  /** Short sample used in the settings picker before a live board renders. */
  sample: string;
  white: {
    fill: string;
    shadow: string;
  };
  black: {
    fill: string;
    shadow: string;
  };
  /** Extra font-weight punch for styles that want a heavier, bolder look. */
  fontWeight?: number;
}

// Pieces stay pure Unicode glyphs (see pieceGlyphs.ts) in every style below —
// no raster artwork, no third-party piece sets, nothing generated. A "style"
// here is a considered fill and shadow treatment applied to the same glyph,
// so it stays crisp at any board size and never adds image weight.
export const PIECE_STYLES: PieceStyle[] = [
  {
    id: "standard",
    label: "Classic ivory",
    sample: "♔♚",
    white: { fill: "#f5f5f0", shadow: "0 1px 1px rgba(0,0,0,0.55)" },
    black: { fill: "#15181a", shadow: "0 1px 1px rgba(0,0,0,0.35)" },
  },
  {
    id: "bold",
    label: "Bold contrast",
    sample: "♔♚",
    white: { fill: "#ffffff", shadow: "0 0 0 1px rgba(0,0,0,0.75), 0 2px 2px rgba(0,0,0,0.5)" },
    black: { fill: "#000000", shadow: "0 0 0 1px rgba(255,255,255,0.18), 0 2px 2px rgba(0,0,0,0.6)" },
    fontWeight: 900,
  },
  {
    id: "walnut",
    label: "Walnut & bone",
    sample: "♔♚",
    white: { fill: "#f1e4c9", shadow: "0 1px 1px rgba(74,49,24,0.5)" },
    black: { fill: "#4a2f13", shadow: "0 1px 1px rgba(0,0,0,0.4)" },
  },
];

export function getPieceStyle(id: string | undefined): PieceStyle {
  return PIECE_STYLES.find((s) => s.id === id) ?? PIECE_STYLES[0];
}
