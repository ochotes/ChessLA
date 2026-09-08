import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** One shared, lazily-created Socket.IO connection for the whole app.
 * Authentication rides on the same httpOnly session cookie as REST calls —
 * there is no token to manage on this side. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io("/", {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
