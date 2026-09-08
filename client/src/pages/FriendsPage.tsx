import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { IconSearch } from "../components/ui/Icons";
import type { FriendSummary } from "../lib/types";

interface FriendRequest {
  id: string;
  from?: { id: string; username: string };
  to?: { id: string; username: string };
}

export function FriendsPage() {
  usePageMeta("Friends", "Manage your ChessLA friends and challenge them to a game.");
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ username: string; id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [f, r] = await Promise.all([
      api.get<{ friends: FriendSummary[] }>("/friends"),
      api.get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends/requests"),
    ]);
    setFriends(f.friends);
    setIncoming(r.incoming);
    setOutgoing(r.outgoing);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    function onPresence({ userId, online }: { userId: string; online: boolean }) {
      setFriends((prev) => prev.map((f) => (f.id === userId ? { ...f, online } : f)));
    }
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<{ users: { username: string; id: string }[] }>(`/users/search?q=${encodeURIComponent(query.trim())}`).then((r) => setResults(r.users));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function sendRequest(username: string) {
    try {
      await api.post("/friends/requests", { username });
      showToast(`Friend request sent to ${username}.`, "success");
      setQuery("");
      setResults([]);
      refresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send friend request.", "danger");
    }
  }

  async function respond(id: string, accept: boolean) {
    await api.post(`/friends/requests/${id}/${accept ? "accept" : "decline"}`);
    refresh();
  }

  async function removeFriend(friendId: string) {
    await api.delete(`/friends/${friendId}`);
    refresh();
  }

  async function challenge(username: string) {
    try {
      await api.post("/invitations", { timeControlId: "blitz-5+0", recipientUsername: username });
      showToast(`Challenge sent to ${username}.`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send challenge.", "danger");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Friends</h1>

      <div className="relative mt-4 max-w-md">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          className="input pl-9"
          placeholder="Search players by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="card absolute z-10 mt-1 w-full p-2">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-raised">
                <span>{u.username}</span>
                <button className="text-sm font-medium text-accent hover:underline" onClick={() => sendRequest(u.username)}>
                  Add friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Friend requests</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3">
                <span>{r.from?.username}</span>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => respond(r.id, true)}>
                    Accept
                  </button>
                  <button className="btn-secondary" onClick={() => respond(r.id, false)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Your friends ({friends.length})</h2>
        {loading ? (
          <p className="text-text-muted">Loading...</p>
        ) : friends.length === 0 ? (
          <p className="text-text-muted">No friends yet — search above to add some.</p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.id} className="card flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${f.online ? "bg-success" : "bg-text-muted/40"}`} title={f.online ? "Online" : "Offline"} />
                  <button className="font-medium hover:underline" onClick={() => navigate(`/profile/${f.username}`)}>
                    {f.username}
                  </button>
                  <span className="text-sm text-text-muted">({f.rating})</span>
                </div>
                <div className="flex gap-2">
                  {f.online && (
                    <button className="btn-primary" onClick={() => challenge(f.username)}>
                      Challenge
                    </button>
                  )}
                  <button className="btn-ghost" onClick={() => removeFriend(f.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {outgoing.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Pending requests</h2>
          <div className="space-y-2">
            {outgoing.map((r) => (
              <div key={r.id} className="card p-3 text-text-muted">
                Request sent to {r.to?.username}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
