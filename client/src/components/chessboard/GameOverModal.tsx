import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import type { GameStateDTO } from "../../lib/types";

const REASON_LABEL: Record<string, string> = {
  checkmate: "by checkmate",
  resignation: "by resignation",
  timeout: "on time",
  stalemate: "by stalemate",
  draw_agreement: "by agreement",
  threefold_repetition: "by threefold repetition",
  fifty_move_rule: "by the fifty-move rule",
  insufficient_material: "by insufficient material",
  abandonment: "by abandonment",
};

export function GameOverModal({ state, myColor, onClose }: { state: GameStateDTO; myColor: "w" | "b" | null; onClose: () => void }) {
  const navigate = useNavigate();
  const reason = state.terminationReason ?? "";
  const reasonLabel = REASON_LABEL[reason] ?? reason.replace(/_/g, " ");

  let headline: string;
  if (state.result === "1/2-1/2") {
    headline = "Draw";
  } else {
    const winner = state.result === "1-0" ? state.white : state.black;
    headline = `${winner.username} wins`;
  }

  const myRatingChange = myColor && state.ratingChange ? (myColor === "w" ? state.ratingChange.white : state.ratingChange.black) : null;

  return (
    <Modal
      title={headline}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
            Return home
          </button>
          <button className="btn-secondary" onClick={() => navigate(`/game/${state.id}`)}>
            Analyze game
          </button>
          <button className="btn-primary" onClick={() => navigate("/play")}>
            New game
          </button>
        </>
      }
    >
      <p className="text-text">
        {state.result === "1/2-1/2" ? "The game ended in a draw" : `${state.result === "1-0" ? state.black.username : state.white.username} was defeated`}{" "}
        {reasonLabel}.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-raised p-3">
          <dt className="text-text-muted">Moves played</dt>
          <dd className="text-lg font-semibold text-text">{Math.ceil(state.moveHistorySan.length / 2)}</dd>
        </div>
        <div className="rounded-lg bg-surface-raised p-3">
          <dt className="text-text-muted">Time control</dt>
          <dd className="text-lg font-semibold text-text">{state.timeControl.label}</dd>
        </div>
        {myRatingChange !== null && (
          <div className="col-span-2 rounded-lg bg-surface-raised p-3">
            <dt className="text-text-muted">Your rating change</dt>
            <dd className={`text-lg font-semibold ${myRatingChange >= 0 ? "text-success" : "text-danger"}`}>
              {myRatingChange >= 0 ? "+" : ""}
              {myRatingChange}
            </dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}
