import "dotenv/config";

function required(name: string, fallbackForDev?: string): string {
  const value = process.env[name] ?? fallbackForDev;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`
    );
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

// In production we refuse to boot with placeholder secrets. In development
// we fall back to an insecure default so the app is runnable out of the box,
// but this fallback is intentionally never used once NODE_ENV=production.
export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  forceHttps: process.env.FORCE_HTTPS === "true",
  jwt: {
    accessSecret: isProduction
      ? required("JWT_ACCESS_SECRET")
      : process.env.JWT_ACCESS_SECRET ?? "dev-only-insecure-access-secret",
    refreshSecret: isProduction
      ? required("JWT_REFRESH_SECRET")
      : process.env.JWT_REFRESH_SECRET ?? "dev-only-insecure-refresh-secret",
    accessTtlMinutes: 15,
    refreshTtlDays: 30,
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.EMAIL_FROM ?? "ChessLA <no-reply@chessla.com>",
  },
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
};

if (isProduction && (config.jwt.accessSecret.startsWith("dev-only") || config.jwt.refreshSecret.startsWith("dev-only"))) {
  throw new Error("Refusing to start in production with development JWT secrets.");
}
