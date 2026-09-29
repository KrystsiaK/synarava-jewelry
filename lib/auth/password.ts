import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/**
 * scrypt with Node defaults (N=16384). Raising N/r/p is a planned follow-up:
 * changing parameters invalidates existing `ADMIN_PASSWORD_HASH` values, so it
 * needs a dual-verify + rehash window rather than a silent hot-fix.
 * @see https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options
 */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}
