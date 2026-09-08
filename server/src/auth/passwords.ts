import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A deliberately generous but non-trivial policy: long enough to resist
// guessing, not so strict that it pushes users toward predictable patterns.
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export function isPasswordStrongEnough(plain: string): boolean {
  return PASSWORD_RULE.test(plain);
}
