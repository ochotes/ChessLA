import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { countryName } from "../lib/countries";
import { SkeletonCard } from "../components/ui/Skeleton";
import type { PublicProfile } from "../lib/types";

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: viewer } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageMeta(username ?? "Profile", `${username ?? "Player"}'s ChessLA profile and rating history.`);

  useEffect(() => {
    if (!username) return;
    setProfile(null);
    setError(null);
    api
      .get<{ user: PublicProfile }>(`/users/${username}`)
      .then((r) => setProfile(r.user))
      .catch((err) => setError(err instanceof ApiError ? err.message : "This profile could not be found."));
  }, [username]);

  async function addFriend() {
    if (!profile) return;
    try {
      await api.post("/friends/requests", { username: profile.username });
      showToast(`Friend request sent to ${profile.username}.`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send friend request.", "danger");
    }
  }

  async function challenge() {
    if (!profile) return;
    try {
      await api.post("/invitations", { timeControlId: "blitz-5+0", recipientUsername: profile.username });
      showToast(`Challenge sent to ${profile.username}.`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send challenge.", "danger");
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-text-muted">
        <p>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <SkeletonCard />
      </div>
    );
  }

  const isOwnProfile = viewer?.username === profile.username;

  return (
    <div className="mx-auto max-w-3xl py-4">
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-2xl font-semibold text-accent">
            {profile.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-semibold">{profile.username}</h1>
            <p className="text-sm text-text-muted">{countryName(profile.country)}</p>
            <p className="text-xs text-text-muted">Member since {new Date(profile.memberSince).toLocaleDateString()}</p>
          </div>
        </div>
        {isOwnProfile ? (
          <Link to="/settings" className="btn-secondary">
            Edit profile
          </Link>
        ) : viewer ? (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={challenge}>
              Challenge
            </button>
            <button className="btn-secondary" onClick={addFriend}>
              Add friend
            </button>
          </div>
        ) : null}
      </div>

      {profile.bio && <p className="mt-4 text-text">{profile.bio}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RatingCard label="Bullet" value={profile.rating.bullet} />
        <RatingCard label="Blitz" value={profile.rating.blitz} />
        <RatingCard label="Rapid" value={profile.rating.rapid} />
        <RatingCard label="Classical" value={profile.rating.classical} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Games played" value={profile.stats.gamesPlayed} />
        <StatCard label="Wins" value={profile.stats.wins} />
        <StatCard label="Draws" value={profile.stats.draws} />
        <StatCard label="Losses" value={profile.stats.losses} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Win rate" value={`${profile.stats.winRate}%`} />
        <StatCard label="Highest rating" value={profile.rating.highest} />
        <StatCard
          label="Current streak"
          value={profile.stats.currentStreak === 0 ? "—" : `${Math.abs(profile.stats.currentStreak)} ${profile.stats.currentStreak > 0 ? "W" : "L"}`}
        />
      </div>
    </div>
  );
}

function RatingCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
