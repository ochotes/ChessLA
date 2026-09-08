import type { Server } from "socket.io";

let ioRef: Server | null = null;

/** Wires the shared Socket.IO server so plain REST route handlers can push a
 * real-time event to a specific user without importing the whole sockets
 * module (which would create a circular dependency with GameManager). */
export function attachIoForNotifications(io: Server) {
  ioRef = io;
}

export function notifyUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}
