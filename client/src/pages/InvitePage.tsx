import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";

interface InvitationInfo {
  code: string;
  from: { username: string; country: string };
  timeControlLabel: string;
}

export function InvitePage() {
  usePageMeta("Join game", "Accept a ChessLA game invitation.");
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .get<{ invitation: InvitationInfo }>(`/invitations/code/${code}`)
      .then((r) => setInvitation(r.invitation))
      .catch((err) => setError(err instanceof ApiError ? err.message : "This invitation could not be found."));
  }, [code]);

  async function accept() {
    if (!code) return;
    setAccepting(true);
    try {
      const { gameId } = await api.post<{ gameId: string }>(`/invitations/code/${code}/accept`);
      navigate(`/game/${gameId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This invitation could not be accepted.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Logo className="h-12 w-12" />

      {error && (
        <div className="mt-6">
          <p className="text-text">{error}</p>
          <Link to="/play" className="btn-primary mt-4 inline-flex">
            Find another game
          </Link>
        </div>
      )}

      {!error && !invitation && <p className="mt-6 text-text-muted">Loading invitation...</p>}

      {!error && invitation && (
        <div className="mt-6 card w-full p-6">
          <p className="text-lg">
            <span className="font-semibold">{invitation.from.username}</span> invited you to a{" "}
            <span className="font-semibold">{invitation.timeControlLabel}</span> game.
          </p>
          {user ? (
            <button className="btn-primary mt-4 w-full" onClick={accept} disabled={accepting}>
              {accepting ? "Joining..." : "Accept and play"}
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-text-muted">Sign in or create an account to accept this challenge.</p>
              <Link to="/login" state={{ from: `/invite/${code}` }} className="btn-primary block w-full">
                Sign in
              </Link>
              <Link to="/register" className="btn-secondary block w-full">
                Create account
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
