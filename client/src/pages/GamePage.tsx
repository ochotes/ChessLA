import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { Board } from "../components/chessboard/Board";
import { Clock } from "../components/chessboard/Clock";
import { MoveList } from "../components/chessboard/MoveList";
import { ChatPanel, type ChatMessageItem } from "../components/chessboard/ChatPanel";
import { GameOverModal } from "../components/chessboard/GameOverModal";
import { Modal } from "../components/ui/Modal";
import { SkeletonBoard } from "../components/ui/Skeleton";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconFlag, IconHandshake } from "../components/ui/Icons";
import type { GameReplay, GameStateDTO, UserSettings } from "../lib/types";

type PromotionPiece = "q" | "r" | "b" | "n";

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"loading" | "live" | "replay" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [settings, setSettings] = useState<UserSettings | null>(null);

  usePageMeta("Game", "Play chess in real time on ChessLA.");

  useEffect(() => {
    api.get<{ settings: UserSettings }>("/users/me/settings").then((r) => setSettings(r.settings)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMode("loading");
    api
      .get<{ game: GameReplay }>(`/games/${id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.game.status === "IN_PROGRESS") {
          setMode("live");
        } else {
          setReplayGame(res.game);
          setMode("replay");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message ?? "This game could not be found.");
        setMode("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [replayGame, setReplayGame] = useState<GameReplay | null>(null);

  if (mode === "loading") {
    return (
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonBoard />
        <div className="space-y-3">
          <div className="skeleton h-16" />
          <div className="skeleton h-40" />
        </div>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg font-medium">{errorMessage}</p>
        <button className="btn-primary mt-4" onClick={() => navigate("/dashboard")}>
          Return home
        </button>
      </div>
    );
  }

  if (mode === "replay" && replayGame) {
    return <ReplayView game={replayGame} myUsername={user?.username ?? null} settings={settings} />;
  }

  if (mode === "live" && id && user) {
    return <LiveView gameId={id} myUserId={user.id} settings={settings} />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Live game
// ---------------------------------------------------------------------------

function LiveView({ gameId, myUserId, settings }: { gameId: string; myUserId: string; settings: UserSettings | null }) {
  const { showToast } = useToast();
  const [state, setState] = useState<GameStateDTO | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [drawCooldownUntil, setDrawCooldownUntil] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    function onState(s: GameStateDTO) {
      setState(s);
      if (s.status === "COMPLETED") setShowGameOver(true);
    }
    function onMove({ state: s }: { state: GameStateDTO; san: string }) {
      setState(s);
    }
    function onClock(clocks: { white: number; black: number; turn: "white" | "black" }) {
      setState((prev) => (prev ? { ...prev, clocks: { white: clocks.white, black: clocks.black } } : prev));
    }
    function onOver(s: GameStateDTO) {
      setState(s);
      setShowGameOver(true);
    }
    function onDrawOffer({ from }: { from: "white" | "black" }) {
      setState((prev) => (prev ? { ...prev, drawOfferBy: from } : prev));
    }
    function onDrawDeclined() {
      showToast("Your draw offer was declined.", "info");
      setState((prev) => (prev ? { ...prev, drawOfferBy: null } : prev));
    }
    function onConnection({ side, connected }: { side: "white" | "black"; connected: boolean }) {
      setState((prev) => (prev ? { ...prev, connection: { ...prev.connection, [side]: connected } } : prev));
      if (!connected) showToast("Your opponent lost connection. Reconnecting...", "warning");
      else showToast("Your opponent reconnected.", "info");
    }
    function onChat(message: ChatMessageItem) {
      setChatMessages((prev) => [...prev, message]);
    }
    function onError({ message }: { message: string }) {
      showToast(message, "danger");
    }

    socket.on("game:state", onState);
    socket.on("game:move", onMove);
    socket.on("game:clock", onClock);
    socket.on("game:over", onOver);
    socket.on("game:drawOffer", onDrawOffer);
    socket.on("game:drawDeclined", onDrawDeclined);
    socket.on("game:connection", onConnection);
    socket.on("game:chat", onChat);
    socket.on("game:error", onError);

    socket.emit("game:join", { gameId });

    return () => {
      socket.off("game:state", onState);
      socket.off("game:move", onMove);
      socket.off("game:clock", onClock);
      socket.off("game:over", onOver);
      socket.off("game:drawOffer", onDrawOffer);
      socket.off("game:drawDeclined", onDrawDeclined);
      socket.off("game:connection", onConnection);
      socket.off("game:chat", onChat);
      socket.off("game:error", onError);
    };
  }, [gameId, showToast]);

  const myColor: "w" | "b" | null = useMemo(() => {
    if (!state) return null;
    if (state.white.id === myUserId) return "w";
    if (state.black.id === myUserId) return "b";
    return null;
  }, [state, myUserId]);

  const handleMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      getSocket().emit("game:move", { gameId, from, to, promotion });
    },
    [gameId]
  );

  const handleResign = useCallback(() => {
    getSocket().emit("game:resign", { gameId });
    setShowResignConfirm(false);
  }, [gameId]);

  const handleOfferDraw = useCallback(() => {
    getSocket().emit("game:offerDraw", { gameId });
    setDrawCooldownUntil(Date.now() + 20_000);
  }, [gameId]);

  const handleRespondDraw = useCallback(
    (accept: boolean) => {
      getSocket().emit("game:respondDraw", { gameId, accept });
    },
    [gameId]
  );

  const handleSendChat = useCallback(
    (text: string) => {
      getSocket().emit("game:chat", { gameId, text });
    },
    [gameId]
  );

  if (!state) {
    return (
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonBoard />
      </div>
    );
  }

  const orientation =
    settings?.boardOrientation && settings.boardOrientation !== "auto"
      ? settings.boardOrientation
      : myColor === "b"
      ? "black"
      : "white";

  const iHaveOfferedDraw = state.drawOfferBy && myColor && state.drawOfferBy === (myColor === "w" ? "white" : "black");
  const opponentOfferedDraw = state.drawOfferBy && myColor && state.drawOfferBy !== (myColor === "w" ? "white" : "black");
  const canOfferDraw = Date.now() > drawCooldownUntil;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-2xl">
        <PlayerHeader
          summary={orientation === "white" ? state.black : state.white}
          connected={orientation === "white" ? state.connection.black : state.connection.white}
        />
        <Clock
          label={orientation === "white" ? "Black" : "White"}
          remainingMs={orientation === "white" ? state.clocks.black : state.clocks.white}
          isRunning={state.status === "IN_PROGRESS" && state.turn === (orientation === "white" ? "b" : "w")}
        />
        <div className="my-2">
          <Board
            fen={state.fen}
            orientation={orientation}
            interactive={state.status === "IN_PROGRESS" && myColor !== null}
            myColor={myColor}
            lastMove={state.lastMove}
            onMove={handleMove}
            showLegalMoves={settings?.showLegalMoves ?? true}
            showCoordinates={settings?.showCoordinates ?? true}
            boardTheme={settings?.boardTheme}
            pieceStyle={settings?.pieceStyle}
          />
        </div>
        <Clock
          label={orientation === "white" ? "White" : "Black"}
          remainingMs={orientation === "white" ? state.clocks.white : state.clocks.black}
          isRunning={state.status === "IN_PROGRESS" && state.turn === (orientation === "white" ? "w" : "b")}
        />
        <PlayerHeader
          summary={orientation === "white" ? state.white : state.black}
          connected={orientation === "white" ? state.connection.white : state.connection.black}
        />
      </div>

      <aside className="space-y-4">
        <div className="card p-3 text-sm">
          <p className="font-semibold">{state.timeControl.label} &middot; {state.isRated ? "Rated" : "Unrated"}</p>
          <p className="text-text-muted">{gameStatusLabel(state, myColor)}</p>
        </div>

        <MoveList moves={state.moveHistorySan} />

        {myColor && state.status === "IN_PROGRESS" && (
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={handleOfferDraw}
              disabled={!canOfferDraw || Boolean(iHaveOfferedDraw)}
              title={!canOfferDraw ? "Please wait before offering another draw" : undefined}
            >
              <IconHandshake className="h-4 w-4" /> Offer draw
            </button>
            <button
              className="btn-danger flex-1"
              onClick={() => (settings?.confirmResign ?? true ? setShowResignConfirm(true) : handleResign())}
            >
              <IconFlag className="h-4 w-4" /> Resign
            </button>
          </div>
        )}

        {opponentOfferedDraw && (
          <div className="card border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="mb-2 font-medium">Your opponent has offered a draw.</p>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => handleRespondDraw(true)}>
                Accept draw
              </button>
              <button className="btn-secondary flex-1" onClick={() => handleRespondDraw(false)}>
                Decline
              </button>
            </div>
          </div>
        )}

        {myColor && <ChatPanel messages={chatMessages} onSend={handleSendChat} myUserId={myUserId} />}
      </aside>

      {showResignConfirm && (
        <Modal
          title="Resign this game?"
          onClose={() => setShowResignConfirm(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowResignConfirm(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleResign}>
                Resign
              </button>
            </>
          }
        >
          This counts as a loss and will affect your rating. Are you sure?
        </Modal>
      )}

      {showGameOver && state.status === "COMPLETED" && (
        <GameOverModal state={state} myColor={myColor} onClose={() => setShowGameOver(false)} />
      )}
    </div>
  );
}

function PlayerHeader({ summary, connected }: { summary: { username: string; country: string; rating: number }; connected: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`}
          title={connected ? "Connected" : "Disconnected"}
          aria-label={connected ? "Connected" : "Disconnected"}
        />
        <span className="font-medium">{summary.username}</span>
        <span className="text-sm text-text-muted">({summary.rating})</span>
      </div>
    </div>
  );
}

function gameStatusLabel(state: GameStateDTO, myColor: "w" | "b" | null): string {
  if (state.status === "COMPLETED") {
    if (state.result === "1/2-1/2") return "Game drawn";
    const winner = state.result === "1-0" ? "White" : "Black";
    return `${winner} wins`;
  }
  if (state.isCheck) return `${state.turn === "w" ? "White" : "Black"} is in check`;
  if (!myColor) return `${state.turn === "w" ? "White" : "Black"} to move`;
  return state.turn === myColor ? "Your move" : "Waiting for opponent";
}

// ---------------------------------------------------------------------------
// Replay / analysis
// ---------------------------------------------------------------------------

function ReplayView({ game, myUsername, settings }: { game: GameReplay; myUsername: string | null; settings: UserSettings | null }) {
  const [moveIndex, setMoveIndex] = useState(game.moves.length - 1);

  const displayedFen = moveIndex === -1 ? game.startingFen : game.moves[moveIndex]?.fenAfter ?? game.currentFen;

  const orientation =
    myUsername && game.black?.username === myUsername && game.white?.username !== myUsername ? "black" : "white";

  const materialBalance = useMemo(() => {
    try {
      const chess = new Chess(displayedFen);
      const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let balance = 0;
      for (const row of chess.board()) {
        for (const cell of row) {
          if (!cell) continue;
          balance += cell.color === "w" ? values[cell.type] : -values[cell.type];
        }
      }
      return balance;
    } catch {
      return 0;
    }
  }, [displayedFen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setMoveIndex((i) => Math.max(-1, i - 1));
      if (e.key === "ArrowRight") setMoveIndex((i) => Math.min(game.moves.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.moves.length]);

  const resultLabel =
    game.result === "1/2-1/2"
      ? "Draw"
      : game.result === "1-0"
      ? `${game.white?.username ?? "White"} won`
      : game.result === "0-1"
      ? `${game.black?.username ?? "Black"} won`
      : "Game ended";

  usePageMeta(`${game.white?.username ?? "?"} vs ${game.black?.username ?? "?"}`, "Replay and review a completed ChessLA game.");

  const clampedBalance = Math.max(-9, Math.min(9, materialBalance));
  const whitePercent = 50 + (clampedBalance / 9) * 50;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-semibold">
              {game.white?.username ?? "White"} vs {game.black?.username ?? "Black"}
            </p>
            <p className="text-sm text-text-muted">
              {resultLabel} &middot; {(game.terminationReason ?? "").replace(/_/g, " ")} &middot; {game.timeControl}
            </p>
          </div>
        </div>

        <Board
          fen={displayedFen}
          orientation={orientation}
          interactive={false}
          myColor={null}
          lastMove={null}
          onMove={() => {}}
          showCoordinates={settings?.showCoordinates ?? true}
          boardTheme={settings?.boardTheme}
          pieceStyle={settings?.pieceStyle}
        />

        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="btn-ghost" onClick={() => setMoveIndex(-1)} aria-label="First move">
            <IconChevronsLeft className="h-5 w-5" />
          </button>
          <button className="btn-ghost" onClick={() => setMoveIndex((i) => Math.max(-1, i - 1))} aria-label="Previous move">
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <button className="btn-ghost" onClick={() => setMoveIndex((i) => Math.min(game.moves.length - 1, i + 1))} aria-label="Next move">
            <IconChevronRight className="h-5 w-5" />
          </button>
          <button className="btn-ghost" onClick={() => setMoveIndex(game.moves.length - 1)} aria-label="Last move">
            <IconChevronsRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-3">
          <p className="mb-1.5 text-sm font-medium">Material balance</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#15181a]">
            <div className="h-full bg-[#f5f5f0] transition-all" style={{ width: `${whitePercent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-text-muted">
            {materialBalance === 0 ? "Even material" : `${materialBalance > 0 ? "White" : "Black"} ahead by ${Math.abs(materialBalance)} point${Math.abs(materialBalance) === 1 ? "" : "s"}`}
            {" "}&middot; based on piece count, not a full engine evaluation
          </p>
        </div>

        <MoveList moves={game.moves.map((m) => m.san)} currentIndex={moveIndex} onSelect={setMoveIndex} />
      </aside>
    </div>
  );
}
