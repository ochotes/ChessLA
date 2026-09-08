import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { SkeletonCard } from "../components/ui/Skeleton";
import type { GameHistoryEntry } from "../lib/types";

const RESULT_LABEL: Record<string, string> = { win: "Win", loss: "Loss", draw: "Draw" };
const RESULT_COLOR: Record<string, string> = { win: "text-success", loss: "text-danger", draw: "text-text-muted" };

export function HistoryPage() {
  usePageMeta("Game history", "Your complete ChessLA game history.");
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function load(after?: string) {
    const params = new URLSearchParams({ limit: "20" });
    if (after) params.set("cursor", after);
    const res = await api.get<{ games: GameHistoryEntry[]; nextCursor: string | null }>(`/games/history?${params.toString()}`);
    setGames((prev) => (after ? [...prev, ...res.games] : res.games));
    setCursor(res.nextCursor);
    setHasMore(Boolean(res.nextCursor));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Game history</h1>

      {loading ? (
        <div className="mt-4 space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : games.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-text-muted">
          No games yet. <Link to="/play" className="text-accent hover:underline">Play your first game</Link>.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {games.map((g) => (
            <Link key={g.id} to={`/game/${g.id}`} className="card flex items-center justify-between p-4 hover:border-accent">
              <div>
                <p className="font-medium">
                  vs {g.opponent.username} <span className={`ml-2 text-sm font-semibold ${RESULT_COLOR[g.result]}`}>{RESULT_LABEL[g.result]}</span>
                </p>
                <p className="text-xs text-text-muted">
                  {g.timeControl} &middot; {g.moveCount} moves &middot; {new Date(g.completedAt).toLocaleDateString()}
                </p>
              </div>
              {g.ratingChange !== null && (
                <span className={`text-sm font-semibold ${g.ratingChange >= 0 ? "text-success" : "text-danger"}`}>
                  {g.ratingChange >= 0 ? "+" : ""}
                  {g.ratingChange}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button className="btn-secondary mt-4 w-full" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
