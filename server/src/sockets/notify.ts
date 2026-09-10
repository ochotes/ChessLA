import type { Server } from "socket.io";

let ioRef: Server | null = null;
let presenceCheckerRef: ((userId: string) => boolean) | null = null;

/** Wires the shared Socket.IO server so plain REST route handlers can push a
 * real-time event to a specific user without importing the whole sockets
 * module (which would create a circular dependency with GameManager). */
export function attachIoForNotifications(io: Server) {
  ioRef = io;
}

export function notifyUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

/** Same decoupling as attachIoForNotifications, for the sockets module's own
 * live connection tracking — lets REST endpoints (e.g. GET /friends) report
 * accurate online status on first load, not just via the presence:update
 * events fired later on a connect/disconnect transition (which say nothing
 * about a friend who was already online before this fetch happened). */
export function attachPresenceChecker(checker: (userId: string) => boolean) {
  presenceCheckerRef = checker;
}

export function isUserOnline(userId: string): boolean {
  return presenceCheckerRef?.(userId) ?? false;
}
