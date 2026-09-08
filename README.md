# ChessLA

Real-time multiplayer chess. Think. Play. Conquer.

A full-stack chess platform: server-authoritative game engine, real-time
play over WebSockets, matchmaking by rating, Elo ratings per time control,
friends, chat, game history and replay, leaderboards, and an admin panel.

## Project layout

```
chessla/
  server/   Node + TypeScript + Express + Socket.IO + Prisma (SQLite)
  client/   React + TypeScript + Vite + Tailwind CSS
```

The two are independent npm workspaces tied together by the root
`package.json`. The chess rules engine (`chess.js`) is used identically on
both sides: the server as the sole source of truth, the client only to
highlight legal destination squares.

## Running it locally

Requires Node.js 20+.

```bash
npm install                       # installs both workspaces

cp server/.env.example server/.env
npm run db:migrate                # creates server/prisma/dev.db
npm run db:seed                   # a handful of demo players, e.g. AlexN / Password123

npm run dev:server                # http://localhost:4000
npm run dev:client                # http://localhost:5173, proxies /api and /socket.io to the server
```

Open http://localhost:5173. The dev servers hot-reload on save.

To run the chess-engine and rating test suite:

```bash
npm run test:server
```

To empirically exercise the full live-game path (matchmaking, a scripted
Fool's Mate, checkmate detection, and Elo updates) against a **running** dev
server:

```bash
cd server && npm run verify:live
```

## What's implemented

- **Chess correctness (the top priority):** every rule — castling both
  sides, en passant, all four promotion pieces, check/checkmate/stalemate,
  threefold repetition, the fifty-move rule, insufficient material — is
  enforced by `chess.js` on the server (`server/src/chess/engine.ts`), never
  the client. Covered by an automated test suite
  (`server/src/chess/engine.test.ts`) and verified live end-to-end with two
  real Socket.IO clients (see `verify:live` above).
- **Real-time multiplayer:** Socket.IO, server-side clocks
  (`server/src/game/clock.ts`) immune to client clock manipulation, draw
  offers with a cooldown, resignation, disconnect/reconnect handling with a
  60-second abandonment grace period.
- **Matchmaking:** a per-time-control queue that widens the acceptable
  rating gap the longer someone waits (`server/src/matchmaking`).
- **Accounts and security:** bcrypt password hashing, httpOnly JWT session
  cookies with rotating refresh tokens, double-submit CSRF protection,
  rate limiting, Helmet security headers, zod validation on every mutating
  endpoint (server never trusts client-side validation).
- **Ratings:** a per-time-control Elo implementation
  (`server/src/rating/elo.ts`), with unit tests.
- **Full app:** landing page, auth (register/login/forgot/reset password),
  dashboard, quick match / play-a-friend / create-private-game, the live
  game screen (board, clocks, move list, chat, draw/resign), game history
  and move-by-move replay with a material-balance indicator, profiles,
  friends, a global/country/friends leaderboard, settings (board theme,
  orientation, sound/animation toggles, account, privacy), and an admin
  panel (users, reports, suspicious-activity flags, audit log).
- **Anti-cheat (first line of defense):** inline move-timing heuristics
  flag inhumanly fast or suspiciously uniform play for moderator review
  (`server/src/anticheat/heuristics.ts`). This is not a substitute for a
  full offline statistical/engine-correlation detector — see "Not built"
  below.
- **Compliance/SEO groundwork:** real Privacy Policy and Terms pages
  describing this app's actual data practices, a cookie consent banner that
  gates analytics loading, a custom 404 page, `robots.txt` and
  `sitemap.xml`, Open Graph/Twitter meta tags, a generated favicon set and
  social preview image (hand-authored SVG rasterized at build time — no
  stock or AI-generated imagery), semantic color tokens with a light and
  dark theme, keyboard-navigable and screen-reader-labeled controls.

## What's intentionally not built yet

Being upfront about this matters more than pretending it's all done:

- **Deep game analysis.** The replay view shows a real material-balance bar
  (piece count, not a search-based evaluation) rather than fabricating
  blunder/best-move detection. Wiring in a real engine (e.g., Stockfish
  compiled to WASM, run in a Web Worker) is the natural next step for
  section 25 of the spec.
- **Full statistical anti-cheat.** The inline heuristics catch obviously
  abnormal timing; they are not the offline, engine-correlation-based
  detection that large chess sites run over completed games.
- **Live deployment.** This has been built and verified locally. Going live
  needs your decisions on hosting and a domain — see `DEPLOYMENT.md`.
- **Real third-party accounts.** Analytics (Plausible/GA4), CAPTCHA
  (Cloudflare Turnstile), and outbound email (SMTP) are all wired up and
  will work the moment you add real credentials to `.env` — none are
  invented or hardcoded, and the app runs fully without them (analytics
  simply never loads; password reset links are logged to the server
  console instead of emailed).

## Database

SQLite for local development (`server/prisma/dev.db`, gitignored). The
schema (`server/prisma/schema.prisma`) uses only types Postgres supports
identically, so moving to Postgres for production is:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

followed by `npx prisma migrate deploy` against the new database.
