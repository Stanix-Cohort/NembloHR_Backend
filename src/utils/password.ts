import argon2 from "argon2";

/**
 * Hashes a plain-text password using Argon2id.
 *
 * Only the resulting hash should be stored in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verifies a plain-text password against its stored hash.
 *
 * Returns true when the password matches, otherwise false.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}
