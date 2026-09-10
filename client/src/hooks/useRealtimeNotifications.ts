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
    function onFriendRequest(payload: { from: string }) {
      showToast(`${payload.from} sent you a friend request.`, "info");
    }
    function onFriendAccepted(payload: { by: string }) {
      showToast(`${payload.by} accepted your friend request.`, "success");
    }

    socket.on("invitation:received", onInvitationReceived);
    socket.on("invitation:accepted", onInvitationAccepted);
    socket.on("friend:request", onFriendRequest);
    socket.on("friend:accepted", onFriendAccepted);

    return () => {
      socket.off("invitation:received", onInvitationReceived);
      socket.off("invitation:accepted", onInvitationAccepted);
      socket.off("friend:request", onFriendRequest);
      socket.off("friend:accepted", onFriendAccepted);
    };
  }, [user, showToast, navigate]);
}
