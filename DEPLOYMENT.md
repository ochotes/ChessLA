# Going live

You asked not to launch until specific things are in place. Here is exactly
what ChessLA already does, and what only you can finish (an account,
a domain, a hosting decision — nothing this build can do on its own).

## Already done in the code

- [x] Skeleton loaders instead of spinners (`client/src/components/ui/Skeleton.tsx`)
- [x] Semantic color tokens, no raw hex in components (`client/src/styles/tokens.css`)
- [x] Privacy Policy and Terms pages describing this app's real behavior
- [x] Secrets are server-only — `server/.env` (gitignored) holds JWT secrets,
      SMTP credentials, and the Turnstile secret key. The client bundle only
      ever contains `VITE_`-prefixed *public* values (see `client/.env.example`)
- [x] HTTPS-redirect middleware and HSTS header, gated behind `FORCE_HTTPS=true`
      (`server/src/middleware/security.ts`) — see below for why it's off by default
- [x] Cookie consent banner gating analytics (`client/src/components/CookieConsent.tsx`)
- [x] Meta titles/descriptions per page (`usePageMeta` hook), Open Graph + Twitter cards
- [x] Social preview image generated from hand-authored SVG, not AI art
      (`client/scripts/generate-seo-assets.mjs` → `client/public/social-preview.png`)
- [x] Favicon set (svg + 16/32/192/512 png + apple-touch-icon), same script
- [x] `sitemap.xml` and `robots.txt` for the public marketing pages
- [x] Alt text on meaningful images/icons; decorative icons marked `aria-hidden`
- [x] All artwork is SVG (vector, tiny, nothing to compress) — no raster images to bloat load time
- [x] Custom 404 page (`client/src/pages/NotFoundPage.tsx`)
- [x] Mobile-first responsive layout, bottom nav on small screens
- [x] Form validation client-side (instant feedback) and server-side via zod
      (authoritative — the client-side checks are a courtesy, never trusted)
- [x] Spam protection: honeypot fields on register/forgot-password, rate
      limiting on all auth endpoints, and a ready (optional) Cloudflare
      Turnstile slot — see below to activate it
- [x] No purple gradients, no pill buttons, no fake reviews, no fake metrics,
      no vague hero copy, no emoji icons, no em dashes, minimal animation, no
      cursor-follow effects, no fake counters — the landing page's player/game
      counts are live `SELECT COUNT(*)` queries (`server/src/routes/stats.ts`),
      and will honestly show small numbers until you have real users
- [x] No "made with AI" watermark exists anywhere in this codebase

## Two things worth knowing before you pick a host

**ChessLA keeps live state in server memory, not the database.** Active
games, their clocks, and the matchmaking queue live in the running
process (`GameManager`, `MatchmakingQueue`) — only completed moves and
finished games are persisted. This means your hosting plan **must be
always-on**, never a free "sleeps when idle" tier. If the process restarts
between requests, every in-progress game is silently lost. This is the
main reason the Render setup below specifies Render's smallest always-on
plan (`0.5c-512mb`, ~$7/month, called "Starter" in Render's dashboard)
rather than the free one — expect a real, if modest, monthly hosting cost.

**`chessla.com` is not available.** I checked directly against the .com
registry: it's been registered since 2009 and currently sits parked on
GoDaddy's Afternic resale platform — not obtainable through normal
registration, only by making an offer to the current owner. `chessla.io`
and `chessla.app` both look taken too. Options: make an offer via Afternic
for the parked domain, or register a different name/TLD outright (e.g. a
different word order, a `.gg`/`.dev`/`.app` suffix, or dropping/adding a
word). Whichever you land on, the domain is referenced in a handful of
places once you're ready to swap the placeholder — see the checklist below.

## What only you can finish

### 1. A real domain, then point it at your host

Once you own a real domain, follow your registrar's instructions to add a
`CNAME` (or `A` record, depending on the host) pointing it at your hosting
provider. Render, Railway, Fly.io, and most others issue a free TLS
certificate automatically once DNS resolves — nothing in this app manages
certificates itself. Then set in your host's environment variables:

```
FORCE_HTTPS=true
CLIENT_ORIGIN=https://your-real-domain.com
```

This turns on the http→https redirect and HSTS header, and locks CORS/cookies
to your real origin. Leaving `FORCE_HTTPS=false` in development is
intentional — enabling it before you have a certificate would just break
local dev.

The client and API are already served from the same origin in production
(`server/src/index.ts` serves the built `client/dist` directly, and the
client only ever calls relative `/api` and `/` paths) — so this is one
domain, one deploy, no cross-origin cookie complications.

Once you have a real domain, update these placeholder `chessla.com`
references (all currently using it as an honest placeholder, not a live
value):

- [ ] `client/index.html` — canonical URL, Open Graph tags
- [ ] `client/public/robots.txt` and `client/public/sitemap.xml`
- [ ] `client/src/pages/PrivacyPage.tsx` and `TermsPage.tsx` — contact references
- [ ] `server/src/config.ts` — the `EMAIL_FROM` fallback address
- [ ] `render.yaml` — nothing hardcoded there; `CLIENT_ORIGIN` is set via the dashboard

### 2. Hosting: a ready-to-use Render Blueprint

`render.yaml` at the repo root defines everything: a single always-on web
service that builds and serves both the client and API, plus a 1GB
persistent disk holding the SQLite database file so it survives restarts
and redeploys. To use it:

1. Push this repo to GitHub (already done).
2. In the Render dashboard: **New → Blueprint**, point it at this repo.
   Render reads `render.yaml` and provisions the service and disk.
3. Fill in the environment variables marked "set during deploy" in Render's
   UI: `CLIENT_ORIGIN` (your real domain), and optionally `EMAIL_FROM`,
   `SMTP_*`, `TURNSTILE_SECRET_KEY`. `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
   are generated automatically by the blueprint — you never have to
   generate or paste those yourself.
4. Deploy. The start command runs `prisma migrate deploy` before booting,
   so the database schema is always current.
5. In Render's service settings, add your custom domain and follow the DNS
   instructions it gives you.

This was verified locally end-to-end before writing it up: production
build, `prisma migrate deploy` against a fresh database, the server
booting with `NODE_ENV=production`, the built client served correctly
(including client-side route refreshes), and a real registration request
round-tripping through the database — all passed.

**Not using Render?** The same topology (one always-on Node process,
`npm run build` then `npm start`, a persistent volume for the SQLite file)
works on Railway or Fly.io with their equivalent config formats — ask and
I'll translate `render.yaml` if you'd rather use one of those.

If you outgrow single-writer SQLite later: switch
`server/prisma/schema.prisma`'s datasource to `postgresql` (one line),
point `DATABASE_URL` at a managed Postgres instance (Neon, Supabase, your
host's managed offering, etc.), and run `npx prisma migrate deploy` — every
field type already used here is Postgres-compatible unchanged.

### 3. Real secrets

Already handled if you're using the Render Blueprint above — skip this.
On any other host, generate and set these yourself in your production
environment (never commit them):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use a fresh one each for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. The
server refuses to boot in production with the development placeholder
secrets, by design.

### 4. Analytics (optional, off by default)

Pick a provider — Plausible (privacy-first, no cookie banner legally
required in most cases) or GA4 are both wired up already
(`client/src/lib/analytics.ts`). Once you have an account:

```
# client/.env.local (or your host's env var UI)
VITE_ANALYTICS_PROVIDER=plausible   # or "ga4"
VITE_ANALYTICS_ID=your-real-id
```

Nothing loads until a visitor accepts the cookie banner *and* this is set —
so it's safe to leave blank indefinitely.

### 5. Spam protection (optional upgrade)

The honeypot + rate limiting is real and active today. If you want a second
layer, sign up for Cloudflare Turnstile (free) and set:

```
# server/.env
TURNSTILE_SECRET_KEY=...
# client/.env.local
VITE_TURNSTILE_SITE_KEY=...
```

then wire the widget into the register/login forms (currently structured to
receive it, not yet rendered — ask and I'll finish this wiring once you have
real keys, so nothing fake ships in the meantime).

### 6. Outbound email

Password reset currently logs the reset link to the server console in
development. For real email delivery, set `SMTP_HOST` / `SMTP_PORT` /
`SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` in `server/.env` (any standard SMTP
provider — Postmark, SES, Resend's SMTP endpoint, etc.).

### 7. Custom favicon / branding decisions

The current mark (an abstract knight's-move glyph) is original, hand-coded
SVG — not AI-generated, not a licensed icon pack. If you'd rather use a
different mark before launch, swap `client/public/favicon.svg` and
`client/src/components/Logo.tsx`, then re-run:

```bash
cd client && node scripts/generate-seo-assets.mjs
```

to regenerate every derived size and the social preview image.

## Before you flip the switch

- [ ] A real domain secured — `chessla.com` is taken; pick an alternative
      or pursue buying the parked one (see above)
- [ ] Hosting plan is always-on, not a free/sleep-when-idle tier (required —
      see "live state lives in memory" above)
- [ ] Domain's DNS pointed at your host
- [ ] TLS certificate active (usually automatic once DNS resolves)
- [ ] `FORCE_HTTPS=true` and `CLIENT_ORIGIN` set to the real domain
- [ ] Persistent disk attached for the SQLite file (handled by `render.yaml`
      if using Render's Blueprint) — or migrated to Postgres
- [ ] Real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` set (automatic with
      the Render Blueprint)
- [ ] The `chessla.com` placeholder references updated to your real domain
      (see the checklist in section 1 above)
- [ ] Decide on analytics now or later (safe to skip)
- [ ] Decide on Turnstile now or later (honeypot + rate limiting already protect you)
- [ ] SMTP configured so password resets actually arrive by email
