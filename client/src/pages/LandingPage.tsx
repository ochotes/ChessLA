import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { api } from "../lib/api";
import { Board } from "../components/chessboard/Board";
import { Logo } from "../components/Logo";
import { IconBolt, IconTrophy, IconUsers, IconShield, IconHistory, IconArrowRight } from "../components/ui/Icons";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 5";

export function LandingPage() {
  usePageMeta(
    "ChessLA — Real-Time Multiplayer Chess",
    "Play real-time multiplayer chess on ChessLA. Find an opponent by rating, challenge friends, and track your rating across bullet, blitz, rapid, and classical chess."
  );
  const { user } = useAuth();
  const [stats, setStats] = useState<{ totalUsers: number; totalGamesCompleted: number } | null>(null);

  useEffect(() => {
    api.get<{ totalUsers: number; totalGamesCompleted: number }>("/stats/public").then(setStats).catch(() => {});
  }, []);

  return (
    <div>
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <div className="mb-5 flex items-center gap-2">
            <Logo className="h-9 w-9" />
            <span className="font-display text-xl font-semibold">ChessLA</span>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Think. Play. Conquer.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-text-muted">
            Real-time multiplayer chess with server-verified moves, ratings for bullet, blitz, rapid,
            and classical, and a matchmaking queue that pairs you with an opponent close to your
            rating.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <Link to="/play" className="btn-primary px-6 py-3 text-base">
                Play now <IconArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/register" className="btn-primary px-6 py-3 text-base">
                Create free account <IconArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link to="/how-it-works" className="btn-ghost px-6 py-3 text-base">
              How it works
            </Link>
            <Link to="/leaderboard" className="btn-ghost px-6 py-3 text-base">
              Leaderboard
            </Link>
          </div>

          {stats && (stats.totalUsers > 0 || stats.totalGamesCompleted > 0) && (
            <p className="mt-6 text-sm text-text-muted">
              <span className="font-semibold text-text">{stats.totalUsers.toLocaleString()}</span> players ·{" "}
              <span className="font-semibold text-text">{stats.totalGamesCompleted.toLocaleString()}</span> games completed
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-md">
          <Board fen={PREVIEW_FEN} orientation="white" interactive={false} myColor={null} lastMove={{ from: "g8", to: "f6" }} onMove={() => {}} showCoordinates />
        </div>
      </section>

      <section className="border-t border-border bg-surface-raised/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold">Built for players who take the game seriously</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={IconShield} title="Server-verified moves" description="Every move is checked against the full rules of chess on the server — castling, en passant, promotion, checks, and all draw conditions." />
            <Feature icon={IconBolt} title="Real time controls" description="Bullet, blitz, rapid, and classical, with clocks synchronized to the server so no one can win by editing their device clock." />
            <Feature icon={IconUsers} title="Matchmaking and friends" description="Quick Match pairs you with a similarly rated opponent, or challenge a specific friend and share a game link." />
            <Feature icon={IconTrophy} title="Ratings and leaderboards" description="A separate rating per time control, full game history, and global, country, and friends leaderboards." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-xl font-semibold">Your first game is one click away</h2>
            <p className="mt-1 text-text-muted">Create a free account and get matched in seconds.</p>
          </div>
          <Link to={user ? "/play" : "/register"} className="btn-primary px-6 py-3 text-base">
            {user ? "Play now" : "Create free account"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, description }: { icon: typeof IconBolt; title: string; description: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-text-muted">{description}</p>
    </div>
  );
}
