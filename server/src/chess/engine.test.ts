import { describe, it, expect } from "vitest";
import { ChessGameEngine } from "./engine.js";

describe("ChessGameEngine — core rule enforcement", () => {
  it("has exactly 20 legal moves in the starting position", () => {
    const engine = new ChessGameEngine();
    expect(engine.legalMoves().length).toBe(20);
  });

  it("accepts a normal legal opening move", () => {
    const engine = new ChessGameEngine();
    const result = engine.attemptMove("e2", "e4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.san).toBe("e4");
  });

  it("rejects a pawn moving like a rook", () => {
    const engine = new ChessGameEngine();
    const result = engine.attemptMove("e2", "e5");
    expect(result.ok).toBe(false);
  });

  it("rejects moving a piece that would leave your own king in check", () => {
    // White king on e1, white bishop pinned on... set up a simple pin: FEN
    // where the white knight on e2 is pinned by a black bishop on the e-file? Instead use a direct check exposure test.
    const engine = new ChessGameEngine({ fen: "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5P2/PPPP2PP/RNBQKBNR w KQkq - 1 3" });
    // Black queen on h4 checks white king on e1 via the diagonal after ...Qh4+? Actually verify by asking chess.js.
    expect(engine.isCheck).toBe(true);
    // Any move that doesn't address the check should be illegal.
    const illegalTry = engine.attemptMove("b1", "c3");
    expect(illegalTry.ok).toBe(false);
  });

  it("does not allow moving after checkmate", () => {
    const engine = new ChessGameEngine();
    // Fool's mate: fastest checkmate in chess.
    expect(engine.attemptMove("f2", "f3").ok).toBe(true);
    expect(engine.attemptMove("e7", "e5").ok).toBe(true);
    expect(engine.attemptMove("g2", "g4").ok).toBe(true);
    const mate = engine.attemptMove("d8", "h4");
    expect(mate.ok).toBe(true);
    if (mate.ok) {
      expect(mate.isCheckmate).toBe(true);
      expect(mate.isGameOver).toBe(true);
    }
    const afterMate = engine.attemptMove("e1", "e2");
    expect(afterMate.ok).toBe(false);
  });

  it("allows kingside castling once the path is clear and rights remain", () => {
    const engine = new ChessGameEngine({ fen: "rnbqk1nr/pppp1ppp/4p3/8/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 3" });
    const result = engine.attemptMove("e1", "g1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.san).toBe("O-O");
  });

  it("forbids castling through an attacked square", () => {
    // White king e1, rook h1, f1/g1 empty and otherwise castleable — except
    // a black rook sits on g4 with a completely open g-file, attacking the
    // g1 landing square directly. Castling must be refused.
    const engine = new ChessGameEngine({ fen: "4k3/8/8/8/6r1/8/8/4K2R w K - 0 1" });
    const result = engine.attemptMove("e1", "g1");
    expect(result.ok).toBe(false);
  });

  it("loses castling rights once the king has moved, even if it returns", () => {
    const engine = new ChessGameEngine();
    engine.attemptMove("e2", "e4");
    engine.attemptMove("e7", "e5");
    engine.attemptMove("e1", "e2"); // king steps out
    engine.attemptMove("e8", "e7");
    engine.attemptMove("e2", "e1"); // king returns home
    engine.attemptMove("e7", "e8");
    const castlingField = engine.fen.split(" ")[2];
    expect(castlingField).not.toMatch(/[KQ]/); // white rights gone even though the king is back home
  });

  it("supports en passant capture", () => {
    const engine = new ChessGameEngine();
    engine.attemptMove("e2", "e4");
    engine.attemptMove("a7", "a6");
    engine.attemptMove("e4", "e5");
    engine.attemptMove("d7", "d5"); // black pawn jumps two squares next to white pawn on e5
    const ep = engine.attemptMove("e5", "d6");
    expect(ep.ok).toBe(true);
    if (ep.ok) expect(ep.san).toBe("exd6");
  });

  it("supports promotion to each piece type", () => {
    for (const promotion of ["q", "r", "b", "n"] as const) {
      const engine = new ChessGameEngine({ fen: "8/P6k/8/8/8/8/7K/8 w - - 0 1" });
      const result = engine.attemptMove("a7", "a8", promotion);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.san.startsWith("a8=")).toBe(true);
        expect(result.fenAfter.split(" ")[0].startsWith(promotion === "q" ? "Q" : promotion.toUpperCase())).toBe(true);
      }
    }
  });

  it("detects stalemate", () => {
    // Well-known stalemate position: black king h8 has no legal moves and is not in check.
    const engine = new ChessGameEngine({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1" });
    expect(engine.isGameOver).toBe(true);
    expect(engine.isStalemate).toBe(true);
    expect(engine.isCheck).toBe(false);
  });

  it("detects insufficient material once the last capturable piece is gone", () => {
    // King + pawn vs king is NOT a dead position (the pawn could still
    // promote and force mate), so this only becomes a draw the instant the
    // black king captures the pawn, leaving a bare king vs king.
    const engine = new ChessGameEngine({ fen: "8/8/3k4/3P4/8/8/8/K7 b - - 0 1" });
    expect(engine.isGameOver).toBe(false);
    const result = engine.attemptMove("d6", "d5");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.drawReason).toBe("insufficient_material");
  });

  it("detects the fifty-move rule", () => {
    // Halfmove clock at 99; one more reversible move should push it to the
    // fifty-move draw threshold (100 halfmoves without a capture or pawn move).
    const engine = new ChessGameEngine({ fen: "8/8/8/4k3/8/8/4K3/7R w - - 99 60" });
    const result = engine.attemptMove("h1", "h5");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isDraw).toBe(true);
      expect(result.drawReason).toBe("fifty_move_rule");
    }
  });

  it("detects threefold repetition", () => {
    const engine = new ChessGameEngine();
    // Shuffle knights out and back twice: the starting position recurs a
    // third time on the final move, which must be flagged as a draw.
    let last: ReturnType<ChessGameEngine["attemptMove"]> | null = null;
    for (let round = 0; round < 2; round++) {
      engine.attemptMove("g1", "f3");
      engine.attemptMove("g8", "f6");
      engine.attemptMove("f3", "g1");
      last = engine.attemptMove("f6", "g8");
    }
    expect(last?.ok).toBe(true);
    if (last?.ok) expect(last.drawReason).toBe("threefold_repetition");
  });
});
