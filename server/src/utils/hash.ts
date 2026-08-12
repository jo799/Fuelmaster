import crypto from "node:crypto";

/**
 * SHA-256 hex digest, used for hashing high-entropy generated secrets
 * (refresh tokens, edge-daemon credentials) before storing them. Not for
 * user passwords \u2014 those use bcrypt, since a fast hash is only safe when
 * the underlying secret is already random and long, not something a human
 * chose and that might be brute-forceable.
 */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}