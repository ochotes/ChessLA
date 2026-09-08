import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { api } from "../lib/api";
import { SkeletonCard } from "../components/ui/Skeleton";
import { IconPlay, IconBolt, IconUsers, IconTrophy, IconHistory } from "../components/ui/Icons";
import type { GameHistoryEntry } from "../lib/types";

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  usePageMeta("Dashboard", "Your ChessLA dashboard.");
  const { user } = useAuth();
  const [recentGames, setRecentGames] = useState<GameHistoryEntry[] | null>(null);

  useEffect(() => {
    api.get<{ games: GameHistoryEntry[] }>("/games/history?limit=5").then((r) => setRecentGames(r.games)).catch(() => setRecentGames([]));
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">
        {timeOfDayGreeting()}, {user.fullName.split(" ")[0]}
      </h1>
      <p className="mt-1 text-text-muted">Blitz rating: {user.rating.blitz}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DashboardAction to="/play" icon={IconPlay} label="Play" />
        <DashboardAction to="/play?mode=quick" icon={IconBolt} label="Quick match" />
        <DashboardAction to="/friends" icon={IconUsers} label="Play a friend" />
        <DashboardAction to="/leaderboard" icon={IconTrophy} label="Leaderboard" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Current rating" value={user.rating.blitz} />
        <StatCard label="Games played" value={user.stats.gamesPlayed} />
        <StatCard label="Win rate" value={`${user.stats.winRate}%`} />
        <StatCard
          label="Current streak"
          value={user.stats.currentStreak === 0 ? "—" : `${Math.abs(user.stats.currentStreak)} ${user.stats.currentStreak > 0 ? "wins" : "losses"}`}
        />
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent games</h2>
          <Link to="/history" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            <IconHistory className="h-4 w-4" /> View all
          </Link>
        </div>

        {recentGames === null ? (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : recentGames.length === 0 ? (
          <div className="card p-6 text-center text-text-muted">
            No games yet. <Link to="/play" className="text-accent hover:underline">Play your first game</Link>.
          </div>
        ) : (
          <div className="space-y-2">
            {recentGames.map((g) => (
              <Link key={g.id} to={`/game/${g.id}`} className="card flex items-center justify-between p-4 hover:border-accent">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${g.result === "win" ? "bg-success" : g.result === "loss" ? "bg-danger" : "bg-text-muted"}`} />
                  <div>
                    <p className="font-medium">vs {g.opponent.username}</p>
                    <p className="text-xs text-text-muted">{g.timeControl} &middot; {g.moveCount} moves</p>
                  </div>
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
      </div>
    </div>
  );
}

function DashboardAction({ to, icon: Icon, label }: { to: string; icon: typeof IconPlay; label: string }) {
  return (
    <Link to={to} className="card flex flex-col items-center gap-2 p-4 text-center hover:border-accent">
      <Icon className="h-6 w-6 text-accent" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
