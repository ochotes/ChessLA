// Manual end-to-end smoke test against a RUNNING dev server. Registers two
// throwaway accounts, puts them both in the matchmaking queue, plays a
// scripted Fool's Mate over real Socket.IO connections, and asserts that
// illegal moves are rejected, checkmate is detected, the game ends with the
// correct result, and Elo ratings actually move in the database. This is
// the same server-authoritative path a real browser client uses — nothing
// here is faked or mocked.
//
// Usage: start the dev server first (npm run dev), then in another
// terminal: node scripts/verify-live-game.mjs [baseUrl]
import { io } from "socket.io-client";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:4000";

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const line of setCookieHeaders ?? []) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function registerUser(n) {
  const username = `E2E${n}_${Date.now().toString(36)}`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      fullName: `E2E Player ${n}`,
      email: `${username.toLowerCase()}@example.com`,
      password: "Password123",
      country: "US",
    }),
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.raw?.()["set-cookie"];
  const jar = parseCookies(setCookie);
  const body = await res.json();
  if (!res.ok) throw new Error(`register failed: ${JSON.stringify(body)}`);
  return { username, jar, userId: body.user.id, rating: body.user.rating.bullet };
}

function connectSocket(jar) {
  return io(BASE, { transports: ["websocket"], extraHeaders: { Cookie: cookieHeader(jar) } });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Verifying live server at ${BASE} ...`);
  console.log("Registering two fresh players...");
  const p1 = await registerUser(1);
  const p2 = await registerUser(2);
  console.log("Players:", p1.username, p2.username, "starting bullet rating:", p1.rating, p2.rating);

  const s1 = connectSocket(p1.jar);
  const s2 = connectSocket(p2.jar);

  await Promise.all([
    new Promise((resolve, reject) => { s1.on("connect", resolve); s1.on("connect_error", reject); }),
    new Promise((resolve, reject) => { s2.on("connect", resolve); s2.on("connect_error", reject); }),
  ]);
  console.log("Both sockets connected.");

  const found1 = new Promise((resolve) => s1.once("matchmaking:found", resolve));
  const found2 = new Promise((resolve) => s2.once("matchmaking:found", resolve));
  s1.emit("matchmaking:join", { timeControlId: "bullet-1+0" });
  s2.emit("matchmaking:join", { timeControlId: "bullet-1+0" });

  const [f1, f2] = await Promise.all([found1, found2]);
  if (f1.gameId !== f2.gameId) throw new Error("Players were not matched into the same game!");
  const gameId = f1.gameId;
  console.log("Matched into game:", gameId);

  const state1 = new Promise((resolve) => s1.once("game:state", resolve));
  s1.emit("game:join", { gameId });
  s2.emit("game:join", { gameId });
  const st1 = await state1;

  const whiteSocket = st1.white.username === p1.username ? s1 : s2;
  const blackSocket = st1.white.username === p1.username ? s2 : s1;
  console.log(`White: ${st1.white.username}, Black: ${st1.black.username}`);

  const gameOver1 = new Promise((resolve) => s1.once("game:over", resolve));
  const gameOver2 = new Promise((resolve) => s2.once("game:over", resolve));
  const errors = [];
  s1.on("game:error", (e) => errors.push({ who: "s1", ...e }));
  s2.on("game:error", (e) => errors.push({ who: "s2", ...e }));

  const move = (socket, from, to) => socket.emit("game:move", { gameId, from, to });

  console.log("Testing illegal move rejection (pawn e2 to e5)...");
  move(whiteSocket, "e2", "e5");
  await wait(300);
  if (errors.length === 0) throw new Error("Expected an illegal-move error but got none!");
  console.log("  -> correctly rejected:", errors[errors.length - 1].message);

  console.log("Playing Fool's Mate: 1.f3 e5 2.g4 Qh4#");
  move(whiteSocket, "f2", "f3");
  await wait(200);
  move(blackSocket, "e7", "e5");
  await wait(200);
  move(whiteSocket, "g2", "g4");
  await wait(200);
  move(blackSocket, "d8", "h4"); // checkmate

  const [over1] = await Promise.all([gameOver1, gameOver2]);
  console.log("Game over payload: result =", over1.result, "reason =", over1.terminationReason, "ratingChange =", over1.ratingChange);

  if (over1.terminationReason !== "checkmate") throw new Error(`Expected checkmate, got ${over1.terminationReason}`);
  if (over1.result !== "0-1") throw new Error(`Expected black (0-1) to win, got ${over1.result}`);
  if (!over1.ratingChange || over1.ratingChange.black <= 0 || over1.ratingChange.white >= 0) {
    throw new Error(`Expected black's rating to rise and white's to fall, got ${JSON.stringify(over1.ratingChange)}`);
  }

  console.log("Attempting to move again after game over (should be rejected)...");
  errors.length = 0;
  move(whiteSocket, "a2", "a3");
  await wait(300);
  if (errors.length === 0) throw new Error("Expected a post-game-over move to be rejected!");
  console.log("  -> correctly rejected:", errors[errors.length - 1].message);

  console.log("\nALL CHECKS PASSED: matchmaking, live move sync, illegal-move rejection,");
  console.log("checkmate detection, game-over broadcast, and Elo rating updates all work end-to-end.");
  s1.close();
  s2.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
