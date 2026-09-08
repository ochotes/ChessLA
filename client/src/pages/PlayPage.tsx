import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { IconBolt, IconUsers, IconPlay, IconChevronRight } from "../components/ui/Icons";
import type { TimeControl } from "../lib/types";

type Tab = "quick" | "friend" | "create";

export function PlayPage() {
  usePageMeta("Play chess", "Find an opponent by rating, challenge a friend, or create a private game.");
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("mode") as Tab) ?? "quick");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Play</h1>

      <div className="mt-4 flex gap-2 border-b border-border">
        <TabButton active={tab === "quick"} onClick={() => setTab("quick")} icon={IconBolt} label="Quick match" />
        <TabButton active={tab === "friend"} onClick={() => setTab("friend")} icon={IconUsers} label="Play a friend" />
        <TabButton active={tab === "create"} onClick={() => setTab("create")} icon={IconPlay} label="Create game" />
      </div>

      <div className="py-6">
        {tab === "quick" && <QuickMatchTab />}
        {tab === "friend" && <PlayFriendTab />}
        {tab === "create" && <CreateGameTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof IconBolt; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
        active ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical" };

function QuickMatchTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [timeControls, setTimeControls] = useState<TimeControl[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [opponentFound, setOpponentFound] = useState(false);

  useEffect(() => {
    api.get<{ timeControls: TimeControl[] }>("/time-controls").then((r) => {
      setTimeControls(r.timeControls);
      setSelected((prev) => prev ?? r.timeControls.find((t) => t.category === "blitz")?.id ?? r.timeControls[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    function onFound({ gameId }: { gameId: string }) {
      setOpponentFound(true);
      // A brief, real transition state — not decoration — so the player
      // sees a match was actually made before the board loads.
      setTimeout(() => {
        setSearching(false);
        setOpponentFound(false);
        navigate(`/game/${gameId}`);
      }, 700);
    }
    function onError({ message }: { message: string }) {
      setSearching(false);
      showToast(message, "danger");
    }
    socket.on("matchmaking:found", onFound);
    socket.on("matchmaking:error", onError);
    return () => {
      socket.off("matchmaking:found", onFound);
      socket.off("matchmaking:error", onError);
    };
  }, [navigate, showToast]);

  useEffect(() => {
    if (!searching) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  function startSearch() {
    if (!selected) return;
    getSocket().emit("matchmaking:join", { timeControlId: selected });
    setSearching(true);
  }

  function cancelSearch() {
    getSocket().emit("matchmaking:leave");
    setSearching(false);
  }

  const grouped = useMemo(() => {
    const groups: Record<string, TimeControl[]> = {};
    for (const tc of timeControls ?? []) {
      groups[tc.category] = groups[tc.category] ?? [];
      groups[tc.category].push(tc);
    }
    return groups;
  }, [timeControls]);

  if (searching) {
    return (
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        {opponentFound ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden="true">
              <IconBolt className="h-5 w-5" />
            </div>
            <p className="text-lg font-medium">Opponent found!</p>
            <p className="text-sm text-text-muted">Loading your game...</p>
          </>
        ) : (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/25 border-t-accent" aria-hidden="true" />
            <p className="text-lg font-medium">Searching for opponent...</p>
            <p className="text-sm text-text-muted">{elapsedSeconds}s elapsed &middot; expanding the rating range the longer you wait</p>
            <button className="btn-secondary" onClick={cancelSearch}>
              Cancel
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {!timeControls ? (
        <p className="text-text-muted">Loading time controls...</p>
      ) : (
        Object.entries(grouped).map(([category, list]) => (
          <div key={category} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">{CATEGORY_LABELS[category] ?? category}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {list.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => setSelected(tc.id)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                    selected === tc.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface-raised"
                  }`}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      <button className="btn-primary mt-4 w-full sm:w-auto" onClick={startSearch} disabled={!selected}>
        Find opponent
      </button>
    </div>
  );
}

function PlayFriendTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<{ id: string; username: string; rating: number }[] | null>(null);
  const [username, setUsername] = useState("");
  const [timeControls, setTimeControls] = useState<TimeControl[]>([]);
  const [selectedTc, setSelectedTc] = useState<string>("");

  useEffect(() => {
    api.get<{ friends: { id: string; username: string; rating: number }[] }>("/friends").then((r) => setFriends(r.friends));
    api.get<{ timeControls: TimeControl[] }>("/time-controls").then((r) => {
      setTimeControls(r.timeControls);
      setSelectedTc(r.timeControls.find((t) => t.category === "rapid")?.id ?? r.timeControls[0]?.id ?? "");
    });
  }, []);

  async function challenge(recipientUsername: string) {
    try {
      await api.post("/invitations", { timeControlId: selectedTc, recipientUsername });
      showToast(`Challenge sent to ${recipientUsername}.`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send challenge.", "danger");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="tc" className="label">
          Time control
        </label>
        <select id="tc" className="input max-w-xs" value={selectedTc} onChange={(e) => setSelectedTc(e.target.value)}>
          {timeControls.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.category} &middot; {tc.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="username" className="label">
          Challenge by username
        </label>
        <div className="flex max-w-md gap-2">
          <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter a username" />
          <button
            className="btn-primary shrink-0"
            disabled={!username.trim()}
            onClick={() => {
              void challenge(username.trim());
              setUsername("");
            }}
          >
            Challenge
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">Your friends</h2>
        {friends === null ? (
          <p className="text-text-muted">Loading...</p>
        ) : friends.length === 0 ? (
          <p className="text-text-muted">
            No friends yet. Add some from the{" "}
            <button className="text-accent hover:underline" onClick={() => navigate("/friends")}>
              Friends page
            </button>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.id} className="card flex items-center justify-between p-3">
                <span>
                  {f.username} <span className="text-text-muted">({f.rating})</span>
                </span>
                <button className="btn-secondary" onClick={() => void challenge(f.username)}>
                  Challenge <IconChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateGameTab() {
  const { showToast } = useToast();
  const [timeControls, setTimeControls] = useState<TimeControl[]>([]);
  const [selectedTc, setSelectedTc] = useState<string>("");
  const [code, setCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<{ timeControls: TimeControl[] }>("/time-controls").then((r) => {
      setTimeControls(r.timeControls);
      setSelectedTc(r.timeControls.find((t) => t.category === "rapid")?.id ?? r.timeControls[0]?.id ?? "");
    });
  }, []);

  async function createGame() {
    setCreating(true);
    try {
      const { invitation } = await api.post<{ invitation: { code: string } }>("/invitations", { timeControlId: selectedTc });
      setCode(invitation.code);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not create the game.", "danger");
    } finally {
      setCreating(false);
    }
  }

  const inviteUrl = code ? `${window.location.origin}/invite/${code}` : null;

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label htmlFor="tc-create" className="label">
          Time control
        </label>
        <select id="tc-create" className="input" value={selectedTc} onChange={(e) => setSelectedTc(e.target.value)}>
          {timeControls.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.category} &middot; {tc.label}
            </option>
          ))}
        </select>
      </div>

      <button className="btn-primary" onClick={createGame} disabled={creating}>
        {creating ? "Creating..." : "Create private game"}
      </button>

      {inviteUrl && (
        <div className="card p-4">
          <p className="text-sm text-text-muted">Share this link or code with your opponent:</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly className="input font-mono" value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="btn-secondary shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
                showToast("Link copied to clipboard.", "success");
              }}
            >
              Copy
            </button>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-widest">{code}</p>
        </div>
      )}
    </div>
  );
}
