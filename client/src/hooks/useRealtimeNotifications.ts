import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getSocket } from "../lib/socket";

/** App-wide socket listeners that matter no matter which page the player is
 * currently on: an accepted challenge should pull the challenger straight
 * into the new game even if they're browsing the leaderboard, for instance. */
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    function onInvitationReceived(payload: { from: string; timeControlLabel: string; code: string }) {
      showToast(`${payload.from} challenged you to a ${payload.timeControlLabel} game.`, "info");
    }
    function onInvitationAccepted(payload: { gameId: string }) {
      showToast("Your challenge was accepted!", "success");
      navigate(`/game/${payload.gameId}`);
    }
    function onFriendRequestOrAccept() {
      // Notification list (bell) re-fetches lazily on open; a toast is enough here.
    }

    socket.on("invitation:received", onInvitationReceived);
    socket.on("invitation:accepted", onInvitationAccepted);
    socket.on("presence:update", onFriendRequestOrAccept);

    return () => {
      socket.off("invitation:received", onInvitationReceived);
      socket.off("invitation:accepted", onInvitationAccepted);
      socket.off("presence:update", onFriendRequestOrAccept);
    };
  }, [user, showToast, navigate]);
}
