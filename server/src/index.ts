import express from "express";
import http from "node:http";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { config } from "./config.js";
import { httpsEnforcement, helmetMiddleware, corsMiddleware, generalRateLimit, csrfProtection } from "./middleware/security.js";
import { attachUserIfPresent } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { friendsRouter } from "./routes/friends.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { gamesRouter } from "./routes/games.js";
import { invitationsRouter } from "./routes/invitations.js";
import { notificationsRouter } from "./routes/notifications.js";
import { reportsRouter } from "./routes/reports.js";
import { timeControlsRouter } from "./routes/timeControls.js";
import { enginesRouter } from "./routes/engines.js";
import { statsRouter } from "./routes/stats.js";
import { adminRouter } from "./admin/routes.js";
import { registerSockets } from "./sockets/index.js";
import { attachIoForNotifications } from "./sockets/notify.js";

const app = express();

// Trust the first reverse proxy hop (typical for Render/Railway/Fly/behind
// nginx) so `req.secure` / X-Forwarded-* are read correctly for HTTPS
// enforcement and rate limiting by real client IP.
app.set("trust proxy", 1);

app.use(httpsEnforcement);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(attachUserIfPresent);
app.use(generalRateLimit);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// The auth router deliberately does NOT get csrfProtection: register/login/
// forgot-password/reset-password are what ISSUE the CSRF cookie in the
// first place (a brand-new visitor cannot present a token that doesn't
// exist yet), and logout/refresh CSRF'd by a third party is not a
// meaningfully exploitable outcome. Every route below that acts on an
// already-authenticated session is protected.
app.use("/api/auth", authRouter);
app.use("/api/users", csrfProtection, usersRouter);
app.use("/api/friends", csrfProtection, friendsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/games", gamesRouter);
app.use("/api/invitations", csrfProtection, invitationsRouter);
app.use("/api/notifications", csrfProtection, notificationsRouter);
app.use("/api/reports", csrfProtection, reportsRouter);
app.use("/api/time-controls", timeControlsRouter);
app.use("/api/engines", enginesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/admin", csrfProtection, adminRouter);

// Unknown API route.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "This resource does not exist." });
});

// Section 39: never leak stack traces to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigins, credentials: true },
});

attachIoForNotifications(io);
registerSockets(io);

httpServer.listen(config.port, () => {
  console.log(`ChessLA server listening on port ${config.port} (${config.isProduction ? "production" : "development"})`);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
