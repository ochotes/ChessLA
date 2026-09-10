import type { Server, Socket } from "socket.io";
import cookie from "cookie";
import { verifyAccessToken } from "../auth/tokens.js";
import { COOKIE_NAMES } from "../auth/cookies.js";
import { gameManager } from "../game/GameManager.js";
import { matchmakingQueue, playerSummaryFor } from "../matchmaking/MatchmakingQueue.js";
import { findTimeControl, classifyTimeControl, isValidCustomTimeControl, TIME_CONTROLS, type TimeControlCategory } from "../game/timeControls.js";
import { getEngineTier } from "../engine/engineTiers.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeChatText, isSpam, type RateLimiterState } from "../lib/chatModeration.js";
import type { GameBroadcaster } from "../game/types.js";
import { attachPresenceChecker } from "./notify.js";

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    username: string;
    role: "PLAYER" | "MODERATOR" | "ADMIN";
  };
}

const chatState = new Map<string, RateLimiterState>(); // key: `${gameId}:${userId}`
const presence = new Map<string, Set<string>>(); // userId -> socket ids

export function registerSockets(io: Server) {
  io.use((socket, next) => {
    const raw = socket.handshake.headers.cookie;
    if (!raw) return next(new Error("Not authenticated."));
    const cookies = cookie.parse(raw);
    const token = cookies[COOKIE_NAMES.access];
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) return next(new Error("Not authenticated."));
    (socket as AuthedSocket).data = { userId: payload.sub, username: payload.username, role: payload.role };
    next();
  });

  const broadcaster: GameBroadcaster = {
    emitState: (gameId, state) => io.to(roomFor(gameId)).emit("game:state", state),
    emitMove: (gameId, state, san) => io.to(roomFor(gameId)).emit("game:move", { state, san }),
    emitClock: (gameId, clocks) => io.to(roomFor(gameId)).emit("game:clock", clocks),
    emitGameOver: (gameId, state) => io.to(roomFor(gameId)).emit("game:over", state),
    emitDrawOffer: (gameId, from) => io.to(roomFor(gameId)).emit("game:drawOffer", { from }),
    emitDrawDeclined: (gameId) => io.to(roomFor(gameId)).emit("game:drawDeclined"),
    emitConnectionChange: (gameId, side, connected) => io.to(roomFor(gameId)).emit("game:connection", { side, connected }),
    emitChat: (gameId, message) => io.to(roomFor(gameId)).emit("game:chat", message),
    emitError: (gameId, userId, message) => io.to(socketRoomForUser(userId)).emit("game:error", { gameId, message }),
  };
  gameManager.setBroadcaster(broadcaster);
  gameManager.start();
  attachPresenceChecker((userId) => presence.has(userId));

  matchmakingQueue.setOnMatch((gameId, players) => {
    for (const p of players) {
      io.to(socketRoomForUser(p.userId)).emit("matchmaking:found", { gameId });
    }
  });
  matchmakingQueue.start();

  io.on("connection", (socket) => {
    const s = socket as AuthedSocket;
    const userId = s.data.userId;

    socket.join(socketRoomForUser(userId));
    trackPresence(userId, socket.id, true);
    void broadcastPresence(io, userId, true);

    socket.on("game:join", async ({ gameId }: { gameId: string }) => {
      const game = gameManager.getGame(gameId);
      if (!game) return socket.emit("game:error", { gameId, message: "This game no longer exists." });
      socket.join(roomFor(gameId));
      const reconnectedState = await gameManager.handleReconnect(userId, gameId);
      socket.emit("game:state", reconnectedState ?? gameManager.toDTO(game));
    });

    socket.on("game:move", async ({ gameId, from, to, promotion }: { gameId: string; from: string; to: string; promotion?: "q" | "r" | "b" | "n" }) => {
      const result = await gameManager.attemptMove(gameId, userId, from, to, promotion);
      if (!result.ok) socket.emit("game:error", { gameId, message: result.error });
    });

    socket.on("game:offerDraw", async ({ gameId }: { gameId: string }) => {
      const result = await gameManager.offerDraw(gameId, userId);
      if (!result.ok) socket.emit("game:error", { gameId, message: result.error });
    });

    socket.on("game:respondDraw", async ({ gameId, accept }: { gameId: string; accept: boolean }) => {
      const result = await gameManager.respondToDraw(gameId, userId, accept);
      if (!result.ok) socket.emit("game:error", { gameId, message: result.error });
    });

    socket.on("game:resign", async ({ gameId }: { gameId: string }) => {
      const result = await gameManager.resign(gameId, userId);
      if (!result.ok) socket.emit("game:error", { gameId, message: result.error });
    });

    socket.on("game:chat", async ({ gameId, text }: { gameId: string; text: string }) => {
      const game = gameManager.getGame(gameId);
      if (!game) return;
      const key = `${gameId}:${userId}`;
      const clean = sanitizeChatText(String(text ?? ""));
      if (!clean) return;
      if (isSpam(chatState.get(key), clean, Date.now())) {
        return socket.emit("game:error", { gameId, message: "You're sending messages too quickly." });
      }
      const prior = chatState.get(key);
      chatState.set(key, {
        lastMessageAt: Date.now(),
        lastText: clean,
        repeatCount: prior?.lastText === clean ? (prior.repeatCount ?? 0) + 1 : 0,
      });

      const saved = await prisma.chatMessage.create({ data: { gameId, userId, text: clean } });
      broadcaster.emitChat(gameId, {
        id: saved.id,
        userId,
        username: s.data.username,
        text: clean,
        createdAt: saved.createdAt.toISOString(),
        isSystem: false,
      });
    });

    socket.on(
      "matchmaking:join",
      async ({ timeControlId, category }: { timeControlId?: string; category?: TimeControlCategory }) => {
        const tc = timeControlId ? findTimeControl(timeControlId) : undefined;
        if (!tc) return socket.emit("matchmaking:error", { message: "Unknown time control." });
        const info = await playerSummaryFor(userId, tc.category);
        if (!info) return socket.emit("matchmaking:error", { message: "Could not load your profile." });
        matchmakingQueue.enqueue(userId, info.summary, info.rating, tc);
        socket.emit("matchmaking:searching", { timeControlId: tc.id });
      }
    );

    socket.on(
      "engine:play",
      async ({ tierId, timeControlId, side }: { tierId?: string; timeControlId?: string; side?: "white" | "black" | "random" }) => {
        const tier = tierId ? getEngineTier(tierId) : undefined;
        if (!tier) return socket.emit("engine:error", { message: "Unknown engine." });
        const tc = timeControlId ? findTimeControl(timeControlId) : undefined;
        if (!tc) return socket.emit("engine:error", { message: "Unknown time control." });
        const info = await playerSummaryFor(userId, tc.category);
        if (!info) return socket.emit("engine:error", { message: "Could not load your profile." });

        const humanSide: "white" | "black" = side === "white" || side === "black" ? side : Math.random() < 0.5 ? "white" : "black";

        const { id } = await gameManager.createEngineGame({ human: info.summary, humanSide, tier, timeControl: tc });
        socket.emit("engine:ready", { gameId: id });
      }
    );

    socket.on("matchmaking:leave", () => {
      matchmakingQueue.dequeue(userId);
      socket.emit("matchmaking:cancelled");
    });

    socket.on("disconnect", () => {
      trackPresence(userId, socket.id, false);
      matchmakingQueue.dequeue(userId);
      void broadcastPresence(io, userId, presence.has(userId));
      void handleUserFullyDisconnected(userId);
    });
  });
}

function roomFor(gameId: string) {
  return `game:${gameId}`;
}

function socketRoomForUser(userId: string) {
  return `user:${userId}`;
}

function trackPresence(userId: string, socketId: string, connected: boolean) {
  const set = presence.get(userId) ?? new Set<string>();
  if (connected) set.add(socketId);
  else set.delete(socketId);
  if (set.size > 0) presence.set(userId, set);
  else presence.delete(userId);
}

async function handleUserFullyDisconnected(userId: string) {
  if (presence.has(userId)) return; // still has another open tab/connection
  const activeGames = await prisma.game.findMany({
    where: { status: "IN_PROGRESS", OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }] },
    select: { id: true },
  });
  for (const g of activeGames) {
    await gameManager.handleDisconnect(userId, g.id);
  }
}

async function broadcastPresence(io: Server, userId: string, online: boolean) {
  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ userId }, { friendId: userId }] },
  });
  const friendIds = friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
  for (const fid of friendIds) {
    io.to(socketRoomForUser(fid)).emit("presence:update", { userId, online });
  }
}

export { TIME_CONTROLS, classifyTimeControl, isValidCustomTimeControl };
