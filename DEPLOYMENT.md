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

## What only you can finish

### 1. A real domain and TLS

Buy/point a domain at your hosting provider. Almost every modern host
(Vercel, Netlify, Render, Railway, Fly.io, a VPS behind Caddy/nginx) issues
a free TLS certificate automatically once the domain's DNS points at it —
this app doesn't need to manage certificates itself. Once you're serving
over `https://` in production, set in `server/.env`:

```
FORCE_HTTPS=true
CLIENT_ORIGIN=https://your-real-domain.com
```

This turns on the http→https redirect and HSTS header, and locks CORS/cookies
to your real origin. Leaving `FORCE_HTTPS=false` in development is
intentional — enabling it before you have a certificate would just break
local dev.

**Recommended topology:** serve the client and API from the same domain
(e.g., the API behind `/api` on the same host, via a reverse proxy) so
session cookies stay simple `SameSite=Lax` same-site cookies. If you split
them onto separate subdomains, you'll need `SameSite=None; Secure` cookies
and matching CORS — happy to wire that up if that's the route you take.

### 2. A production database

SQLite is for local development only. Before real users sign up, switch
`server/prisma/schema.prisma`'s datasource to `postgresql` (one line) and
point `DATABASE_URL` at a managed Postgres instance (Neon, Supabase, RDS,
your host's managed offering, etc.), then run `npx prisma migrate deploy`.

### 3. Real secrets

Generate and set in your production environment (never commit these):

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

- [ ] Domain purchased and DNS pointed at your host
- [ ] TLS certificate active (usually automatic once DNS resolves)
- [ ] `FORCE_HTTPS=true` and `CLIENT_ORIGIN` set to the real domain
- [ ] Production Postgres database provisioned and migrated
- [ ] Real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` set
- [ ] Decide on analytics now or later (safe to skip)
- [ ] Decide on Turnstile now or later (honeypot + rate limiting already protect you)
- [ ] SMTP configured so password resets actually arrive by email
