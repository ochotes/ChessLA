import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { COUNTRIES, countryName } from "../lib/countries";
import type { LeaderboardEntry, TimeControlCategory } from "../lib/types";

const CATEGORIES: TimeControlCategory[] = ["bullet", "blitz", "rapid", "classical"];
type Scope = "global" | "country" | "friends";

export function LeaderboardPage() {
  usePageMeta("Leaderboard", "See the top-rated ChessLA players by rating, country, and time control.");
  const { user } = useAuth();
  const [category, setCategory] = useState<TimeControlCategory>("blitz");
  const [scope, setScope] = useState<Scope>("global");
  const [country, setCountry] = useState(user?.country ?? "US");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    setEntries(null);
    const params = new URLSearchParams({ category, scope: scope === "country" ? "global" : scope });
    if (scope === "country") params.set("country", country);
    api
      .get<{ entries: LeaderboardEntry[] }>(`/leaderboard?${params.toString()}`)
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, [category, scope, country]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                category === c ? "bg-accent text-accent-contrast" : "text-text-muted hover:bg-surface-raised"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setScope("global")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === "global" ? "bg-accent text-accent-contrast" : "text-text-muted hover:bg-surface-raised"}`}
            >
              Global
            </button>
            <button
              onClick={() => setScope("country")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === "country" ? "bg-accent text-accent-contrast" : "text-text-muted hover:bg-surface-raised"}`}
            >
              Country
            </button>
            {user && (
              <button
                onClick={() => setScope("friends")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === "friends" ? "bg-accent text-accent-contrast" : "text-text-muted hover:bg-surface-raised"}`}
              >
                Friends
              </button>
            )}
          </div>
          {scope === "country" && (
            <select className="input w-auto" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-left">
              <th className="p-3">Rank</th>
              <th className="p-3">Player</th>
              <th className="p-3">Country</th>
              <th className="p-3 text-right">Rating</th>
              <th className="p-3 text-right">Games</th>
            </tr>
          </thead>
          <tbody>
            {entries === null ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No ranked players yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.userId} className="border-b border-border last:border-0 hover:bg-surface-raised">
                  <td className="p-3 font-medium">{e.rank}</td>
                  <td className="p-3">
                    <Link to={`/profile/${e.username}`} className="text-accent hover:underline">
                      {e.username}
                    </Link>
                  </td>
                  <td className="p-3 text-text-muted">{countryName(e.country)}</td>
                  <td className="p-3 text-right font-semibold">{e.rating}</td>
                  <td className="p-3 text-right text-text-muted">{e.gamesPlayed}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
