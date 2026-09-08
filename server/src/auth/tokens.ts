import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config.js";

export type AppRole = "PLAYER" | "MODERATOR" | "ADMIN";

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
  role: AppRole;
}

/** The database stores role as a plain string (SQLite has no native enum
 * type). This is the one place that value is trusted back into the narrow
 * union type, so a corrupted/unexpected value fails safely to the lowest
 * privilege rather than silently widening `role`'s type everywhere. */
export function asAppRole(value: string): AppRole {
  return value === "ADMIN" || value === "MODERATOR" ? value : "PLAYER";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: `${config.jwt.accessTtlMinutes}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Opaque, high-entropy refresh tokens. Only a SHA-256 hash is ever stored, so a
 * leaked database does not hand out usable refresh tokens (mirrors password hashing practice). */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString("hex");
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
