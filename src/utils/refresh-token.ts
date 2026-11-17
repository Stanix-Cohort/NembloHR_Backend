import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a cryptographically secure refresh token.
 *
 * The raw token is returned only once to the client.
 * Never store the raw token in the database.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * Creates a SHA-256 hash of a refresh token.
 *
 * Store this hash in the RefreshSession table,
 * not the original token.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
